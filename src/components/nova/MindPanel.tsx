import { useCallback, useEffect, useMemo, useState } from "react";
import { Brain, Heart, Loader2, Pause, Play, Search, Sparkles, Trash2, X, Zap } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

const PROJECT_TYPES = ["all", "website", "blueprint", "domains"] as const;
type ProjectType = (typeof PROJECT_TYPES)[number];

type Thought = {
  id: string;
  thought: string;
  source_chat: string | null;
  is_auto: boolean;
  created_at: string;
};

type Memory = {
  id: string;
  prompt: string;
  project_type: string;
  code: string;
  summary: string;
  blueprint: Record<string, unknown>;
  liked: boolean;
  version: number;
  created_at: string;
};

export function MindPanel({ userId, refreshKey }: { userId: string; refreshKey: number }) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ProjectType>("all");
  const [likedOnly, setLikedOnly] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("memories")
      .select("id, prompt, project_type, code, summary, blueprint, liked, version, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    setMemories((data as unknown as Memory[]) ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);


  const [thoughts, setThoughts] = useState<Thought[]>([]);
  const [thinking, setThinking] = useState(false);
  const [autoOn, setAutoOn] = useState(true);

  const loadThoughts = useCallback(async () => {
    const { data } = await supabase
      .from("mind_thoughts")
      .select("id, thought, source_chat, is_auto, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    setThoughts((data as unknown as Thought[]) ?? []);
  }, [userId]);

  const think = useCallback(
    async (manual: boolean) => {
      setThinking(true);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) return;
        const res = await fetch(`/api/mind/think${manual ? "?manual=1" : ""}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = (await res.json().catch(() => null)) as
          | { ok: boolean; error?: string }
          | null;
        if (!res.ok || !json?.ok) {
          if (manual) toast.error(json?.error ?? "Mind soch nahi saka");
          return;
        }
        if (manual) toast.success("Nayi soch add ho gayi");
      } catch {
        if (manual) toast.error("Mind se connect nahi ho saka");
      } finally {
        setThinking(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadThoughts();
  }, [loadThoughts, refreshKey]);

  useEffect(() => {
    const channel = supabase
      .channel("mind-thoughts")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mind_thoughts", filter: `user_id=eq.${userId}` },
        () => {
          void loadThoughts();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, loadThoughts]);

  useEffect(() => {
    if (!autoOn) return;
    const id = setInterval(() => {
      void think(false);
    }, 90_000);
    return () => clearInterval(id);
  }, [autoOn, think]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return memories.filter((memory) => {
      const matchesType = filter === "all" || memory.project_type === filter;
      const matchesLike = !likedOnly || memory.liked;
      const matchesSearch =
        !term ||
        memory.prompt.toLowerCase().includes(term) ||
        memory.summary.toLowerCase().includes(term) ||
        memory.code.toLowerCase().includes(term);
      return matchesType && matchesLike && matchesSearch;
    });
  }, [memories, search, filter, likedOnly]);

  const likedCount = useMemo(() => memories.filter((m) => m.liked).length, [memories]);

  const preferredStyle = useMemo(() => {
    const liked = memories.filter((m) => m.liked);
    if (liked.length === 0) return null;
    const typeCounts = new Map<string, number>();
    for (const memory of liked) {
      typeCounts.set(memory.project_type, (typeCounts.get(memory.project_type) ?? 0) + 1);
    }
    return [...typeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  }, [memories]);

  async function toggleLike(id: string, liked: boolean) {
    const { error } = await supabase.from("memories").update({ liked: !liked }).eq("id", id);
    if (error) {
      toast.error("Like update nahi ho saka");
      return;
    }
    setMemories((prev) => prev.map((m) => (m.id === id ? { ...m, liked: !liked } : m)));
  }

  async function remove(id: string) {
    const { error } = await supabase.from("memories").delete().eq("id", id);
    if (error) {
      toast.error("Delete nahi ho saka");
      return;
    }
    setMemories((prev) => prev.filter((m) => m.id !== id));
  }

  return (
    <div className="space-y-3 pb-6">
      <section className="panel flex flex-col gap-3 p-4">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Mind</span>
          <span className="ml-auto text-2xl font-semibold text-gradient">{thoughts.length}</span>
        </div>

        <p className="text-xs text-muted-foreground">
          {memories.length === 0
            ? "Chat karo — abhi 0 learnings hain, jitni zyada knowledge hogi Mind utni behtar nayi soch nikalega."
            : `${memories.length} learnings se ab tak ${thoughts.length} nayi sochein nikli hain — har 90 second me Mind khud kuch naya seekhta hai.`}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => void think(true)} disabled={thinking} className="h-8 gap-1.5">
            {thinking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Socho
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5"
            onClick={() => setAutoOn((v) => !v)}
          >
            {autoOn ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {autoOn ? "Pause" : "Resume"}
          </Button>
          <span className="text-[11px] text-muted-foreground">
            {autoOn ? "Auto-grow ON (90s)" : "Auto-grow paused"}
          </span>
        </div>

        <div className="space-y-2">
          {thoughts.length === 0 && (
            <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
              Abhi koi soch nahi — "Socho" dabao ya chat me kuch banwao.
            </p>
          )}
          {thoughts.map((t) => (
            <div key={t.id} className="rounded-xl border border-border bg-secondary/50 p-3">
              <p className="text-sm leading-snug">{t.thought}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                <span>{new Date(t.created_at).toLocaleString()}</span>
                <span>·</span>
                <span>{t.is_auto ? "auto" : "manual"}</span>
                {t.source_chat && t.source_chat !== "general" && (
                  <>
                    <span>·</span>
                    <span className="truncate">from: {t.source_chat}</span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
      <div className="panel flex flex-col gap-3 p-4">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Memories — NO QUIT AI ki self-grown library</span>
          <span className="ml-auto text-2xl font-semibold text-gradient">{memories.length}</span>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Memories me search karo…"
            className="h-9 border-border bg-secondary pl-9 text-sm"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {PROJECT_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                filter === type
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border bg-secondary text-muted-foreground hover:border-primary"
              }`}
            >
              {type === "all" ? "Sab" : type}
            </button>
          ))}
          <button
            onClick={() => setLikedOnly((v) => !v)}
            className={`ml-auto flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition ${
              likedOnly
                ? "border-primary bg-primary/15 text-primary"
                : "border-border bg-secondary text-muted-foreground hover:border-primary"
            }`}
          >
            <Heart className={`h-3 w-3 ${likedOnly ? "fill-current" : ""}`} />
            Liked ({likedCount})
          </button>
        </div>

        {preferredStyle && (
          <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            <span>
              Preferred style detected: <span className="font-semibold">{preferredStyle}</span> — AI will rank similar builds higher.
            </span>
          </div>
        )}
      </div>

      {loading && memories.length === 0 && (
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Memories load ho rahi hain…
        </div>
      )}

      {filtered.length === 0 && !loading && (
        <div className="panel mt-2 flex flex-col items-center gap-2 p-8 text-center">
          <Sparkles className="h-6 w-6 text-primary node-pulse" />
          <p className="text-sm font-medium">Koi memory nahi mili</p>
          <p className="text-xs text-muted-foreground">
            Chat me kuch banwayen — har domain, blueprint aur website yahan save hoti hai.
          </p>
        </div>
      )}

      {filtered.map((memory) => (
        <article key={memory.id} className="panel p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {memory.project_type}
                </span>
                {memory.version > 1 && (
                  <span className="text-[10px] text-muted-foreground">v{memory.version}</span>
                )}
              </div>
              <h3 className="text-sm font-semibold leading-snug">{memory.prompt}</h3>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => void toggleLike(memory.id, memory.liked)}
                aria-label={memory.liked ? "Unlike" : "Like"}
              >
                <Heart
                  className={`h-3.5 w-3.5 ${memory.liked ? "fill-primary text-primary" : "text-muted-foreground"}`}
                />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => void remove(memory.id)}>
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </div>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{memory.summary}</p>
          {memory.project_type === "domains" && memory.code && (
            <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
              {memory.code.slice(0, 120)}…
            </p>
          )}
        </article>
      ))}
    </div>
  );
}
