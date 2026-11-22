import { createFileRoute } from '@tanstack/react-router';

type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string };

type Body = { messages?: unknown };

const OFFLINE_MESSAGE = 'NO QUIT AI is unavailable right now.';

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    (v['role'] === 'user' || v['role'] === 'assistant' || v['role'] === 'system') &&
    typeof v['content'] === 'string'
  );
}

export const Route = createFileRoute('/api/jalsa-ai')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const key = process.env.DEEPSEEK_API_KEY;
          if (!key) {
            return Response.json({ error: OFFLINE_MESSAGE }, { status: 503 });
          }

          const body = (await request.json()) as Body;
          const messages = Array.isArray(body?.messages)
            ? body.messages.filter(isChatMessage)
            : [];

          if (messages.length === 0) {
            return Response.json({ error: OFFLINE_MESSAGE }, { status: 503 });
          }

          const res = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              authorization: `Bearer ${key}`,
            },
            body: JSON.stringify({
              model: 'deepseek-chat',
              messages,
              stream: false,
            }),
            signal: AbortSignal.timeout(20000),
          });

          if (!res.ok) {
            return Response.json({ error: OFFLINE_MESSAGE }, { status: 503 });
          }

          const data = (await res.json()) as {
            choices?: Array<{ message?: { content?: unknown } }>;
          };
          const reply = data?.choices?.[0]?.message?.content;
          if (typeof reply !== 'string' || reply.trim().length === 0) {
            return Response.json({ error: OFFLINE_MESSAGE }, { status: 503 });
          }

          return Response.json({ reply });
        } catch {
          return Response.json({ error: OFFLINE_MESSAGE }, { status: 503 });
        }
      },
    },
  },
});
