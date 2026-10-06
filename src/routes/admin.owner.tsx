import { useCallback, useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Crown, Gift, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { CommunityShell } from "@/components/community/CommunityShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/owner")({
  head: () => ({
    meta: [
      { title: "Owner Panel — NO QUIT AI" },
      { name: "description", content: "NO QUIT AI owner panel: Pro users manage karo aur viral video views par bonus do." },
      { property: "og:title", content: "Owner Panel — NO QUIT AI" },
      { property: "og:description", content: "Manage Pro users and viral video bonuses for NO QUIT AI." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OwnerPage,
});

type U = { id: string; display_name: string | null; username: string | null; plan: string };
type V = { id: string; user_id: string; title: string; url: string; views: number; bonus_awarded: boolean };

async function call(method: "GET" | "POST", body?: unknown) {
  const { data: s } = await supabase.auth.getSession();
  const res = await fetch("/api/owner", {
    method,
    headers: { "content-type": "application/json", authorization: `Bearer ${s.session?.access_token ?? ""}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error((await res.text()) || String(res.status));
  return res.json();
}

function OwnerPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [data, setData] = useState<{ users: U[]; videos: V[]; bonusPer1000: number } | null>(null);
  const [denied, setDenied] = useState(false);
  const [q, setQ] = useState("");
  const [views, setViews] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  const load = useCallback(async () => {
    try {
      setData(await call("GET"));
    } catch {
      setDenied(true);
    }
  }, []);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  async function act(body: object, okMsg: string) {
    try {
      const r = await call("POST", body);
      toast.success(r.amount ? `${okMsg}: +${r.amount} NQAI` : okMsg);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  }

  if (!user) return null;
  const names = new Map((data?.users ?? []).map((u) => [u.id, u.display_name || u.username || u.id.slice(0, 8)]));
  const users = (data?.users ?? []).filter((u) => `${u.display_name} ${u.username}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <CommunityShell userId={user.id} title="Owner Panel" subtitle="Sirf owner ke liye">
      {denied ? (
        <section className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">Yeh page sirf app ke owner ke liye hai.</section>
      ) : !data ? (
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
      ) : (
        <div className="space-y-6">
          <section className="rounded-2xl border border-border bg-card p-4">
            <h2 className="mb-3 flex items-center gap-2 font-semibold"><Crown className="h-4 w-4 text-primary" /> Pro users</h2>
            <Input placeholder="User dhoondo..." value={q} onChange={(e) => setQ(e.target.value)} className="mb-3" />
            <div className="max-h-96 space-y-2 overflow-y-auto">
              {users.map((u) => (
                <div key={u.id} className="flex items-center justify-between gap-2 rounded-xl border border-border p-2 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{u.display_name || "—"}</div>
                    <div className="truncate text-xs text-muted-foreground">@{u.username} · {u.plan === "pro" ? "PRO" : "Free"}</div>
                  </div>
                  <Button size="sm" variant={u.plan === "pro" ? "outline" : "default"}
                    onClick={() => act({ action: "set_plan", userId: u.id, plan: u.plan === "pro" ? "free" : "pro" }, "Plan update ho gaya")}>
                    {u.plan === "pro" ? "Free karo" : "Pro banao"}
                  </Button>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-4">
            <h2 className="mb-1 flex items-center gap-2 font-semibold"><Gift className="h-4 w-4 text-primary" /> Viral video bonus</h2>
            <p className="mb-3 text-xs text-muted-foreground">Har 1000 views = {data.bonusPer1000} NQAI. Ek video par bonus sirf ek baar.</p>
            <div className="space-y-2">
              {data.videos.length === 0 && <p className="text-sm text-muted-foreground">Abhi koi video nahi.</p>}
              {data.videos.map((v) => (
                <div key={v.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-border p-2 text-sm">
                  <a href={v.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-primary underline">{v.title || "Video"}</a>
                  <span className="text-xs text-muted-foreground">{names.get(v.user_id) ?? "user"}</span>
                  <Input type="number" className="h-8 w-24" value={views[v.id] ?? String(v.views)} onChange={(e) => setViews({ ...views, [v.id]: e.target.value })} />
                  <Button size="sm" variant="outline" onClick={() => act({ action: "set_views", videoId: v.id, views: Number(views[v.id] ?? v.views) }, "Views save")}>Save</Button>
                  <Button size="sm" disabled={v.bonus_awarded} onClick={() => act({ action: "award_bonus", videoId: v.id }, "Bonus diya")}>
                    {v.bonus_awarded ? "Bonus diya ja chuka" : "Bonus do"}
                  </Button>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </CommunityShell>
  );
}
