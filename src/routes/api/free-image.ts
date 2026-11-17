import { createFileRoute } from "@tanstack/react-router";
import { serverImage } from "@/lib/free-image.server";

/** Free image source (loaded via <img>) — Hugging Face first, Pollinations fallback. */
export const Route = createFileRoute("/api/free-image")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const prompt = (url.searchParams.get("prompt") ?? "").trim();
        if (!prompt) return new Response("prompt is required", { status: 400 });
        if (prompt.length > 1000) return new Response("prompt too long", { status: 400 });
        const upstream = await serverImage(prompt);
        const headers = new Headers();
        const type = upstream.headers.get("content-type") ?? "image/png";
        headers.set("content-type", type);
        headers.set("cache-control", "public, max-age=86400');
        return new Response(upstream.body, { status: upstream.status, headers });
      },
    },
  },
});
