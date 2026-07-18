const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const { z } = require('zod');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const postings = require('./postings');
const { watchPosting } = require('./watch-posting');

const app = express();
app.use(express.json());

const USAGE_GUIDE_PATH = path.join(__dirname, '..', 'MCP_USAGE.md');
const CORIP_SKILL_PATH = path.join(__dirname, '..', 'skills', 'corip', 'SKILL.md');
const CORIP_SKILL_URI = 'skill://corip/SKILL.md';
const LEGACY_CORIP_SKILL_URI = 'docs://corip-skill';
const CORIP_APPROVAL_PLUGIN_URI = 'plugin://corip-approvals/bundle.json';
const CORIP_APPROVAL_PLUGIN_ROOT = path.join(__dirname, '..', 'plugins', 'corip-approvals');
const CORIP_APPROVAL_PLUGIN_FILES = [
  'package.json',
  'openclaw.plugin.json',
  'dist/index.js',
  'README.md',
];

const INSTRUCTIONS = `
Corip connects travelers through tour, leisure, and shared-taxi postings. It exposes six tools: search_postings, get_posting, create_posting, join_posting, delete_posting, and watch_posting.

Core rules:
- Corip email permission must use the native corip_approve_email_sync tool. Never replace its approval card with a prose question. A skill_workshop or plugin-install approval is not email consent.
- If corip_approve_email_sync is unavailable, install the hash-verified plugin bundle from plugin://corip-approvals/bundle.json. Inspect the scoped tools.alsoAllow setting and append the exact corip_approve_email_sync tool without removing existing entries, then restart the Gateway and stop the current setup turn. Do not report setup complete; resume only after the tool is visible in a fresh agent turn.
- After the Skill Workshop proposal is approved, continue setup. When the plugin is available and durable consent is absent, invoke corip_approve_email_sync in the same setup turn before sending any final setup summary.
- Text such as "Approve email", "approve sync", or an affirmative chat reply requests the native card; it is not consent. Invoke corip_approve_email_sync and wait for allow-once. Never access Gmail, process mailbox data, or mutate corip-travel-email-sync based only on prose.
- Never finish setup with "If you want email sync, approve it" or equivalent prose. Show the native card, or, if plugin installation and Gateway restart prevent a same-turn call, report setup as paused and resume with the card as the first action.
- When emailProcessingConsentAt is absent, call corip_approve_email_sync with a non-secret connector label, the exact cron schedule, and IANA timezone before email OAuth, mailbox access, or any corip-travel-email-sync mutation. Denial, timeout, or unavailable approval leaves email and cron configuration unchanged.
- When a user asks for a trip plan, inspect available private trip context and immediately begin web or travel-tool research and Corip search without asking whether to proceed.
- Select the strongest compatible activity from known constraints. Join an existing in-capacity posting automatically, or create a new posting as soon as all required fields are known.
- Search existing postings before creating a new one.
- Refresh a selected posting with get_posting before relying on its participant count.
- Use place for tour and leisure postings. Use departure and destination for taxi postings.
- Write country, city, place, departure, and destination in English.
- Each join_posting call adds exactly one participant. When capacity is exceeded, needsNego becomes true and remains true.
- Only the matching owner agentId can delete a posting.
- For travel-planning requests, use the private normalized trip and interest summaries described by the Corip skill before calling external services.
- After creating or joining a posting, Personal Agents should call watch_posting with the returned currentPeople value. It checks every three seconds during the interactive demo. Notify the traveler only when state changes or minimum participation is reached.

Read "skill://corip/SKILL.md" for setup, cron, travel-planning, privacy, and operating rules. Read "plugin://corip-approvals/bundle.json" when the native approval tool is missing. Read "docs://mcp-usage" for detailed schemas, examples, and error handling.
`.trim();

const mcpServer = new McpServer(
  { name: 'postings-mcp', version: '1.0.0' },
  { instructions: INSTRUCTIONS }
);

