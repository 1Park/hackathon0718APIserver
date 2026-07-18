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

The server exposes six tools after connection.

### Install native Corip approval controls

The Skill cannot create an OpenClaw approval card by prose alone. Install the bundled native plugin before the email phase so setup can call `corip_approve_email_sync`:

```bash
cd plugins/corip-approvals
npm install
npm run plugin:validate
openclaw plugins install .
openclaw gateway restart
```

When setup starts from only the public MCP URL and the tool is missing, read `plugin://corip-approvals/bundle.json`. Accept only format `corip-openclaw-plugin-bundle-v1`, plugin id `corip-approvals`, and the exact unique path set `package.json`, `openclaw.plugin.json`, `dist/index.js`, and `README.md`. Reject absolute paths, traversal, links, extra or duplicate files, manifest id mismatch, or any lowercase SHA-256 digest mismatch. Materialize the verified files in a new narrowly scoped temporary directory, install that directory with `openclaw plugins install <temporary-directory>`, restart the Gateway, and stop the current setup turn. Resume only after `corip_approve_email_sync` is available.

The plugin-install or Skill Workshop approval authorizes only that named operation. It is not email consent. After the plugin is loaded, call `corip_approve_email_sync` with the non-secret connector label, exact cron expression, and IANA timezone. The resulting native card covers read-only travel-email access, model-assisted local summaries, and the recurring `corip-travel-email-sync` cron. Never substitute a prose permission question. On denial, timeout, or missing approval routing, leave email and cron configuration unchanged.

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

The server initializes `currentPeople` to `0` and `needsNego` to `false`.

### 3.4 `join_posting`

Add exactly one participant.

- `id` (string or number): required posting id

Refresh the posting with `get_posting` first. One call always increments `currentPeople` by one, even when the posting is full. For multiple participants, call once per person and inspect each result. Obtain explicit approval before submitting an over-capacity request.

### 3.5 `delete_posting`

Delete an owned posting.

- `id` (string or number): required posting id
- `agentId` (string): must exactly match the posting owner

Deletion is irreversible. Refresh the posting, verify ownership, and obtain explicit confirmation before calling this tool. Success returns `{ "id": ..., "deleted": true }`.

### 3.6 `watch_posting`

Watch one posting during an active demo. The server checks its state every three seconds and returns when something meaningful happens or the timeout expires.

- `id` (string or number): required posting id
- `lastKnownPeople` (non-negative integer): participant count returned by the most recent create, join, get, or watch call
- `timeoutSeconds` (integer, optional): 3–120 seconds; defaults to 30

Possible statuses:

- `formed`: `currentPeople >= minPeople`
- `changed`: participant count changed but the group is not formed yet
- `waiting`: no meaningful change before timeout
- `negotiation_required`: `needsNego` became true
- `deleted`: the posting no longer exists

Call it immediately after creating or joining. If it returns `changed` or `waiting`, call it again with the latest participant count while the interactive run remains active.

## 4. Recommended flows

### Autonomous trip planning and coordination

1. When the user asks for a trip plan, first read matching normalized artifacts in `travel/corip/plans/` and `travel/corip/interests.md`, then use current-session or mock input. Do not reopen or search email during planning.
2. Begin web or travel-tool research immediately without asking whether to proceed. Internally compare viable candidates and select the strongest one from known constraints.
3. Call `search_postings` for a compatible posting before creating anything.
4. If a compatible posting exists, refresh it with `get_posting` and join it automatically when it is within capacity and all traveler constraints are known.
5. If no compatible posting exists, call `create_posting` as soon as all required fields are known, then count the creator's party with one `join_posting` call per participant.
6. Record the posting id and last observed state locally, then call `watch_posting` with the returned `currentPeople` value. It checks every three seconds during an active demo.
7. Continue watching automatically on `changed` or `waiting`. When `formed` is returned, notify once and stop the interactive watcher.
8. If the session ends before formation, continue durable monitoring with OpenClaw Heartbeat or cron using `get_posting`.

The current server does not push events to agents. `watch_posting` is three-second long polling for the live demo; Heartbeat or cron is the durable fallback. WebSocket is optional for the human-facing board UI.

### Find a travel opportunity

1. Read the trip constraints and preferences supplied in the current context according to the Corip Skill.
2. Send only minimal destination, date, category, place, or route filters to Corip.
3. Call `search_postings`.
4. Rank compatible results without exposing private source data.
5. Call `get_posting` before presenting a selected result as currently available.

### Join an available posting

1. Call `get_posting`.
2. If capacity remains, follow the user's confirmed intent and call `join_posting` once per participant.
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

Surface the actual message and do not claim success after an error. The server supports only search, get, create, join-one-person, and owner delete. It does not edit postings, remove one participant, message organizers, reserve inventory, process payment, complete negotiation, book travel, or call vendors.
