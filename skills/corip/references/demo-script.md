# Corip demo canonical script

This reference fixes all facts and transitions for the recorded demo. Do not improvise alternatives.

## Contents

- Scene 1 — Initial Corip Setup
- Scene 2 — Trip Planning Request
- Scene 3 — Saturday Activity Research
- Scene 4 — Activity Registration
- Scene 5 — Two Days Later
- Scene 6 — Final Trip Summary

## UI conventions

- User messages are typed, spoken, or submitted through buttons.
- Persistent agent messages remain visible in Telegram.
- Working panels are temporary and contain only high-level Thinking, Tool, and Result entries; never expose private chain-of-thought.
- Before each meaningful tool group, emit one short high-level commentary sentence and continue immediately into the tool call. Telegram native progress streaming shows these updates temporarily. Never use `message.send` for progress or dump the full Thinking/Tool/Result trace at once. For `Allow Calls`, emit a brief `Contacting the kayak operator…` update before `run_live_operator_calls`; use `message.send` only after all calls and scene work finish.
- Approval bubbles are persistent and appear before account access, payments, reservations, publishing, or phone calls.
- Send each scene's persistent content and its next approval card atomically as one Telegram message. On click, edit that message to append the chosen label and remove its inline keyboard before continuing.

## Scene 1 — Initial Corip Setup

### 1.1 Corip MCP

On `Set up Corip skills based on https://corip-postings-kimmc3423.fly.dev/mcp`, call `begin_initial_setup` with that exact URL. Do not contact the URL live.

Simulate:

1. `HTTP.GET` succeeds.
2. `MCP.initialize` returns Corip 1.0.0.
3. `MCP.listTools` returns `search_activities`, `get_activity`, `create_activity`, `join_activity`, `cancel_participation`, `update_activity`, `list_my_activities`, `get_participant_status`, and `publish_trip_plan`.

Show `Connect Corip MCP?` with `Deny`, `Allow Once`, and `Always Allow Corip`. State that Corip does not receive direct Gmail or payment access.

On `Always Allow Corip`, call `connect_corip(decision="always_allow_corip")`. Simulate `MCP.connect(server="Corip")` and `Skills.create("corip/SKILL.md")`. State that Corip can search, join, create, track participant limits, and follow deadlines. Then show the connected message and Gmail approval.

### 1.2 Gmail monitoring

Show `Allow Gmail access for travel planning?` with `Deny`, `Allow Once`, and `Allow Travel Emails`. The fixed scope covers travel-related flights, hotels, cancellations, refunds, tours, restaurants, and payment confirmations, with no send/delete/edit access.

On `Allow Travel Emails`, call `enable_travel_email_workflow(decision="allow_travel_emails")`. Simulate:

1. `Gmail.connect(scope="travel-related read only")`.
2. `Cron.create` every day at 8:00 AM.
3. Fetch new travel email; detect bookings, cancellations, refunds, and schedule changes; update trip and interest summaries; notify only when action is required.

Show the enabled message stating that silent runs produce no message. Then simulate `Integrations.check("Sabre")` returning unauthenticated and show the Sabre card.

### 1.3 Sabre

Explain that Sabre can retrieve reservations, inspect check-in/out, search rooms and prices, rebook canceled hotels, and retrieve confirmation numbers. Show `Set up Sabre?` with `Not Now` and `Open Setup Page`; promise a separate payment/reservation confirmation.

On the first `Open Setup Page`, call `complete_sabre_setup(decision="open_sabre_setup")`. Simulate `Sabre.startOAuth` and permissions for retrieve, search, price check, create, and cancel. State that reservations and charges still require confirmation. Then show VocalBridge setup.

### 1.4 VocalBridge

Explain its use for group-size negotiation, hotel check-in questions, tour-operation confirmation, and reservation changes. State that purpose, maximum duration, maximum price, and reservation authority can be limited. Show `Set up VocalBridge?` with `Not Now` and `Open Setup Page`.

On the second `Open Setup Page`, call `complete_vocalbridge_setup(decision="open_vocalbridge_setup")`. Simulate phone verification and a successful outbound-call test. End with two persistent messages: VocalBridge connected, then Setup complete with all six checks for Corip MCP, skill, Gmail, daily analysis, Sabre, and VocalBridge.

## Scene 2 — Trip Planning Request

### 2.1 General request and balance approval

On `Plan a trip for this weekend and make the necessary reservations.`, call `review_trip_request`.

Simulate these fixed results:

- Interests: ocean/outdoor activities, kayaking or surfing, local food, small groups, and affordable group experiences.
- Trip: San Diego; depart Friday evening July 24; return Sunday night July 26; Sunday fully planned and booked.
- Gmail: six relevant messages; American Airlines round trip ticketed; July 26 activities booked; Hilton San Diego Bayfront cancellation due to insufficient funds at authorization; refund completed.
- Sabre: hotel status `CANCELLED / REFUNDED`.

First show the persistent urgent-issue message: flight confirmed, Sunday unchanged, hotel canceled/refunded, and a similar room available. Immediately below it in the same delivery, show `Allow a balance check?` with `Deny` and `Allow Once`. Scope is PayPal available balance only—no history or transfer.

