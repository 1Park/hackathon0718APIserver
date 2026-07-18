const path = require('path');
const fs = require('fs');
const express = require('express');
const { z } = require('zod');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const postings = require('./postings');

const app = express();
app.use(express.json());

const USAGE_GUIDE_PATH = path.join(__dirname, '..', 'MCP_USAGE.md');
const CORIP_SKILL_PATH = path.join(__dirname, '..', 'skills', 'corip', 'SKILL.md');

const INSTRUCTIONS = `
Corip은 투어·레저·택시를 함께할 여행자를 연결하는 공고 서버다. 툴 5개: search_postings(검색), get_posting(단건조회), create_posting(등록), join_posting(참여인원+1), delete_posting(삭제).

핵심 규칙:
- 사용자가 투어·레저·택시를 계획하거나 동행자를 찾으면 새 공고를 만들기 전에 search_postings로 기존 공고부터 검색한다.
- 적합한 공고가 있으면 get_posting으로 최신 상태를 확인하고 사용자 승인 후 join_posting을 호출한다.
- 적합한 공고가 없으면 필요한 값을 확인하고 사용자 승인 후 create_posting을 호출한다.
- type이 "taxi"면 place 대신 departure/destination을 채운다. tour/leisure는 place를 채운다.
- country/city/place/departure/destination은 영어로 적는다.
- needsNego가 true인 공고는 정원을 넘겨서라도 참여 신청이 들어온 상태 — 한 번 true가 되면 되돌아가지 않는다.
- join_posting은 호출할 때마다 currentPeople을 +1 한다 (여러 명이면 그만큼 여러 번 호출).
- delete_posting은 그 공고를 올린 agentId로만 삭제 가능하다 (다른 agentId면 거부됨).

행동 원칙은 리소스 "docs://corip-skill", 상세 파라미터와 에러 처리는 "docs://mcp-usage"를 읽어라.
`.trim();

const mcpServer = new McpServer(
  { name: 'postings-mcp', version: '1.0.0' },
  { instructions: INSTRUCTIONS }
);

mcpServer.registerResource(
  'usage-guide',
  'docs://mcp-usage',
  {
    title: '공고 MCP 서버 사용 가이드',
    description: '툴별 상세 파라미터, 에러 메시지, 시나리오별 호출 흐름을 담은 전체 가이드',
    mimeType: 'text/markdown',
  },
  async (uri) => ({
    contents: [{ uri: uri.href, mimeType: 'text/markdown', text: fs.readFileSync(USAGE_GUIDE_PATH, 'utf-8') }],
  })
);

mcpServer.registerResource(
  'corip-skill',
  'docs://corip-skill',
  {
    title: 'Corip OpenClaw Skill',
    description: 'OpenClaw가 Corip 도구를 언제 어떤 순서로 사용할지 정의한 설치용 SKILL.md',
    mimeType: 'text/markdown',
  },
  async (uri) => ({
    contents: [{ uri: uri.href, mimeType: 'text/markdown', text: fs.readFileSync(CORIP_SKILL_PATH, 'utf-8') }],
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
    description: '투어/레저/택시 참여인원 모집 공고를 등록한다. type이 taxi면 place 대신 departure/destination을 채운다',
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
    description: '특정 id의 공고를 조회한다',
    inputSchema: { id: z.union([z.string(), z.number()]) },
  },
  async ({ id }) => {
    const posting = postings.getById(id);
    if (!posting) return toolError('공고를 찾을 수 없습니다');
    return toolResult(posting);
  }
);

mcpServer.registerTool(
  'search_postings',
  {
    description: '키워드/조건으로 여러 공고를 검색한다',
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
    description: '특정 공고에 참여인원을 1명 늘린다 (최대인원 초과 시 네고여부가 true로 바뀜)',
    inputSchema: { id: z.union([z.string(), z.number()]) },
  },
  async ({ id }) => {
    const updated = postings.join(id);
    if (!updated) return toolError('공고를 찾을 수 없습니다');
    return toolResult(updated);
  }
);

mcpServer.registerTool(
  'delete_posting',
  {
    description: '자신이 올린 공고를 삭제한다. 공고를 올린 agentId와 일치해야만 삭제된다',
    inputSchema: { id: z.union([z.string(), z.number()]), agentId: z.string() },
  },
  async ({ id, agentId }) => {
    const result = postings.remove(id, agentId);
    if (result === 'not_found') return toolError('공고를 찾을 수 없습니다');
    if (result === 'forbidden') return toolError('본인이 올린 공고만 삭제할 수 있습니다');
    return toolResult({ id, deleted: true });
  }
);

app.post('/mcp', async (req, res) => {
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on('close', () => transport.close());
  await mcpServer.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

// 공고 올리는 API
app.post('/postings', (req, res) => {
  const error = postings.validateCreateInput(req.body);
  if (error) {
    return res.status(400).json({ error });
  }
  const created = postings.create(req.body);
  res.status(201).json(created);
});

// 검색해서 여러 공고를 받아오는 API
app.get('/postings/search', (req, res) => {
  const { q, type, country, city, date } = req.query;
  const results = postings.search({ q, type, country, city, date });
  res.json(results);
});

// 특정 공고를 받아오는 API
app.get('/postings/:id', (req, res) => {
  const posting = postings.getById(req.params.id);
  if (!posting) {
    return res.status(404).json({ error: '공고를 찾을 수 없습니다' });
  }
  res.json(posting);
});

// 참여인원 +1 API
app.post('/postings/:id/join', (req, res) => {
  const updated = postings.join(req.params.id);
  if (!updated) {
    return res.status(404).json({ error: '공고를 찾을 수 없습니다' });
  }
  res.json(updated);
});

// 자신이 올린 공고를 삭제하는 API (agentId 일치해야 삭제됨)
app.delete('/postings/:id', (req, res) => {
  const { agentId } = req.query;
  if (!agentId) {
    return res.status(400).json({ error: '쿼리 파라미터 agentId가 필요합니다' });
  }
  const result = postings.remove(req.params.id, agentId);
  if (result === 'not_found') {
    return res.status(404).json({ error: '공고를 찾을 수 없습니다' });
  }
  if (result === 'forbidden') {
    return res.status(403).json({ error: '본인이 올린 공고만 삭제할 수 있습니다' });
  }
  res.status(204).end();
});

// JSON 파싱 실패 등 잘못된 요청을 스택트레이스 대신 깔끔한 400으로 응답
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: '요청 body가 올바른 JSON 형식이 아닙니다' });
  }
  console.error(err);
  res.status(500).json({ error: '서버 내부 오류' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API 서버 실행 중: http://localhost:${PORT}`);
});
