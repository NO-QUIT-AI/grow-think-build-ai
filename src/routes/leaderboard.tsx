import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2, Trophy } from "lucide-react";

import { AdSlot } from "@/components/ads/AdSlot";
import { CommunityShell } from "@/components/community/CommunityShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  PROFILE_COLUMNS,
  handleOf,
  initials,
  nameOf,
  type CommunityProfile,
} from "@/lib/community";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "Top Builders Leaderboard — NO QUIT AI" },
      {
        name: "description",
        content:
          "NO QUIT AI ke top builders: reputation points, banayi hui apps aur community me sab se zyada madad karne wale members.",
      },
      { property: "og:title", content: "Top Builders Leaderboard — NO QUIT AI" },
      {
        property: "og:description",
        content: "See the highest reputation builders in the NO QUIT AI community.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LeaderboardPage,
});

function LeaderboardPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </main>
    );
  }
  return <Board meId={user.id} />;
}

function Board({ meId }: { meId: string }) {
  const [rows, setRows] = useState<CommunityProfile[] | null>(null);

  useEffect(() => {
    void supabase
      .from("profiles")
      .select(PROFILE_COLUMNS)
      .order("reputation_points", { ascending: false })
      .limit(50)
      .then(({ data }) => setRows((data ?? []) as CommunityProfile[]));
  }, []);

  return (
    <CommunityShell userId={meId} title="Top Builders" subtitle="Sab se zyada reputation points">
      {rows === null && (
        <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Leaderboard load ho raha hai…
        </div>
      )}

      <div className="space-y-2">
        {rows?.map((row, index) => (
          <Link
            key={row.id}
            to="/u/$username"
            params={{ username: handleOf(row) }}
            className={
              row.id === meId
                ? "panel flex items-center gap-3 border-primary p-3"
                : "panel flex items-center gap-3 p-3"
            }
          >
            <span className="w-6 text-center text-sm font-semibold text-muted-foreground">
              {index + 1}
            </span>
            {row.avatar_url ? (
              <img src={row.avatar_url} alt={nameOf(row)} className="h-9 w-9 rounded-full object-cover" />
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold">
                {initials(row)}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{nameOf(row)}</span>
              <span className="block text-[11px] text-muted-foreground">
                @{handleOf(row)} · {row.total_apps_built} apps
              </span>
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
              <Trophy className="h-3.5 w-3.5" /> {row.reputation_points}
            </span>
          </Link>
        ))}
      </div>

      <AdSlot name="footer" className="mt-4" />
    </CommunityShell>
  );
}
