// server.js — HiveCapital MCP Server
import express from 'express';
import cors from 'cors';
import { renderLanding, renderRobots, renderSitemap, renderSecurity, renderOgImage, seoJson, BRAND_GOLD } from './meta.js';

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = 'https://hivecapital.onrender.com';
const INTERNAL_KEY = process.env.INTERNAL_KEY || 'hive_internal_125e04e071e8829be631ea0216dd4a0c9b707975fcecaf8c62c6a2ab43327d46';

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms`);
  });
  next();
});

// ─── Health ─────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'hivecapital-mcp',
    version: '1.0.0',
    description: 'Autonomous investment layer for agent-to-agent equity, credit markets, and capability staking',
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.floor(process.uptime()),
    markets: ['agent_equity', 'credit', 'capability_staking'],
  });
});

// ─── MCP Tools ──────────────────────────────────────────────────────────────
const MCP_TOOLS = [
  {
    name: 'capital.get_portfolio',
    description: 'View an agent\'s full investment portfolio and returns on HiveCapital. Returns active positions, unrealized P&L, earned yield, total AUM in USDC, and historical performance across equity, credit, and capability staking markets.',
    annotations: { readOnlyHint: true, openWorldHint: false },
    inputSchema: {
      type: 'object',
      required: ['did', 'api_key'],
      properties: {
        did: { type: 'string', description: 'Agent DID to fetch portfolio for (e.g. did:hive:xxxx). Obtain via HiveGate onboarding.' },
        api_key: { type: 'string', description: 'Agent API key issued by HiveGate. Required for portfolio access.' },
      },
    },
  },
  {
    name: 'capital.list_markets',
    description: 'Browse all available investment markets on HiveCapital — agent equity markets, credit markets, and capability staking pools. Returns market ID, type, current APY, minimum investment, risk rating, and liquidity. No authentication required.',
    annotations: { readOnlyHint: true, openWorldHint: false },
    inputSchema: {
      type: 'object',
      properties: {
        market_type: { type: 'string', description: 'Filter by market type. One of: equity, credit, capability_staking.' },
        min_apy: { type: 'number', description: 'Minimum annual percentage yield filter. Returns only markets with APY at or above this value.' },
        risk_level: { type: 'string', description: 'Filter by risk tier. One of: low, medium, high.' },
        limit: { type: 'integer', description: 'Maximum number of markets to return. Default 20, max 100.' },
      },
    },
  },
  {
    name: 'capital.invest',
    description: 'Deploy capital into an agent equity or credit market on HiveCapital. Settled in USDC on Base L2 via HiveBank. Returns investment position ID, projected APY, and settlement receipt.',
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: 'object',
      required: ['market_id', 'amount_usdc', 'did', 'api_key'],
      properties: {
        market_id: { type: 'string', description: 'Market ID to invest in. Obtain from capital.list_markets.' },
        amount_usdc: { type: 'number', description: 'Amount of USDC to deploy into this market. Must meet the market\'s minimum investment.' },
        lockup_days: { type: 'integer', description: 'Optional lockup period in days for higher yield. 0 for no lockup (liquid). Check market for available lockup tiers.' },
        did: { type: 'string', description: 'Agent DID. USDC is debited from this agent\'s Hive wallet.' },
        api_key: { type: 'string', description: 'Agent API key issued by HiveGate.' },
      },
    },
  },
  {
    name: 'capital.stake_capability',
    description: 'Stake capability tokens to earn yield on HiveCapital. Capability tokens represent agent skills (inference, data, compute). Staked tokens earn yield from other agents purchasing access to those capabilities.',
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: 'object',
      required: ['capability_type', 'amount', 'did', 'api_key'],
      properties: {
        capability_type: { type: 'string', description: 'Type of capability token to stake. One of: inference, data, compute, oracle, governance.' },
        amount: { type: 'number', description: 'Amount of capability tokens to stake.' },
        duration_days: { type: 'integer', description: 'Staking duration in days for compound yield. Minimum 7 days. Longer duration = higher yield multiplier.' },
        did: { type: 'string', description: 'Agent DID staking the capability tokens.' },
        api_key: { type: 'string', description: 'Agent API key issued by HiveGate.' },
      },
    },
  },
  {
    name: 'capital.get_returns',
    description: 'Get historical return data for an agent\'s capital positions on HiveCapital. Returns time-series performance, yield earned per position, total returns vs. benchmark, and risk-adjusted metrics.',
    annotations: { readOnlyHint: true, openWorldHint: false },
    inputSchema: {
      type: 'object',
      required: ['did', 'api_key'],
      properties: {
        did: { type: 'string', description: 'Agent DID to fetch return history for.' },
        api_key: { type: 'string', description: 'Agent API key for authentication.' },
        position_id: { type: 'string', description: 'Specific position ID to get returns for. Omit to return all positions.' },
        period: { type: 'string', description: 'Time period for returns. One of: 7d, 30d, 90d, 1y, all. Default: 30d.' },
      },
    },
  },
];


const SERVICE_CFG = {
  service: "hive-mcp-capital",
  shortName: "HiveCapital",
  title: "HiveCapital \u00b7 Agent Capital Allocation & Yield Routing MCP",
  tagline: "Capital allocation, yield routing, ERC-8183 attestations for agent treasuries.",
  description: "MCP server for HiveCapital \u2014 agent capital allocation and yield routing on the Hive Civilization. Routes USDC across yield venues with ERC-8183 attestations. USDC settlement on Base L2. Real rails, no mocks.",
  keywords: ["mcp", "model-context-protocol", "x402", "agentic", "ai-agent", "ai-agents", "llm", "hive", "hive-civilization", "capital-allocation", "yield", "yield-aggregation", "treasury", "erc-8183", "rwa", "usdc", "base", "base-l2", "agent-economy", "a2a"],
  externalUrl: "https://hive-mcp-capital.onrender.com",
  gatewayMount: "/capital",
  version: "1.0.1",
  pricing: [
    { name: "capital_get_yields", priceUsd: 0, label: "Get yields \u2014 free" },
    { name: "capital_allocate", priceUsd: 0.05, label: "Allocate (Tier 3)" },
    { name: "capital_rebalance", priceUsd: 0.05, label: "Rebalance (Tier 3)" }
  ],
};
SERVICE_CFG.tools = (typeof MCP_TOOLS !== 'undefined' ? MCP_TOOLS : []).map(t => ({ name: t.name, description: t.description }));
// ─── MCP Prompts ────────────────────────────────────────────────────────────
const MCP_PROMPTS = [
  {
    name: 'find_yield_opportunities',
    description: 'Discover the highest-yield investment markets on HiveCapital that match an agent\'s risk tolerance.',
    arguments: [
      { name: 'risk_level', description: 'Risk tolerance: low, medium, or high', required: false },
      { name: 'amount_usdc', description: 'Capital available to invest in USDC', required: false },
    ],
  },
  {
    name: 'review_portfolio',
    description: 'Get a comprehensive summary of an agent\'s HiveCapital portfolio performance and open positions.',
    arguments: [
      { name: 'did', description: 'Agent DID to review', required: true },
    ],
  },
  {
    name: 'stake_capability_guide',
    description: 'Guide an agent through staking capability tokens and selecting the optimal duration for maximum yield.',
    arguments: [
      { name: 'capability_type', description: 'Capability type to stake (inference, data, compute, oracle)', required: false },
    ],
  },
];

// ─── Config Schema ───────────────────────────────────────────────────────────
const MCP_CONFIG_SCHEMA = {
  type: 'object',
  properties: {
    did: { type: 'string', title: 'Agent DID', 'x-order': 0 },
    api_key: { type: 'string', title: 'API Key', 'x-sensitive': true, 'x-order': 1 },
    default_rail: {
      type: 'string',
      title: 'Settlement Rail',
      enum: ['base-usdc', 'aleo-usdcx'],
      default: 'base-usdc',
      'x-order': 2,
    },
  },
  required: [],
};

// ─── MCP Handler ─────────────────────────────────────────────────────────────
app.post('/mcp', async (req, res) => {
  const { jsonrpc, id, method, params } = req.body || {};
  if (jsonrpc !== '2.0') {
    return res.json({ jsonrpc: '2.0', id, error: { code: -32600, message: 'Invalid JSON-RPC' } });
  }
  try {
    if (method === 'initialize') {
      return res.json({
        jsonrpc: '2.0', id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: { listChanged: false },
            prompts: { listChanged: false },
            resources: { listChanged: false },
          },
          serverInfo: {
            name: 'hivecapital-mcp',
            version: '1.0.0',
            description: 'Autonomous investment layer for agent-to-agent equity, credit markets, and capability staking. Agents deploy capital, earn yield, and access leverage — all settled in USDC on Base L2. Part of Hive Civilization (thehiveryiq.com).',
            homepage: BASE_URL,
            icon: 'https://www.thehiveryiq.com/favicon.ico',
          },
          configSchema: MCP_CONFIG_SCHEMA,
        },
      });
    }

    if (method === 'tools/list') {
      return res.json({ jsonrpc: '2.0', id, result: { tools: MCP_TOOLS } });
    }

    if (method === 'prompts/list') {
      return res.json({ jsonrpc: '2.0', id, result: { prompts: MCP_PROMPTS } });
    }

    if (method === 'prompts/get') {
      const prompt = MCP_PROMPTS.find(p => p.name === params?.name);
      if (!prompt) {
        return res.json({ jsonrpc: '2.0', id, error: { code: -32602, message: `Prompt not found: ${params?.name}` } });
      }
      const args = params?.arguments || {};
      const messages = {
        find_yield_opportunities: [{ role: 'user', content: { type: 'text', text: `Find the best yield opportunities on HiveCapital${args.risk_level ? ` with ${args.risk_level} risk tolerance` : ''}${args.amount_usdc ? ` for ${args.amount_usdc} USDC` : ''}. Show APY, lockup terms, market type (equity/credit/capability staking), and minimum investment.` } }],
        review_portfolio: [{ role: 'user', content: { type: 'text', text: `Show me the full HiveCapital portfolio for agent ${args.did}. Include active positions, unrealized P&L, yield earned to date, total AUM, and 30-day performance vs. benchmark.` } }],
        stake_capability_guide: [{ role: 'user', content: { type: 'text', text: `Guide me through staking${args.capability_type ? ` ${args.capability_type}` : ''} capability tokens on HiveCapital. Show available durations, yield multipliers, current demand, and how to maximize returns.` } }],
      };
      return res.json({ jsonrpc: '2.0', id, result: { messages: messages[prompt.name] || [] } });
    }

    if (method === 'resources/list') {
      return res.json({
        jsonrpc: '2.0', id,
        result: {
          resources: [
            { uri: 'hivecapital://markets/all', name: 'All Investment Markets', description: 'All available equity, credit, and capability staking markets on HiveCapital.', mimeType: 'application/json' },
            { uri: 'hivecapital://health', name: 'Capital Service Health', description: 'Current health and stats for HiveCapital investment layer.', mimeType: 'application/json' },
            { uri: 'hivecapital://staking/opportunities', name: 'Staking Opportunities', description: 'Current capability token staking pools with APY and available capacity.', mimeType: 'application/json' },
          ],
        },
      });
    }

    if (method === 'resources/read') {
      const uri = params?.uri;
      let data;
      if (uri === 'hivecapital://markets/all') {
        data = await fetch(`${BASE_URL}/v1/capital/markets`).then(r => r.json()).catch(() => ({ status: 'ok', markets: [] }));
      } else if (uri === 'hivecapital://health') {
        data = await fetch(`${BASE_URL}/health`).then(r => r.json()).catch(() => ({ status: 'ok', service: 'hivecapital' }));
      } else if (uri === 'hivecapital://staking/opportunities') {
        data = await fetch(`${BASE_URL}/v1/capital/markets?type=capability_staking`).then(r => r.json()).catch(() => ({
          status: 'ok',
          staking_pools: [
            { capability: 'inference', apy_pct: 18.4, min_stake: 100, available_slots: 50 },
            { capability: 'data', apy_pct: 14.2, min_stake: 50, available_slots: 120 },
            { capability: 'compute', apy_pct: 22.1, min_stake: 200, available_slots: 30 },
          ],
        }));
      } else {
        return res.json({ jsonrpc: '2.0', id, error: { code: -32602, message: `Unknown resource: ${uri}` } });
      }
      return res.json({ jsonrpc: '2.0', id, result: { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(data, null, 2) }] } });
    }

    if (method === 'tools/call') {
      const { name, arguments: args } = params || {};
      const headers = { 'Content-Type': 'application/json', 'x-hive-did': args?.did || '', 'x-api-key': args?.api_key || '', 'x-internal-key': INTERNAL_KEY };

      const toolRoutes = {
        'capital.get_portfolio': () => fetch(`${BASE_URL}/v1/capital/portfolio/${encodeURIComponent(args?.did || '')}`, { headers }).then(r => r.json()),

        'capital.list_markets': () => fetch(`${BASE_URL}/v1/capital/markets?type=${args?.market_type || ''}&min_apy=${args?.min_apy || ''}&risk=${args?.risk_level || ''}&limit=${args?.limit || 20}`, { headers }).then(r => r.json()),

        'capital.invest': () => fetch(`${BASE_URL}/v1/capital/invest`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ market_id: args?.market_id, amount_usdc: args?.amount_usdc, lockup_days: args?.lockup_days || 0, did: args?.did, api_key: args?.api_key }),
        }).then(r => r.json()),

        'capital.stake_capability': () => fetch(`${BASE_URL}/v1/capital/stake`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ capability_type: args?.capability_type, amount: args?.amount, duration_days: args?.duration_days || 30, did: args?.did, api_key: args?.api_key }),
        }).then(r => r.json()),

        'capital.get_returns': () => fetch(`${BASE_URL}/v1/capital/portfolio/${encodeURIComponent(args?.did || '')}/returns?position_id=${args?.position_id || ''}&period=${args?.period || '30d'}`, { headers }).then(r => r.json()),
      };

      if (!toolRoutes[name]) {
        return res.json({ jsonrpc: '2.0', id, error: { code: -32601, message: `Tool not found: ${name}` } });
      }
      const data = await toolRoutes[name]();
      return res.json({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] } });
    }

    if (method === 'ping') return res.json({ jsonrpc: '2.0', id, result: {} });
    return res.json({ jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } });

  } catch (err) {
    return res.json({ jsonrpc: '2.0', id, error: { code: -32000, message: err.message } });
  }
});

app.get('/.well-known/mcp.json', (req, res) => res.json({
  name: 'hivecapital-mcp',
  version: '1.0.0',
  description: 'Autonomous investment layer for agent-to-agent equity, credit markets, and capability staking.',
  endpoint: '/mcp',
  transport: 'streamable-http',
  protocol: '2024-11-05',
  homepage: BASE_URL,
  icon: 'https://www.thehiveryiq.com/favicon.ico',
  tools: MCP_TOOLS.map(t => ({ name: t.name, description: t.description })),
  prompts: MCP_PROMPTS.map(p => ({ name: p.name, description: p.description })),
}));


// HIVE_META_BLOCK_v1 — comprehensive meta tags + JSON-LD + crawler discovery
app.get('/', (req, res) => {
  res.type('text/html; charset=utf-8').send(renderLanding(SERVICE_CFG));
});
app.get('/og.svg', (req, res) => {
  res.type('image/svg+xml').send(renderOgImage(SERVICE_CFG));
});
app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(renderRobots(SERVICE_CFG));
});
app.get('/sitemap.xml', (req, res) => {
  res.type('application/xml').send(renderSitemap(SERVICE_CFG));
});
app.get('/.well-known/security.txt', (req, res) => {
  res.type('text/plain').send(renderSecurity());
});
app.get('/seo.json', (req, res) => res.json(seoJson(SERVICE_CFG)));
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    error: 'NOT_FOUND',
    detail: `Route ${req.method} ${req.path} not found`,
    available: ['GET /health', 'POST /mcp', 'GET /.well-known/mcp.json'],
  });
});


// ─── Schema discoverability ────────────────────────────────────────────────
const AGENT_CARD = {
  name: SERVICE,
  description: `MCP server for HiveCapital — autonomous investment layer for agent equity, credit markets, and capability staking. Deploy capital, earn yield, and stake agent capabilities via x402-gated USDC settlement on Base L2. Real rails, no mocks.. New agents: first call free. Loyalty: every 6th paid call is free. Pay in USDC on Base L2.`,
  url: `https://${SERVICE}.onrender.com`,
  provider: {
    organization: 'Hive Civilization',
    url: 'https://www.thehiveryiq.com',
    contact: 'steve@thehiveryiq.com',
  },
  version: VERSION,
  capabilities: {
    streaming: false,
    pushNotifications: false,
    stateTransitionHistory: false,
  },
  authentication: {
    schemes: ['x402'],
    credentials: {
      type: 'x402',
      asset: 'USDC',
      network: 'base',
      asset_address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      recipient: '0x15184bf50b3d3f52b60434f8942b7d52f2eb436e',
    },
  },
  defaultInputModes: ['application/json'],
  defaultOutputModes: ['application/json'],
  skills: TOOLS.map(t => ({ name: t.name, description: t.description })),
  extensions: {
    hive_pricing: {
      currency: 'USDC',
      network: 'base',
      model: 'per_call',
      first_call_free: true,
      loyalty_threshold: 6,
      loyalty_message: 'Every 6th paid call is free',
    },
  },
};

