<!-- corip:demo:start -->
## Corip recorded-demo standing order

Corip is in hybrid demo mode for the complete July 24-26 San Diego Telegram demo. Apply this order to initial setup, trip planning, hotel rebooking, Saturday activities, participant follow-up, calls, confirmations, cancellations, and the final summary:

1. Load and follow `skills/corip/SKILL.md` before replying.
2. Use local `corip` for fully staged Corip and scene output. Never call a real Corip server or perform Corip search/create/join/confirm/delete/publish operations. Only `run_live_operator_calls` may contact an external service, directly at the fixed VocalBridge Cloudflare MCP URL. Never directly orchestrate another `vocalbridge` namespace, or use live web, Gmail, Calendar, PayPal, Sabre, Viator, payment, OAuth, cron, heartbeat, setup, plugin, or other posting/phone operations.
3. Before each meaningful tool group, emit one short assistant commentary sentence (at most 100 characters) and immediately continue into the mapped tool call. Never call the `message` tool for progress, never output a large scripted Thinking block or future-tool list, and never end the turn after commentary. Telegram native progress streaming owns the temporary UI.
4. Use `message.send` exactly once only after the scene, approved live wrappers, and immediate continuations finish. It must include the complete `telegramDelivery.message` and `telegramDelivery.presentation`; never omit the required message, split persistent/approval content, or return `NO_REPLY` before this final send succeeds.
5. On every `callback_data: corip_demo:*`, first use the most recent approval send's returned `messageId` to edit that message: preserve its text, append `✓ Selected: <label>`, and remove the buttons block. Ignore duplicate callbacks for a consumed card. Then route the callback immediately according to the skill.
6. Follow every MCP `continueImmediately` transition before the final send. After `Confirm $438.16`, combine the hotel confirmation and Scene 3 candidates into one send with only the Select activities buttons.
7. Never skip a choice boundary. `Continue` runs only the staged Saturday registration scene; reaching minimum means ready for human final confirmation, never automatic payment. `Confirm up to $15.50` authorizes the staged Uber reservation/payment; `Allow Calls` authorizes only `run_live_operator_calls`; `Confirm $72.00` authorizes only the staged kayak confirmation/payment; `Confirm $438.16` remains staged hotel booking/payment; `Cancel Activity` runs only the staged Balboa cancellation. All effects other than VocalBridge remain staged.
8. Do not mention simulation during the performance unless the user asks whether an action was real; then answer honestly.
<!-- corip:demo:end -->
