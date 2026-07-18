const express = require('express');
const { z } = require('zod');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const demo = require('./demo-script');
const liveCorip = require('./live-corip');
const liveVocalBridge = require('./live-vocalbridge');
const postings = require('./postings');
const { watchPosting } = require('./watch-posting');

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

const INSTRUCTIONS = `
Corip is running in hybrid demo mode for the complete July 24-26 San Diego itinerary, Scenes 1 through 6.

Mandatory behavior:
- Keep all GET/research/account/payment/calendar results staged. The only live effects are the explicitly approved Corip production MCP posting mutations and two VocalBridge calls made directly by this server to https://extent-prospective-ext-condition.trycloudflare.com/mcp.
- Use only the Corip demo tools exposed by this server for Scenes 1 through 6.
- Treat every tool result as the authoritative script. Render its persistent message verbatim except for harmless channel formatting.
- When a result contains an approval object, send one persistent interactive message with the supplied title, body, and buttons. On Telegram use semantic presentation buttons or inline buttons. Do not replace buttons with a prose question when buttons are available.
- On Telegram, emit one short high-level commentary sentence before each meaningful tool group. Native Telegram progress streaming renders it as a temporary preview. Never call message.send for progress, never dump the whole scripted trace at once, and continue immediately into the tool calls. Use message.send only for the complete final telegramDelivery after all work finishes.
- Button callback values are user choices. Map them to the next tool exactly as described by the tool result.
- Before following a callback, edit the most recent approval messageId to preserve its text, append the selected label, and remove its buttons. Ignore duplicate callbacks for an already consumed message.
- When a tool result contains continueImmediately, call that named Corip demo tool in the same turn before sending the combined persistent output. Do not wait for another user message.
- Do not reveal implementation details during the performance unless the user asks. Calendar, Viator, Gmail, PayPal, Sabre, and booking results remain staged; Corip production POSTs and VocalBridge calls are live.
- Do not run real email sync, cron, heartbeat, plugin installation, Gateway restart, marketplace research, Gmail, PayPal, Sabre, Calendar, Viator, or payment tools.
- Never skip ahead. Never purchase the kayak before the user selects Confirm $72.00. Never cancel Balboa Park before the user selects Cancel Activity.

Read demo://corip/script for the full canonical scene script. Start Scene 1 with begin_initial_setup.
`.trim();

const mcpServer = new McpServer(
  { name: 'corip-demo', version: '2.0.0' },
  { instructions: INSTRUCTIONS }
);

function result(value) {
  const payload = {
    ...value,
    telegramDelivery: demo.buildTelegramDelivery(value),
  };
  return {
    content: [{ type: 'text', text: JSON.stringify(payload) }],
    structuredContent: payload,
  };
}

function liveResult(value) {
  return {
    content: [{ type: 'text', text: JSON.stringify(value) }],
    structuredContent: value,
  };
}

function postingResult(value) {
  return liveResult(value);
}

function postingError(message) {
  return {
    isError: true,
    content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
  };
}

// Production posting tools used by Personal Agents and the live demo wrappers.
mcpServer.registerTool('search_postings', {
  description: 'Search Corip postings.',
  inputSchema: {
    q: z.string().optional(), type: z.enum(postings.VALID_TYPES).optional(),
    country: z.string().optional(), city: z.string().optional(),
    date: z.string().optional(), agentId: z.string().optional(),
  },
}, async (input) => postingResult(postings.search(input)));

mcpServer.registerTool('get_posting', {
  description: 'Get one Corip posting.',
  inputSchema: { id: z.union([z.string(), z.number()]) },
}, async ({ id }) => {
  const posting = postings.getById(id);
  return posting ? postingResult(posting) : postingError('Posting not found');
});

mcpServer.registerTool('create_posting', {
  description: 'Create a Corip posting. The owner is participant one.',
  inputSchema: {
    type: z.enum(postings.VALID_TYPES), title: z.string().optional(), description: z.string().optional(),
    country: z.string(), city: z.string(), place: z.string().optional(),
    departure: z.string().optional(), destination: z.string().optional(),
    date: z.string(), time: z.string(), minPeople: z.number().int().positive(),
    maxPeople: z.number().int().positive(), price: z.number(), agentId: z.string(),
  },
}, async (input) => {
  const error = postings.validateCreateInput(input);
  return error ? postingError(error) : postingResult(postings.create(input));
});

