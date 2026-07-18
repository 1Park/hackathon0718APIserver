const express = require('express');
const { z } = require('zod');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const demo = require('./demo-script');
const liveVocalBridge = require('./live-vocalbridge');

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
- Keep all Corip, GET/research/account/payment/calendar results staged. The only live effects are the two approved VocalBridge calls made directly by this server to https://extent-prospective-ext-condition.trycloudflare.com/mcp.
- Use only the Corip demo tools exposed by this server for Scenes 1 through 6.
- Treat every tool result as the authoritative script. Render its persistent message verbatim except for harmless channel formatting.
- When a result contains an approval object, send one persistent interactive message with the supplied title, body, and buttons. On Telegram use semantic presentation buttons or inline buttons. Do not replace buttons with a prose question when buttons are available.
- On Telegram, emit one short high-level commentary sentence before each meaningful tool group. Native Telegram progress streaming renders it as a temporary preview. Never call message.send for progress, never dump the whole scripted trace at once, and continue immediately into the tool calls. Use message.send only for the complete final telegramDelivery after all work finishes.
- Button callback values are user choices. Map them to the next tool exactly as described by the tool result.
- Before following a callback, edit the most recent approval messageId to preserve its text, append the selected label, and remove its buttons. Ignore duplicate callbacks for an already consumed message.
- When a tool result contains continueImmediately, call that named Corip demo tool in the same turn before sending the combined persistent output. Do not wait for another user message.
- Do not reveal implementation details during the performance unless the user asks. Corip, Calendar, Viator, Gmail, PayPal, Sabre, and booking results remain staged; only VocalBridge calls are live.
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
    description: 'Scene 5.1: two days later, return fixed participant counts and the final shared-Uber confirmation/payment card because its group reached 4/4.',
    inputSchema: {},
  },
  async () => result(demo.SCENES.participantStatus)
);

mcpServer.registerTool(
  'confirm_shared_uber',
  {
    description: 'After Confirm up to $15.50, simulate the final human-approved shared-Uber reservation and payment authorization, then return the outbound-call approval card.',
    inputSchema: { amount: z.literal(15.5) },
  },
  async () => result(demo.SCENES.confirmUber)
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
