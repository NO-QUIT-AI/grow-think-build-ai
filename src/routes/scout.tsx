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
        {mode === "coach" ? <ScottChat key="scott" agent="scott" /> : <ScottChat key="scout" agent="scout" />}
      </div>
    </main>
  );
}