mcpServer.registerTool('join_posting', {
  description: 'Join one Personal Agent to a posting idempotently.',
  inputSchema: { id: z.union([z.string(), z.number()]), agentId: z.string() },
}, async ({ id, agentId }) => {
  const value = postings.join(id, agentId);
  if (!value) return postingError('Posting not found');
  return value.error ? postingError(value.error) : postingResult(value);
});

mcpServer.registerTool('confirm_posting_with_vendor', {
  description: 'Complete an under-minimum tour or leisure posting after VocalBridge approval.',
  inputSchema: {
    id: z.union([z.string(), z.number()]), agentId: z.string(),
    source: z.literal('vocal_bridge'), note: z.string().optional(),
  },
}, async ({ id, agentId, source, note }) => {
  const value = postings.confirmByVendor(id, { agentId, source, note });
  if (!value) return postingError('Posting not found');
  return value.error ? postingError(value.error) : postingResult(value);
});

mcpServer.registerTool('delete_posting', {
  description: 'Delete an owned Corip posting.',
  inputSchema: { id: z.union([z.string(), z.number()]), agentId: z.string() },
}, async ({ id, agentId }) => {
  const state = postings.remove(id, agentId);
  if (state === 'not_found') return postingError('Posting not found');
  if (state === 'forbidden') return postingError('Only the posting owner can delete it');
  return postingResult({ id: Number(id), deleted: true });
});

mcpServer.registerTool('watch_posting', {
  description: 'Long-poll a Corip posting for participant or completion changes.',
  inputSchema: {
    id: z.union([z.string(), z.number()]), lastKnownPeople: z.number().int().nonnegative(),
    timeoutSeconds: z.number().int().min(3).max(120).optional(),
  },
}, async ({ id, lastKnownPeople, timeoutSeconds }) => postingResult(
  await watchPosting(postings.getById, id, lastKnownPeople, timeoutSeconds ?? 30)
));

mcpServer.registerTool('get_agent_notifications', {
  description: 'Get completion notifications for a Personal Agent.',
  inputSchema: { agentId: z.string(), afterId: z.number().int().nonnegative().optional() },
}, async ({ agentId, afterId }) => postingResult(postings.listNotifications(agentId, afterId ?? 0)));

mcpServer.registerTool('acknowledge_notification', {
  description: 'Mark a Personal Agent notification as read.',
  inputSchema: { notificationId: z.union([z.string(), z.number()]), agentId: z.string() },
}, async ({ notificationId, agentId }) => {
  const value = postings.acknowledgeNotification(notificationId, agentId);
  return value ? postingResult(value) : postingError('Notification not found');
});

mcpServer.registerResource(
  'corip-demo-script',
  'demo://corip/script',
  {
    title: 'Canonical Corip Demo Script',
    description: 'Exact Scenes 3-6 role-play script and button transitions',
    mimeType: 'text/markdown',
  },
  async (uri) => ({
    contents: [{ uri: uri.href, mimeType: 'text/markdown', text: demo.FULL_SCRIPT }],
  })
);

mcpServer.registerResource(
  'corip-skill',
  'skill://corip/SKILL.md',
  {
    title: 'Corip Demo Skill',
    description: 'Deterministic OpenClaw role-play workflow for the Corip demo',
    mimeType: 'text/markdown',
  },
  async (uri) => ({
    contents: [{ uri: uri.href, mimeType: 'text/markdown', text: demo.readSkill() }],
  })
);

mcpServer.registerTool(
  'sync_live_demo_postings',
  {
    description: 'Perform the approved real Corip production POST mutations and deterministically synchronize the demo website counts. Use initial only after Continue and two_days_later only during the participant follow-up.',
    inputSchema: { stage: z.enum(['initial', 'two_days_later']) },
  },
  async ({ stage }) => liveResult(
    stage === 'initial'
      ? await liveCorip.syncInitialPostings()
      : await liveCorip.syncTwoDaysLater()
  )
);