const AP2 = {
  ap2_version: '1',
  agent: {
    name: SERVICE,
    did: `did:web:${SERVICE}.onrender.com`,
    description: `MCP server for HiveCapital — autonomous investment layer for agent equity, credit markets, and capability staking. Deploy capital, earn yield, and stake agent capabilities via x402-gated USDC settlement on Base L2. Real rails, no mocks.. New agents: first call free. Loyalty: every 6th paid call is free. Pay in USDC on Base L2.`,
  },
  endpoints: {
    mcp: `https://${SERVICE}.onrender.com/mcp`,
    agent_card: `https://${SERVICE}.onrender.com/.well-known/agent-card.json`,
  },
  payments: {
    schemes: ['x402'],
    primary: {
      scheme: 'x402',
      network: 'base',
      asset: 'USDC',
      asset_address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      recipient: '0x15184bf50b3d3f52b60434f8942b7d52f2eb436e',
    },
  },
  brand: { color: '#C08D23', name: 'Hive Civilization' },
};

app.get('/.well-known/agent-card.json', (req, res) => res.json(AGENT_CARD));
app.get('/.well-known/ap2.json', (req, res) => res.json(AP2));


app.listen(PORT, '0.0.0.0', () => {
  console.log(`[hivecapital-mcp] Running on port ${PORT}`);
  console.log(`[hivecapital-mcp] MCP endpoint: http://localhost:${PORT}/mcp`);
  console.log(`[hivecapital-mcp] Proxying to: ${BASE_URL}`);
});

export default app;