On the Scene 2 `Allow Once`, call `check_balance_and_find_hotel(decision="allow_balance_once")`. Simulate sufficient balance. Do not repeat the urgent-issue message.

### 2.2 Hotel rebooking

In the same response, simulate `Sabre.searchHotelAvailability` for Hilton San Diego Bayfront, July 24-26, one guest, same/equivalent room. The fixed offer is one king bed, two nights, $438.16 including taxes, cancellation through July 23 at 11:59 PM, 4:00 PM check-in, and 11:00 AM check-out.

Show `Rebook canceled hotel` with `Not Now`, `Review Alternatives`, and `Confirm $438.16`. Payment method is the card connected through PayPal.

On `Confirm $438.16`, call `confirm_hotel_rebooking(amount=438.16)`. Simulate successful `Sabre.createHotelBooking`, Hilton email confirmation, and trip-summary update. State the $438.16 charge and `I’ll now organize your open schedule for Saturday.` Then, without waiting for another user message, immediately call `get_saturday_candidates` and continue into Scene 3.

## Scene 3 — Saturday Activity Research

Call `get_saturday_candidates`. Show its `persistentMessage`, then its `approval` card. The card must contain these choices in order: `Cancel`, `Edit Selection`, `Continue`. Continue only when the callback is `corip_demo:continue`.

Fixed candidates:

- La Jolla Sea Caves Kayak Tour: July 25, 9:00–11:00 AM, La Jolla Shores, $69, Viator, existing Corip activity, 2/4 joined before the user.
- Balboa Park Food & Photo Walk: July 25, 2:30–5:00 PM, Balboa Park, up to $45, GetYourGuide, no listing, minimum 6, zero joined before creation.
- Shared Uber to La Jolla: hotel departure at 7:45 AM, $13–18 per person, existing Corip listing, 3/4 spots filled.
- Maximum selected total: $132.

## Scene 4 — Activity Registration

On `Continue`, call only `register_saturday_plan(selection="all")`. All displayed Corip create/join/count results are scripted; do not call a real Corip server.

Simulate in this order:

1. Join kayak: 3/4, one still needed.
2. Join shared Uber: 4/4.
3. Create Balboa Park Food & Photo Walk with minimum 6, maximum 8, deadline July 23 at 6:00 PM.
4. Count creator as first Balboa participant: 1/6, five still needed.
5. Add all three tentative calendar events.
6. Publish the Saturday plan to Corip.

End by stating that kayak is 3/4, Balboa is 1/6, and no tour payments have been made. Do not show an immediate kayak payment card.

## Scene 5 — Two days later

Call only `get_participant_status` for the follow-up. All participant counts are scripted:

- Shared Uber: 4/4 confirmed and ready to reserve.
- Kayak: 3/4, one participant short, deadline approaching, not booked.
- Balboa Park: 2/6, four short, deadline approaching, unlikely to reach minimum.

Because the shared Uber reached 4/4, first show a final human confirmation/payment card with `Not Now` and `Confirm up to $15.50`. Reaching capacity does not authorize automatic reservation or payment. On confirmation, call `confirm_shared_uber(amount=15.5)`, simulate the ride reservation and a payment authorization capped at $15.50, and then show the outbound-call card. That card permits at most two real calls, three minutes each, with AI disclosure and no payment. Kayak ceiling is $85 with a morning departure; Balboa ceiling is $55 with an afternoon departure.

On `Allow Calls`, call `run_live_operator_calls(decision="allow_calls")`; it makes the two real calls directly to the fixed VocalBridge MCP URL with the seven fields specified in `SKILL.md`. Then call `complete_operator_calls(decision="allow_calls")`. Do not confirm the live Kayak posting yet.

- Simulated kayak call duration: 1:48. Result: three-person group can join a public July 25 9:30 AM departure for $72 each, free cancellation through 24 hours prior, reserve by 6:00 PM today.
- Simulated Balboa call duration: 2:06. Result: only a 4:30 PM different-route, nonrefundable tour for $64. Reject it because it exceeds $55.
- No payment during calls.

Show the kayak card with `Decline` and `Confirm $72.00`.

On `Confirm $72.00`, call only `confirm_kayak_tour(amount=72)`. This human button gates the staged Corip confirmation and payment/reservation. Simulate three Viator places, receive the Gmail confirmation, and update the calendar. Then show `Keep Recruiting`, `Search Alternatives`, and `Cancel Activity` for Balboa Park.

On `Cancel Activity`, call only `cancel_balboa_activity(decision="cancel_activity")`. Simulate the Corip cancellation, participant notification, and tentative calendar removal. Final count is 2/6 with no reservation and no charge.

## Scene 6 — Final Trip Summary

Call `get_final_trip_summary`. Its exact Saturday section and completed-actions list are canonical.

Saturday facts:

- Shared Uber is 7:40 AM, Hilton San Diego Bayfront to La Jolla Shores, four participants, reserved.
- Kayak is 9:30 AM, three Corip participants merged into another public departure, charged $72.
- Saturday afternoon is open because Balboa Park ended at 2/6 with no reservation or charge.

## Forbidden live effects

Never use a real Corip server, live web research, Gmail, Calendar, Sabre, Viator, payment, cron, or heartbeat. The only live effect is the approved direct VocalBridge wrapper; all other named-service traces are staged fixtures.
