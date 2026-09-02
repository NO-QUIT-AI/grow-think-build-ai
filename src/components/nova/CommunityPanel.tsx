import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, MessageCircle, Send, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

type Post = {
  id: string;
  user_id: string;
  content: string;
  category: string;
  created_at: string;
};

type Reply = {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
};

const CATEGORIES = [
  { value: "general", label: "Baat cheet" },
  { value: "mashwara", label: "Mashwara" },
  { value: "idea", label: "Idea" },
  { value: "help", label: "Madad chahiye" },
];

function timeAgo(iso: string) {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const min = Math.floor(diff / 60000);
  if (min < 1) return "abhi";
  if (min < 60) return `${min}m`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export function CommunityPanel({ userId }: { userId: string }) {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("general");
  const [sending, setSending] = useState(false);
  const [openPost, setOpenPost] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  const loadNames = useCallback(async (ids: string[]) => {
    const unique = Array.from(new Set(ids));
    if (unique.length === 0) return;
    const { data } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", unique);
    if (!data) return;
    setNames((prev) => {
      const next = { ...prev };
      for (const row of data) next[row.id] = row.display_name || "Member";
      return next;
    });
  }, []);

  const load = useCallback(async () => {
    const [{ data: postRows }, { data: replyRows }] = await Promise.all([
      supabase
        .from("community_posts")
        .select("id, user_id, content, category, created_at")
        .order("created_at", { ascending: false })
        .limit(60),
      supabase
        .from("community_replies")
        .select("id, post_id, user_id, content, created_at")
        .order("created_at", { ascending: true })
        .limit(300),
    ]);
    setPosts(postRows ?? []);
    setReplies(replyRows ?? []);
    await loadNames([
      ...(postRows ?? []).map((p) => p.user_id),
      ...(replyRows ?? []).map((r) => r.user_id),
    ]);
  }, [loadNames]);

  useEffect(() => {
    void load();
    const channel = supabase
      .channel("community-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "community_posts" }, () => {
        void load();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "community_replies" }, () => {
        void load();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load]);

  const repliesByPost = useMemo(() => {
    const map: Record<string, Reply[]> = {};
    for (const reply of replies) {
      (map[reply.post_id] ??= []).push(reply);
    }
    return map;
  }, [replies]);

  async function submitPost() {
    const value = content.trim();
    if (!value || sending) return;
    setSending(true);
    const { error } = await supabase
      .from("community_posts")
      .insert({ user_id: userId, content: value, category });
    setSending(false);
    if (error) {
      toast.error("Post nahi ho saka");
      return;
    }
    setContent("");
    void load();
  }

  async function submitReply(postId: string) {
    const value = replyText.trim();
    if (!value) return;
    const { error } = await supabase
      .from("community_replies")
      .insert({ post_id: postId, user_id: userId, content: value });
    if (error) {
      toast.error("Reply nahi ja saki");
      return;
    }
    setReplyText("");
    void load();
  }

  async function removePost(id: string) {
    const { error } = await supabase.from("community_posts").delete().eq("id", id);
    if (error) toast.error("Delete nahi hua");
    else void load();
  }

  function nameOf(id: string) {
    if (id === userId) return "Aap";
    return names[id] ?? "Member";
  }

  return (
    <div className="space-y-4 pb-6">
      <div className="panel p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium">
          <Users className="h-4 w-4 text-primary" /> Community — sab members se baat aur mashwara
        </div>
        <Textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Apni baat, sawal ya mashwara likho…"
          rows={3}
          className="resize-none text-sm"
        />
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {CATEGORIES.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setCategory(item.value)}
              className={
                item.value === category
                  ? "rounded-full border border-primary bg-primary px-3 py-1 text-[11px] text-primary-foreground"
                  : "rounded-full border border-border bg-secondary px-3 py-1 text-[11px] text-muted-foreground"
              }
            >
              {item.label}
            </button>
          ))}
          <Button
            size="sm"
            className="ml-auto gap-1 text-xs"
            disabled={sending || !content.trim()}
            onClick={() => void submitPost()}
          >
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Post karo
          </Button>
        </div>
      </div>

      {posts === null && (
        <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Community load ho rahi hai…
        </div>
      )}

      {posts?.length === 0 && (
        <p className="panel p-4 text-sm text-muted-foreground">
          Abhi koi baat nahi hui — pehli post tum karo aur community shuru karo.
        </p>
      )}

      {posts?.map((post) => {
        const postReplies = repliesByPost[post.id] ?? [];
        const isOpen = openPost === post.id;
        return (
          <div key={post.id} className="panel p-4">
            <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{nameOf(post.user_id)}</span>
              <span>· {timeAgo(post.created_at)}</span>
              <span className="rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px]">
                {CATEGORIES.find((c) => c.value === post.category)?.label ?? post.category}
              </span>
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
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{post.content}</p>

            <button
              onClick={() => {
                setOpenPost(isOpen ? null : post.id);
                setReplyText("");
              }}
              className="mt-2 inline-flex items-center gap-1 text-xs text-primary"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              {postReplies.length > 0 ? `${postReplies.length} jawab` : "Jawab do"}
            </button>

            {isOpen && (
              <div className="mt-3 space-y-2 border-t border-border pt-3">
                {postReplies.map((reply) => (
                  <div key={reply.id} className="rounded-xl bg-secondary px-3 py-2">
                    <div className="text-[11px] text-muted-foreground">
                      {nameOf(reply.user_id)} · {timeAgo(reply.created_at)}
                    </div>
                    <p className="whitespace-pre-wrap text-sm">{reply.content}</p>
                  </div>
                ))}
                <div className="flex items-end gap-2">
                  <Textarea
                    value={replyText}
                    onChange={(event) => setReplyText(event.target.value)}
                    placeholder="Apna mashwara likho…"
                    rows={1}
                    className="max-h-28 min-h-10 resize-none text-sm"
                  />
                  <Button
                    size="icon"
                    disabled={!replyText.trim()}
                    onClick={() => void submitReply(post.id)}
                    aria-label="Reply bhejo"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
