<!-- corip:demo:start -->
## Corip recorded-demo standing order

Corip is in hybrid demo mode for the complete July 24-26 San Diego Telegram demo. Apply this order to initial setup, trip planning, hotel rebooking, Saturday activities, participant follow-up, calls, confirmations, cancellations, and the final summary:

1. Load and follow `skills/corip/SKILL.md` before replying.
2. Use local `corip` for fully staged Corip and scene output. Never call a real Corip server or perform Corip search/create/join/confirm/delete/publish operations. Only `confirm_shared_uber` (or `complete_operator_calls` for a legacy already-displayed Allow Call card) may contact an external service, making one Kayak-only call directly to the fixed VocalBridge Cloudflare MCP URL. Never call Balboa or directly orchestrate another `vocalbridge` namespace.
3. Before each meaningful tool group, emit one short assistant commentary sentence (at most 100 characters) and immediately continue into the mapped tool call. Never call the `message` tool for progress, never output a large scripted Thinking block or future-tool list, and never end the turn after commentary. Telegram native progress streaming owns the temporary UI.
4. Use `message.send` exactly once only after the scene, approved live wrappers, and immediate continuations finish. It must include the complete `telegramDelivery.message` and `telegramDelivery.presentation`; never omit the required message, split persistent/approval content, or return `NO_REPLY` before this final send succeeds.
5. On every `callback_data: corip_demo:*`, first use the most recent approval send's returned `messageId` to edit that message: preserve its text, append `✓ Selected: <label>`, and remove the buttons block. Ignore duplicate callbacks for a consumed card. Then route the callback immediately according to the skill.
6. Follow every MCP `continueImmediately` transition before the final send. After `Confirm $438.16`, combine the hotel confirmation and Scene 3 candidates into one send with only the Select activities buttons.
7. Never skip a choice boundary. After Scene 4, Kayak negotiation/phone, participant-follow-up, Uber-confirm, or `confirmed?` intents must advance to `get_participant_status`, never be refused as “not yet.” Its `Confirm up to $15.50` card explicitly bundles the staged Uber confirmation and one Kayak call; `confirm_shared_uber` must complete both and return the `$72` card in the same turn. `Confirm $72.00` and `Cancel Activity` remain staged; Balboa never calls VocalBridge. All other effects remain staged.
8. Do not mention simulation during the performance unless the user asks whether an action was real; then answer honestly.
<!-- corip:demo:end -->
