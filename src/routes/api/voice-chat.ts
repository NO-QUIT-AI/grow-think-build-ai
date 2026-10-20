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

async function callOpenAI(url: string, key: string, model: string, messages: Msg[]) {
  const res = await fetch(url, {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ model, messages: [{ role: "system", content: VOICE_PROMPT }, ...messages], temperature: 0.8 }),
  });
  if (!res.ok) throw new Error(`${model} ${res.status}`);
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = json.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("empty");
  return text;
}

/** Voice mode: pehle Groq, credit/error par DeepSeek. */
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
        const groq = process.env["GROQ_API_KEY"];
        const deepseek = process.env["DEEPSEEK_API_KEY"];
        const providers: (() => Promise<string>)[] = [];
        if (groq) providers.push(() => callOpenAI("https://api.groq.com/openai/v1/chat/completions", groq, "llama-3.1-8b-instant", messages));
        if (deepseek) providers.push(() => callOpenAI("https://api.deepseek.com/chat/completions", deepseek, "deepseek-chat", messages));
        for (const run of providers) {
          try {
            return Response.json({ text: await run() });
          } catch (e) {
            console.error("[voice-chat]", e);
          }
        }
        return new Response("Voice AI unavailable", { status: 503 });
      },
    },
  },
});
