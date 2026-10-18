import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Loader2, Lock, Phone, PhoneOff, Send, Video } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CommunityShell } from "@/components/community/CommunityShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchProfiles,
  initials,
  nameOf,
  notify,
  timeAgo,
  type CommunityProfile,
} from "@/lib/community";
import { fetchFriendState, type FriendState } from "@/lib/friends";
import {
  CALL_SYSTEM_PREFIX,
  createCallInvite,
  hasActiveCall,
  sendCallSystemMessage,
  startRingtone,
  updateCallStatus,
  type CallInvite,
  type CallType,
} from "@/lib/calls";
import { useT } from "@/i18n/LanguageContext";

type Search = { u?: string | undefined };

export const Route = createFileRoute("/messages")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    u: typeof search['u'] === "string" ? (search['u'] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Messages — NO QUIT AI Community Chat" },
      {
        name: "description",
        content:
          "NO QUIT AI ke andar members se private realtime chat karo — koi app chhodne ki zaroorat nahi.",
      },
      { property: "og:title", content: "Messages — NO QUIT AI Community Chat" },
      {
        property: "og:description",
        content: "Private realtime chat with other builders, fully inside NO QUIT AI.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MessagesPage,
});

type Conversation = {
  id: string;
  user1_id: string;
  user2_id: string;
  last_message: string | null;
  updated_at: string;
};

type DirectMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  text: string;
  created_at: string;
};

function MessagesPage() {
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
  return <Inbox meId={user.id} />;
}

