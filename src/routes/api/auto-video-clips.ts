import { createFileRoute } from "@tanstack/react-router";
import { userFromRequest } from "@/lib/auth-user.server";

export const Route = createFileRoute("/api/auto-video-clips")({
  server: { handlers: { GET: async ({ request }) => {
    const user = await userFromRequest(request);
    if (!user) return Response.json({ error: "Pehle login karo" }, { status: 401 });
    const key = process.env["PEXELS_API_KEY"];
    if (!key) return Response.json({ clips: [], configured: false });
    const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 100) || "nature";
    try {
      const url = new URL("https://api.pexels.com/videos/search");
      url.search = new URLSearchParams({ query, orientation: "portrait", per_page: "6", size: "small" }).toString();
      const result = await fetch(url, { headers: { Authorization: key }, signal: AbortSignal.timeout(15000) });
      if (!result.ok) return Response.json({ error: `Pexels clips unavailable (${result.status})` }, { status: result.status });
      const data = await result.json() as { videos?: { image: string; url: string; user?: { name: string }; video_files: { link: string; width: number; height: number; file_type: string }[] }[] };
      const clips = (data.videos ?? []).flatMap(v => {
        const file = v.video_files.filter(f => f.file_type === "video/mp4" && f.height > f.width).sort((a,b) => a.width - b.width)[0];
        return file ? [{ url: file.link, thumbnail: v.image, page: v.url, author: v.user?.name ?? "Pexels" }] : [];
      });
      return Response.json({ clips, configured: true }, { headers: { "cache-control": "private, no-store" } });
    } catch { return Response.json({ error: "Pexels clips abhi nahi mil rahe; apna clip choose karo." }, { status: 502 }); }
  } } },
});