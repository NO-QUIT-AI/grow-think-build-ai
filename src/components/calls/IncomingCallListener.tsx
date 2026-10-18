import { useEffect, useRef, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Phone, PhoneOff, Video } from "lucide-react";

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
  startRingtone,
  updateCallStatus,
  type CallInvite,
} from "@/lib/calls";

// Global WhatsApp-style incoming call overlay. Mounted once in the root route;
// listens on call_invites for rows addressed to the signed-in user.
export function IncomingCallListener() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [invite, setInvite] = useState<CallInvite | null>(null);
  const [caller, setCaller] = useState<CommunityProfile | null>(null);
  const stopRingtone = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!user) return;
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
          const row = payload.new as CallInvite;
          if (row.status !== "ringing") return;
          // Already on the call screen — ignore.
          if (window.location.pathname.startsWith("/call")) return;
          setInvite(row);
          void fetchProfiles([row.from_user]).then((p) =>
            setCaller(p[row.from_user] ?? null),
          );
          stopRingtone.current?.();
          stopRingtone.current = startRingtone();
          navigator.vibrate?.([500, 300, 500]);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
      stopRingtone.current?.();
      stopRingtone.current = null;
    };
  }, [user]);

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
    close();
    await updateCallStatus(current.id, "accepted");
    void navigate({
      to: "/call/$roomId",
      params: { roomId: current.room_id },
      search: {
        type: current.call_type,
        friendId: current.from_user,
        inviteId: current.id,
      },
    });
  };

  const reject = async () => {
    const current = invite;
    close();
    await updateCallStatus(current.id, "rejected");
    await sendCallSystemMessage(
      current.from_user,
      current.to_user,
      current.to_user,
      `missed ${current.call_type}`,
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-black/95 px-6 text-center">
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
        <button
          onClick={() => void reject()}
          aria-label="Reject call"
          className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive text-destructive-foreground transition-transform hover:scale-105"
        >
          <PhoneOff className="h-7 w-7" />
        </button>
        <button
          onClick={() => void accept()}
          aria-label="Accept call"
          className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105"
        >
          {invite.call_type === "video" ? (
            <Video className="h-7 w-7" />
          ) : (
            <Phone className="h-7 w-7" />
          )}
        </button>
      </div>
    </div>
  );
}
