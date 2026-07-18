---
name: corip
description: Run the complete Corip Personal Agent Telegram demo for Scenes 1 through 6, using scripted Corip/GET/account/booking results while performing only one approved Kayak VocalBridge negotiation call. Use for the supplied Corip setup URL, Plan a trip for this weekend, any demo button callback, or any Scene 1-6 request during the recorded demo.
---

# Corip hybrid demo

Run a deterministic presentation with one narrowly scoped live effect: approved VocalBridge negotiation calls only.

## Non-negotiable demo rules

1. Use `corip` for staged scene output. The `confirm_shared_uber` tool contains the single approved Kayak VocalBridge call and connects directly to the fixed VocalBridge MCP URL. Never call a real Corip server or perform Corip create/join/search/confirm/delete operations. Do not directly orchestrate a separate `vocalbridge` namespace. Do not browse, inspect Gmail, charge money, alter a real calendar, create real cron jobs, open OAuth pages, or call PayPal, Sabre, Viator, or any other live connector.
2. Before every meaningful tool group, emit one brief assistant commentary update of one sentence and at most 100 characters, such as `Checking your confirmed reservations…`. This is a non-terminal progress update: the very next action must be the mapped MCP tool call, never a final response or `NO_REPLY`.
3. Never use the `message` tool for Thinking, Working, status, or tool-progress output. Native Telegram progress streaming renders commentary and tool calls in a temporary preview while the same agent turn continues. Do not emit `⏳ Working…`, headings, a list of future tools, simulated results, or a large prewritten Thinking block.
4. Use `message.send` exactly once only after the scene action, approved live wrappers, and immediate continuations all finish. Send the response's complete `telegramDelivery.message` and `telegramDelivery.presentation`, including all persistent text and the next approval buttons. Return `NO_REPLY` only after this final send succeeds.
5. When interactive buttons are unavailable, render the exact labels as bracketed choices. Do not turn the choice into a generic prose question.
6. Treat `callback_data: corip_demo:<value>` as the user's selection. Before any next MCP call, consume the most recent approval card: find the `messageId` returned by the most recent successful approval `message.send`, then call `message` action `edit` on that message with the same text plus `\n\n✓ Selected: <button label>` and a presentation containing text only—no buttons block. This removes the inline keyboard. Then call the mapped MCP tool in the same turn. Do not ask the user to repeat the label. Ignore duplicate callbacks for an already consumed card with `NO_REPLY`.
7. When an MCP response includes `continueImmediately`, do not send its `telegramDelivery` yet. Emit at most one new short commentary update if the work stage materially changes, call the named Corip demo tool in the same turn, combine both deliveries' text in order, attach only the last approval button block, and send once after the continuation chain ends. This is mandatory after `confirm_hotel_rebooking`, which flows directly into Scene 3.
8. Never skip approval boundaries. Do not perform a Corip POST or VocalBridge call until its matching scripted button is selected. The initial setup and email/Sabre/payment results remain staged.
9. Do not mention the retired production workflow, plugin implementation, trust policy, or real cron/heartbeat state during the performance.

Read [references/demo-script.md](references/demo-script.md) only when exact full-scene wording or transition troubleshooting is needed.

## Scene routing

Use this exact state transition table:

| User intent or callback | MCP tool | Required output |
| --- | --- | --- |
| `Set up Corip skills based on https://corip-postings-kimmc3423.fly.dev/mcp` | `begin_initial_setup(url="https://corip-postings-kimmc3423.fly.dev/mcp")` | Simulated inspection trace, Connect Corip MCP buttons |
| `corip_demo:always_allow_corip` or `Always Allow Corip` | `connect_corip(decision="always_allow_corip")` | Simulated connection/skill trace, connected message, Gmail buttons |
| `corip_demo:allow_travel_emails` or `Allow Travel Emails` | `enable_travel_email_workflow(decision="allow_travel_emails")` | Simulated Gmail/8 AM cron trace, email message, Sabre card |
| `corip_demo:open_sabre_setup` or first `Open Setup Page` | `complete_sabre_setup(decision="open_sabre_setup")` | Simulated Sabre OAuth, connected message, VocalBridge card |
| `corip_demo:open_vocalbridge_setup` or second `Open Setup Page` | `complete_vocalbridge_setup(decision="open_vocalbridge_setup")` | Simulated VocalBridge setup and complete setup summary |
| `Plan a trip for this weekend and make the necessary reservations.` | `review_trip_request` | Simulated review, urgent-issue message first, then balance-check buttons in the same delivery |
| `corip_demo:allow_balance_once` or the Scene 2 `Allow Once` | `check_balance_and_find_hotel(decision="allow_balance_once")` | Simulated balance/hotel search, then rebooking buttons without repeating the urgent issue |
| `corip_demo:confirm_438_16` or `Confirm $438.16` | `confirm_hotel_rebooking(amount=438.16)`, then immediately `get_saturday_candidates` | Hotel confirmation, then Scene 3 candidates and Select activities buttons in the same turn |
| Research Saturday activities; start Scene 3 | `get_saturday_candidates` | Candidate message, then Select activities buttons |
| `corip_demo:continue` or `Continue` | `register_saturday_plan(selection="all")` | Scripted registered plan and reservation status |
| Two days later; participant follow-up; `Go ahead with La Jolla Kayak negotiation`; `phone call to kayak tour`; `go ahead with Uber confirm`; `confirmed?` after Scene 4 | `get_participant_status` | Scripted attention message, then bundled Uber-confirm/Kayak-call approval buttons |
| `corip_demo:confirm_uber_15_50` or `Confirm up to $15.50` | `confirm_shared_uber(amount=15.5)` | In one tool: staged Uber confirmation, one real Kayak call, combined results, then Kayak final confirm/pay buttons |
| `corip_demo:allow_calls` or `Allow Call` from an already displayed legacy card | `complete_operator_calls(decision="allow_calls")` | Backward-compatible one real Kayak call, then Kayak final confirm/pay buttons |
| `corip_demo:confirm_72` or `Confirm $72.00` | `confirm_kayak_tour(amount=72)` | Human-approved staged confirmation/payment, then Balboa Park decision buttons |
| `corip_demo:cancel_balboa` or `Cancel Activity` | `cancel_balboa_activity(decision="cancel_activity")` | Scripted cancellation trace and message |
| Final trip summary; Scene 6 | `get_final_trip_summary` | Exact Saturday section and completed-actions list |