mcpServer.registerTool(
  'confirm_live_kayak_posting',
  {
    description: 'After a successful approved VocalBridge kayak call, perform the real production vendor-confirm POST for the owned kayak demo posting.',
    inputSchema: {},
  },
  async () => liveResult(await liveCorip.confirmKayak())
);

mcpServer.registerTool(
  'cancel_live_balboa_posting',
  {
    description: 'After Cancel Activity, perform the real production delete POST for only the owned Balboa demo posting.',
    inputSchema: {},
  },
  async () => liveResult(await liveCorip.cancelBalboa())
);

mcpServer.registerTool(
  'run_live_operator_calls',
  {
    description: 'After Allow Calls only, connect directly to the fixed VocalBridge MCP URL and make the two approved negotiation calls with all seven required activity fields.',
    inputSchema: { decision: z.literal('allow_calls') },
  },
  async () => liveResult(await liveVocalBridge.runOperatorCalls())
);

mcpServer.registerTool(
  'begin_initial_setup',
  {
    description: 'Scene 1.1: simulate inspection of the supplied Corip MCP URL and return the Connect Corip MCP approval card.',
    inputSchema: { url: z.literal('https://corip-postings-kimmc3423.fly.dev/mcp') },
  },
  async () => result(demo.SCENES.initialSetup)
);

mcpServer.registerTool(
  'connect_corip',
  {
    description: 'After Always Allow Corip, simulate the MCP connection and skill creation, then return the Gmail travel-access approval card.',
    inputSchema: { decision: z.literal('always_allow_corip') },
  },
  async () => result(demo.SCENES.connectCorip)
);

mcpServer.registerTool(
  'enable_travel_email_workflow',
  {
    description: 'After Allow Travel Emails, simulate read-only Gmail and the daily 8 AM workflow, then return the Sabre setup card.',
    inputSchema: { decision: z.literal('allow_travel_emails') },
  },
  async () => result(demo.SCENES.enableTravelEmail)
);

mcpServer.registerTool(
  'complete_sabre_setup',
  {
    description: 'After the Sabre Open Setup Page choice, simulate OAuth and permission verification, then return the VocalBridge setup card.',
    inputSchema: { decision: z.literal('open_sabre_setup') },
  },
  async () => result(demo.SCENES.setupSabre)
);

mcpServer.registerTool(
  'complete_vocalbridge_setup',
  {
    description: 'After the VocalBridge Open Setup Page choice, simulate phone verification and return the complete setup summary.',
    inputSchema: { decision: z.literal('open_vocalbridge_setup') },
  },
  async () => result(demo.SCENES.setupVocalBridge)
);

mcpServer.registerTool(
  'review_trip_request',
  {
    description: 'Scene 2.1: simulate review of memory, travel email, and Sabre, show the urgent issue first, then return the PayPal balance-check approval card.',
    inputSchema: {},
  },
  async () => result(demo.SCENES.reviewTrip)
);

mcpServer.registerTool(
  'check_balance_and_find_hotel',
  {
    description: 'After Allow Once, simulate a balance check and Hilton availability search without repeating the urgent issue, then return the $438.16 rebooking approval card.',
    inputSchema: { decision: z.literal('allow_balance_once') },
  },
  async () => result(demo.SCENES.findHotel)
);

mcpServer.registerTool(
  'confirm_hotel_rebooking',
  {
    description: 'After Confirm $438.16, simulate Sabre booking, Gmail confirmation, and trip-memory update, then immediately continue to Saturday candidate research in the same turn.',
    inputSchema: { amount: z.literal(438.16) },
  },
  async () => result(demo.SCENES.confirmHotel)
);

mcpServer.registerTool(
  'get_saturday_candidates',
  {
    description: 'Scene 3: return the three fixed Saturday candidates and the Select activities button card.',
    inputSchema: {},
  },
  async () => result(demo.SCENES.saturdayCandidates)
);

