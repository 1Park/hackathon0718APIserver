const fs = require('fs');
const path = require('path');

const FULL_SCRIPT_PATH = path.join(__dirname, '..', 'skills', 'corip', 'references', 'demo-script.md');
const SKILL_PATH = path.join(__dirname, '..', 'skills', 'corip', 'SKILL.md');

function readSkill() {
  return fs.readFileSync(SKILL_PATH, 'utf8');
}

function persistentParts(scene) {
  if (Array.isArray(scene.persistentMessages)) return scene.persistentMessages;
  return scene.persistentMessage ? [scene.persistentMessage] : [];
}

function buildTelegramDelivery(scene) {
  const parts = persistentParts(scene);
  if (scene.approval) {
    const approvalText = [`## ${scene.approval.title}`, scene.approval.body]
      .filter(Boolean)
      .join('\n\n');
    parts.push(approvalText);
  }
  if (!parts.length) return null;

  const message = parts.join('\n\n---\n\n');
  const blocks = [{ type: 'text', text: message }];
  if (scene.approval) {
    blocks.push({ type: 'buttons', buttons: scene.approval.buttons });
  }

  return {
    action: 'send',
    exactlyOnce: true,
    message,
    presentation: { blocks },
    approvalMessage: Boolean(scene.approval),
    consumeButtonsOnCallback: Boolean(scene.approval),
    deferUntilContinuationsComplete: Boolean(scene.continueImmediately),
  };
}

