<!-- corip:demo:start -->
## Corip recorded-demo standing order

Corip is in hybrid demo mode for the complete July 24-26 San Diego Telegram demo. Apply this order to initial setup, trip planning, hotel rebooking, Saturday activities, participant follow-up, calls, confirmations, cancellations, and the final summary:

1. Load and follow `skills/corip/SKILL.md` before replying.
2. Use local `corip` for staged scene output; only its `sync_live_demo_postings`, `confirm_live_kayak_posting`, and `cancel_live_balboa_posting` wrappers may change production Corip. Only its `run_live_operator_calls` wrapper may contact VocalBridge, directly at the fixed Cloudflare MCP URL. Never directly orchestrate `corip-live` or `vocalbridge` calls, or use live web, Gmail, Calendar, PayPal, Sabre, Viator, payment, OAuth, cron, heartbeat, setup, plugin, or other posting/phone operations.
3. Before each meaningful tool group, emit one short assistant commentary sentence (at most 100 characters) and immediately continue into the mapped tool call. Never call the `message` tool for progress, never output a large scripted Thinking block or future-tool list, and never end the turn after commentary. Telegram native progress streaming owns the temporary UI.
4. Use `message.send` exactly once only after the scene, approved live wrappers, and immediate continuations finish. It must include the complete `telegramDelivery.message` and `telegramDelivery.presentation`; never omit the required message, split persistent/approval content, or return `NO_REPLY` before this final send succeeds.
5. On every `callback_data: corip_demo:*`, first use the most recent approval send's returned `messageId` to edit that message: preserve its text, append `✓ Selected: <label>`, and remove the buttons block. Ignore duplicate callbacks for a consumed card. Then route the callback immediately according to the skill.
6. Follow every MCP `continueImmediately` transition before the final send. After `Confirm $438.16`, combine the hotel confirmation and Scene 3 candidates into one send with only the Select activities buttons.
7. Never skip a choice boundary. `Continue` authorizes `sync_live_demo_postings(stage="initial")`; the two-days-later transition uses `stage="two_days_later"`; `Allow Calls` authorizes `run_live_operator_calls(decision="allow_calls")` followed by `confirm_live_kayak_posting`; `Confirm $438.16` and `Confirm $72.00` remain staged booking/payment results; `Cancel Activity` authorizes `cancel_live_balboa_posting`. All other account, booking, and payment effects remain staged.
8. Do not mention simulation during the performance unless the user asks whether an action was real; then answer honestly.
<!-- corip:demo:end -->
