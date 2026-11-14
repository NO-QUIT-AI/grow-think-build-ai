import { useEffect, useRef, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Phone, PhoneOff, Video } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useServerFn } from "@tanstack/react-start";
import { registerCallPush } from "@/lib/call-push.functions";
import { isAndroidCallPush, nativeCallPush } from "@/lib/native-call-push";

import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchProfiles,
  initials,
  nameOf,
  type CommunityProfile,
} from "@/lib/community";
import {
  sendCallSystemMessage,
  CALL_RING_TIMEOUT_MS,
  isFreshRingingCall,
  startRingtone,
  updateCallStatus,
  type CallInvite,
} from "@/lib/calls";

// Global WhatsApp-style incoming call overlay. Mounted once in the root route;
// listens on call_invites for rows addressed to the signed-in user.
export function IncomingCallListener() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [invite, setInvite] = useState<CallInvite | null>(null);
  const [caller, setCaller] = useState<CommunityProfile | null>(null);
  const stopRingtone = useRef<(() => void) | null>(null);
  const [answering, setAnswering] = useState(false);
  const savePush = useServerFn(registerCallPush);

  useEffect(() => {
    if (loading || !isAndroidCallPush()) return;
    if (!user) { void nativeCallPush.disable().catch(() => {}); return; }
    let disposed = false;
    const enable = async () => {
      try {
        const { token } = await nativeCallPush.register();
        if (!disposed) {
          await savePush({ data: { token } });
          await nativeCallPush.fullScreenSettings();
        }
      } catch { if (!disposed) toast.error("Call notifications enable nahi huin; Android notification settings check karein."); }
    };
    toast("Background call notifications", { id: "call-push-permission", duration: Infinity, action: { label: "Enable", onClick: () => { void enable(); } } });
    const refreshToken = () => { if (document.visibilityState === "visible") void nativeCallPush.refresh().then(async result => { if (result.token && !disposed) await savePush({ data: { token: result.token } }); }).catch(() => {}); };
    refreshToken();
    document.addEventListener("visibilitychange", refreshToken);
    return () => { disposed = true; toast.dismiss("call-push-permission"); document.removeEventListener("visibilitychange", refreshToken); };
  }, [loading, user?.id, savePush]);

  useEffect(() => {
    if (!user) return;
    const query = new URLSearchParams(window.location.search);
    const id = query.get("incomingCall");
    if (!id || !/^[a-f\d-]{36}$/i.test(id)) return;
    const action = query.get("callAction");
    let disposed = false;
    const open = async () => {
      const { data: row } = await supabase.from("call_invites").select("*").eq("id", id).eq("to_user", user.id).maybeSingle();
      if (disposed) return;
      query.delete("incomingCall"); query.delete("callAction");
      window.history.replaceState(null, "", window.location.pathname + (query.size ? `?${query}` : ""));
      if (!row || !isFreshRingingCall(row as CallInvite)) { toast.error("Call ab available nahi hai"); return; }
      if (action === "reject") {
        const changed = await updateCallStatus(id, "rejected");
        if (changed) await sendCallSystemMessage(row.from_user, row.to_user, row.to_user, `missed ${row.call_type}`);
      } else if (action === "accept") {
        const changed = await updateCallStatus(id, "accepted");
        if (changed) void navigate({ to: "/call/$roomId", params: { roomId: row.room_id }, search: { type: row.call_type === "video" ? "video" : "audio", friendId: row.from_user, inviteId: id } });
        else toast.error("Call ab available nahi hai");
      } else setInvite(row as CallInvite);
    };
    void open().catch(() => toast.error("Call open nahi hui; dobara try karein"));
    return () => { disposed = true; };
  }, [user?.id, navigate]);

  useEffect(() => {
    if (!user) return;
    let disposed = false;
    const receive = (row: CallInvite) => {
      if (disposed || !isFreshRingingCall(row) || window.location.pathname.startsWith("/call")) return;
      setInvite(previous => previous?.id === row.id ? previous : row);
    };
    const refresh = async () => {
      const { data } = await supabase.from("call_invites").select("*").eq("to_user", user.id).eq("status", "ringing")
        .gte("created_at", new Date(Date.now() - CALL_RING_TIMEOUT_MS).toISOString()).order("created_at", { ascending: false }).limit(1);
      const row = data?.[0];
      if (row) receive(row as CallInvite);
    };
    const channel = supabase
      .channel("incoming-calls")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "call_invites",
          filter: `to_user=eq.${user.id}`,
        },
        (payload) => {
          receive(payload.new as CallInvite);
        },
      )
      .subscribe(status => { if (status === "SUBSCRIBED") void refresh(); });
    void refresh();
    return () => {
      disposed = true;
      void supabase.removeChannel(channel);
      stopRingtone.current?.();
      stopRingtone.current = null;
    };
  }, [user]);

  useEffect(() => {
    if (!invite) return;
    let disposed = false;
    void fetchProfiles([invite.from_user]).then(p => { if (!disposed) setCaller(p[invite.from_user] ?? null); });
    stopRingtone.current = startRingtone();
    navigator.vibrate?.([500, 300, 500]);
    const closeInvite = () => { if (!disposed) { setInvite(null); setCaller(null); } };
    const channel = supabase.channel(`incoming-status-${invite.id}`).on("postgres_changes", {
      event: "UPDATE", schema: "public", table: "call_invites", filter: `id=eq.${invite.id}`,
    }, payload => { if ((payload.new as CallInvite).status !== "ringing") closeInvite(); }).subscribe();
    const timer = window.setTimeout(() => {
      closeInvite();
      void updateCallStatus(invite.id, "missed").catch(() => {});
    }, Math.max(0, CALL_RING_TIMEOUT_MS - (Date.now() - Date.parse(invite.created_at))));
    const poll = window.setInterval(() => {
      void supabase.from("call_invites").select("status").eq("id", invite.id).maybeSingle().then(({data}) => {
        if (data && data.status !== "ringing") closeInvite();
      });
    }, 1500);
    return () => {
      if (isAndroidCallPush()) void nativeCallPush.dismiss({ inviteId: invite.id }).catch(() => {});
      disposed = true; window.clearTimeout(timer); window.clearInterval(poll);
      void supabase.removeChannel(channel); stopRingtone.current?.(); stopRingtone.current = null;
    };
  }, [invite]);

  // Hide the overlay while on the call page itself.
  if (!invite || pathname.startsWith("/call")) return null;

  const close = () => {
    stopRingtone.current?.();
    stopRingtone.current = null;
    setInvite(null);
    setCaller(null);
  };

  const accept = async () => {
    const current = invite;
    setAnswering(true);
    try {
      const changed = await updateCallStatus(current.id, "accepted");
      close();
      if (!changed) { toast.error("Call ab available nahi hai"); return; }
      void navigate({
      to: "/call/$roomId",
      params: { roomId: current.room_id },
      search: {
        type: current.call_type,
        friendId: current.from_user,
        inviteId: current.id,
      },
      });
    } catch { toast.error("Call accept nahi hui; dobara try karo"); }
    finally { setAnswering(false); }
  };

  const reject = async () => {
    const current = invite;
    setAnswering(true);
    try {
      const changed = await updateCallStatus(current.id, "rejected");
      close();
      if (changed) await sendCallSystemMessage(
      current.from_user,
      current.to_user,
      current.to_user,
      `missed ${current.call_type}`,
      );
    } catch { toast.error("Call reject nahi hui; dobara try karo"); }
    finally { setAnswering(false); }
  };

  return (
    <div role="dialog" aria-label="Incoming call" className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background/95 px-6 text-center">
      <div className="relative">
        {caller?.avatar_url ? (
          <img
            src={caller.avatar_url}
            alt={nameOf(caller)}
            className="h-28 w-28 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-28 w-28 items-center justify-center rounded-full bg-secondary text-2xl font-semibold text-foreground">
            {initials(caller)}
          </span>
        )}
        <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-primary/30" />
      </div>
      <div>
        <p className="text-xl font-semibold text-foreground">
          {caller ? nameOf(caller) : "NO QUIT AI member"}
        </p>
        <p className="mt-1 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          {invite.call_type === "video" ? (
            <Video className="h-4 w-4" />
          ) : (
            <Phone className="h-4 w-4" />
          )}
          Incoming {invite.call_type} call…
        </p>
      </div>
      <div className="flex items-center gap-10">
        <Button variant="destructive" size="icon" disabled={answering}
          onClick={() => void reject()}
          aria-label="Reject call"
          className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive text-destructive-foreground transition-transform hover:scale-105"
        >
          <PhoneOff className="h-7 w-7" />
        </Button>
        <Button size="icon" disabled={answering}
          onClick={() => void accept()}
          aria-label="Accept call"
          className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105"
        >
          {invite.call_type === "video" ? (
            <Video className="h-7 w-7" />
          ) : (
            <Phone className="h-7 w-7" />
          )}
        </Button>
      </div>
    </div>
  );
}