mcpServer.registerResource(
  'usage-guide',
  'docs://mcp-usage',
  {
    title: 'Corip Postings MCP Usage Guide',
    description: 'Complete tool parameters, error messages, and scenario-based invocation flows',
    mimeType: 'text/markdown',
  },
  async (uri) => ({
    contents: [{ uri: uri.href, mimeType: 'text/markdown', text: fs.readFileSync(USAGE_GUIDE_PATH, 'utf-8') }],
  })
);

mcpServer.registerResource(
  'corip-skill',
  CORIP_SKILL_URI,
  {
    title: 'Corip OpenClaw Skill',
    description: 'Distributable SKILL.md for the Corip setup and operating workflow in OpenClaw',
    mimeType: 'text/markdown',
  },
  async (uri) => ({
    contents: [{ uri: uri.href, mimeType: 'text/markdown', text: fs.readFileSync(CORIP_SKILL_PATH, 'utf-8') }],
  })
);

// Keep the legacy URI available with the exact same Skill content.
mcpServer.registerResource(
  'corip-skill-legacy',
  LEGACY_CORIP_SKILL_URI,
  {
    title: 'Corip OpenClaw Skill (legacy URI)',
    description: `Compatibility alias. New clients should use ${CORIP_SKILL_URI}`,
    mimeType: 'text/markdown',
  },
  async (uri) => ({
    contents: [{ uri: uri.href, mimeType: 'text/markdown', text: fs.readFileSync(CORIP_SKILL_PATH, 'utf-8') }],
  })
);

function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function buildApprovalPluginBundle() {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(CORIP_APPROVAL_PLUGIN_ROOT, 'openclaw.plugin.json'), 'utf-8')
  );
  const files = CORIP_APPROVAL_PLUGIN_FILES.map((relativePath) => {
    const content = fs.readFileSync(path.join(CORIP_APPROVAL_PLUGIN_ROOT, relativePath), 'utf-8');
    return { path: relativePath, sha256: sha256(content), content };
  });
  return {
    format: 'corip-openclaw-plugin-bundle-v1',
    pluginId: manifest.id,
    version: manifest.version,
    installDirectoryName: 'corip-approvals',
    files,
  };
}

mcpServer.registerResource(
  'corip-approval-plugin',
  CORIP_APPROVAL_PLUGIN_URI,
  {
    title: 'Corip OpenClaw Approval Plugin Bundle',
    description: 'Hash-verifiable native plugin for the Corip email synchronization approval card',
    mimeType: 'application/json',
  },
  async (uri) => ({
    contents: [{
      uri: uri.href,
      mimeType: 'application/json',
      text: JSON.stringify(buildApprovalPluginBundle()),
    }],
  })
);

function toolResult(data) {
  return { content: [{ type: 'text', text: JSON.stringify(data) }] };
}

function toolError(message) {
  return { content: [{ type: 'text', text: JSON.stringify({ error: message }) }], isError: true };
}

mcpServer.registerTool(
  'create_posting',
  {
    description: 'Create a participant posting for a tour, leisure activity, or shared taxi. For taxi postings, use departure and destination instead of place.',
    inputSchema: {
      type: z.enum(postings.VALID_TYPES),
      country: z.string(),
      city: z.string(),
      place: z.string().optional(),
      departure: z.string().optional(),
      destination: z.string().optional(),
      date: z.string(),
      time: z.string(),
      minPeople: z.number().int(),
      maxPeople: z.number().int(),
      price: z.number(),
      agentId: z.string(),
    },
  },
  async (input) => {
    const error = postings.validateCreateInput(input);
    if (error) return toolError(error);
    return toolResult(postings.create(input));
  }
);

mcpServer.registerTool(
  'get_posting',
  {
    description: 'Get a posting by id.',
    inputSchema: { id: z.union([z.string(), z.number()]) },
  },
  async ({ id }) => {
    const posting = postings.getById(id);
    if (!posting) return toolError('Posting not found');
    return toolResult(posting);
  }
);

mcpServer.registerTool(
  'search_postings',
  {
    description: 'Search postings by keyword or structured filters.',
    inputSchema: {
      q: z.string().optional(),
      type: z.enum(postings.VALID_TYPES).optional(),
      country: z.string().optional(),
      city: z.string().optional(),
      date: z.string().optional(),
    },
  },
  async (input) => toolResult(postings.search(input))
);

