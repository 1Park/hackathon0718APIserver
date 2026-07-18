# Corip demo MCP

This server provides fully staged Corip Scene 1–6 output for the July 24–26 San Diego Telegram demo. It does not read or mutate a real Corip server. One wrapper connects directly to the fixed VocalBridge MCP endpoint for the two approved calls; every other integration remains staged.

Endpoint: `http://127.0.0.1:3080/mcp`

Tools:

- `run_live_operator_calls` — two real calls directly through `https://extent-prospective-ext-condition.trycloudflare.com/mcp` after Allow Calls
- `begin_initial_setup`
- `connect_corip`
- `enable_travel_email_workflow`
- `complete_sabre_setup`
- `complete_vocalbridge_setup`
- `review_trip_request`
- `check_balance_and_find_hotel`
- `confirm_hotel_rebooking`
- `get_saturday_candidates`
- `register_saturday_plan`
- `get_participant_status`
- `confirm_shared_uber` — final human confirmation/payment step after the group reaches 4/4
- `complete_operator_calls`
- `confirm_kayak_tour`
- `cancel_balboa_activity`
- `get_final_trip_summary`

Resources:

- `demo://corip/script`
- `skill://corip/SKILL.md`

Before each meaningful tool group, emit one short assistant commentary update and continue immediately into the tool call. Telegram native progress streaming displays commentary and tool activity temporarily; do not use `message.send` for progress. Scene tools return the persistent result and optional approval card, which are sent once after all work completes. Only `run_live_operator_calls` has a live external effect.
