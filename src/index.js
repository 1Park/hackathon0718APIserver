const express = require('express');
const { z } = require('zod');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const postings = require('./postings');

const app = express();
app.use(express.json());

const mcpServer = new McpServer({ name: 'postings-mcp', version: '1.0.0' });

function toolResult(data) {
  return { content: [{ type: 'text', text: JSON.stringify(data) }] };
}

function toolError(message) {
  return { content: [{ type: 'text', text: JSON.stringify({ error: message }) }], isError: true };
}

mcpServer.registerTool(
  'create_posting',
  {
    description: '투어/레저/택시 참여인원 모집 공고를 등록한다',
    inputSchema: {
      type: z.enum(postings.VALID_TYPES),
      country: z.string(),
      city: z.string(),
      place: z.string(),
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
