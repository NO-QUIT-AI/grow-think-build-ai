import { createFileRoute } from '@tanstack/react-router';

type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string };

type Body = { messages?: unknown };

const OFFLINE_MESSAGE =
  'NO QUIT AI is offline — start Ollama locally (phi3:mini).';

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
          const body = (await request.json()) as Body;
          const messages = Array.isArray(body?.messages)
            ? body.messages.filter(isChatMessage)
            : [];

          const res = await fetch('http://localhost:11434/api/chat', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              model: 'phi3:mini',
              messages,
              stream: false,
            }),
            signal: AbortSignal.timeout(20000),
          });

          if (!res.ok) {
            return Response.json({ error: OFFLINE_MESSAGE }, { status: 503 });
          }

          const data = (await res.json()) as {
            message?: { content?: unknown };
          };
          const reply = data?.message?.content;
          if (typeof reply !== 'string') {
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
