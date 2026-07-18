# Corip Postings MCP Usage Guide

This guide explains how an agent uses the Corip MCP server to search, create, join, inspect, watch, and delete participant postings for tours, leisure activities, and shared taxis.

## 1. Connection

- MCP endpoint: `https://corip-postings-kimmc3423.fly.dev/mcp`
- Transport: stateless Streamable HTTP
- Authentication: none; this is a public test server and must not receive private travel data

Register it with an MCP client as a Streamable HTTP server. For current OpenClaw versions, use:

```bash
openclaw mcp set corip '{"url":"https://corip-postings-kimmc3423.fly.dev/mcp","transport":"streamable-http"}'
openclaw mcp probe corip --json
```

The server exposes nine tools after connection.

### Install native Corip approval controls

The Skill cannot create an OpenClaw approval card by prose alone. Install the bundled native plugin before the email phase so setup can call `corip_approve_email_sync`:

```bash
cd plugins/corip-approvals
npm install
npm run plugin:validate
openclaw plugins install .
openclaw gateway restart
```

When setup starts from only the public MCP URL and the tool is missing, read `plugin://corip-approvals/bundle.json`. Accept only format `corip-openclaw-plugin-bundle-v1`, plugin id `corip-approvals`, and the exact unique path set `package.json`, `openclaw.plugin.json`, `dist/index.js`, and `README.md`. Reject absolute paths, traversal, links, extra or duplicate files, manifest id mismatch, or any lowercase SHA-256 digest mismatch. Materialize the verified files in a new narrowly scoped temporary directory and install that directory with `openclaw plugins install <temporary-directory>`. Then read only `tools.alsoAllow` and append the exact `corip_approve_email_sync` name while preserving all existing entries. This is required under restrictive tool profiles such as `coding`; it exposes only the approval gate and does not grant mailbox permission. Restart the Gateway and stop the current setup turn. Resume only in a fresh agent turn where `corip_approve_email_sync` is visible.

The plugin-install or Skill Workshop approval authorizes only that named operation. It is not email consent. After the plugin is loaded, call `corip_approve_email_sync` with the non-secret connector label, exact cron expression, and IANA timezone. The resulting native card covers read-only travel-email access, model-assisted local summaries, and the recurring `corip-travel-email-sync` cron. Never substitute a prose permission question. On denial, timeout, or missing approval routing, leave email and cron configuration unchanged.

After the Skill Workshop proposal is approved, continue setup instead of returning a final summary. If the plugin is loaded and matching durable consent is absent, call `corip_approve_email_sync` in that same setup turn. Text such as `Approve email`, `approve sync`, or `yes` requests this card and is never consent by itself. Do not access Gmail or mutate the email-sync cron until the native card returns `allow-once`. Never finish with a prose invitation such as “If you want email sync, approve it.” If installing the plugin requires a Gateway restart, report setup as paused and resume with the approval card as the first action.

### Install the Corip OpenClaw Skill

An MCP connection supplies tools. The Corip Skill defines when and how OpenClaw should set up and use them. From this repository, install it with:

```bash
openclaw skills install ./skills/corip --as corip
```

Start a new session after installation and confirm that `corip` appears in `openclaw skills list`. MCP-only clients can read the exact Skill from `skill://corip/SKILL.md`. The legacy alias `docs://corip-skill` returns the same content. Do not overwrite a locally modified Skill without user approval.

## 2. Posting model

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | number | Unique posting id |
| `type` | `tour` \| `leisure` \| `taxi` | Posting category |
| `country` | string | Country in English |
| `city` | string | City in English |
| `place` | string \| null | Tour/leisure location; always null for taxi postings |
| `departure` | string \| null | Taxi departure; null for tour/leisure postings |
| `destination` | string \| null | Taxi destination; null for tour/leisure postings |
| `date` | string | Date, normally `YYYY-MM-DD` |
| `time` | string | Time, normally `HH:mm` |
| `minPeople` | number | Minimum participant count |
| `maxPeople` | number | Nominal capacity |
| `currentPeople` | number | Current participant count |
| `needsNego` | boolean | Whether an over-capacity request requires negotiation |
| `price` | number | Posting price |
| `agentId` | string | Stable id of the creating agent |
| `createdAt` | string | Creation timestamp |

### `needsNego`

