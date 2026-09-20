import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Clock, Loader2, MessageCircle, Trophy, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { AdSlot } from "@/components/ads/AdSlot";
import { Button } from "@/components/ui/button";
import { CommunityShell } from "@/components/community/CommunityShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  PROFILE_COLUMNS,
  ensureConversation,
  fetchProfiles,
  handleOf,
  initials,
  nameOf,
  type CommunityProfile,
} from "@/lib/community";
import { fetchFriendStates, sendFriendRequest, type FriendState } from "@/lib/friends";

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
  const navigate = useNavigate();
  const [rows, setRows] = useState<CommunityProfile[] | null>(null);
  const [states, setStates] = useState<Record<string, FriendState>>({});
  const [myName, setMyName] = useState("Ek member");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [{ data }, friendMap, mine] = await Promise.all([
      supabase
        .from("profiles")
        .select(PROFILE_COLUMNS)
        .order("reputation_points", { ascending: false })
        .limit(50),
      fetchFriendStates(meId),
      fetchProfiles([meId]),
    ]);
    setRows((data ?? []) as CommunityProfile[]);
    const next: Record<string, FriendState> = {};
    for (const [id, value] of Object.entries(friendMap)) next[id] = value.state;
    setStates(next);
    setMyName(nameOf(mine[meId]));
  }, [meId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addFriend(otherId: string) {
    setBusyId(otherId);
    try {
      await sendFriendRequest(meId, otherId, myName);
      setStates((prev) => ({ ...prev, [otherId]: "outgoing" }));
      toast.success("Friend request bhej di");
    } catch {
      toast.error("Request nahi gayi");
    } finally {
      setBusyId(null);
    }
  }

  async function openChat(otherId: string) {
    try {
      await ensureConversation(meId, otherId);
      void navigate({ to: "/messages", search: { u: otherId } });
    } catch {
      toast.error("Chat open nahi hui");
    }
  }

  return (
    <CommunityShell userId={meId} title="Top Builders" subtitle="Sab se zyada reputation points">
      {rows === null && (
        <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Leaderboard load ho raha hai…
        </div>
      )}

      <div className="space-y-2">
        {rows?.map((row, index) => {
          const state = states[row.id] ?? "none";
          return (
            <div
              key={row.id}
              className={
                row.id === meId
                  ? "panel flex flex-wrap items-center gap-3 border-primary p-3"
                  : "panel flex flex-wrap items-center gap-3 p-3"
              }
            >
              <span className="w-6 text-center text-sm font-semibold text-muted-foreground">
                {index + 1}
              </span>
              <Link
                to="/u/$username"
                params={{ username: handleOf(row) }}
                className="flex min-w-0 flex-1 items-center gap-3"
              >
                {row.avatar_url ? (
                  <img
                    src={row.avatar_url}
                    alt={nameOf(row)}
                    className="h-9 w-9 rounded-full object-cover"
                  />
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
              </Link>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                <Trophy className="h-3.5 w-3.5" /> {row.reputation_points}
              </span>
              {row.id !== meId && (
                <FriendButton
                  state={state}
                  busy={busyId === row.id}
                  onAdd={() => void addFriend(row.id)}
                  onMessage={() => void openChat(row.id)}
                />
              )}
            </div>
          );
        })}
      </div>

      <AdSlot name="footer" className="mt-4" />
    </CommunityShell>
  );
}

export function FriendButton({
  state,
  busy,
  onAdd,
  onMessage,
  className,
}: {
  state: FriendState;
  busy?: boolean;
  onAdd: () => void;
  onMessage: () => void;
  className?: string;
}) {
  if (state === "friends") {
    return (
      <Button
        size="sm"
        variant="secondary"
        className={`h-8 gap-1 text-[11px] ${className ?? ""}`}
        onClick={onMessage}
      >
        <MessageCircle className="h-3.5 w-3.5" /> Message
      </Button>
    );
  }
  if (state === "outgoing") {
    return (
      <Button size="sm" variant="secondary" className={`h-8 text-[11px] ${className ?? ""}`} disabled>
        <Clock className="mr-1 h-3.5 w-3.5" /> Requested
      </Button>
    );
  }
  if (state === "incoming") {
    return (
      <Button size="sm" variant="secondary" className={`h-8 text-[11px] ${className ?? ""}`} disabled>
        Bell me Accept karo
      </Button>
    );
  }
  return (
    <Button
      size="sm"
      className={`btn-green h-8 gap-1 text-[11px] ${className ?? ""}`}
      disabled={busy}
      onClick={onAdd}
    >
      <UserPlus className="h-3.5 w-3.5" /> Add Friend
    </Button>
  );
}
