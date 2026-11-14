import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Radar, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { ScottChat } from "@/components/ScottChat";

export const Route = createFileRoute("/scout")({
  head: () => ({
    meta: [
      { title: "Scott Coach & Scout — NO QUIT AI" },
      { name: "description", content: "Talk to Scott, your Roman Urdu and English motivational coach, or explore Scout market research." },
      { property: "og:title", content: "Scott Coach & Scout — NO QUIT AI" },
      { property: "og:description", content: "Private coaching conversations with Scott and market research with Scout in NO QUIT AI." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ScoutPage,
});

type Log = { text: string; level: "info" | "ok" | "warn" | "error"; at: string };
type Summary = { intro?: string; points?: { title: string; detail: string }[]; outro?: string };

function ScoutPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [running, setRunning] = useState(false);
  const [mode, setMode] = useState<"coach" | "research">("coach");
  const [started, setStarted] = useState(false);
  const [logs, setLogs] = useState<Log[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const logEnd = useRef<HTMLDivElement>(null);


  useEffect(() => logEnd.current?.scrollIntoView({ behavior: "smooth" }), [logs]);

  async function run() {
    setStarted(true);
    setRunning(true);
    setLogs([]);
    setSummary(null);
    setError(null);
    const add = (text: string, level: Log["level"] = "info") =>
      setLogs((l) => [...l, { text, level, at: new Date().toLocaleTimeString() }]);
    try {
      const { data } = await supabase.auth.getSession();
      const res = await fetch("/api/scout", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${data.session?.access_token ?? ""}` },
        body: JSON.stringify({}),
      });
      if (!res.ok || !res.body) throw new Error(`Scout error ${res.status}`);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line);
          if (ev.type === "log") add(ev.text, ev.level);
          else if (ev.type === "answers") add(`${ev.answers.length} agents ke jawab aa gaye`, "ok");
          else if (ev.type === "summary") setSummary(ev.summary);
          else if (ev.type === "error") {
            setError(ev.text);
            add(ev.text, "error");
          }
        }
      }
    } catch (e) {
      setError((e as Error).message);
      add((e as Error).message, "error");
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className="min-h-screen bg-background">
      {running && (
        <div className="sticky top-0 z-10 flex items-center justify-center gap-3 border-b border-border bg-card/90 px-4 py-3 backdrop-blur">
          <span className="h-3 w-3 rounded-full bg-primary node-pulse" />
          <p className="animate-pulse text-sm font-medium text-primary">Bhai main dusre AIs se baat kar raha hu...</p>
        </div>
      )}
      <div className="mx-auto max-w-[1280px] px-4 py-5">
        <Link to="/" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Home
        </Link>

        <div className="mb-5 flex gap-2" role="tablist" aria-label="Agent mode">
          <Button role="tab" aria-selected={mode === "coach"} variant={mode === "coach" ? "default" : "secondary"} onClick={() => setMode("coach")}>Scott Coach</Button>
          <Button role="tab" aria-selected={mode === "research"} variant={mode === "research" ? "default" : "secondary"} onClick={() => setMode("research")}>Scout Research</Button>
        </div>
        {mode === "coach" ? <ScottChat /> : !user ? <Link to="/auth" className="text-primary">Sign in for Scout Research</Link> : !started ? (
          <div className="flex min-h-[70vh] flex-col items-center justify-center gap-6 text-center">
            <Radar className="h-14 w-14 text-primary node-pulse" />
            <h1 className="text-2xl font-semibold md:text-3xl">
              MASTER <span className="text-gradient">SCOUT AGENT</span>
            </h1>
            <p className="max-w-md text-sm text-muted-foreground">Groq aur DeepSeek se A2A mashwara — top AI CV builder trends 2026.</p>
            <Button onClick={run} size="lg" className="glow h-14 rounded-2xl px-8 text-base font-semibold">
              <Sparkles className="mr-2 h-5 w-5" /> Market Se Mashwara Lo
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4 md:flex-row">
            <section className="panel min-h-[60vh] p-5 md:w-[70%]">
              <h2 className="mb-4 text-lg font-semibold">Final Summary</h2>
              {summary ? (
                <div className="space-y-4">
                  <p className="text-base font-medium text-primary">{summary.intro}</p>
                  <ol className="space-y-3">
                    {(summary.points ?? []).slice(0, 3).map((p, i) => (
                      <li key={i} className="rounded-xl border border-border bg-surface p-4">
                        <p className="font-semibold">
                          <span className="mr-2 text-primary">{i + 1}.</span>
                          {p.title}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">{p.detail}</p>
                      </li>
                    ))}
                  </ol>
                  {summary.outro && <p className="text-sm text-muted-foreground">{summary.outro}</p>}
                </div>
              ) : error ? (
                <p className="text-sm text-destructive">{error}</p>
              ) : (
                <p className="text-sm text-muted-foreground node-pulse">Agents se jawab aa rahe hain...</p>
              )}
              {!running && (
                <Button onClick={run} variant="secondary" className="mt-6">
                  Dobara mashwara lo
                </Button>
              )}
            </section>
            <aside className="panel max-h-[70vh] overflow-y-auto p-4 md:w-[30%]">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Live Logs</h2>
              <ul className="space-y-2 font-mono text-xs">
                {logs.map((l, i) => (
                  <li
                    key={i}
                    className={cn(
                      l.level === "ok" && "text-primary",
                      l.level === "warn" && "text-accent",
                      l.level === "error" && "text-destructive",
                      l.level === "info" && "text-foreground",
                    )}
                  >
                    <span className="text-muted-foreground">[{l.at}]</span> {l.text}
                  </li>
                ))}
              </ul>
              <div ref={logEnd} />
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