mcpServer.registerTool(
  'register_saturday_plan',
  {
    description: 'Scene 4: after Continue, simulate joining/creating all three activities and return the registered plan and waiting reservation status.',
    inputSchema: { selection: z.literal('all').default('all') },
  },
  async () => result(demo.SCENES.registerPlan)
);

mcpServer.registerTool(
  'get_participant_status',
  {
    description: 'Scene 5.1: two days later, return fixed participant counts and the outbound-call approval card.',
    inputSchema: {},
  },
  async () => result(demo.SCENES.participantStatus)
);

mcpServer.registerTool(
  'complete_operator_calls',
  {
    description: 'Scene 5.3: after the direct live VocalBridge wrapper succeeds, return the canonical call results plus the kayak confirmation card.',
    inputSchema: { decision: z.literal('allow_calls') },
  },
  async () => result(demo.SCENES.operatorCalls)
);

mcpServer.registerTool(
  'confirm_kayak_tour',
  {
    description: 'After Confirm $72.00, simulate the kayak reservation, updates, and confirmation email, then show the Balboa Park decision card.',
    inputSchema: { amount: z.literal(72) },
  },
  async () => result(demo.SCENES.confirmKayak)
);

mcpServer.registerTool(
  'cancel_balboa_activity',
  {
    description: 'After Cancel Activity, simulate cancellation, participant notification, and calendar removal.',
    inputSchema: { decision: z.literal('cancel_activity') },
  },
  async () => result(demo.SCENES.cancelBalboa)
);

mcpServer.registerTool(
  'get_final_trip_summary',
  {
    description: 'Scene 6: return the fixed Saturday itinerary and completed-actions list.',
    inputSchema: {},
  },
  async () => result(demo.SCENES.finalSummary)
);

app.get('/', (_req, res) => {
  res.json({ name: 'corip-demo', mode: 'role-play', version: '2.0.0', mcp: '/mcp' });
});

app.post('/mcp', async (req, res) => {
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on('close', () => transport.close());
  await mcpServer.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.post('/postings', (req, res) => {
  const error = postings.validateCreateInput(req.body);
  if (error) return res.status(400).json({ error });
  return res.status(201).json(postings.create(req.body));
});

app.get('/postings/search', (req, res) => {
  const { q, type, country, city, date, agentId } = req.query;
  res.json(postings.search({ q, type, country, city, date, agentId }));
});

app.get('/postings/:id', (req, res) => {
  const posting = postings.getById(req.params.id);
  return posting ? res.json(posting) : res.status(404).json({ error: 'Posting not found' });
});

app.get('/postings/:id/delivery-status', (req, res) => {
  const value = postings.getDeliveryStatus(req.params.id);
  return value ? res.json(value) : res.status(404).json({ error: 'Posting not found' });
});

app.post('/postings/:id/join', (req, res) => {
  const value = postings.join(req.params.id, req.body.agentId);
  if (!value) return res.status(404).json({ error: 'Posting not found' });
  return value.error ? res.status(400).json(value) : res.json(value);
});

app.post('/postings/:id/confirm', (req, res) => {
  const value = postings.confirmByVendor(req.params.id, req.body);
  if (!value) return res.status(404).json({ error: 'Posting not found' });
  return value.error ? res.status(400).json(value) : res.json(value);
});

app.delete('/postings/:id', (req, res) => {
  const state = postings.remove(req.params.id, req.body.agentId);
  if (state === 'not_found') return res.status(404).json({ error: 'Posting not found' });
  if (state === 'forbidden') return res.status(403).json({ error: 'Only the posting owner can delete it' });
  return res.json({ id: Number(req.params.id), deleted: true });
});

app.get('/agents/:agentId/notifications', (req, res) => {
  const afterId = Number(req.query.afterId ?? 0);
  if (!Number.isInteger(afterId) || afterId < 0) return res.status(400).json({ error: 'Invalid afterId' });
  return res.json(postings.listNotifications(req.params.agentId, afterId));
});

app.use((err, req, res, _next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'The request body is not valid JSON' });
  }
  console.error(err);
  return res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Corip demo MCP listening at http://localhost:${PORT}`);
});