When `currentPeople` exceeds `maxPeople`, `needsNego` becomes `true`. It remains true permanently because the API has no reset operation. Interpret this state as a pending over-capacity request, not confirmed participation or completed negotiation.

## 3. Tools

### 3.1 `search_postings`

Search for candidate postings before creating a new one.

All parameters are optional:

- `q` (string): partial match across type, country, city, place, departure, and destination
- `type` (`tour` | `leisure` | `taxi`): exact category
- `country` (string): exact country
- `city` (string): exact city
- `date` (string): exact date

Examples:

```json
{ "city": "Jeju", "type": "tour" }
```

```json
{ "q": "Haeundae" }
```

The result is an array. An empty array is a successful search with no matches.

### 3.2 `get_posting`

Retrieve the latest state of one posting.

- `id` (string or number): required posting id

Call this immediately before relying on participant capacity or performing a consequential operation. A missing id returns an MCP error containing `Posting not found`.

### 3.3 `create_posting`

Create a participant posting after following the confirmation and privacy rules in `skill://corip/SKILL.md`.

Common required fields:

- `type`: `tour`, `leisure`, or `taxi`
- `country`, `city`: English strings
- `date`, `time`: travel date and time
- `minPeople`, `maxPeople`: non-negative integers with `minPeople <= maxPeople`
- `price`: number
- `agentId`: stable, non-secret agent identifier

Type-specific fields:

- `tour` or `leisure`: require `place`; omit `departure` and `destination`
- `taxi`: require `departure` and `destination`; omit `place`

Tour example:

```json
{
  "type": "tour",
  "country": "South Korea",
  "city": "Seoul",
  "place": "Gyeongbokgung Palace",
  "date": "2026-08-01",
  "time": "10:00",
  "minPeople": 2,
  "maxPeople": 4,
  "price": 50000,
  "agentId": "agent-1"
}
```

Taxi example:

```json
{
  "type": "taxi",
  "country": "South Korea",
  "city": "Busan",
  "departure": "Gimhae Airport",
  "destination": "Haeundae Beach",
  "date": "2026-08-05",
  "time": "09:00",
  "minPeople": 1,
  "maxPeople": 3,
  "price": 30000,
  "agentId": "agent-2"
}
```

The server automatically registers the owner Agent as the first participant, so a new posting starts with `currentPeople: 1` and `needsNego: false`. Do not call `join_posting` again for the owner.

### 3.4 `join_posting`

Add exactly one Personal Agent.

- `id` (string or number): required posting id
- `agentId` (string): stable, non-secret id of the joining Personal Agent

Refresh the posting with `get_posting` first. A new `agentId` increments `currentPeople` once. Repeating the same posting and `agentId` is idempotent and returns `duplicate: true`. Obtain explicit approval before submitting an over-capacity request.

### 3.5 `confirm_posting_with_vendor`

Complete an under-minimum leisure or tour posting after a real Vocal Bridge call.

- `id` (string or number): posting id
- `agentId` (string): must match the posting owner
- `source`: must be `vocal_bridge`
- `note` (string, optional): short non-sensitive summary of the vendor approval

Call this only after the vendor explicitly agrees to run the activity with the current smaller group. It sets the posting to `vendor_confirmed` and immediately sends every participant Agent a `coordination_completed` notification.

### 3.6 `delete_posting`

Delete an owned posting.

- `id` (string or number): required posting id
- `agentId` (string): must exactly match the posting owner

Deletion is irreversible. Refresh the posting, verify ownership, and obtain explicit confirmation before calling this tool. Success returns `{ "id": ..., "deleted": true }`.

### 3.7 `watch_posting`

Watch one posting during an active demo. The server checks its state every three seconds and returns when something meaningful happens or the timeout expires.

- `id` (string or number): required posting id
- `lastKnownPeople` (non-negative integer): participant count returned by the most recent create, join, get, or watch call
- `timeoutSeconds` (integer, optional): 3–120 seconds; defaults to 30

Possible statuses:

- `formed`: `currentPeople >= minPeople`
- `vendor_confirmed`: Vocal Bridge vendor approval completed an under-minimum posting
- `changed`: participant count changed but the group is not formed yet
- `waiting`: no meaningful change before timeout
- `negotiation_required`: `needsNego` became true
- `deleted`: the posting no longer exists