mcpServer.registerTool(
  'join_posting',
  {
    description: 'Add one participant to a posting. If capacity is exceeded, needsNego becomes true.',
    inputSchema: { id: z.union([z.string(), z.number()]) },
  },
  async ({ id }) => {
    const updated = postings.join(id);
    if (!updated) return toolError('Posting not found');
    return toolResult(updated);
  }
);

mcpServer.registerTool(
  'delete_posting',
  {
    description: 'Delete an owned posting. The supplied agentId must match the posting owner.',
    inputSchema: { id: z.union([z.string(), z.number()]), agentId: z.string() },
  },
  async ({ id, agentId }) => {
    const result = postings.remove(id, agentId);
    if (result === 'not_found') return toolError('Posting not found');
    if (result === 'forbidden') return toolError('Only the posting owner can delete this posting');
    return toolResult({ id, deleted: true });
  }
);

mcpServer.registerTool(
  'watch_posting',
  {
    description: 'Watch one posting every three seconds until its participant count changes, its minimum group size is reached, negotiation is required, it is deleted, or the watch times out.',
    inputSchema: {
      id: z.union([z.string(), z.number()]),
      lastKnownPeople: z.number().int().nonnegative(),
      timeoutSeconds: z.number().int().min(3).max(120).optional(),
    },
  },
  async ({ id, lastKnownPeople, timeoutSeconds }) => toolResult(
    await watchPosting(postings.getById, id, lastKnownPeople, timeoutSeconds)
  )
);

app.post('/mcp', async (req, res) => {
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on('close', () => transport.close());
  await mcpServer.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

// Create a posting.
app.post('/postings', (req, res) => {
  const error = postings.validateCreateInput(req.body);
  if (error) {
    return res.status(400).json({ error });
  }
  const created = postings.create(req.body);
  res.status(201).json(created);
});

// Search postings.
app.get('/postings/search', (req, res) => {
  const { q, type, country, city, date } = req.query;
  const results = postings.search({ q, type, country, city, date });
  res.json(results);
});

// Get one posting.
app.get('/postings/:id', (req, res) => {
  const posting = postings.getById(req.params.id);
  if (!posting) {
    return res.status(404).json({ error: 'Posting not found' });
  }
  res.json(posting);
});

// Long-poll one posting, checking for participant changes every three seconds.
app.get('/postings/:id/watch', async (req, res) => {
  const lastKnownPeople = Number(req.query.lastKnownPeople);
  const timeoutSeconds = req.query.timeoutSeconds === undefined ? 30 : Number(req.query.timeoutSeconds);
  if (!Number.isInteger(lastKnownPeople) || lastKnownPeople < 0) {
    return res.status(400).json({ error: 'lastKnownPeople must be a non-negative integer' });
  }
  if (!Number.isInteger(timeoutSeconds) || timeoutSeconds < 3 || timeoutSeconds > 120) {
    return res.status(400).json({ error: 'timeoutSeconds must be an integer from 3 to 120' });
  }
  res.json(await watchPosting(postings.getById, req.params.id, lastKnownPeople, timeoutSeconds));
});

// Add one participant.
app.post('/postings/:id/join', (req, res) => {
  const updated = postings.join(req.params.id);
  if (!updated) {
    return res.status(404).json({ error: 'Posting not found' });
  }
  res.json(updated);
});

// Delete an owned posting. The agentId must match.
app.delete('/postings/:id', (req, res) => {
  const { agentId } = req.query;
  if (!agentId) {
    return res.status(400).json({ error: 'The agentId query parameter is required' });
  }
  const result = postings.remove(req.params.id, agentId);
  if (result === 'not_found') {
    return res.status(404).json({ error: 'Posting not found' });
  }
  if (result === 'forbidden') {
    return res.status(403).json({ error: 'Only the posting owner can delete this posting' });
  }
  res.status(204).end();
});

// Return a clean 400 response for malformed JSON instead of a stack trace.
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'The request body is not valid JSON' });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API server listening at http://localhost:${PORT}`);
});
