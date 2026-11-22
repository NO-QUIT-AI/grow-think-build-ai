/**
 * NO QUIT AI — smart router: try local Ollama first, then DeepSeek.
 *
 * Design rules:
 * - No external dependencies.
 * - TypeScript strict-safe (noUncheckedIndexedAccess, exactOptionalPropertyTypes).
 * - Never throws: each provider returns string | null; routeChat returns null only if both fail.
 * - Never logs or returns API keys.
 */

export type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string };

export type ProviderName = 'ollama' | 'deepseek';

export type RouteResult = { reply: string; provider: ProviderName };

export interface RouteOptions {
  messages: ChatMessage[];
  signal?: AbortSignal;
  timeoutMs?: number;
  temperature?: number;
}

export const PROVIDER_ORDER: readonly ProviderName[] = ['ollama', 'deepseek'];

const DEFAULT_TIMEOUT_MS = 20000;
const OLLAMA_MODEL = 'phi3:mini';
const DEEPSEEK_MODEL = 'deepseek-chat';
const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';
const REPLY_PREFIX = 'NO QUIT AI: ';

/** Removes a single leading 'NO QUIT AI: ' prefix if present. */
export function stripReplyPrefix(reply: string): string {
  if (typeof reply !== 'string') return '';
  return reply.startsWith(REPLY_PREFIX) ? reply.slice(REPLY_PREFIX.length) : reply;
}

function toTimeout(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return DEFAULT_TIMEOUT_MS;
  return value;
}

/** Builds a combined abort signal from an optional parent signal plus a timeout. */
function makeSignal(parent: AbortSignal | undefined, timeoutMs: number): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  if (!parent) return timeout;
  if (typeof AbortSignal.any === 'function') return AbortSignal.any([parent, timeout]);
  // Fallback for environments without AbortSignal.any.
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (parent.aborted) controller.abort();
  else parent.addEventListener('abort', abort, { once: true });
  timeout.addEventListener('abort', abort, { once: true });
  return controller.signal;
}

function extractNonEmpty(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function buildBody(base: Record<string, unknown>, options: RouteOptions): Record<string, unknown> {
  if (typeof options.temperature === 'number' && Number.isFinite(options.temperature)) {
    return { ...base, temperature: options.temperature };
  }
  return base;
}

/** Tries local Ollama chat; returns trimmed reply or null. Never throws. */
export async function callOllama(options: RouteOptions): Promise<string | null> {
  try {
    const baseUrl = process.env.OLLAMA_URL ?? 'http://localhost:11434';
    const url = `${baseUrl}/api/chat`;
    const signal = makeSignal(options.signal, toTimeout(options.timeoutMs));
    const body = buildBody({ model: OLLAMA_MODEL, messages: options.messages, stream: false }, options);

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });

    if (!res.ok) return null;

    const data = (await res.json()) as {
      message?: { content?: unknown };
      response?: unknown;
    };

    return extractNonEmpty(data?.message?.content) ?? extractNonEmpty(data?.response);
  } catch {
    return null;
  }
}

/** Tries DeepSeek chat completions; returns trimmed reply or null. Never throws. */
export async function callDeepSeek(options: RouteOptions): Promise<string | null> {
  try {
    const key = process.env.DEEPSEEK_API_KEY;
    if (!key) return null;

    const signal = makeSignal(options.signal, toTimeout(options.timeoutMs));
    const body = buildBody({ model: DEEPSEEK_MODEL, messages: options.messages, stream: false }, options);

    const res = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!res.ok) return null;

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: unknown } }>;
    };

    return extractNonEmpty(data?.choices?.[0]?.message?.content);
  } catch {
    return null;
  }
}

/**
 * Routes a chat turn: Ollama first, then DeepSeek. Returns the first non-empty reply
 * with its provider name; returns null only if both fail. Never throws.
 */
export async function routeChat(options: RouteOptions): Promise<RouteResult | null> {
  for (const provider of PROVIDER_ORDER) {
    let reply: string | null = null;
    try {
      reply = provider === 'ollama' ? await callOllama(options) : await callDeepSeek(options);
    } catch {
      reply = null;
    }

    if (reply !== null) {
      const cleaned = stripReplyPrefix(reply).trim();
      if (cleaned.length > 0) return { reply: cleaned, provider };
    }
  }
  return null;
}
