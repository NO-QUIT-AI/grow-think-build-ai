/**
 * NO QUIT AI — static configuration for the 4-agent nightly system.
 *
 * Design rules:
 * - Only depends on './types' (AgentId).
 * - No network calls; env is read only for the optional AGENT_MODEL override (defensive).
 * - TypeScript strict-safe (noUncheckedIndexedAccess, exactOptionalPropertyTypes).
 * - Functions never throw.
 */

import type { AgentId } from './types';

export interface AgentConfig {
  id: AgentId;
  name: string;
  mission: string;
  scope: string[];
  queries: string[];
  urduQueries: string[];
  maxFindings: number;
  temperatureScope: 'cold' | 'warm' | 'hot';
  outputJsonShape: string;
  allowAutoApply: false;
}

const OUTPUT_JSON_SHAPE =
  '{"findings":[{"title":string,"summary":string,"whyItMatters":string,"confidence":number(0..1),"tags":string[],"sources":string[]}]}';

export const AGENTS: Record<AgentId, AgentConfig> = {
  world_tech: {
    id: 'world_tech',
    name: 'World Tech',
    mission: 'Track worldwide technology shifts: AI models, chips, platforms, developer tools.',
    scope: ['ai', 'hardware', 'developer-tools', 'open-source', 'cloud', 'security'],
    queries: [
      'new AI model release this week',
      'open source AI framework trending',
      'chip hardware announcement 2026',
      'developer tool launch',
    ],
    urduQueries: ['duniya me nayi technology kya aa rahi hai'],
    maxFindings: 6,
    temperatureScope: 'cold',
    outputJsonShape: OUTPUT_JSON_SHAPE,
    allowAutoApply: false,
  },
  market_pulse: {
    id: 'market_pulse',
    name: 'Market Pulse',
    mission: 'What is actually selling and trending in the market right now.',
    scope: ['app-trends', 'pricing', 'creator-economy', 'mobile', 'saas'],
    queries: ['top grossing apps this week', 'app market trends', 'saas pricing changes'],
    urduQueries: ['market me abhi kya chal raha hai'],
    maxFindings: 6,
    temperatureScope: 'warm',
    outputJsonShape: OUTPUT_JSON_SHAPE,
    allowAutoApply: false,
  },
  smart_app: {
    id: 'smart_app',
    name: 'Smart App',
    mission: 'Make OUR app smarter: features, UX, retention, AI capabilities we should add.',
    scope: ['product', 'ux', 'retention', 'ai-features', 'performance'],
    queries: [
      'app retention best practices 2026',
      'on-device AI app features',
      'mobile UX patterns that convert',
    ],
    urduQueries: ['hum apni app ko smart kaise banaye'],
    maxFindings: 6,
    temperatureScope: 'hot',
    outputJsonShape: OUTPUT_JSON_SHAPE,
    allowAutoApply: false,
  },
  world_news: {
    id: 'world_news',
    name: 'World News',
    mission: 'What is happening in the world that affects builders: policy, economy, internet, culture.',
    scope: ['policy', 'economy', 'internet', 'culture'],
    queries: ['AI regulation news', 'tech policy changes', 'internet platform news'],
    urduQueries: ['duniya me chal kya raha hai'],
    maxFindings: 6,
    temperatureScope: 'cold',
    outputJsonShape: OUTPUT_JSON_SHAPE,
    allowAutoApply: false,
  },
};

export const DEFAULT_AGENT_MODELS: readonly string[] = [
  'meta-llama/llama-3.3-70b-instruct:free',
  'qwen/qwen3-235b-a22b:free',
  'google/gemma-3-27b-it:free',
  'mistralai/mistral-small-3.2-24b-instruct:free',
];

export const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';

export const NIGHTLY_HOUR_LOCAL = 3;
export const NIGHTLY_TIMEZONE = 'Asia/Dubai';
export const CROSSTALK_ROUNDS = 3;
export const MAX_PROPOSALS = 8;
export const REQUEST_TIMEOUT_MS = 30000;

const FALLBACK_MODEL = 'meta-llama/llama-3.3-70b-instruct:free';

function readModelOverride(): string | null {
  try {
    const raw = process.env['AGENT_MODEL'];
    if (typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}

/**
 * Returns the model list to use: optional AGENT_MODEL override first,
 * then DEFAULT_AGENT_MODELS, deduped and non-empty. Never throws.
 */
export function agentModels(): string[] {
  try {
    const override = readModelOverride();
    const seen = new Set<string>();
    const out: string[] = [];
    if (override !== null) {
      seen.add(override);
      out.push(override);
    }
    for (const model of DEFAULT_AGENT_MODELS) {
      if (typeof model !== 'string') continue;
      const trimmed = model.trim();
      if (trimmed.length === 0 || seen.has(trimmed)) continue;
      seen.add(trimmed);
      out.push(trimmed);
    }
    if (out.length === 0) out.push(FALLBACK_MODEL);
    return out;
  } catch {
    return [FALLBACK_MODEL];
  }
}

/** Safe accessor: returns the config for `id`, or world_tech when the id is unknown. Never throws. */
export function agentConfig(id: AgentId): AgentConfig {
  try {
    const direct = AGENTS[id];
    if (direct) return direct;
  } catch {
    // fall through to default
  }
  return AGENTS.world_tech;
}

function joinList(values: readonly string[]): string {
  try {
    return values.filter((v) => typeof v === 'string' && v.trim().length > 0).join(', ');
  } catch {
    return '';
  }
}

/**
 * Builds a strict JSON-only instruction prompt for the given agent.
 * Never throws; unknown ids fall back to the world_tech config.
 */
export function buildAgentPrompt(id: AgentId): string {
  let cfg: AgentConfig;
  try {
    cfg = agentConfig(id);
  } catch {
    cfg = AGENTS.world_tech;
  }

  const scope = joinList(cfg.scope);
  const queries = joinList(cfg.queries);
  const urduQueries = joinList(cfg.urduQueries);

  return [
    `You are the "${cfg.name}" research agent in NO QUIT AI's nightly system.`,
    `Mission: ${cfg.mission}`,
    `Scope (only report items in this scope): ${scope}.`,
    `Suggested search queries: ${queries}.`,
    `Roman Urdu friendly queries (optional): ${urduQueries}.`,
    '',
    'Output rules (strict):',
    '- Return ONE JSON object only, no markdown fences, no prose before or after.',
    `- Shape: ${cfg.outputJsonShape}`,
    `- At most ${cfg.maxFindings} findings; prefer fewer, higher-quality findings.`,
    '- Every field is required. "confidence" is a number between 0 and 1.',
    '- "tags" is a short array of lowercase keywords. "sources" lists real URLs you actually saw; never invent links.',
    '- "whyItMatters" must explain the practical impact for builders in plain, friendly wording (Roman Urdu/English mix is welcome: e.g. "ye hamare liye kyun matter karta hai...").',
    '- If nothing relevant is found, return {"findings":[]}.',
    '- Never request tool calls, never add extra keys, never wrap the JSON in code blocks.',
  ].join('\n');
}
