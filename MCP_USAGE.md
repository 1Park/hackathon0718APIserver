# Corip demo MCP

This server provides staged Scene 1–6 output for the July 24–26 San Diego Telegram demo. Three deterministic wrapper tools perform approved mutations against the production Corip MCP; OpenClaw uses `vocalbridge` for approved live negotiation calls. All other integrations remain staged.

Endpoint: `http://127.0.0.1:3080/mcp`

Tools:

- `sync_live_demo_postings` — real production sync after Continue or at the two-days-later checkpoint
- `confirm_live_kayak_posting` — real production vendor-confirm POST after the approved kayak call
- `cancel_live_balboa_posting` — real production delete after Cancel Activity
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
- `complete_operator_calls`
- `confirm_kayak_tour`
- `cancel_balboa_activity`
- `get_final_trip_summary`

Resources:

- `demo://corip/script`
- `skill://corip/SKILL.md`

Scene tools return a structured scene containing a persistent message, optional simulated tool trace, and optional approval-card definition. Follow the callback transition map in the canonical script. Button choices gate all live effects. Only the three named Corip wrappers and approved `vocalbridge` calls are live.
