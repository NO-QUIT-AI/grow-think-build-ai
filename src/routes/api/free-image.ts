import { createFileRoute } from "@tanstack/react-router";

/** Final fallback image source for chat (loaded via <img>). */
export const Route = createFileRoute("/api/free-image")({
  server: {
    handlers: {
      // Retire the anonymous owner-key endpoint. Free images now use the public Space.
      GET: () => new Response("Use free image generation in Chat.", { status: 410 }),
    },
  },
});
