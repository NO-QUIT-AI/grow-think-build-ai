/**
 * NO QUIT AI — model-call helper for the nightly agents.
 *
 * Design rules:
 * - Only depends on './config' and './types'.
 * - TypeScript strict-safe (noUncheckedIndexedAccess, exactOptionalPropertyTypes).
 * - Every exported function never throws.
 * - Never logs API keys or prompt content.
 */

import { agentModels, OPENROUTER_CHAT_URL, REQUEST_TIMEOUT_MS } from './config';
import type { AgentFinding, AgentId } from './types';
import { makeId } from './types';

export type DigestResult = { text: string; model: string } | null;

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface CallOptions {
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

const DEFAULT_TEMPERATURE = 0.4;
const DEFAULT_MAX_TOKENS = 1200;
const DEFAULT_REFERER = 'https://noquit.ai';
const X_TITLE = 'NO QUIT AI — Nightly Agents';

type AbortSignalLike = { any?: (signals: AbortSignal[]) => AbortSignal };

function getApiKey(): string | null {
  try {
    const raw = process.env['OPENROUTER_API_KEY'];
    if (typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}

function getReferer(): string {
  try {
    const raw = process.env['PUBLIC_SITE_URL'];
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (trimmed.length > 0) return trimmed;
    }
  } catch {
    // ignore
  }
  return DEFAULT_REFERER;
}

function makeTimeoutSignal(): AbortSignal | null {
  try {
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
      return AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    }
  } catch {
    // ignore
  }
  return null;
}

function combineSignals(callerSignal: AbortSignal | undefined): AbortSignal | undefined {
  const timeout = makeTimeoutSignal();
  if (!callerSignal) return timeout ?? undefined;
  const anyFn = (AbortSignal as unknown as AbortSignalLike).any;
  if (timeout && typeof anyFn === 'function') {
    try {
      return anyFn.call(AbortSignal, [callerSignal, timeout]);
    } catch {
      // fall through to timeout only
    }
  }
  return timeout ?? callerSignal;
}

function coerceFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function extractContent(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const first = choices[0];
  if (!first || typeof first !== 'object') return null;
  const message = (first as { message?: unknown }).message;
  if (!message || typeof message !== 'object') return null;
  const content = (message as { content?: unknown }).content;

  if (typeof content === 'string') {
    const trimmed = content.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (Array.isArray(content)) {
    const parts: string[] = [];
    for (const part of content) {
      if (!part || typeof part !== 'object') continue;
      const p = part as { type?: unknown; text?: unknown };
      if (p.type !== 'text') continue;
      if (typeof p.text !== 'string') continue;
      const trimmed = p.text.trim();
      if (trimmed.length > 0) parts.push(trimmed);
    }
    if (parts.length === 0) return null;
    return parts.join('\n');
  }

  return null;
}

/**
 * Tries each configured model in order and returns the first non-empty response.
 * Returns null on missing API key, non-200 responses, empty content, or all failures.
 * Never throws.
 */
export async function callOpenRouter(
  messages: ChatMessage[],
  options?: CallOptions
): Promise<DigestResult> {
  try {
    const apiKey = getApiKey();
    if (apiKey === null) return null;

    if (!Array.isArray(messages) || messages.length === 0) return null;

    const safeMessages: ChatMessage[] = [];
    for (const m of messages) {
      if (!m || typeof m !== 'object') continue;
      if (m.role !== 'user' && m.role !== 'assistant' && m.role !== 'system') continue;
      if (typeof m.content !== 'string') continue;
      safeMessages.push({ role: m.role, content: m.content });
    }
    if (safeMessages.length === 0) return null;

    const temperature =
      coerceFiniteNumber(options?.temperature) ?? DEFAULT_TEMPERATURE;
    const maxTokens = coerceFiniteNumber(options?.maxTokens) ?? DEFAULT_MAX_TOKENS;
    const callerSignal = options?.signal;

    let models: string[];
    try {
      models = agentModels();
    } catch {
      models = [];
    }

    for (const model of models) {
      if (typeof model !== 'string' || model.length === 0) continue;

      const signal = combineSignals(callerSignal);

      const body: Record<string, unknown> = {
        model,
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
          'HTTP-Referer': getReferer(),
          'X-Title': X_TITLE,
        },
        body: JSON.stringify(body),
      };
      if (signal) init.signal = signal;

      let response: Response;
      try {
        response = await fetch(OPENROUTER_CHAT_URL, init);
      } catch {
        continue;
      }

      if (!response || response.status !== 200) {
        continue;
      }

      let payload: unknown = null;
      try {
        payload = await response.json();
      } catch {
        continue;
      }

      const text = extractContent(payload);
      if (text === null) continue;

      return { text, model };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Extracts the first JSON object from arbitrary text (with optional markdown fences
 * and surrounding prose). Returns null on any failure. Never throws.
 */
export function extractJsonObject(text: string | null | undefined): unknown {
  try {
    if (typeof text !== 'string') return null;
    let cleaned = text.trim();
    if (cleaned.length === 0) return null;

    // Strip leading/trailing code fences if present.
    const fenceMatch = cleaned.match(/^```(?:json|JSON)?\s*([\s\S]*?)\s*```$/);
    if (fenceMatch && typeof fenceMatch[1] === 'string') {
      cleaned = fenceMatch[1].trim();
    }

    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) return null;

    const slice = cleaned.slice(start, end + 1);
    try {
      return JSON.parse(slice) as unknown;
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

/**
 * Convenience wrapper: sends a system + user prompt, extracts JSON, returns
 * { json, model } or { json: null, model: null } on failure. Never throws.
 */
export async function digestJson(
  agent: AgentId,
  systemPrompt: string,
  userPrompt: string
): Promise<{ json: unknown; model: string | null }> {
  try {
    const sys = typeof systemPrompt === 'string' ? systemPrompt : '';
    const usr = typeof userPrompt === 'string' ? userPrompt : '';
    const result = await callOpenRouter([
      { role: 'system', content: sys },
      { role: 'user', content: usr },
    ]);
    if (result === null) return { json: null, model: null };
    const json = extractJsonObject(result.text);
    if (json === null) return { json: null, model: null };
    // `agent` is accepted for API symmetry; used by callers to tag the source.
    void agent;
    return { json, model: result.model };
  } catch {
    return { json: null, model: null };
  }
}

function clampConfidence(value: unknown): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function toStringArray(value: unknown): string[] {
  try {
    if (!Array.isArray(value)) return [];
    const out: string[] = [];
    for (const item of value) {
      if (typeof item !== 'string') continue;
      const trimmed = item.trim();
      if (trimmed.length > 0) out.push(trimmed);
    }
    return out;
  } catch {
    return [];
  }
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function candidatesFrom(json: unknown): unknown[] {
  if (Array.isArray(json)) return json;
  if (json && typeof json === 'object') {
    const findings = (json as { findings?: unknown }).findings;
    if (Array.isArray(findings)) return findings;
  }
  return [];
}

/**
 * Parses an arbitrary JSON payload into a defensive AgentFinding list.
 * Skips invalid entries, clamps confidence, trims strings, drops empty titles,
 * caps to `limit`. Returns [] on anything unusable. Never throws.
 */
export function parseFindings(json: unknown, agent: AgentId, limit: number): AgentFinding[] {
  try {
    const max = typeof limit === 'number' && Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 0;
    if (max === 0) return [];

    const raw = candidatesFrom(json);
    if (raw.length === 0) return [];

    const now = new Date().toISOString();
    const out: AgentFinding[] = [];

    for (const item of raw) {
      if (out.length >= max) break;
      if (!item || typeof item !== 'object') continue;

      const rec = item as Record<string, unknown>;
      const title = asString(rec['title']);
      if (title.length === 0) continue;

      const summary = asString(rec['summary']);
      const whyItMatters = asString(rec['whyItMatters']);
      const confidence = clampConfidence(rec['confidence']);
      const tags = toStringArray(rec['tags']);
      const sources = toStringArray(rec['sources']);

      out.push({
        id: makeId('finding'),
        agent,
        createdAt: now,
        title,
        summary,
        whyItMatters,
        confidence,
        tags,
        sources,
      });
    }

    return out;
  } catch {
    return [];
  }
}
