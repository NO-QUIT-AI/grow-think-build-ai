import { createFileRoute } from "@tanstack/react-router";
import { userFromRequest } from "@/lib/auth-user.server";

const VOICE_PROMPT = `You are NO QUIT AI. MOST IMPORTANT RULE: Reply in the EXACT same language as the user's last message.
- English -> English. Roman Urdu/Hinglish -> Roman Urdu/Hinglish. Hindi -> Hindi. Punjabi -> Punjabi.
- Arabic, Urdu, Bengali, Tamil or ANY other language -> reply in that same language and script.
- Never force Roman Urdu or English.
Be a friendly human friend, never robotic, never say "As an AI".
VOICE REPLY: very short, max 15-20 words, often ask something back. No emojis, no markdown.
Remember context, never repeat a question you already asked.`;

type Msg = { role: "user" | "assistant"; content: string };

export const Route = createFileRoute("/api/voice-chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await userFromRequest(request);
        if (!user) return new Response("Unauthorized", { status: 401 });
        const body = (await request.json().catch(() => ({}))) as { messages?: Msg[]; name?: string; replyLang?: string };
        const messages = (Array.isArray(body.messages) ? body.messages : [])
          .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
          .slice(-8)
          .map((m) => ({ role: m.role, content: m.content.slice(0, 1500) }));
        if (!messages.length) return new Response("messages required", { status: 400 });
        if (body.name) messages.unshift({ role: "user", content: `(Mera naam ${String(body.name).slice(0, 40)} hai)` });

        const langRule = body.replyLang === "en"
          ? "User is speaking ENGLISH. Reply ONLY in casual English, e.g. \"I'm great bro, what's up?\""
          : "Reply in the exact same language and script as the user's last message.";
        messages.push({ role: "user", content: `(Instruction: ${langRule})` });
        try {
          const { aiText } = await import("@/lib/ai-provider.server");
          return Response.json({ text: await aiText(VOICE_PROMPT, messages, request.signal) });
        } catch { console.warn("[voice-chat] providers unavailable"); }
        return new Response("Voice AI unavailable", { status: 503 });
      },
    },
  },
});
