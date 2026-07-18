---
name: corip
description: Run the complete hybrid Corip Personal Agent Telegram demo for Scenes 1 through 6, using scripted GET/account/booking results while performing approved production Corip posting mutations and approved VocalBridge negotiation calls. Use for the supplied Corip setup URL, Plan a trip for this weekend, any demo button callback, or any Scene 1-6 request during the recorded demo.
---

# Corip hybrid demo

Run a deterministic presentation with narrowly scoped live effects: Corip production posting mutations and VocalBridge negotiation calls only.

## Non-negotiable demo rules

1. Use `corip` for staged scene output, its deterministic live-posting wrappers, and its `run_live_operator_calls` wrapper. The latter connects directly to the fixed VocalBridge MCP URL. Do not directly orchestrate individual `corip-live` or `vocalbridge` calls. Do not browse, inspect Gmail, charge money, alter a real calendar, create real cron jobs, open OAuth pages, or call PayPal, Sabre, Viator, or any other live connector.
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
| `corip_demo:continue` or `Continue` | `sync_live_demo_postings(stage="initial")`, then `register_saturday_plan(selection="all")` | Real website sync, then working trace, registered plan, reservation status |
| Two days later; check participants; continue Scene 5 | `sync_live_demo_postings(stage="two_days_later")`, then `get_participant_status` | Real website count sync, then status trace, attention message, Allow outbound calls buttons |
| `corip_demo:allow_calls` or `Allow Calls` | `run_live_operator_calls(decision="allow_calls")`, `confirm_live_kayak_posting`, then `complete_operator_calls(decision="allow_calls")` | Two direct real calls/vendor confirmation, then call results and Confirm kayak tour buttons |
| `corip_demo:confirm_72` or `Confirm $72.00` | `confirm_kayak_tour(amount=72)` | Reservation trace, kayak confirmation, Balboa Park decision buttons |
| `corip_demo:cancel_balboa` or `Cancel Activity` | `cancel_live_balboa_posting`, then `cancel_balboa_activity(decision="cancel_activity")` | Real website deletion, then cancellation trace and cancellation message |
| Final trip summary; Scene 6 | `get_final_trip_summary` | Exact Saturday section and completed-actions list |

Use callback values instead of ambiguous labels whenever possible. The two `Open Setup Page` labels route according to the current scene; the Scene 2 `Allow Once` routes to the balance check, not the earlier Corip or Gmail choice.

For `Not Now`, `Cancel`, `Edit Selection`, `Deny`, `Edit Limits`, `Decline`, `Keep Recruiting`, `Search Alternatives`, or any unimplemented alternate branch, acknowledge the selection briefly and stop. Do not invent a branch.

## Live Corip posting mutations

Use only the following local `corip` wrapper tools. Each wrapper talks to the production Corip MCP and restricts deletion or replacement to records owned by the fixed `corip-telegram-demo-*` agent IDs. Keep displayed GET results scripted. Do not replace these wrappers with a sequence of direct `corip-live` calls.

### After Continue

After `Continue` and before `register_saturday_plan`, call `sync_live_demo_postings(stage="initial")`. It deletes/recreates only the three owned demo records and makes these exact production website states:

- Kayak: `type=tour`, title `La Jolla Sea Caves Kayak Tour`, country `United States`, city `San Diego`, place `La Jolla Shores`, date `2026-07-25`, time `09:00`, `minPeople=4`, `maxPeople=4`, price `69`, owner `corip-telegram-demo-kayak-owner`.
- Shared Uber: `type=taxi`, title `Shared Uber to La Jolla`, country `United States`, city `San Diego`, departure `Hilton San Diego Bayfront`, destination `La Jolla Shores`, date `2026-07-25`, time `07:45`, `minPeople=4`, `maxPeople=4`, price `15.5`, owner `corip-telegram-demo-uber-owner`.
- Balboa: `type=leisure`, title `Balboa Park Food & Photo Walk`, description from the canonical script, country `United States`, city `San Diego`, place `Balboa Park Visitors Center`, date `2026-07-25`, time `14:30`, `minPeople=6`, `maxPeople=8`, price `45`, owner `corip-telegram-demo-balboa-owner`.

- Kayak: 3/4. The owner is participant 1; the wrapper adds `kayak-member-1` and `corip-demo-user`.
- Shared Uber: 4/4. The owner is participant 1; the wrapper adds `uber-member-1`, `uber-member-2`, and `corip-demo-user`.
- Balboa: 1/6 from the automatically counted owner, with no extra join.

### Two days later

Before `get_participant_status`, call `sync_live_demo_postings(stage="two_days_later")`. This recreates only the owned Balboa record and adds `corip-demo-user` to the automatically counted owner, producing the scripted 2/6 website state without inflating reruns.

### After actual calls

After the kayak VocalBridge call succeeds, call `confirm_live_kayak_posting`. It locates the owned kayak record and performs the production vendor-confirm POST with source `vocal_bridge` and the merged-departure note.

### Cancel Activity

Before showing the cancellation result, call `cancel_live_balboa_posting`. It deletes only records owned by `corip-telegram-demo-balboa-owner`; no record found is a successful idempotent rerun.

## Live VocalBridge calls

After `Allow Calls`, call `run_live_operator_calls(decision="allow_calls")`. This local wrapper connects directly to `https://extent-prospective-ext-condition.trycloudflare.com/mcp` and invokes `negotiate_reservation` twice with all seven required fields exactly:

1. Kayak: country `United States`; city `San Diego`; location `La Jolla Shores`; activity_date `2026-07-25 09:00`; min_participants `4`; current_participants `3`; provider_phone `+1-619-555-0147`.
2. Balboa: country `United States`; city `San Diego`; location `Balboa Park Visitors Center`; activity_date `2026-07-25 14:30`; min_participants `6`; current_participants `2`; provider_phone `+1-619-555-0182`.

The current VocalBridge server deliberately dials its fixed demo override number; `provider_phone` is required activity context. Do not separately call a `vocalbridge` namespace: the wrapper owns the direct connection and both calls. Display the canonical scripted call results regardless of returned wording, but report a real call failure instead of falsely claiming completion.

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

HTTP setup, Skills, Cron, Memory, Calendar, PayPal, Sabre, Viator, Gmail, OAuth, reservation, payment, and notification results are staged fixtures. Corip production posting mutations and VocalBridge negotiation calls are real. Never broaden live effects beyond those two MCPs. If asked whether an action was real, describe this boundary honestly.
