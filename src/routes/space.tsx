import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type Apod = { title?: string; date?: string; explanation?: string; url?: string; hdurl?: string; media_type?: string; error?: string };

export const Route = createFileRoute("/space")({
  head: () => ({
    meta: [
      { title: "Space Photo of the Day — NO QUIT AI" },
      { name: "description", content: "NASA ki aaj ki space photo, NO QUIT AI par." },
      { property: "og:title", content: "Space Photo of the Day — NO QUIT AI" },
      { property: "og:description", content: "NASA ki aaj ki space photo, NO QUIT AI par." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SpacePage,
});

function SpacePage() {
  const [d, setD] = useState<Apod | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    setD(null);
    fetch("/api/nasa-apod")
      .then(async (r) => {
        const body = (await r.json().catch(() => null)) as Apod | null;
        if (!r.ok) {
          setD({ error: body?.error || `NASA data load nahi hua (${r.status})` });
          return;
        }
        setD(body);
      })
      .catch(() => setD({ error: "NASA data load nahi hua. Internet check karein." }))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <Link to="/" className="text-sm text-primary">← Back</Link>
      <h1 className="mt-3 font-display text-2xl font-bold text-foreground">🌌 Space Photo of the Day</h1>
      {loading && <p className="mt-6 text-muted-foreground">Loading...</p>}
      {!loading && d?.error && (
        <div className="mt-6 space-y-3">
          <p className="text-destructive">{d.error}</p>
          <Button variant="outline" size="sm" onClick={load}>Try again</Button>
        </div>
      )}
      {!loading && d && !d.error && (
        <div className="mt-4 space-y-3">
          {d.media_type === "video" ? (
            <iframe src={d.url} title={d.title} className="aspect-video w-full rounded-2xl border border-border" allowFullScreen />
          ) : (
            <img src={d.url} alt={d.title} className="w-full rounded-2xl border border-border" />
          )}
          <h2 className="text-lg font-semibold text-foreground">{d.title}</h2>
          <p className="text-xs text-muted-foreground">{d.date} · NASA APOD</p>
          <p className="text-sm leading-relaxed text-foreground/90">{d.explanation}</p>
          {d.hdurl && d.media_type !== "video" && (
            <a href={d.hdurl} target="_blank" rel="noreferrer" className="text-sm text-primary underline">
              View HD image
            </a>
          )}
        </div>
      )}
    </main>
  );
}