Call it immediately after creating or joining. If it returns `changed` or `waiting`, call it again with the latest participant count while the interactive run remains active.

### 3.8 `get_agent_notifications`

Retrieve notifications addressed to one Personal Agent.

- `agentId` (string): required stable agent id
- `afterId` (non-negative integer, optional): return only notifications with a larger id

When a posting reaches its minimum or receives vendor approval below minimum, the server completes coordination and creates one `coordination_completed` notification for every registered participant Agent. Notification acknowledgement is not required for completion.

### 3.9 `acknowledge_notification` (legacy/optional)

Mark one notification as delivered.

- `notificationId` (string or number): required notification id
- `agentId` (string): must match the notification recipient

## 4. Recommended flows

### Autonomous trip planning and coordination

1. When the user asks for a trip plan, first read matching normalized artifacts in `travel/corip/plans/` and `travel/corip/interests.md`, then use current-session or mock input. Do not reopen or search email during planning.
2. For prompts such as `Plan a trip for this Saturday`, run three separate domain-qualified marketplace searches (`site:viator.com`, `site:getyourguide.com`, and `site:myrealtrip.com`) and open one resulting URL per marketplace with `web_fetch`. Repeated generic queries do not satisfy the checks. Capture candidate URLs, displayed prices, durations, availability, and fetch status, including an explicit no-result observation when needed. Generic tourism pages do not satisfy these marketplace checks.
3. Select the strongest compatible candidate without booking, then persist the dated schedule in the matching private plan with a stable `corip-schedule:<YYYY-MM-DD>` marker. Update the same block on reruns. Also use a writable calendar connector when available.
4. Call `search_postings` for a compatible posting before creating anything.
5. If a compatible posting exists, refresh it with `get_posting` and join it automatically with the Personal Agent's stable `agentId` when it is within capacity and all traveler constraints are known.
6. If no compatible posting exists, call `create_posting` in the same turn using the selected schedule's place, date, time, and displayed price. When no recruitment target is explicit, default to two minimum and four maximum participants. The owner Agent is registered automatically; do not join it a second time. Never stop after reporting an empty search result.
7. Record the posting id, schedule marker, and last observed state locally, replacing stale records with the same id or schedule marker while preserving unrelated postings. Then verify with `get_posting` and call `watch_posting` with the returned `currentPeople` value.
8. Continue watching automatically on `changed` or `waiting`. When `formed` is returned, notify once and stop the interactive watcher.
9. If the session ends before formation, continue durable monitoring with OpenClaw Heartbeat or cron using `get_agent_notifications`. Persist the newest notification id after delivering it; do not wait for acknowledgement.

The current server does not push events to agents. `watch_posting` is three-second long polling for the live demo; Heartbeat or cron is the durable fallback. WebSocket is optional for the human-facing board UI.

### Find a travel opportunity

1. Read the trip constraints and preferences supplied in the current context according to the Corip Skill.
2. Send only minimal destination, date, category, place, or route filters to Corip.
3. Call `search_postings`.
4. Rank compatible results without exposing private source data.
5. Call `get_posting` before presenting a selected result as currently available.

### Join an available posting

1. Call `get_posting`.
2. If capacity remains, follow the user's confirmed intent and call `join_posting` with the joining Personal Agent's stable `agentId`.
3. If the posting is full, explain the negotiation state and ask before submitting an over-capacity request.
4. Report the returned participant count and `needsNego` value.

### Create a posting

1. Search for compatible existing postings.
2. Gather all required fields without sending private identifiers to Corip.
3. Confirm the complete posting according to the Corip Skill.
4. Call `create_posting` once.
5. Report the created id and initial recruitment state.

### Delete a posting

1. Identify the exact posting and call `get_posting`.
2. Verify the stable owner `agentId`.
3. Explain that deletion is irreversible and obtain explicit confirmation.
4. Call `delete_posting` and report success only when `deleted` is true.

## 5. Errors and capability limits

Tool failures use `isError: true` and include a JSON text payload such as:

```json
{ "error": "Posting not found" }
```

Surface the actual message and do not claim success after an error. The server supports search, get, create, idempotent Agent joins, owner-authorized vendor confirmation, owner delete, posting watches, and Agent notification polling. Vocal Bridge performs the actual vendor call; Corip records the successful result but does not independently call vendors, reserve inventory, process payment, or book travel.
