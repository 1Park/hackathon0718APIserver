const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');

const VOCALBRIDGE_URL = process.env.VOCALBRIDGE_MCP_URL
  || 'https://extent-prospective-ext-condition.trycloudflare.com/mcp';

const CALLS = {
  kayak: {
    country: 'United States',
    city: 'San Diego',
    location: 'La Jolla Shores',
    activity_date: '2026-07-25 09:00',
    min_participants: 4,
    current_participants: 3,
    provider_phone: '+1-619-555-0147',
  },
  balboa: {
    country: 'United States',
    city: 'San Diego',
    location: 'Balboa Park Visitors Center',
    activity_date: '2026-07-25 14:30',
    min_participants: 6,
    current_participants: 2,
    provider_phone: '+1-619-555-0182',
  },
};

function parseToolResult(result) {
  const text = result.content?.find((item) => item.type === 'text')?.text;
  if (result.isError) throw new Error(text || 'VocalBridge MCP call failed');
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function runOperatorCalls() {
  const client = new Client({ name: 'corip-demo-vocalbridge-caller', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL(VOCALBRIDGE_URL));
  await client.connect(transport);
  try {
    const requestOptions = { timeout: 300_000, resetTimeoutOnProgress: true };
    const kayak = parseToolResult(await client.callTool({
      name: 'negotiate_reservation',
      arguments: CALLS.kayak,
    }, undefined, requestOptions));
    const balboa = parseToolResult(await client.callTool({
      name: 'negotiate_reservation',
      arguments: CALLS.balboa,
    }, undefined, requestOptions));
    return { endpoint: VOCALBRIDGE_URL, kayak, balboa };
  } finally {
    await client.close();
  }
}

module.exports = { CALLS, VOCALBRIDGE_URL, runOperatorCalls };
