import { useCallback, useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, MessageCircle, Sparkles, Trophy, UserMinus, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { CommunityShell } from "@/components/community/CommunityShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  PROFILE_COLUMNS,
  ensureConversation,
  fetchProfiles,
  initials,
  nameOf,
  notify,
  timeAgo,
  type CommunityProfile,
} from "@/lib/community";
import { fetchFriendState, sendFriendRequest, type FriendState } from "@/lib/friends";
import { FriendButton } from "@/routes/leaderboard";

export const Route = createFileRoute("/u/$username")({
  head: ({ params }) => ({
    meta: [
      { title: `@${params.username} — NO QUIT AI Builder Profile` },
      {
        name: "description",
        content: `@${params.username} ki NO QUIT AI profile: banayi hui apps, posts, followers aur reputation points.`,
      },
      { property: "og:title", content: `@${params.username} — NO QUIT AI Builder Profile` },
      {
        property: "og:description",
        content: `See the apps, posts and reputation of @${params.username} on NO QUIT AI.`,
      },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});

type Post = {
  id: string;
  content: string;
  image_url: string | null;
  app_link: string | null;
  likes_count: number;
  comments_count: number;
  created_at: string;
};

function ProfilePage() {
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
  return <ProfileView meId={user.id} />;
}

function ProfileView({ meId }: { meId: string }) {
  const { username } = Route.useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<CommunityProfile | null | undefined>(undefined);
  const [posts, setPosts] = useState<Post[]>([]);
  const [followers, setFollowers] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [friendState, setFriendState] = useState<FriendState>("none");
  const [myName, setMyName] = useState("Ek member");

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("profiles")
      .select(PROFILE_COLUMNS)
      .ilike("username", username)
      .maybeSingle();
    if (!data) {
      setProfile(null);
      return;
    }
    const row = data as CommunityProfile;
    setProfile(row);

    const [{ data: postRows }, followerRes, followingRes, mineRes] = await Promise.all([
      supabase
        .from("community_posts")
        .select("id, content, image_url, app_link, likes_count, comments_count, created_at")
        .eq("user_id", row.id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.from("follows").select("id", { count: "exact", head: true }).eq("following_id", row.id),
      supabase.from("follows").select("id", { count: "exact", head: true }).eq("follower_id", row.id),
      supabase
        .from("follows")
        .select("id")
        .eq("follower_id", meId)
        .eq("following_id", row.id)
        .maybeSingle(),
    ]);
    setPosts((postRows ?? []) as Post[]);
    setFollowers(followerRes.count ?? 0);
    setFollowingCount(followingRes.count ?? 0);
    setIsFollowing(Boolean(mineRes.data));

    if (row.id !== meId) {
      const [{ state }, mine] = await Promise.all([
        fetchFriendState(meId, row.id),
        fetchProfiles([meId]),
      ]);
      setFriendState(state);
      setMyName(nameOf(mine[meId]));
    }
  }, [username, meId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleFollow() {
    if (!profile || busy) return;
    setBusy(true);
    if (isFollowing) {
      await supabase.from("follows").delete().eq("follower_id", meId).eq("following_id", profile.id);
    } else {
      const { error } = await supabase
        .from("follows")
        .insert({ follower_id: meId, following_id: profile.id });
      if (error) toast.error("Follow nahi hua");
      else await notify({ userId: profile.id, actorId: meId, type: "follow" });
    }
    setBusy(false);
    void load();
  }

  async function openChat() {
    if (!profile) return;
    try {
      await ensureConversation(meId, profile.id);
      void navigate({ to: "/messages", search: { u: profile.id } });
    } catch {
      toast.error("Chat open nahi hui");
    }
  }

  async function addFriend() {
    if (!profile || busy) return;
    setBusy(true);
    try {
      await sendFriendRequest(meId, profile.id, myName);
      setFriendState("outgoing");
      toast.success("Friend request bhej di");
    } catch {
      toast.error("Request nahi gayi");
    } finally {
      setBusy(false);
    }
  }

  if (profile === undefined) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </main>
    );
  }

  if (profile === null) {
    return (
      <CommunityShell userId={meId} title="Profile">
        <p className="panel p-4 text-sm text-muted-foreground">@{username} nahi mila.</p>
      </CommunityShell>
    );
  }

  const isMe = profile.id === meId;

  return (
    <CommunityShell userId={meId} title={nameOf(profile)} subtitle={`@${profile.username}`}>
      <section className="panel mb-4 p-4">
        <div className="flex items-center gap-3">
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={nameOf(profile)}
              className="h-16 w-16 rounded-full object-cover"
            />
          ) : (
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary text-lg font-semibold">
              {initials(profile)}
            </span>
          )}
          <div className="flex-1">
            <h2 className="text-base font-semibold leading-tight">{nameOf(profile)}</h2>
            <p className="text-xs text-muted-foreground">@{profile.username}</p>
            <p className="mt-1 inline-flex items-center gap-1 text-xs text-primary">
              <Trophy className="h-3 w-3" /> {profile.reputation_points} points
            </p>
          </div>
        </div>

        {profile.bio && <p className="mt-3 text-sm text-muted-foreground">{profile.bio}</p>}

        <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
          <Stat label="Posts" value={posts.length} />
          <Stat label="Apps" value={profile.total_apps_built} />
          <Stat label="Followers" value={followers} />
          <Stat label="Following" value={followingCount} />
        </div>

        {!isMe && (
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              variant={isFollowing ? "secondary" : "default"}
              className="flex-1 gap-1 text-xs"
              disabled={busy}
              onClick={() => void toggleFollow()}
            >
              {isFollowing ? <UserMinus className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
              {isFollowing ? "Following" : "Follow"}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="flex-1 gap-1 text-xs"
              onClick={() => void openChat()}
            >
              <MessageCircle className="h-3.5 w-3.5" /> Message
            </Button>
          </div>
        )}
      </section>

      <h3 className="mb-2 inline-flex items-center gap-1 text-sm font-medium">
        <Sparkles className="h-4 w-4 text-primary" /> Posts &amp; Apps
      </h3>

      {posts.length === 0 && (
        <p className="panel p-4 text-sm text-muted-foreground">Abhi koi post nahi hai.</p>
      )}

      <div className="space-y-3">
        {posts.map((post) => (
          <article key={post.id} className="panel p-3">
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{post.content}</p>
            {post.image_url && (
              <img
                src={post.image_url}
                alt="Post screenshot"
                loading="lazy"
                className="mt-2 w-full rounded-2xl border border-border object-cover"
              />
            )}
            <p className="mt-2 text-[11px] text-muted-foreground">
              {post.likes_count} likes · {post.comments_count} comments · {timeAgo(post.created_at)}
            </p>
          </article>
        ))}
      </div>
    </CommunityShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-secondary py-2">
      <div className="text-sm font-semibold">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}
