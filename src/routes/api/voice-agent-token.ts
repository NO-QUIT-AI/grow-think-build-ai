import { createFileRoute } from "@tanstack/react-router";
import { userFromRequest } from "@/lib/auth-user.server";

const AGENT_ID = "agent_2401m4hk9g2qf738x31ryxc07eyy";

/** ElevenLabs live agent ka WebRTC token — sirf signed-in users. */
export const Route = createFileRoute("/api/voice-agent-token")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await userFromRequest(request);
        if (!user) return new Response("Unauthorized", { status: 401 });
        const key = process.env["ELEVENLABS_AGENT_API_KEY"];
        if (!key) return new Response("Agent not configured", { status: 503 });
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
