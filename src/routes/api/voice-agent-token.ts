import { createFileRoute } from "@tanstack/react-router";
import { userFromRequest } from "@/lib/auth-user.server";
import { voiceAgentUpdate } from "@/lib/voice-agent-config";

const AGENT_ID = "agent_2401m4hk9g2qf738x31ryxc07eyy";

let promptSynced: Promise<void> | null = null;
/** Agent ka prompt code se ElevenLabs par set karo (har server instance par ek baar). */
function syncAgentPrompt(key: string) {
  promptSynced ??= (async () => {
    const url = `https://api.elevenlabs.io/v1/convai/agents/${AGENT_ID}`;
    const headers = { "xi-api-key": key, "content-type": "application/json" };
    const existing = await fetch(url, { headers });
    if (!existing.ok) throw new Error(`Agent configuration read failed (${existing.status})`);
    const current = await existing.json() as { conversation_config: Parameters<typeof voiceAgentUpdate>[0] };
    const updated = await fetch(url, { method: "PATCH", headers, body: JSON.stringify(voiceAgentUpdate(current.conversation_config)) });
    if (!updated.ok) throw new Error(`Agent configuration update failed (${updated.status})`);
  })().catch((e) => { console.error("[voice-agent] configuration sync", e); promptSynced = null; });
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
        void syncAgentPrompt(key); // background — token ko block na kare
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