function Inbox({ meId }: { meId: string }) {
  const t = useT();
  const { u } = Route.useSearch();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [profiles, setProfiles] = useState<Record<string, CommunityProfile>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [friendState, setFriendState] = useState<FriendState>("none");
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [outgoing, setOutgoing] = useState<CallInvite | null>(null);
  const stopRingtone = useRef<(() => void) | null>(null);
  const missedTimer = useRef<number | null>(null);

  const loadConversations = useCallback(async () => {
    const { data } = await supabase
      .from("dm_conversations")
      .select("id, user1_id, user2_id, last_message, updated_at")
      .order("updated_at", { ascending: false });
    const rows = (data ?? []) as Conversation[];
    setConversations(rows);
    setProfiles(await fetchProfiles(rows.flatMap((r) => [r.user1_id, r.user2_id])));
    return rows;
  }, []);

  useEffect(() => {
    void loadConversations().then((rows) => {
      if (!u) return;
      const match = rows.find((r) => r.user1_id === u || r.user2_id === u);
      if (match) setActiveId(match.id);
    });
  }, [loadConversations, u]);

  const active = useMemo(
    () => conversations?.find((c) => c.id === activeId) ?? null,
    [conversations, activeId],
  );
  const otherId = active ? (active.user1_id === meId ? active.user2_id : active.user1_id) : null;

  useEffect(() => {
    if (!otherId) return;
    void fetchFriendState(meId, otherId).then(({ state }) => setFriendState(state));
  }, [meId, otherId]);

  const loadMessages = useCallback(async (conversationId: string) => {
    const { data } = await supabase
      .from("dm_messages")
      .select("id, conversation_id, sender_id, text, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(200);
    setMessages((data ?? []) as DirectMessage[]);
  }, []);

  useEffect(() => {
    if (!activeId) return;
    void loadMessages(activeId);
    const channel = supabase
      .channel(`dm-${activeId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "dm_messages",
          filter: `conversation_id=eq.${activeId}`,
        },
        (payload) => setMessages((prev) => [...prev, payload.new as DirectMessage]),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeId, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const value = draft.trim();
    if (!value || !activeId || !otherId) return;
    if (friendState !== "friends") {
       toast.error(t("waitFriend"));
      return;
    }
    setDraft("");
    const { error } = await supabase
      .from("dm_messages")
      .insert({ conversation_id: activeId, sender_id: meId, text: value });
    if (error) {
      toast.error("Message nahi gaya");
      return;
    }
    await supabase
      .from("dm_conversations")
      .update({ last_message: value.slice(0, 140), updated_at: new Date().toISOString() })
      .eq("id", activeId);
    await notify({
      userId: otherId,
      actorId: meId,
      type: "message",
      entityId: activeId,
      body: value.slice(0, 120),
    });
    void loadConversations();
  }

  const cleanupOutgoing = useCallback(() => {
    stopRingtone.current?.();
    stopRingtone.current = null;
    if (missedTimer.current !== null) {
      window.clearTimeout(missedTimer.current);
      missedTimer.current = null;
    }
    setOutgoing(null);
  }, []);

  // Watch the outgoing invite: accept -> join the call room, reject/missed -> close.
  useEffect(() => {
    if (!outgoing) return;
    const channel = supabase
      .channel(`outgoing-call-${outgoing.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "call_invites",
          filter: `id=eq.${outgoing.id}`,
        },
        (payload) => {
          const row = payload.new as CallInvite;
          if (row.status === "accepted") {
            const invite = outgoing;
            cleanupOutgoing();
            void navigate({
              to: "/call/$roomId",
              params: { roomId: invite.room_id },
              search: { type: invite.call_type, friendId: invite.to_user, inviteId: invite.id },
            });
          } else if (row.status === "rejected" || row.status === "missed") {
            cleanupOutgoing();
            toast.error("Call answer nahi hui");
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [outgoing, cleanupOutgoing, navigate]);

  async function startCall(callType: CallType) {
    if (!otherId || friendState !== "friends") return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === "video",
      });
      stream.getTracks().forEach((track) => track.stop());
    } catch {
      toast.error("Mic/Camera permission chahiye call ke liye");
      return;
    }
    if (await hasActiveCall(meId)) {
      toast.error("Already in call");
      return;
    }
    const invite = await createCallInvite(meId, otherId, callType);
    if (!invite) {
      toast.error("Call start nahi hui");
      return;
    }
    setOutgoing(invite);
    stopRingtone.current?.();
    stopRingtone.current = startRingtone();
    missedTimer.current = window.setTimeout(() => {
      void (async () => {
        await updateCallStatus(invite.id, "missed");
        await sendCallSystemMessage(meId, invite.to_user, meId, `missed ${invite.call_type}`);
        cleanupOutgoing();
      })();
    }, 30_000);
  }

  function cancelOutgoing() {
    if (!outgoing) return;
    const invite = outgoing;
    cleanupOutgoing();
    void (async () => {
      await updateCallStatus(invite.id, "missed");
      await sendCallSystemMessage(meId, invite.to_user, meId, `missed ${invite.call_type}`);
    })();
  }

  if (active) {
    const other = profiles[otherId ?? ""];
    return (
      <CommunityShell userId={meId} title={nameOf(other)} subtitle={`@${other?.username ?? "member"}`}>
        <div className="mb-2 flex items-center gap-2">
          <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => setActiveId(null)}>
             <ArrowLeft className="h-3.5 w-3.5" /> {t("inbox")}
          </Button>
          {other?.username && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() =>
                navigate({ to: "/u/$username", params: { username: other.username as string } })
              }
            >
               {t("openProfile")}
            </Button>
          )}
          {friendState === "friends" && (
            <span className="ml-auto flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Audio call"
                className="hover:text-primary"
                onClick={() => void startCall("audio")}
              >
                <Phone className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Video call"
                className="hover:text-primary"
                onClick={() => void startCall("video")}
              >
                <Video className="h-4 w-4" />
              </Button>
            </span>
          )}
        </div>

        <div className="panel flex min-h-[60vh] flex-1 flex-col gap-2 overflow-y-auto p-3">
          {messages.length === 0 && (
             <p className="m-auto text-xs text-muted-foreground">{t("startChat")}</p>
          )}
          {messages.map((message) => {
            const mine = message.sender_id === meId;
            if (message.text.startsWith(CALL_SYSTEM_PREFIX)) {
              const kind = message.text.slice(CALL_SYSTEM_PREFIX.length);
              const missed = kind.startsWith("missed");
              return (
                <div key={message.id} className="flex justify-center">
                  <span
                    className={`rounded-full px-3 py-1 text-[11px] ${
                      missed ? "bg-destructive/15 text-destructive" : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {missed ? `Missed ${kind.replace("missed ", "")} call` : "Call ended"} · {timeAgo(message.created_at)}
                  </span>
                </div>
              );
            }
            return (
              <div
                key={message.id}
                className={mine ? "flex justify-end" : "flex justify-start"}
              >
                <div
                  className={
                    mine
                      ? "max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground"
                      : "max-w-[80%] rounded-2xl rounded-bl-sm bg-secondary px-3 py-2 text-sm text-foreground"
                  }
                >
                  <p className="whitespace-pre-wrap">{message.text}</p>
                  <p className="mt-0.5 text-[10px] opacity-70">{timeAgo(message.created_at)}</p>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {friendState !== "friends" ? (
          <div className="panel mt-2 flex items-center gap-2 p-3 text-xs text-muted-foreground">
            <Lock className="h-4 w-4 shrink-0" />
            <span>
              {friendState === "outgoing"
                 ? t("requestPending")
                 : t("waitFriend")}
            </span>
          </div>
        ) : (
          <div className="mt-2 flex items-end gap-2">
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void send();
                }
              }}
              rows={1}
               placeholder={t("writeMessage")}
              className="max-h-28 min-h-10 resize-none text-sm"
            />
            <Button
              size="icon"
              disabled={!draft.trim()}
              onClick={() => void send()}
               aria-label={t("sendMessage")}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        )}

        {outgoing && (
          <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-black/95 px-6 text-center">
            <div className="relative">
              {other?.avatar_url ? (
                <img
                  src={other.avatar_url}
                  alt={nameOf(other)}
                  className="h-28 w-28 rounded-full object-cover"
                />
              ) : (
                <span className="flex h-28 w-28 items-center justify-center rounded-full bg-secondary text-2xl font-semibold text-foreground">
                  {initials(other)}
                </span>
              )}
              <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-primary/30" />
            </div>
            <div>
              <p className="text-xl font-semibold text-foreground">{nameOf(other)}</p>
              <p className="mt-1 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                {outgoing.call_type === "video" ? (
                  <Video className="h-4 w-4" />
                ) : (
                  <Phone className="h-4 w-4" />
                )}
                Calling…
              </p>
            </div>
            <button
              onClick={cancelOutgoing}
              aria-label="Cancel call"
              className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive text-destructive-foreground transition-transform hover:scale-105"
            >
              <PhoneOff className="h-7 w-7" />
            </button>
          </div>
        )}
      </CommunityShell>
    );
  }

  return (
    <CommunityShell userId={meId} title={t("messages")} subtitle={t("privateChat")}>
      {conversations === null && (
        <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
           <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("inboxLoading")}
        </div>
      )}
      {conversations?.length === 0 && (
        <p className="panel p-4 text-sm text-muted-foreground">
           {t("emptyInbox")}
        </p>
      )}
      <div className="space-y-2">
        {conversations?.map((conversation) => {
          const other = profiles[conversation.user1_id === meId ? conversation.user2_id : conversation.user1_id];
          return (
            <button
              key={conversation.id}
              onClick={() => setActiveId(conversation.id)}
              className="panel flex w-full items-center gap-3 p-3 text-left"
            >
              {other?.avatar_url ? (
                <img src={other.avatar_url} alt={nameOf(other)} className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold">
                  {initials(other)}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{nameOf(other)}</span>
                <span className="block truncate text-xs text-muted-foreground">
                   {conversation.last_message ?? t("startChat")}
                </span>
              </span>
              <span className="text-[10px] text-muted-foreground">{timeAgo(conversation.updated_at)}</span>
            </button>
          );
        })}
      </div>
    </CommunityShell>
  );
}
