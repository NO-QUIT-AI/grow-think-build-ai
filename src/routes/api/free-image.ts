import { createFileRoute } from "@tanstack/react-router";
import { serverImage } from "@/lib/free-image.server";

/** Final fallback image source for chat (loaded via <img>). */
export const Route = createFileRoute("/api/free-image")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const prompt = new URL(request.url).searchParams.get("prompt")?.trim().slice(0, 600);
        if (!prompt) return new Response("prompt required", { status: 400 });
        const r = await serverImage(prompt);
        if (!r.ok) return r;
        return new Response(r.body, {
          headers: { "content-type": r.headers.get("content-type") ?? "image/png", "cache-control": "public, max-age=86400" },
        });
      },
    },
  },
});
