import { createFileRoute } from "@tanstack/react-router";
import { userFromRequest } from "@/lib/auth-user.server";
import { fetchPixabayClips } from "@/lib/pixabay-stock";

export const Route = createFileRoute("/api/auto-video-clips")({
  server: { handlers: { GET: async ({ request }) => {
    const user = await userFromRequest(request);
    if (!user) return Response.json({ error: "Pehle login karo" }, { status: 401 });
    const key = process.env["PIXABAY_API_KEY"];
    if (!key) return Response.json({ clips: [], configured: false }, { headers: { "cache-control": "private, no-store" } });
    const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 100) || "nature";
    const clips = await fetchPixabayClips(key, query);
    return Response.json({ clips, configured: true }, { headers: { "cache-control": "private, no-store" } });
  } } },
});