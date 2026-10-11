import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

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
  useEffect(() => {
    fetch("/api/nasa-apod").then((r) => r.json()).then(setD).catch(() => setD({ error: "Load nahi hua" }));
  }, []);
  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <Link to="/" className="text-sm text-primary">← Back</Link>
      <h1 className="mt-3 font-display text-2xl font-bold text-foreground">🌌 Space Photo of the Day</h1>
      {!d && <p className="mt-6 text-muted-foreground">Loading...</p>}
      {d?.error && <p className="mt-6 text-destructive">{d.error}</p>}
      {d && !d.error && (
        <div className="mt-4 space-y-3">
          {d.media_type === "video" ? (
            <iframe src={d.url} title={d.title} className="aspect-video w-full rounded-2xl border border-border" allowFullScreen />
          ) : (
            <img src={d.url} alt={d.title} className="w-full rounded-2xl border border-border" />
          )}
          <h2 className="text-lg font-semibold text-foreground">{d.title}</h2>
          <p className="text-xs text-muted-foreground">{d.date} · NASA APOD</p>
          <p className="text-sm leading-relaxed text-foreground/90">{d.explanation}</p>
        </div>
      )}
    </main>
  );
}
