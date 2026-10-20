import { createFileRoute } from "@tanstack/react-router";
import { userFromRequest } from "@/lib/auth-user.server";

const AGENT_ID = "agent_2401m4hk9g2qf738x31ryxc07eyy";

const AGENT_PROMPT = `You are NO QUIT AI - a friendly desi friend. You always reply in the EXACT same language the user speaks.
- English -> English. Roman Urdu -> Roman Urdu. Hindi, Punjabi, Urdu, Arabic or any other language -> that same language.
- If the user mixes (e.g. "Are yaar main desi hoon par English bhi aati hai"), reply in the same natural mix.
- Never force Roman Urdu. Match the user's language 100%, from their LAST message.
Be warm and fun like a real friend, never robotic, never say "As an AI". Keep replies short (15-20 words) and often ask something back. Remember context and never repeat a question.`;

let promptSynced: Promise<void> | null = null;
/** Agent ka prompt code se ElevenLabs par set karo (har server instance par ek baar). */
function syncAgentPrompt(key: string) {
  promptSynced ??= fetch(`https://api.elevenlabs.io/v1/convai/agents/${AGENT_ID}`, {
    method: "PATCH",
    headers: { "xi-api-key": key, "content-type": "application/json" },
    body: JSON.stringify({ conversation_config: { agent: { first_message: "", prompt: { prompt: AGENT_PROMPT } } } }),
  }).then(async (r) => {
    if (!r.ok) { console.error("[voice-agent] prompt sync failed", r.status, await r.text()); promptSynced = null; }
  }).catch((e) => { console.error("[voice-agent] prompt sync", e); promptSynced = null; });
  return promptSynced;
}

/** ElevenLabs live agent ka WebRTC token — sirf signed-in users. */
export const Route = createFileRoute("/api/voice-agent-token")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await userFromRequest(request);
        if (!user) return new Response("Unauthorized", { status: 401 });
        const key = process.env["ELEVENLABS_AGENT_API_KEY"];
        if (!key) return new Response("Agent not configured", { status: 503 });
        await syncAgentPrompt(key);
        const res = await fetch(`https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${AGENT_ID}`, {
          headers: { "xi-api-key": key },
        });
        if (!res.ok) return new Response(`Agent unavailable (${res.status}): ${await res.text()}`, { status: 503 });
        const { token } = (await res.json()) as { token?: string };
        if (!token) return new Response("No token", { status: 503 });
        return Response.json({ token });
      },
    },
  },
});
