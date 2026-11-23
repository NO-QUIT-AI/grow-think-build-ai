/**
 * NO QUIT AI — 4-agent nightly runners with OpenRouter primary + DeepSeek fallback.
 *
 * Design rules:
 * - Only depends on './config', './digest', './types'.
 * - TypeScript strict-safe (noUncheckedIndexedAccess, exactOptionalPropertyTypes).
 * - Every exported function never throws (including runAgent/runAllAgents).
 * - Never logs the DeepSeek/OpenRouter API key or prompt content.
 */

import { callOpenRouter, digestJson, extractJsonObject, parseFindings } from './digest';
import { agentConfig, buildAgentPrompt } from './config';
import { makeId } from './types';
import type { AgentConfig } from './config';
import type { AgentFinding, AgentId } from './types';
import { AGENT_IDS } from './types';

export interface ModelReply {
  text: string;
  model: string;
  provider: 'openrouter' | 'deepseek';
}

export interface ProviderMessages {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ProviderOptions {
  temperature?: number;
  maxTokens?: number;
}

export interface AgentRunResult {
  agent: AgentId;
  status: 'ok' | 'offline';
  provider: 'openrouter' | 'deepseek' | null;
  model: string | null;
  findings: AgentFinding[];
  notes: string[];
}

const DEEPSEEK_CHAT_URL = 'https://api.deepseek.com/chat/completions';
const DEEPSEEK_MODEL = 'deepseek-chat';
const DEFAULT_TEMPERATURE = 0.4;
const DEFAULT_MAX_TOKENS = 1200;
const DEEPSEEK_TIMEOUT_MS = 30000;
const FALLBACK_SUMMARY_LIMIT = 600;

type TemperatureScope = 'cold' | 'warm' | 'hot';

function getDeepSeekApiKey(): string | null {
  try {
    const raw = process.env['DEEPSEEK_API_KEY'];
    if (typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}

function makeTimeoutSignal(): AbortSignal | null {
  try {
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
      return AbortSignal.timeout(DEEPSEEK_TIMEOUT_MS);
    }
  } catch {
    // ignore
  }
  return null;
}

function coerceFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function sanitizeMessages(messages: ProviderMessages[]): ProviderMessages[] {
  try {
    if (!Array.isArray(messages)) return [];
    const out: ProviderMessages[] = [];
    for (const m of messages) {
      if (!m || typeof m !== 'object') continue;
      if (m.role !== 'user' && m.role !== 'assistant' && m.role !== 'system') continue;
      if (typeof m.content !== 'string') continue;
      out.push({ role: m.role, content: m.content });
    }
    return out;
  } catch {
    return [];
  }
}

function extractDeepSeekContent(payload: unknown): string | null {
  try {
    if (!payload || typeof payload !== 'object') return null;
    const choices = (payload as { choices?: unknown }).choices;
    if (!Array.isArray(choices) || choices.length === 0) return null;
    const first = choices[0];
    if (!first || typeof first !== 'object') return null;
    const message = (first as { message?: unknown }).message;
    if (!message || typeof message !== 'object') return null;
    const content = (message as { content?: unknown }).content;
    if (typeof content !== 'string') return null;
    const trimmed = content.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}

/**
 * Internal DeepSeek fallback. Returns null on missing key, non-200, empty content,
 * or any error. Never throws and never logs the API key.
 */
export async function callDeepSeek(
  messages: ProviderMessages[],
  options?: ProviderOptions
): Promise<ModelReply | null> {
  try {
    const apiKey = getDeepSeekApiKey();
    if (apiKey === null) return null;

    const safeMessages = sanitizeMessages(messages);
    if (safeMessages.length === 0) return null;

    const temperature = coerceFiniteNumber(options?.temperature) ?? DEFAULT_TEMPERATURE;
    const maxTokens = coerceFiniteNumber(options?.maxTokens) ?? DEFAULT_MAX_TOKENS;

    const body: Record<string, unknown> = {
      model: DEEPSEEK_MODEL,
      messages: safeMessages,
      stream: false,
      temperature,
      max_tokens: maxTokens,
    };

    const init: RequestInit = {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    };
    const signal = makeTimeoutSignal();
    if (signal) init.signal = signal;

    let response: Response;
    try {
      response = await fetch(DEEPSEEK_CHAT_URL, init);
    } catch {
      return null;
    }

    if (!response || response.status !== 200) return null;

    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      return null;
    }

    const text = extractDeepSeekContent(payload);
    if (text === null) return null;

    return { text, model: DEEPSEEK_MODEL, provider: 'deepseek' };
  } catch {
    return null;
  }
}

/**
 * Tries OpenRouter first; if it fails, tries DeepSeek. Returns null only if both fail.
 * Never throws.
 */
export async function callModelChain(
  messages: ProviderMessages[],
  options?: ProviderOptions
): Promise<ModelReply | null> {
  try {
    let openRouterReply: { text: string; model: string } | null = null;
    try {
      openRouterReply = await callOpenRouter(messages, options);
    } catch {
      openRouterReply = null;
    }

    if (openRouterReply !== null) {
      return {
        text: openRouterReply.text,
        model: openRouterReply.model,
        provider: 'openrouter',
      };
    }

    let deepSeekReply: ModelReply | null = null;
    try {
      deepSeekReply = await callDeepSeek(messages, options);
    } catch {
      deepSeekReply = null;
    }
    if (deepSeekReply !== null) return deepSeekReply;

    return null;
  } catch {
    return null;
  }
}

function temperatureForScope(scope: TemperatureScope): number {
  switch (scope) {
    case 'cold':
      return 0.2;
    case 'warm':
      return 0.5;
    case 'hot':
      return 0.7;
    default:
      return 0.4;
  }
}

function joinList(values: readonly string[]): string {
  try {
    return values
      .filter((v) => typeof v === 'string' && v.trim().length > 0)
      .join(', ');
  } catch {
    return '';
  }
}

function buildUserPrompt(cfg: AgentConfig): string {
  try {
    const queries = joinList(cfg.queries);
    const urduQueries = joinList(cfg.urduQueries);
    const lines: string[] = [
      'Research task:',
      `- Find the latest, most relevant information for the "${cfg.name}" agent.`,
      `- Focus queries: ${queries || '(none)'}.`,
      `- Roman Urdu optional queries: ${urduQueries || '(none)'}.`,
      '- Return STRICT JSON only, exactly matching the shape given in the system prompt.',
      '- Do not add markdown fences, do not add commentary, do not invent source URLs.',
    ];
    return lines.join('\n');
  } catch {
    return 'Research task: return STRICT JSON only per the system prompt.';
  }
}

function buildRawFallbackFinding(cfg: AgentConfig, agent: AgentId, text: string): AgentFinding {
  const summary = text.slice(0, FALLBACK_SUMMARY_LIMIT);
  let id = 'finding_fallback0000';
  try {
    id = makeId('finding');
  } catch {
    // keep static fallback id
  }
  return {
    id,
    agent,
    createdAt: new Date().toISOString(),
    title: `${cfg.name} digest`,
    summary,
    whyItMatters: 'Raw model output — JSON parse fail hua, isliye raw summary rakhi.',
    confidence: 0.3,
    tags: [],
    sources: [],
  };
}

/**
 * Runs a single agent end-to-end. Never throws; returns an offline result on failure.
 */
export async function runAgent(agent: AgentId): Promise<AgentRunResult> {
  try {
    let cfg: AgentConfig;
    try {
      cfg = agentConfig(agent);
    } catch {
      return {
        agent,
        status: 'offline',
        provider: null,
        model: null,
        findings: [],
        notes: [`Agent config load failed for ${agent}.`],
      };
    }

    let prompt = '';
    try {
      prompt = buildAgentPrompt(agent);
    } catch {
      prompt = '';
    }

    const userPrompt = buildUserPrompt(cfg);
    const temperature = temperatureForScope(cfg.temperatureScope);

    const messages: ProviderMessages[] = [
      { role: 'system', content: prompt },
      { role: 'user', content: userPrompt },
    ];

    let reply: ModelReply | null = null;
    try {
      reply = await callModelChain(messages, { temperature, maxTokens: 1200 });
    } catch {
      reply = null;
    }

    if (reply === null) {
      return {
        agent,
        status: 'offline',
        provider: null,
        model: null,
        findings: [],
        notes: [`Both OpenRouter and DeepSeek unavailable for ${agent}.`],
      };
    }

    let findings: AgentFinding[] = [];
    try {
      const json = extractJsonObject(reply.text);
      findings = parseFindings(json, agent, cfg.maxFindings);
    } catch {
      findings = [];
    }

    if (findings.length === 0 && reply.text.trim().length > 0) {
      try {
        findings = [buildRawFallbackFinding(cfg, agent, reply.text.trim())];
      } catch {
        findings = [];
      }
    }

    return {
      agent,
      status: 'ok',
      provider: reply.provider,
      model: reply.model,
      findings,
      notes: [],
    };
  } catch {
    return {
      agent,
      status: 'offline',
      provider: null,
      model: null,
      findings: [],
      notes: [`Unexpected failure while running ${agent}.`],
    };
  }
}

function offlineAgentResult(agent: AgentId, reason: string): AgentRunResult {
  return {
    agent,
    status: 'offline',
    provider: null,
    model: null,
    findings: [],
    notes: [reason],
  };
}

/**
 * Runs all four agents in parallel with Promise.allSettled, converting rejections
 * into offline results. Never throws.
 */
export async function runAllAgents(): Promise<AgentRunResult[]> {
  try {
    const ids: readonly AgentId[] = AGENT_IDS;
    const settled = await Promise.allSettled(ids.map((id) => runAgent(id)));

    const out: AgentRunResult[] = [];
    for (let i = 0; i < ids.length; i += 1) {
      const id = ids[i];
      if (id === undefined) continue;
      const entry = settled[i];
      if (entry && entry.status === 'fulfilled') {
        const value = entry.value;
        if (value && typeof value === 'object') {
          out.push(value);
          continue;
        }
        out.push(offlineAgentResult(id, `Agent ${id} returned no result.`));
        continue;
      }
      out.push(offlineAgentResult(id, `Agent ${id} rejected during nightly run.`));
    }
    return out;
  } catch {
    return [];
  }
}

/** Re-exported for callers that want the same JSON digest helper without extra imports. */
export { digestJson };
