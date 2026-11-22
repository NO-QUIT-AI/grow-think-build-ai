import { createFileRoute } from '@tanstack/react-router';

type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string };

type Body = { messages?: unknown };

const UNAVAILABLE_MESSAGE =
  'NO QUIT AI temporarily unavailable. Ollama not reachable and DeepSeek fallback failed.';

const REPLY_PREFIX = 'NO QUIT AI: ';

const OLLAMA_MODEL = 'phi3:mini';
const DEEPSEEK_MODEL = 'deepseek-chat';
const REQUEST_TIMEOUT_MS = 20000;

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    (v['role'] === 'user' || v['role'] === 'assistant' || v['role'] === 'system') &&
    typeof v['content'] === 'string'
  );
}

function extractReply(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (value.trim().length === 0) return null;
  return value;
}

function stripPrefix(reply: string): string {
  return reply.startsWith(REPLY_PREFIX) ? reply.slice(REPLY_PREFIX.length) : reply;
}

async function callOllama(messages: ChatMessage[]): Promise<string | null> {
  const baseUrl = process.env.OLLAMA_URL ?? 'http://localhost:11434';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages,
        stream: false,
      }),
      signal: controller.signal,
    });

    if (!res.ok) return null;

    const data = (await res.json()) as {
      message?: { content?: unknown };
      response?: unknown;
    };

    return extractReply(data?.message?.content) ?? extractReply(data?.response);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function callDeepSeek(messages: ChatMessage[]): Promise<string | null> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return null;

  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages,
        stream: false,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: unknown } }>;
    };

    return extractReply(data?.choices?.[0]?.message?.content);
  } catch {
    return null;
  }
}

export const Route = createFileRoute('/api/jalsa-ai')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as Body;
          const messages = Array.isArray(body?.messages)
            ? body.messages.filter(isChatMessage)
            : [];

          if (messages.length === 0) {
            return Response.json({ error: UNAVAILABLE_MESSAGE }, { status: 503 });
          }

          const ollamaReply = await callOllama(messages);
          if (ollamaReply !== null) {
            return Response.json({ reply: stripPrefix(ollamaReply) });
          }

          const deepSeekReply = await callDeepSeek(messages);
          if (deepSeekReply !== null) {
            return Response.json({ reply: stripPrefix(deepSeekReply) });
          }

          return Response.json({ error: UNAVAILABLE_MESSAGE }, { status: 503 });
        } catch {
          return Response.json({ error: UNAVAILABLE_MESSAGE }, { status: 503 });
        }
      },
    },
  },
});
