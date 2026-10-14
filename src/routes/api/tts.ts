import { createFileRoute } from "@tanstack/react-router";
import { userFromRequest } from "@/lib/auth-user.server";
import { getVoiceAudio } from "@/lib/voice-audio.server";

const DEFAULT_VOICE = "pFZP5JQG7iQjIQuC4Bku";

/** ElevenLabs voice with free Edge TTS fallback — signed-in users only. Returns audio/mpeg. */
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
        try {
          const audio = await getVoiceAudio(text, voiceId);
          return new Response(audio, { headers: { "content-type": "audio/mpeg", "cache-control": "no-store" } });
        } catch (e) {
          console.error("TTS failed", (e as Error).message);
          return new Response("Voice failed", { status: 502 });
        }
      },
    },
  },
});
