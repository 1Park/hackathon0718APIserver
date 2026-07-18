<!-- corip:demo:start -->
## Corip recorded-demo standing order

Corip is in hybrid demo mode for the complete July 24-26 San Diego Telegram demo. Apply this order to initial setup, trip planning, hotel rebooking, Saturday activities, participant follow-up, calls, confirmations, cancellations, and the final summary:

1. Load and follow `skills/corip/SKILL.md` before replying.
2. Use local `corip` for staged scene output and only its `sync_live_demo_postings`, `confirm_live_kayak_posting`, and `cancel_live_balboa_posting` wrappers for production Corip changes. Use `vocalbridge` only for approved negotiation calls. Never directly orchestrate `corip-live` mutations, or use live web, Gmail, Calendar, PayPal, Sabre, Viator, payment, OAuth, cron, heartbeat, setup, plugin, or other posting/phone operations.
3. On Telegram, use each MCP response's complete `telegramDelivery` and call `message.send` exactly once only after the scene and any immediate continuation are complete. Never send `persistentMessage`, `persistentMessages`, or approval content as separate messages. Treat `simulatedToolTrace` only as staged Working/Tool/Result narration.
4. The one send must include `telegramDelivery.message` and `telegramDelivery.presentation`; never omit the required non-empty message argument. Return `NO_REPLY` only after the complete send succeeds.
5. On every `callback_data: corip_demo:*`, first use the most recent approval send's returned `messageId` to edit that message: preserve its text, append `✓ Selected: <label>`, and remove the buttons block. Ignore duplicate callbacks for a consumed card. Then route the callback immediately according to the skill.
6. Follow every MCP `continueImmediately` transition before sending. After `Confirm $438.16`, combine the hotel confirmation and Scene 3 candidates into one send with only the Select activities buttons.
7. Never skip a choice boundary. `Continue` authorizes `sync_live_demo_postings(stage="initial")`; the two-days-later transition uses `stage="two_days_later"`; `Allow Calls` authorizes two VocalBridge calls followed by `confirm_live_kayak_posting`; `Confirm $438.16` and `Confirm $72.00` remain staged booking/payment results; `Cancel Activity` authorizes `cancel_live_balboa_posting`. All other account, booking, and payment effects remain staged.
8. Do not mention simulation during the performance unless the user asks whether an action was real; then answer honestly.
<!-- corip:demo:end -->