const SCENES = {
  initialSetup: {
    scene: '1.1',
    working: 'I’m checking which capabilities the Corip MCP server provides and whether authentication is required.',
    simulatedToolTrace: [
      { tool: 'HTTP.GET', input: 'https://corip-postings-kimmc3423.fly.dev/mcp', result: 'The MCP server responded successfully.' },
      { tool: 'MCP.initialize', result: 'Server name: Corip\nVersion: 1.0.0' },
      { tool: 'MCP.listTools', result: `Available tools:

search_activities
get_activity
create_activity
join_activity
cancel_participation
update_activity
list_my_activities
get_participant_status
publish_trip_plan` },
    ],
    approval: {
      title: 'Connect Corip MCP?',
      body: `This will allow the agent to:

* Search for activities
* Join or leave activities
* Create new activity listings
* Publish trip plans
* Check participant counts and registration status

Corip will not receive direct access to Gmail or your payment accounts.`,
      buttons: [
        { label: 'Deny', value: 'corip_demo:deny_corip', style: 'danger' },
        { label: 'Allow Once', value: 'corip_demo:allow_corip_once' },
        { label: 'Always Allow Corip', value: 'corip_demo:always_allow_corip', style: 'success' },
      ],
      next: { 'corip_demo:always_allow_corip': 'connect_corip' },
    },
  },

  connectCorip: {
    scene: '1.1-connected',
    simulatedToolTrace: [
      { tool: 'MCP.connect', input: { server: 'Corip' }, result: 'Corip MCP connected successfully.' },
      { thinking: 'I’m creating a local skill so the Corip tools can be used through natural-language requests.' },
      { tool: 'Skills.create', input: 'corip/SKILL.md', result: `Corip skill created.

Supported actions include:

* Searching for activities that fit a trip schedule
* Joining existing activities
* Creating new group activity listings
* Tracking minimum and maximum participant counts
* Taking follow-up actions before registration deadlines` },
    ],
    persistentMessage: `✅ Corip MCP connected

You can now make requests such as:

“Find people to join me in San Diego on Saturday afternoon.”

“If there is no matching activity, create a new listing.”

“Let me know when enough people have joined.”

Next, I can set up email analysis and automatic monitoring.`,
    approval: {
      title: 'Allow Gmail access for travel planning?',
      body: `The agent will only read emails related to:

* Flights and hotel bookings
* Cancellations and refunds
* Tours and restaurant reservations
* Travel-related payment confirmations

This permission does not include sending, deleting, or editing emails.`,
      buttons: [
        { label: 'Deny', value: 'corip_demo:deny_travel_email', style: 'danger' },
        { label: 'Allow Once', value: 'corip_demo:allow_travel_email_once' },
        { label: 'Allow Travel Emails', value: 'corip_demo:allow_travel_emails', style: 'success' },
      ],
      next: { 'corip_demo:allow_travel_emails': 'enable_travel_email_workflow' },
    },
  },

  enableTravelEmail: {
    scene: '1.2-1.3',
    simulatedToolTrace: [
      { tool: 'Gmail.connect', input: { scope: 'travel-related read only' }, result: 'Gmail connected successfully.' },
      { thinking: 'I’m creating a recurring workflow that checks travel emails and updates your trip and interest summaries.' },
      { tool: 'Cron.create', input: { schedule: 'Every day at 8:00 AM', steps: ['Fetch new travel-related emails', 'Detect bookings, cancellations, refunds, and schedule changes', 'Update the trip summary', 'Update the user interest summary', 'Notify the user only when action is required'] }, result: 'Recurring workflow created.' },
      { thinking: 'I’m checking whether Sabre is available for retrieving and rebooking hotel reservations.' },
      { tool: 'Integrations.check', input: 'Sabre', result: 'Sabre has not been authenticated yet.' },
    ],
    persistentMessages: [
      `✅ Travel email workflow enabled

Every day at 8:00 AM, the agent will check for:

* New reservations or cancellations
* Flight and hotel schedule changes
* Refunds or failed payments
* Changes in travel interests
* Corip participant-status updates

You will not receive a message when there are no important changes.`,
      `## Sabre API

Connecting Sabre will allow the agent to:

* Retrieve existing hotel reservations
* Check hotel check-in and check-out times
* Search current room availability and pricing
* Rebook canceled hotels
* Retrieve reservation confirmation numbers`,
    ],
    approval: {
      title: 'Set up Sabre?',
      body: `The agent will open the Sabre authentication page and request hotel search and booking permissions.

A separate confirmation will always be required before any payment or final reservation.`,
      buttons: [
        { label: 'Not Now', value: 'corip_demo:not_now_sabre' },
        { label: 'Open Setup Page', value: 'corip_demo:open_sabre_setup', style: 'success' },
      ],
      next: { 'corip_demo:open_sabre_setup': 'complete_sabre_setup' },
    },
  },

  setupSabre: {
    scene: '1.3-1.4',
    simulatedToolTrace: [
      { tool: 'Sabre.startOAuth', result: 'Sabre account authentication completed.' },
      { tool: 'Sabre.verifyPermissions', result: `Authorized capabilities:

* Retrieve reservations
* Search hotels
* Check prices
* Create reservations
* Cancel reservations` },
    ],
    persistentMessages: [
      `✅ Sabre connected

The agent will always ask for confirmation before creating a reservation or charging a payment method.`,
      `## VocalBridge

Connecting VocalBridge allows the agent to call businesses when necessary.

Example use cases:

* Negotiating minimum group-size requirements
* Asking about hotel check-in times
* Confirming whether a tour can operate
* Requesting reservation changes

Before every call, you can specify:

* The purpose of the call
* The maximum call duration
* The highest acceptable price
* Whether the agent may make a reservation`,
    ],
    approval: {
      title: 'Set up VocalBridge?',
      body: '',
      buttons: [
        { label: 'Not Now', value: 'corip_demo:not_now_vocalbridge' },
        { label: 'Open Setup Page', value: 'corip_demo:open_vocalbridge_setup', style: 'success' },
      ],
      next: { 'corip_demo:open_vocalbridge_setup': 'complete_vocalbridge_setup' },
    },
  },

  setupVocalBridge: {
    scene: '1.4-complete',
    simulatedToolTrace: [
      { tool: 'VocalBridge.startSetup', result: 'Phone number verification completed.' },
      { tool: 'VocalBridge.testConnection', result: 'Outbound calling is available.' },
    ],
    persistentMessages: [
      `✅ VocalBridge connected

The agent will request separate approval before every outbound phone call.`,
      `## Setup complete

✅ Corip MCP connected
✅ Corip skills installed
✅ Gmail travel access connected
✅ Daily email analysis enabled
✅ Sabre connected
✅ VocalBridge connected

You can now manage trip planning, canceled reservations, group recruitment, and calls to businesses through a single Telegram conversation.`,
    ],
  },

  reviewTrip: {
    scene: '2.1',
    working: 'I’m reviewing your existing flights and reservations so I can preserve confirmed plans and identify anything that is missing or requires urgent action.',
    simulatedToolTrace: [
      { tool: 'Memory.read', input: 'interest_summary', result: `Recent travel interests:

* Ocean and outdoor activities
* Kayaking or surfing
* Local food
* Small-group activities with other travelers
* Preference for affordable group experiences over expensive private tours` },
      { tool: 'Memory.read', input: 'trip_summary', result: `Destination: San Diego
Departure: Friday evening, July 24
Return: Sunday night, July 26

Sunday is already fully planned and booked.` },
      { tool: 'Gmail.search', input: 'San Diego OR SAN OR hotel OR reservation', result: 'Six relevant emails found.' },
      { tool: 'Gmail.readBatch', result: `Detected information:

* American Airlines round-trip flights are ticketed
* All activities for July 26 are already reserved
* A cancellation email was found for Hilton San Diego Bayfront
* Cancellation reason: payment authorization failed because of insufficient funds on the payment date
* The hotel payment was refunded` },
      { tool: 'Sabre.retrieveTrip', result: 'Existing hotel reservation status: CANCELLED / REFUNDED' },
    ],
    persistentMessage: `## I found an urgent issue

✈️ **Flight**

Your American Airlines round-trip ticket is confirmed.

📅 **Sunday**

Your schedule for Sunday, July 26, is already fully booked. I will leave it unchanged.

🚨 **Hotel canceled**

Your Hilton San Diego Bayfront reservation for July 24–26 was canceled and refunded after the payment authorization failed.

A similar room at the same hotel is currently available for rebooking.`,
    approval: {
      title: 'Allow a balance check?',
      body: `To determine whether the hotel can be rebooked, the agent will check only the available balance of your connected PayPal account.

The agent will not access transaction history or transfer funds.`,
      buttons: [
        { label: 'Deny', value: 'corip_demo:deny_balance', style: 'danger' },
        { label: 'Allow Once', value: 'corip_demo:allow_balance_once', style: 'success' },
      ],
      next: { 'corip_demo:allow_balance_once': 'check_balance_and_find_hotel' },
    },
  },

  findHotel: {
    scene: '2.1-2.2',
    simulatedToolTrace: [
      { tool: 'PayPal.getAvailableBalance', result: 'The available balance is sufficient to cover the estimated hotel cost.' },
      { thinking: 'I’m looking for the closest available replacement to your original hotel reservation, with a reasonable cancellation policy.' },
      { tool: 'Sabre.searchHotelAvailability', input: { property: 'Hilton San Diego Bayfront', checkIn: 'July 24', checkOut: 'July 26', guests: 1, preference: 'Same or equivalent room' }, result: `Available room:

1 King Bed
Two nights
Total including taxes: $438.16
Free cancellation until July 23 at 11:59 PM
Check-in: 4:00 PM
Check-out: 11:00 AM` },
    ],
    approval: {
      title: 'Rebook canceled hotel',
      body: `Hilton San Diego Bayfront

July 24–26 · Two nights
1 King Bed
Total including taxes: $438.16

This is the same hotel with room conditions similar to the original reservation.

Payment method: Card connected through PayPal
Free cancellation until July 23 at 11:59 PM`,
      buttons: [
        { label: 'Not Now', value: 'corip_demo:not_now_hotel' },
        { label: 'Review Alternatives', value: 'corip_demo:review_hotel_alternatives' },
        { label: 'Confirm $438.16', value: 'corip_demo:confirm_438_16', style: 'success' },
      ],
      next: { 'corip_demo:confirm_438_16': 'confirm_hotel_rebooking' },
    },
  },

  confirmHotel: {
    scene: '2.2-confirmed',
    simulatedToolTrace: [
      { tool: 'Sabre.createHotelBooking', result: 'Reservation created successfully.' },
      { tool: 'Gmail.waitForConfirmation', result: 'Hilton confirmation email received.' },
      { tool: 'Memory.updateTripSummary', result: 'Hotel reservation status updated to Confirmed.' },
    ],
    persistentMessage: `✅ **Hotel rebooked**

Hilton San Diego Bayfront
Friday, July 24 → Sunday, July 26
Check-in: 4:00 PM
Check-out: 11:00 AM
Total charged: $438.16

The reservation confirmation email has also arrived.

I’ll now organize your open schedule for Saturday.`,
    continueImmediately: {
      tool: 'get_saturday_candidates',
      reason: 'Scene 3 begins immediately after the hotel is rebooked; no additional user message is required.',
    },
  },

  saturdayCandidates: {
    scene: '3',
    persistentMessage: `## Saturday candidates

I selected three options based on your interests and travel route.

### A. La Jolla Sea Caves Kayak Tour

* 9:00–11:00 AM
* La Jolla Shores
* $69 per person
* Available through Viator
* Existing Corip activity found
* Two of four participants have joined
* Two additional participants are needed, including you

**Why it fits:** This is the strongest match for your interest in ocean activities. If you join, the group will have three of four participants and need only one more person.

---

### B. Balboa Park Food & Photo Walk

* 2:30–5:00 PM
* Balboa Park
* Estimated price: $45 per person
* Candidate found through GetYourGuide
* No existing Corip listing
* Requires at least six participants
* No other participants have joined yet

**Why it fits:** It does not conflict with the morning kayak tour and combines local food, walking, and photography. However, significantly more participants will need to be recruited before it can operate.

---

### C. Shared Uber to La Jolla

* Depart hotel at 7:45 AM
* Hilton San Diego Bayfront → La Jolla Shores
* Estimated cost: $13–18 per person
* Existing Corip listing found
* Three of four spots are filled
* One spot remains

**Why it fits:** You can share transportation with other travelers heading to La Jolla and reduce the travel cost.`,
    approval: {
      title: 'Select activities',
      body: `☑ A. La Jolla Kayak · $69
☑ B. Balboa Park Walk · Up to $45
☑ C. Shared Uber · Estimated $13–18

The following actions will be performed:

* Join the existing Corip listing for Activity A
* Create a new Corip listing for Activity B
* Join the existing ride-sharing listing for Activity C
* Add all three items to your schedule
* Monitor participant recruitment
* Ask for final approval before any payment is made

Estimated maximum total: **$132**`,
      buttons: [
        { label: 'Cancel', value: 'corip_demo:cancel', style: 'danger' },
        { label: 'Edit Selection', value: 'corip_demo:edit_selection' },
        { label: 'Continue', value: 'corip_demo:continue', style: 'success' },
      ],
      next: { 'corip_demo:continue': 'register_saturday_plan' },
    },
  },

  registerPlan: {
    scene: '4',
    working: 'I’m joining the existing activities and creating a new listing for the activity that does not yet have one.',
    simulatedToolTrace: [
      { tool: 'Corip.join_activity', input: { activity: 'La Jolla Sea Caves Kayak Tour' }, result: 'Joined successfully.\nCurrent participant count: 3 / 4\nOne additional participant is still needed.' },
      { tool: 'Corip.join_activity', input: { activity: 'Shared Uber to La Jolla' }, result: 'Joined successfully.\nCurrent participant count: 4 / 4' },
      { tool: 'Corip.create_activity', input: { activityName: 'Balboa Park Food & Photo Walk', description: 'Walk through Balboa Park with a small group, visit major landmarks, take photos, and try selected local snacks.', dateAndTime: 'July 25, 2:30–5:00 PM', location: 'Balboa Park Visitors Center', minimumGroupSize: 6, maximumGroupSize: 8, pricePerPerson: 'Up to $45', registrationDeadline: 'July 23, 6:00 PM' }, result: 'New activity created successfully.' },
      { tool: 'Corip.join_activity', input: { activity: 'Balboa Park Food & Photo Walk' }, result: 'The creator was registered as the first participant.\nCurrent participant count: 1 / 6 minimum\nFive additional participants are needed.' },
      { tool: 'Calendar.createEvents', result: 'All three activities were added to the travel calendar as tentative events.' },
      { tool: 'Corip.publish_trip_plan', result: 'The selected Saturday plan was published to Corip.' },
    ],
    persistentMessage: `## Saturday plan registered

### 7:45 AM

**Shared Uber to La Jolla**
Status: Group full · Waiting for final ride booking

### 9:00 AM

**La Jolla Sea Caves Kayak Tour**
Status: Recruiting · Currently 3 of 4 participants
One additional participant is needed before the group can be finalized.

### 2:30 PM

**Balboa Park Food & Photo Walk**
Status: Recruiting · Currently 1 of 6 participants
Five additional participants are needed before the activity can operate.

I’ll monitor both listings and notify you when participant counts change or additional action is required.

---

## Reservations waiting for participant confirmation

### La Jolla Sea Caves Kayak Tour

Current participants: **3 / 4**

The tour has not been booked yet. I’ll ask for payment approval as soon as one more participant joins.

### Balboa Park Food & Photo Walk

Current participants: **1 / 6**

The activity is still far below its minimum group size. I’ll continue recruiting through Corip and explore alternatives if the deadline approaches.

No tour payments have been made.`,
  },

  participantStatus: {
    scene: '5.1',
    working: 'I’m checking participant counts and pending reservations before your trip.',
    simulatedToolTrace: [{
      tool: 'Corip.get_participant_status',
      result: `Shared Uber:
* 4 / 4 participants
* All participants have confirmed
* The ride can now be reserved

La Jolla Sea Caves Kayak Tour:
* 3 / 4 participants
* One participant is still needed
* Registration deadline is approaching
* The tour has not been booked

Balboa Park Food & Photo Walk:
* 2 / 6 participants
* Four additional participants are needed
* Registration deadline is approaching
* Reaching the standard minimum is unlikely`,
    }],
    persistentMessage: `## Three actions need your attention

### 1. The shared Uber group is full

All four passengers for the ride to La Jolla have confirmed.

The current estimated Uber XL fare is $54–62 total. Your estimated share is **$13.50–15.50**.

### 2. The kayak tour is one person short

The La Jolla kayak group currently has three of the required four participants.

The agent can contact the operator and ask:

* Whether the tour can operate with three participants
* Whether the remaining cost can be split among the group
* Whether the group can join another scheduled departure
* Whether the original 9:00 AM departure can remain unchanged

### 3. The Balboa Park activity is far below minimum capacity

The activity currently has only two of the required six participants.

Four additional participants would be needed before the deadline, so the current plan is unlikely to proceed under its original conditions.

The agent can:

* Continue recruiting through Corip
* Search for an existing public group
* Find a smaller-group alternative
* Ask the operator whether two participants may join another scheduled tour`,
    approval: {
      title: 'Confirm shared Uber',
      body: `Shared Uber to La Jolla
July 25 at **7:45 AM**
Hilton San Diego Bayfront → La Jolla Shores

The group is full: **4 / 4 participants**

Current estimated share: **$13.50–15.50**
Maximum authorized charge: **$15.50**

No charge will be made unless you confirm.`,
      buttons: [
        { label: 'Not Now', value: 'corip_demo:not_now_uber' },
        { label: 'Confirm up to $15.50', value: 'corip_demo:confirm_uber_15_50', style: 'success' },
      ],
      next: { 'corip_demo:confirm_uber_15_50': 'confirm_shared_uber' },
    },
  },

  confirmUber: {
    scene: '5.2-uber-confirmed',
    simulatedToolTrace: [
      { tool: 'Uber.createReservation', input: { vehicle: 'Uber XL', route: 'Hilton San Diego Bayfront → La Jolla Shores', departureTime: 'July 25, 7:45 AM', maximumShare: 15.5 }, result: 'The shared ride was reserved successfully.' },
      { tool: 'PayPal.authorizePayment', input: { maximumAmount: 15.5 }, result: 'Payment authorization completed. Final share will not exceed $15.50.' },
      { tool: 'Calendar.updateEvent', result: 'The shared Uber event was marked Confirmed.' },
    ],
    persistentMessage: `✅ **Shared Uber confirmed**

The four-person group is complete and the ride has been reserved.

* July 25 at 7:45 AM
* Hilton San Diego Bayfront → La Jolla Shores
* Four participants
* Your final share will not exceed **$15.50**`,
    approval: {
      title: 'Allow outbound calls?',
      body: `The agent will make up to two calls.

### Call 1: La Jolla kayak operator

**Objective**
Find a way for the three-person group to participate.

**Allowed conditions**
* Maximum acceptable price: $85 per person
* Keep a morning departure
* Joining another group is allowed
* Do not make a payment during the call

### Call 2: Balboa Park tour operator

**Objective**
Find an alternative for the two registered participants.

**Allowed conditions**
* Maximum acceptable price: $55 per person
* Keep an afternoon departure
* Joining an existing public group is allowed
* Do not make a payment during the call

For both calls:
* Maximum call duration: 3 minutes each
* Disclose that the caller is an AI agent`,
      buttons: [
        { label: 'Deny', value: 'corip_demo:deny_calls', style: 'danger' },
        { label: 'Edit Limits', value: 'corip_demo:edit_limits' },
        { label: 'Allow Calls', value: 'corip_demo:allow_calls', style: 'success' },
      ],
      next: { 'corip_demo:allow_calls': 'complete_operator_calls' },
    },
  },

  operatorCalls: {
    scene: '5.3',
    working: 'I’m contacting both operators to find options that fit the approved schedule and price limits.',
    simulatedToolTrace: [
      { tool: 'VocalBridge.startCall', input: { recipient: 'La Jolla kayak operator', objective: 'Find an option for a three-person group', constraints: ['Maximum $85 per person', 'Morning departure', 'Joining another group is allowed', 'No payment authorization', 'Disclose AI agent identity'] }, result: 'Call connected.' },
      { tool: 'VocalBridge.liveCallStatus', result: 'The operator has another public departure with one open space for the Corip group.' },
      { tool: 'VocalBridge.endCall', result: 'Call completed.\nTotal duration: 1 minute 48 seconds.' },
      { tool: 'VocalBridge.startCall', input: { recipient: 'Balboa Park tour operator', objective: 'Find an alternative for two participants', constraints: ['Maximum $55 per person', 'Afternoon departure', 'Joining an existing group is allowed', 'No payment authorization', 'Disclose AI agent identity'] }, result: 'Call connected.' },
      { tool: 'VocalBridge.liveCallStatus', result: 'No existing group is available at 2:30 PM. The operator offered a later public tour at a higher price.' },
      { tool: 'VocalBridge.endCall', result: 'Call completed.\nTotal duration: 2 minutes 6 seconds.' },
    ],
    persistentMessage: `## Call results

### Kayak: a solution was found

The operator can merge your three-person Corip group into another public departure.

* Date: July 25
* New departure time: 9:30 AM
* Available places: Three
* Price: **$72 per person**
* Same La Jolla sea-cave route
* Free cancellation up to 24 hours before departure
* Reservation required by 6:00 PM today

### Balboa Park: no suitable group was found

The original activity has only two of six required participants.

The operator offered:

* A public tour at 4:30 PM
* Price: $64 per person
* Different route
* Nonrefundable booking

This option exceeds your approved $55 limit, so I did not proceed.

No payments were made during either call.`,
    approval: {
      title: 'Confirm kayak tour',
      body: `La Jolla Sea Caves Kayak Tour
July 25 at **9:30 AM**
Your Corip group will join another public departure.

Price: **$72.00**
Free cancellation up to 24 hours before departure`,
      buttons: [
        { label: 'Decline', value: 'corip_demo:decline_kayak', style: 'danger' },
        { label: 'Confirm $72.00', value: 'corip_demo:confirm_72', style: 'success' },
      ],
      next: { 'corip_demo:confirm_72': 'confirm_kayak_tour' },
    },
  },

  confirmKayak: {
    scene: '5.3-kayak-confirmed',
    simulatedToolTrace: [
      { tool: 'Viator.createReservation', result: 'Three places were reserved successfully.' },
      { tool: 'Corip.update_activity', input: { participantCount: 3, status: 'Confirmed through merged departure', departureTime: '9:30 AM', registration: 'Closed' }, result: 'The Corip kayak listing was updated.' },
      { tool: 'Gmail.waitForConfirmation', result: 'Kayak reservation confirmation email received.' },
      { tool: 'Calendar.updateEvent', result: 'The kayak event was updated to 9:30 AM and marked Confirmed.' },
    ],
    persistentMessage: `✅ **Kayak tour confirmed**

The three-person group has been merged into another public departure.

* July 25 at 9:30 AM
* Three Corip participants
* Amount charged: $72.00
* Confirmation email received`,
    approval: {
      title: 'Choose what to do with Balboa Park',
      body: 'The original activity cannot proceed because it has only two of six required participants.',
      buttons: [
        { label: 'Keep Recruiting', value: 'corip_demo:keep_recruiting' },
        { label: 'Search Alternatives', value: 'corip_demo:search_alternatives' },
        { label: 'Cancel Activity', value: 'corip_demo:cancel_balboa', style: 'danger' },
      ],
      next: { 'corip_demo:cancel_balboa': 'cancel_balboa_activity' },
    },
  },

  cancelBalboa: {
    scene: '5.3-balboa-cancelled',
    simulatedToolTrace: [
      { tool: 'Corip.update_activity', input: { status: 'Cancelled', reason: 'Minimum participant count not reached' }, result: 'The activity was canceled.' },
      { tool: 'Corip.notify_participants', result: 'Both participants were notified.' },
      { tool: 'Calendar.deleteEvent', result: 'The tentative Balboa Park event was removed from the calendar.' },
    ],
    persistentMessage: `❌ **Balboa Park activity canceled**

The activity did not reach its minimum participant count.

* Final participant count: 2 / 6
* No reservation was made
* No payment was charged
* Both participants were notified

Your Saturday afternoon is now open.`,
  },

  finalSummary: {
    scene: '6',
    persistentMessage: `## Saturday, July 25

🚙 **7:40 AM — Shared Uber**

Hilton San Diego Bayfront → La Jolla Shores
Four participants
Ride reserved

🛶 **9:30 AM — La Jolla Sea Caves Kayak Tour**

The original Corip group was one participant short, so the operator merged the three participants into another public departure.

Reservation and payment completed
Amount charged: **$72.00**

🌳 **Afternoon — Open**

The Balboa Park activity was canceled because it reached only two of the required six participants.

No reservation was made and no payment was charged.

---

## Completed actions

* ✅ Detected the canceled hotel reservation
* ✅ Verified sufficient payment balance
* ✅ Rebooked the hotel through Sabre
* ✅ Compared activities across three travel platforms
* ✅ Joined the existing Corip kayak activity
* ✅ Created a new Balboa Park activity
* ✅ Joined the existing shared-Uber activity
* ✅ Detected that the kayak group was one participant short
* ✅ Detected that the Balboa Park activity was far below its minimum
* ✅ Reserved the shared Uber
* ✅ Called the kayak operator through VocalBridge
* ✅ Merged the three-person kayak group into another public departure
* ✅ Completed the kayak reservation
* ✅ Called the Balboa Park operator through VocalBridge
* ✅ Rejected an alternative that exceeded the approved price
* ✅ Canceled the underfilled Balboa Park activity without charge
* ✅ Received confirmation emails for all completed reservations`,
  },
};

module.exports = {
  FULL_SCRIPT: fs.readFileSync(FULL_SCRIPT_PATH, 'utf8'),
  SCENES,
  buildTelegramDelivery,
  readSkill,
};
