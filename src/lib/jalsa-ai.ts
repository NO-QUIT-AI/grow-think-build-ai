export const JALSA_AI_PEER = { id: 'no-quit-ai', name: 'NO QUIT AI' };

export type JalsaAIMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

/**
 * Detects whether a Jalsa chat message is addressed to NO QUIT AI.
 * Matches "@AI" or "AI bhai" case-insensitively using word boundaries.
 */
export function isAiMention(text: string): boolean {
  if (typeof text !== 'string' || text.length === 0) return false;
  return /@ai\b/i.test(text) || /\bai\s+bhai\b/i.test(text);
}

/** Formats a raw AI reply with the NO QUIT AI prefix. */
export function formatAiReply(reply: string): string {
  const clean = typeof reply === 'string' ? reply.trim() : '';
  return 'NO QUIT AI: ' + clean;
}

/**
 * Sends the conversation to the Jalsa AI route.
 * Resolves to the reply string when the route responds ok, otherwise null.
 * Never throws.
 */
export async function askJalsaAI(messages: JalsaAIMessage[]): Promise<string | null> {
  try {
    const res = await fetch('/api/jalsa-ai', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { reply?: unknown };
    if (typeof data?.reply === 'string' && data.reply.trim().length > 0) {
      return data.reply;
    }
    return null;
  } catch {
    return null;
  }
}
