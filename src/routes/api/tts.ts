import { createFileRoute } from "@tanstack/react-router";
import { userFromRequest } from "@/lib/auth-user.server";

const DEFAULT_VOICE = "pFZP5JQG7iQjIQuC4Bku";

/** ElevenLabs lifelike voice — signed-in users only. Returns audio/mpeg. */
export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await userFromRequest(request);
        if (!user) return new Response("Unauthorized", { status: 401 });
        const body = (await request.json().catch(() => ({}))) as { text?: string; voiceId?: string };
        const text = String(body.text ?? "").trim().slice(0, 1200);
        if (!text) return new Response("text required", { status: 400 });
        const voiceId = /^[A-Za-z0-9]{10,40}$/.test(body.voiceId ?? "") ? body.voiceId! : DEFAULT_VOICE;
        const key = process.env["ELEVENLABS_API_KEY"];
        if (!key) return new Response("Voice not configured", { status: 500 });

        const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
          method: "POST",
          headers: { "xi-api-key": key, "content-type": "application/json" },
          body: JSON.stringify({
            text,
            model_id: "eleven_multilingual_v2",
            voice_settings: { stability: 0.7, similarity_boost: 0.8, speed: 1.0 },
          }),
        });
        if (!res.ok) return new Response(`Voice failed (${res.status})`, { status: res.status === 429 ? 429 : 502 });
        return new Response(res.body, { headers: { "content-type": "audio/mpeg", "cache-control": "no-store" } });
      },
    },
  },
});
