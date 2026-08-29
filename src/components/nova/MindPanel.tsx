import { useCallback, useEffect, useState } from "react";
import { Brain, Loader2, Play, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type Insight = {
  id: string;
  topic: string;
  content: string;
  tags: string[];
  confidence: number;
  created_at: string;
};

export function MindPanel({ userId, refreshKey }: { userId: string; refreshKey: number }) {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [thinking, setThinking] = useState(false);
  const [auto, setAuto] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("knowledge")
      .select("id, topic, content, tags, confidence, created_at")
      .eq("user_id", userId)
      .contains("tags", ["mind"])
      .order("created_at", { ascending: false })
      .limit(30);
    setInsights((data as unknown as Insight[]) ?? []);
  }, [userId]);

  const think = useCallback(async () => {
    if (thinking) return;
    setThinking(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;
      const res = await fetch("/api/mind", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!json.ok) throw new Error(json.error || "Mind failed");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Mind soch nahi saka");
    } finally {
      setThinking(false);
    }
  }, [thinking, load]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  // Auto-grow: har 90 seconds me Mind khud ek nayi soch add karta hai
  useEffect(() => {
    if (!auto) return;
    const timer = setInterval(() => void think(), 90_000);
    return () => clearInterval(timer);
  }, [auto, think]);

  return (
    <div className="space-y-3 pb-6">
      <div className="panel flex items-center gap-3 p-3">
        <span className="neural-ring flex h-9 w-9 items-center justify-center rounded-xl">
          <Brain className={`h-4 w-4 text-primary-foreground ${thinking ? "node-pulse" : ""}`} />
        </span>
        <div className="flex-1">
          <p className="text-sm font-medium">Mind — background thinking</p>
          <p className="text-xs text-muted-foreground">
            {auto
              ? "Auto-grow ON — har 90s me khud nayi soch add hoti hai"
              : "Auto-grow OFF — sirf button se sochta hai"}
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="text-xs"
          onClick={() => setAuto((v) => !v)}
        >
          {auto ? "Pause" : "Resume"}
        </Button>
        <Button size="sm" className="gap-1 text-xs" disabled={thinking} onClick={() => void think()}>
          {thinking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
          Socho
        </Button>
      </div>

      {insights.length === 0 ? (
        <div className="panel mt-2 flex flex-col items-center gap-2 p-8 text-center">
          <Sparkles className="h-6 w-6 text-primary node-pulse" />
          <p className="text-sm font-medium">Mind abhi soch raha hai</p>
          <p className="text-xs text-muted-foreground">
            Chat karo — jitni zyada knowledge hogi, Mind utni behtar nayi soch nikalega.
          </p>
        </div>
      ) : (
        insights.map((insight) => (
          <div key={insight.id} className="panel p-4">
            <div className="mb-1 flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              <p className="text-sm font-medium">{insight.topic}</p>
              <span className="ml-auto text-[11px] text-muted-foreground">
                {Math.round(insight.confidence * 100)}%
              </span>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">{insight.content}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {insight.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-border bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
