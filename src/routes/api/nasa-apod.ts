import { createFileRoute } from "@tanstack/react-router";

/** NASA Astronomy Picture of the Day — key server par hi rehti hai. */
export const Route = createFileRoute("/api/nasa-apod")({
  server: {
    handlers: {
      GET: async () => {
        const key = process.env["NASA_API_KEY"];
        if (!key) return Response.json({ error: "NASA key missing" }, { status: 503 });
        const res = await fetch(`https://api.nasa.gov/planetary/apod?api_key=${key}`);
        if (!res.ok) return Response.json({ error: `NASA error ${res.status}` }, { status: 502 });
        const d = (await res.json()) as { title?: string; date?: string; explanation?: string; url?: string; hdurl?: string; media_type?: string };
        return Response.json(
          { title: d.title, date: d.date, explanation: d.explanation, url: d.url, hdurl: d.hdurl, media_type: d.media_type },
          { headers: { "cache-control": "public, max-age=3600" } },
        );
      },
    },
  },
});
