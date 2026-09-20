import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Heart,
  Image as ImageIcon,
  Link2,
  Loader2,
  MessageSquare,
  Repeat2,
  Send,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AdSlot } from "@/components/ads/AdSlot";
import { CommunityShell } from "@/components/community/CommunityShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchProfiles,
  handleOf,
  initials,
  nameOf,
  notify,
  timeAgo,
  type CommunityProfile,
} from "@/lib/community";

export const Route = createFileRoute("/community")({
  head: () => ({
    meta: [
      { title: "Community Feed — NO QUIT AI Builders" },
      {
        name: "description",
        content:
          "NO QUIT AI builders community: apni banayi hui apps share karo, screenshots post karo, like, comment aur remix karo — sab app ke andar.",
      },
      { property: "og:title", content: "Community Feed — NO QUIT AI Builders" },
      {
        property: "og:description",
        content: "Share what you built, like, comment and remix apps inside NO QUIT AI.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CommunityPage,
});

type Post = {
  id: string;
  user_id: string;
  content: string;
  image_url: string | null;
  app_link: string | null;
  likes_count: number;
  comments_count: number;
  created_at: string;
};

type Comment = {
  id: string;
  post_id: string;
  user_id: string;
  comment: string;
  created_at: string;
};

type Filter = "trending" | "newest" | "friends";

function CommunityPage() {
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

  return <Feed userId={user.id} />;
}

function Feed({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [profiles, setProfiles] = useState<Record<string, CommunityProfile>>({});
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [filter, setFilter] = useState<Filter>("newest");

  const [text, setText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [appLink, setAppLink] = useState("");
  const [showExtra, setShowExtra] = useState(false);
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    const [{ data: postRows }, { data: likeRows }, { data: followRows }] = await Promise.all([
      supabase
        .from("community_posts")
        .select("id, user_id, content, image_url, app_link, likes_count, comments_count, created_at")
        .order("created_at", { ascending: false })
        .limit(80),
      supabase.from("post_likes").select("post_id").eq("user_id", userId),
      supabase.from("follows").select("following_id").eq("follower_id", userId),
    ]);
    const rows = (postRows ?? []) as Post[];
    setPosts(rows);
    setLikedIds(new Set((likeRows ?? []).map((r) => r.post_id)));
    setFollowing(new Set((followRows ?? []).map((r) => r.following_id)));
    setProfiles(await fetchProfiles(rows.map((r) => r.user_id)));
  }, [userId]);

  useEffect(() => {
    void load();
    const channel = supabase
      .channel("community-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "community_posts" }, () =>
        void load(),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "post_likes" }, () =>
        void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load]);

  const visiblePosts = useMemo(() => {
    if (!posts) return null;
    if (filter === "trending")
      return [...posts].sort(
        (a, b) => b.likes_count + b.comments_count - (a.likes_count + a.comments_count),
      );
    if (filter === "friends") return posts.filter((p) => following.has(p.user_id) || p.user_id === userId);
    return posts;
  }, [posts, filter, following, userId]);

  /** Uploads a screenshot to storage and keeps a long-lived link for the post. */
  async function uploadImage(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image 10MB se choti honi chahiye");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from("community-images")
      .upload(path, file, { contentType: file.type || "image/jpeg", upsert: false });
    if (error) {
      setUploading(false);
      toast.error(`Image upload nahi hui: ${error.message}`);
      return;
    }
    const { data } = await supabase.storage
      .from("community-images")
      .createSignedUrl(path, 60 * 60 * 24 * 3650);
    setUploading(false);
    if (!data?.signedUrl) {
      toast.error("Image link nahi bana");
      return;
    }
    setImageUrl(data.signedUrl);
    setShowExtra(true);
    toast.success("Screenshot lag gaya");
  }

  async function createPost() {
    const value = text.trim();
    if (!value || posting) return;
    setPosting(true);
    const { error } = await supabase.from("community_posts").insert({
      user_id: userId,
      content: value,
      image_url: imageUrl.trim() || null,
      app_link: appLink.trim() || null,
    });
    setPosting(false);
    if (error) {
      toast.error(`Post nahi ho saki: ${error.message}`);
      return;
    }
    setText("");
    setImageUrl("");
    setAppLink("");
    setShowExtra(false);
    toast.success("Post live ho gayi — +10 reputation points!");
    void load();
  }

  async function toggleLike(post: Post) {
    const liked = likedIds.has(post.id);
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (liked) next.delete(post.id);
      else next.add(post.id);
      return next;
    });
    if (liked) {
      await supabase.from("post_likes").delete().eq("post_id", post.id).eq("user_id", userId);
    } else {
      const { error } = await supabase.from("post_likes").insert({ post_id: post.id, user_id: userId });
      if (!error) await notify({ userId: post.user_id, actorId: userId, type: "like", entityId: post.id });
    }
    void load();
  }

  async function loadComments(postId: string) {
    const { data } = await supabase
      .from("post_comments")
      .select("id, post_id, user_id, comment, created_at")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });
    const rows = (data ?? []) as Comment[];
    setComments((prev) => ({ ...prev, [postId]: rows }));
    const map = await fetchProfiles(rows.map((r) => r.user_id));
    setProfiles((prev) => ({ ...prev, ...map }));
  }

  async function sendComment(post: Post) {
    const value = commentText.trim();
    if (!value) return;
    const { error } = await supabase
      .from("post_comments")
      .insert({ post_id: post.id, user_id: userId, comment: value });
    if (error) {
      toast.error("Comment nahi gaya");
      return;
    }
    setCommentText("");
    await notify({
      userId: post.user_id,
      actorId: userId,
      type: "comment",
      entityId: post.id,
      body: value.slice(0, 120),
    });
    await loadComments(post.id);
    void load();
  }

  async function removePost(id: string) {
    const { error } = await supabase.from("community_posts").delete().eq("id", id);
    if (error) toast.error("Delete nahi hua");
    else void load();
  }

  function remix(post: Post) {
    const prompt = `Is app ka behtar version banao: ${post.content}${
      post.app_link ? ` (reference: ${post.app_link})` : ""
    }`;
    try {
      localStorage.setItem("noquit_remix_prompt", prompt);
    } catch {
      /* ignore */
    }
    toast.success("Remix prompt Studio me le ja rahe hain…");
    void navigate({ to: "/" });
  }

  return (
    <CommunityShell userId={userId} title="Community" subtitle="Builders ka apna feed">
      <div className="panel mb-4 p-3">
        <Textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Aaj kya banaya? Screenshot ya app link share karo…"
          rows={3}
          className="resize-none border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
        />
        {showExtra && (
          <div className="mb-2 space-y-2">
            <Input
              value={imageUrl}
              onChange={(event) => setImageUrl(event.target.value)}
              placeholder="Screenshot image URL"
              className="h-9 text-xs"
            />
            <Input
              value={appLink}
              onChange={(event) => setAppLink(event.target.value)}
              placeholder="App / demo link"
              className="h-9 text-xs"
            />
          </div>
        )}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Image aur link add karo"
            onClick={() => setShowExtra((value) => !value)}
          >
            <ImageIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="App link add karo"
            onClick={() => setShowExtra(true)}
          >
            <Link2 className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            className="ml-auto rounded-full px-4 text-xs"
            disabled={posting || !text.trim()}
            onClick={() => void createPost()}
          >
            {posting ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
            Post
          </Button>
        </div>
      </div>

      <div className="mb-3 flex gap-1.5">
        {(["trending", "newest", "friends"] as Filter[]).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={
              value === filter
                ? "rounded-full border border-primary bg-primary px-3 py-1 text-[11px] text-primary-foreground"
                : "rounded-full border border-border bg-secondary px-3 py-1 text-[11px] text-muted-foreground"
            }
          >
            {value === "trending" ? "Trending" : value === "newest" ? "Newest" : "My Friends"}
          </button>
        ))}
      </div>

      {visiblePosts === null && (
        <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Feed load ho raha hai…
        </div>
      )}

      {visiblePosts?.length === 0 && (
        <p className="panel p-4 text-sm text-muted-foreground">
          Yahan abhi kuch nahi — pehli post tum karo aur community shuru karo.
        </p>
      )}

      <div className="space-y-3">
        {visiblePosts?.map((post, index) => {
          const author = profiles[post.user_id];
          const liked = likedIds.has(post.id);
          const isOpen = openComments === post.id;
          return (
            <Fragment key={post.id}>
            {index > 0 && index % 5 === 0 && <AdSlot name="feed" />}
            <article className="panel p-3">
              <div className="flex items-center gap-2">
                <Link
                  to="/u/$username"
                  params={{ username: handleOf(author) }}
                  className="flex items-center gap-2"
                >
                  {author?.avatar_url ? (
                    <img
                      src={author.avatar_url}
                      alt={nameOf(author)}
                      className="h-9 w-9 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold">
                      {initials(author)}
                    </span>
                  )}
                  <span>
                    <span className="block text-sm font-medium leading-tight">{nameOf(author)}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      @{handleOf(author)} · {timeAgo(post.created_at)}
                    </span>
                  </span>
                </Link>
                {post.user_id === userId && (
                  <button
                    onClick={() => void removePost(post.id)}
                    className="ml-auto text-muted-foreground hover:text-destructive"
                    aria-label="Post delete karo"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{post.content}</p>

              {post.image_url && (
                <img
                  src={post.image_url}
                  alt="Post screenshot"
                  loading="lazy"
                  className="mt-2 w-full rounded-2xl border border-border object-cover"
                />
              )}

              {post.app_link && (
                <a
                  href={post.app_link}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline"
                >
                  <Link2 className="h-3 w-3" /> App dekho
                </a>
              )}

              <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                <button
                  onClick={() => void toggleLike(post)}
                  className={liked ? "flex items-center gap-1 text-primary" : "flex items-center gap-1"}
                >
                  <Heart className={liked ? "h-4 w-4 fill-current" : "h-4 w-4"} /> {post.likes_count}
                </button>
                <button
                  onClick={() => {
                    const next = isOpen ? null : post.id;
                    setOpenComments(next);
                    setCommentText("");
                    if (next) void loadComments(post.id);
                  }}
                  className="flex items-center gap-1"
                >
                  <MessageSquare className="h-4 w-4" /> {post.comments_count}
                </button>
                <button onClick={() => remix(post)} className="ml-auto flex items-center gap-1 text-primary">
                  <Repeat2 className="h-4 w-4" /> Remix this App
                </button>
              </div>

              {isOpen && (
                <div className="mt-3 space-y-2 border-t border-border pt-3">
                  {(comments[post.id] ?? []).map((item) => (
                    <div key={item.id} className="rounded-2xl bg-secondary px-3 py-2">
                      <div className="text-[11px] text-muted-foreground">
                        {nameOf(profiles[item.user_id])} · {timeAgo(item.created_at)}
                      </div>
                      <p className="whitespace-pre-wrap text-sm">{item.comment}</p>
                    </div>
                  ))}
                  <div className="flex items-end gap-2">
                    <Textarea
                      value={commentText}
                      onChange={(event) => setCommentText(event.target.value)}
                      placeholder="Comment likho…"
                      rows={1}
                      className="max-h-24 min-h-10 resize-none text-sm"
                    />
                    <Button
                      size="icon"
                      disabled={!commentText.trim()}
                      onClick={() => void sendComment(post)}
                      aria-label="Comment bhejo"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </article>
            </Fragment>
          );
        })}
      </div>

      <AdSlot name="footer" className="mt-4" />
    </CommunityShell>
  );
}
