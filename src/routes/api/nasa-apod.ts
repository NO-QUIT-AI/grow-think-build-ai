import { createFileRoute } from "@tanstack/react-router";

/** NASA Astronomy Picture of the Day — key server par hi rehti hai. */
export const Route = createFileRoute("/api/nasa-apod")({
  server: {
    handlers: {
      GET: async () => {
        // NASA_API_KEY agar set hai to use karo, warna NASA ka public DEMO_KEY.
        const key = process.env["NASA_API_KEY"] || "DEMO_KEY";
        let res: Response;
        try {
          res = await fetch(`https://api.nasa.gov/planetary/apod?api_key=${encodeURIComponent(key)}`, {
            headers: { accept: "application/json" },
          });
        } catch {
          return Response.json({ error: "NASA se connect nahi ho saka. Dobara koshish karein." }, { status: 502 });
        }
        if (!res.ok) {
          return Response.json({ error: `NASA error ${res.status}` }, { status: 502 });
        }
        let d: { title?: string; date?: string; explanation?: string; url?: string; hdurl?: string; media_type?: string };
        try {
          d = (await res.json()) as typeof d;
        } catch {
          return Response.json({ error: "NASA ka jawab parh nahi saka" }, { status: 502 });
        }
        if (!d?.url) {
          return Response.json({ error: "NASA ne koi image nahi bheji" }, { status: 502 });
        }
        return Response.json(
          { title: d.title, date: d.date, explanation: d.explanation, url: d.url, hdurl: d.hdurl, media_type: d.media_type },
          { headers: { "cache-control": "public, max-age=3600" } },
        );
      },
    },
  },
});