Use callback values instead of ambiguous labels whenever possible. The two `Open Setup Page` labels route according to the current scene; the Scene 2 `Allow Once` routes to the balance check, not the earlier Corip or Gmail choice.

After Scene 4, never refuse a request for Kayak negotiation, a Kayak phone call, participant follow-up, or Uber confirmation on the grounds that it is “not yet” available. Those intents explicitly advance to `get_participant_status` and the bundled approval card.

For `Not Now`, `Cancel`, `Edit Selection`, `Deny`, `Edit Limits`, `Decline`, `Keep Recruiting`, `Search Alternatives`, or any unimplemented alternate branch, acknowledge the selection briefly and stop. Do not invent a branch.

## Final confirmation and payment rule

Reaching the required participant count means `ready for final confirmation`, never automatic reservation or payment. Show a persistent human approval card containing the exact activity, date/time, participant count, price or maximum charge, cancellation terms when known, and a confirm-and-pay button. Do not show the scripted booking/payment trace before that button. In this demo, Uber reaches 4/4 and uses `Confirm up to $15.50`; Kayak becomes eligible through the operator’s merged departure and uses `Confirm $72.00`; Balboa remains 2/6 and must not show a payment approval.

## Corip is fully scripted

All Corip searches, participant counts, joins, creates, confirmations, cancellations, publishing, and website changes are script fixtures. Do not connect to `https://corip-postings-kimmc3423.fly.dev/mcp` after the initial staged setup message, and do not retry a missing Corip tool. The fixed scene tools already contain every result needed for the performance.

## Live VocalBridge calls

The `Confirm up to $15.50` card explicitly authorizes both the staged Uber reservation/payment and one Kayak operator call. After that callback, call only `confirm_shared_uber(amount=15.5)`. That tool connects directly to `https://extent-prospective-ext-condition.trycloudflare.com/mcp`, invokes `negotiate_reservation` exactly once for Kayak, and returns the combined Uber confirmation, scripted Kayak result, and `Confirm $72.00` card in one response. Do not wait for another user message and do not show a second call-approval card.

Kayak: country `United States`; city `San Diego`; location `La Jolla Shores`; activity_date `2026-07-25 09:00`; min_participants `4`; current_participants `3`; provider_phone `+1-619-555-0147`.

Never call VocalBridge for Balboa. Its participant status, alternative availability, and cancellation path remain scripted. The current VocalBridge server deliberately dials its fixed demo override number; `provider_phone` is required activity context. Do not separately call a `vocalbridge` namespace: `confirm_shared_uber` owns the direct Kayak call. Display the canonical scripted Kayak result regardless of returned wording, but report a real call failure instead of falsely claiming completion.

## Persistent button cards

The MCP already composes the final object. Send it only after all work is complete, without splitting or rewriting:

```json
{
  "action": "send",
  "message": "<telegramDelivery.message>",
  "presentation": "<telegramDelivery.presentation>"
}
```

Never omit `message`; Telegram rejects presentation-only sends. Record the returned `messageId` as the current approval message when `telegramDelivery.approvalMessage` is true. Once a button is clicked, edit that exact message to remove its buttons, emit the next short commentary update, and continue with the mapped tool call in the same turn.

## Demo truth boundary

HTTP setup, Corip, Skills, Cron, Memory, Calendar, PayPal, Sabre, Viator, Gmail, OAuth, reservation, payment, and notification results are staged fixtures. Only the Kayak VocalBridge negotiation call is real. Never broaden live effects beyond that one call. If asked whether an action was real, describe this boundary honestly.
