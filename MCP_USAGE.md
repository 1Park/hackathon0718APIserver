# Corip demo MCP

This server provides fully staged Corip Scene 1–6 output for the July 24–26 San Diego Telegram demo. It does not read or mutate a real Corip server. One wrapper connects directly to the fixed VocalBridge MCP endpoint for one approved Kayak call; every other integration remains staged.

Endpoint: `http://127.0.0.1:3080/mcp`

Tools:

- `confirm_shared_uber` — staged Uber confirmation plus one bundled real Kayak call, returning the `$72` card in the same response
- `complete_operator_calls` — backward-compatible one-call handler for an already displayed legacy Allow Call card
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

Before each meaningful tool group, emit one short assistant commentary update and continue immediately into the tool call. Telegram native progress streaming displays commentary and tool activity temporarily; do not use `message.send` for progress. After Scene 4, negotiation/phone/Uber-confirm intents route to `get_participant_status`. Confirming its bundled card calls `confirm_shared_uber`, which performs the only live effect—one Kayak VocalBridge call—and returns the combined result without another user turn.
