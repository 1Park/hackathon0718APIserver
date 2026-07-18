const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');

const LIVE_URL = process.env.CORIP_LIVE_MCP_URL || 'https://corip-postings-kimmc3423.fly.dev/mcp';

const DEFINITIONS = {
  kayak: {
    owner: 'corip-telegram-demo-kayak-owner',
    target: 3,
    // create_posting counts the owner as participant 1.
    members: ['kayak-member-1', 'corip-demo-user'],
    create: {
      type: 'tour',
      title: 'La Jolla Sea Caves Kayak Tour',
      description: 'La Jolla sea-cave kayak tour for the Corip Telegram demo.',
      country: 'United States',
      city: 'San Diego',
      place: 'La Jolla Shores',
      date: '2026-07-25',
      time: '09:00',
      minPeople: 4,
      maxPeople: 4,
      price: 69,
      agentId: 'corip-telegram-demo-kayak-owner',
    },
  },
  uber: {
    owner: 'corip-telegram-demo-uber-owner',
    target: 4,
    members: ['uber-member-1', 'uber-member-2', 'corip-demo-user'],
    create: {
      type: 'taxi',
      title: 'Shared Uber to La Jolla',
      description: 'Shared morning ride from Hilton San Diego Bayfront to La Jolla Shores.',
      country: 'United States',
      city: 'San Diego',
      departure: 'Hilton San Diego Bayfront',
      destination: 'La Jolla Shores',
      date: '2026-07-25',
      time: '07:45',
      minPeople: 4,
      maxPeople: 4,
      price: 15.5,
      agentId: 'corip-telegram-demo-uber-owner',
    },
  },
  balboa: {
    owner: 'corip-telegram-demo-balboa-owner',
    target: 1,
    members: [],
    create: {
      type: 'leisure',
      title: 'Balboa Park Food & Photo Walk',
      description: 'Walk through Balboa Park with a small group, visit major landmarks, take photos, and try selected local snacks.',
      country: 'United States',
      city: 'San Diego',
      place: 'Balboa Park Visitors Center',
      date: '2026-07-25',
      time: '14:30',
      minPeople: 6,
      maxPeople: 8,
      price: 45,
      agentId: 'corip-telegram-demo-balboa-owner',
    },
  },
};

function textResult(result) {
  const text = result.content?.find((item) => item.type === 'text')?.text;
  if (result.isError) throw new Error(text || 'Corip live MCP call failed');
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function withClient(operation) {
  const client = new Client({ name: 'corip-demo-live-writer', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL(LIVE_URL));
  await client.connect(transport);
  try {
    return await operation(client);
  } finally {
    await client.close();
  }
}

async function call(client, name, args) {
  return textResult(await client.callTool({ name, arguments: args }));
}

async function findOwned(client, owner) {
  const rows = await call(client, 'search_postings', { agentId: owner });
  return Array.isArray(rows) ? rows : [];
}

async function removeOwned(client, definition) {
  const rows = await findOwned(client, definition.owner);
  for (const row of rows) {
    await call(client, 'delete_posting', { id: row.id, agentId: definition.owner });
  }
}

async function recreate(client, definition, members = definition.members) {
  await removeOwned(client, definition);
  const created = await call(client, 'create_posting', definition.create);
  for (const agentId of members) {
    await call(client, 'join_posting', { id: created.id, agentId });
  }
  return await call(client, 'get_posting', { id: created.id });
}

async function syncInitialPostings() {
  return withClient(async (client) => {
    const kayak = await recreate(client, DEFINITIONS.kayak);
    const uber = await recreate(client, DEFINITIONS.uber);
    const balboa = await recreate(client, DEFINITIONS.balboa);
    return { stage: 'initial', kayak, uber, balboa };
  });
}

async function syncTwoDaysLater() {
  return withClient(async (client) => {
    const balboa = await recreate(
      client,
      DEFINITIONS.balboa,
      ['corip-demo-user']
    );
    return { stage: 'two_days_later', balboa };
  });
}

async function confirmKayak() {
  return withClient(async (client) => {
    const rows = await findOwned(client, DEFINITIONS.kayak.owner);
    if (rows.length !== 1) throw new Error('Expected exactly one owned kayak demo posting');
    return await call(client, 'confirm_posting_with_vendor', {
      id: rows[0].id,
      agentId: DEFINITIONS.kayak.owner,
      source: 'vocal_bridge',
      note: 'Three-person group accepted via merged 9:30 AM departure at $72 per person.',
    });
  });
}

async function cancelBalboa() {
  return withClient(async (client) => {
    const rows = await findOwned(client, DEFINITIONS.balboa.owner);
    for (const row of rows) {
      await call(client, 'delete_posting', { id: row.id, agentId: DEFINITIONS.balboa.owner });
    }
    return { deleted: rows.map((row) => row.id) };
  });
}

module.exports = {
  DEFINITIONS,
  cancelBalboa,
  confirmKayak,
  syncInitialPostings,
  syncTwoDaysLater,
};
