import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2, PhoneOff, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { getZegoCallAccess } from "@/lib/zego-calls.functions";

import { useAuth } from "@/hooks/useAuth";
import { fetchCallInvite, sendCallSystemMessage, updateCallStatus } from "@/lib/calls";
import { supabase } from "@/integrations/supabase/client";

type CallSearch = {
  type?: "audio" | "video" | undefined;
  friendId?: string | undefined;
  inviteId?: string | undefined;
};

export const Route = createFileRoute("/call/$roomId")({
  validateSearch: (search: Record<string, unknown>): CallSearch => ({
    type: search["type"] === "video" ? "video" : "audio",
    friendId: typeof search["friendId"] === "string" ? (search["friendId"] as string) : undefined,
    inviteId: typeof search["inviteId"] === "string" ? (search["inviteId"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Call — NO QUIT AI" },
      { name: "description", content: "Private audio and video calls inside NO QUIT AI." },
      { property: "og:title", content: "Call — NO QUIT AI" },
      { property: "og:description", content: "Private audio and video calls inside NO QUIT AI." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CallPage,
});

function CallPage() {
  const { roomId } = Route.useParams();
  const { type = "audio", friendId, inviteId } = Route.useSearch();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const apiRef = useRef<{ destroy: () => void } | null>(null);
  const getAccess = useServerFn(getZegoCallAccess);
  const [speakerOn, setSpeakerOn] = useState(true);
  const speakerRef = useRef(true);
  const endedRef = useRef(false);
  const [failed, setFailed] = useState("");
  const [ready, setReady] = useState(false);
  const peerRef = useRef<string | undefined>(undefined);

  const endCall = async () => {
    if (endedRef.current) return;
    endedRef.current = true;
    const api = apiRef.current;
    apiRef.current = null;
    api?.destroy();
    try {
      const changed = inviteId && await updateCallStatus(inviteId, "ended");
      if (changed && user && peerRef.current) await sendCallSystemMessage(user.id, peerRef.current, user.id, `ended ${type}`);
    } catch { toast.error("Call band ho gayi; history update nahi hui"); }
    finally { void navigate({ to: "/messages", search: { u: peerRef.current } }); }
  };

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    let validated = false;
    let channel: ReturnType<typeof supabase.channel> | undefined;
    let poll: number | undefined;
    setFailed(""); setReady(false); endedRef.current = false;
    setSpeakerOn(true); speakerRef.current = true;
    const validate = async () => {
      if (!inviteId) throw new Error("Call invitation nahi mili.");
      const invite = await fetchCallInvite(inviteId);
      if (!invite || invite.room_id !== roomId || invite.status !== "accepted" || (invite.from_user !== user.id && invite.to_user !== user.id)) {
        throw new Error("Call ab active nahi hai ya aap is call ka hissa nahi hain.");
      }
      const peer = invite.from_user === user.id ? invite.to_user : invite.from_user;
      if (invite.call_type !== type || (friendId && friendId !== peer)) throw new Error("Call invitation match nahi hui.");
      if (cancelled) return;
      validated = true; peerRef.current = peer;
      const refresh = () => {
        void fetchCallInvite(inviteId).then(row => { if (!cancelled && row?.status !== "accepted") void endCall(); }).catch(() => {});
      };
      channel = supabase.channel(`active-call-${inviteId}`).on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "call_invites", filter: `id=eq.${inviteId}`,
      }, refresh).subscribe();
      poll = window.setInterval(refresh, 2000);
      const access = await getAccess({ data: { inviteId, roomId } });
      const { ZegoUIKitPrebuilt } = await import("@zegocloud/zego-uikit-prebuilt");
      if (cancelled || endedRef.current || !containerRef.current) return;
      const kitToken = ZegoUIKitPrebuilt.generateKitTokenForProduction(access.appId, access.token, access.roomId, access.userId, user.user_metadata?.["full_name"] || "NO QUIT AI member");
      const api = ZegoUIKitPrebuilt.create(kitToken);
      apiRef.current = api;
      api.joinRoom({
        container: containerRef.current,
        scenario: { mode: ZegoUIKitPrebuilt.OneONoneCall },
        maxUsers: 2,
        showPreJoinView: false,
        turnOnMicrophoneWhenJoining: true,
        turnOnCameraWhenJoining: access.callType === "video",
        showMyCameraToggleButton: access.callType === "video",
        showMyMicrophoneToggleButton: true,
        showAudioVideoSettingsButton: true,
        showTextChat: false,
        showUserList: false,
        showRoomDetailsButton: false,
        showScreenSharingButton: false,
        showLayoutButton: false,
        showLeavingView: false,
        showLeaveRoomConfirmDialog: false,
        autoHideFooter: false,
        onJoinRoom: () => { if (!cancelled) setReady(true); },
        onLeaveRoom: () => { if (!cancelled) void endCall(); },
        onUserLeave: () => { if (!cancelled) void endCall(); },
      });
      // UIKit renders its own loading/error states while joining.
      setReady(true);
    };
    void validate().catch(error => { if (!cancelled) setFailed(error instanceof Error ? error.message : "Call load nahi hui"); });

    return () => {
      cancelled = true;
      if (poll !== undefined) window.clearInterval(poll);
      if (channel) void supabase.removeChannel(channel);
      const api = apiRef.current;
      apiRef.current = null;
      api?.destroy();
      if (validated && !endedRef.current && inviteId) void updateCallStatus(inviteId, "ended").catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, roomId, type, friendId, inviteId]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const sync = () => container.querySelectorAll<HTMLMediaElement>("video,audio").forEach(media => {
      // Preserve UIKit's muted self-preview; change playback volume only.
      media.volume = speakerRef.current ? 1 : 0;
    });
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(container, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [speakerOn, ready]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </main>
    );
  }
  if (!user) return <main className="flex min-h-screen items-center justify-center bg-background"><Button asChild><Link to="/auth">Sign in to join call</Link></Button></main>;

  return (
    <main className="flex min-h-dvh flex-col bg-background">
      <div className="relative min-h-[70dvh] flex-1">
        <div ref={containerRef} className="absolute inset-0" />
        {!ready && !failed && <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}
        {failed && (
            <div role="alert" className="flex min-h-[70dvh] flex-col items-center justify-center gap-3 px-4 text-center">
            <p className="text-sm text-muted-foreground">
              {failed}
            </p>
          </div>
        )}
      </div>
      <div className="flex items-center justify-center gap-3 bg-background py-4">
        <Button variant="secondary" size="icon" disabled={!ready || !!failed} aria-label={speakerOn ? "Mute speaker" : "Unmute speaker"} title={speakerOn ? "Mute speaker" : "Unmute speaker"}
          onClick={() => { speakerRef.current = !speakerRef.current; setSpeakerOn(speakerRef.current); }}>
          {speakerOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
        </Button>
        <Button variant="destructive"
          onClick={() => void endCall()}
          className="flex items-center gap-2 rounded-full bg-destructive px-6 py-3 text-sm font-semibold text-destructive-foreground transition-transform hover:scale-105"
        >
          <PhoneOff className="h-5 w-5" /> End Call
        </Button>
      </div>
    </main>
  );
}
