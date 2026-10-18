import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2, PhoneOff } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { sendCallSystemMessage, updateCallStatus } from "@/lib/calls";

declare global {
  interface Window {
    // Loaded on demand from https://meet.jit.si/external_api.js
    JitsiMeetExternalAPI?: new (
      domain: string,
      options: Record<string, unknown>,
    ) => {
      addListener: (event: string, handler: () => void) => void;
      dispose: () => void;
    };
  }
}

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
  const apiRef = useRef<{ dispose: () => void } | null>(null);
  const endedRef = useRef(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  const endCall = async () => {
    if (endedRef.current) return;
    endedRef.current = true;
    apiRef.current?.dispose();
    apiRef.current = null;
    if (inviteId) await updateCallStatus(inviteId, "ended");
    if (user && friendId) {
      await sendCallSystemMessage(user.id, friendId, user.id, `ended ${type ?? "audio"}`);
      navigate({ to: "/messages", search: { u: friendId } });
    } else {
      navigate({ to: "/messages", search: { u: undefined } });
    }
  };

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const boot = () => {
      if (cancelled || !containerRef.current || !window.JitsiMeetExternalAPI) return;
      const api = new window.JitsiMeetExternalAPI("meet.jit.si", {
        roomName: roomId,
        parentNode: containerRef.current,
        width: "100%",
        height: "100%",
        configOverwrite: {
          startWithAudioMuted: false,
          startWithVideoMuted: type !== "video",
          prejoinPageEnabled: false,
        },
        interfaceConfigOverwrite: {
          TOOLBAR_BUTTONS: ["microphone", "camera", "hangup", "chat"],
          SHOW_JITSI_WATERMARK: false,
        },
      });
      api.addListener("videoConferenceLeft", () => void endCall());
      apiRef.current = api;
    };

    if (window.JitsiMeetExternalAPI) {
      boot();
    } else {
      const script = document.createElement("script");
      script.src = "https://meet.jit.si/external_api.js";
      script.async = true;
      script.onload = boot;
      script.onerror = () => setFailed(true);
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
      apiRef.current?.dispose();
      apiRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, roomId, type]);

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-black">
      <div className="flex-1" ref={containerRef}>
        {failed && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <p className="text-sm text-muted-foreground">
              Call service load nahi hui. Internet check karke dobara try karo.
            </p>
          </div>
        )}
      </div>
      <div className="flex items-center justify-center gap-3 bg-black py-4">
        <button
          onClick={() => void endCall()}
          className="flex items-center gap-2 rounded-full bg-destructive px-6 py-3 text-sm font-semibold text-destructive-foreground transition-transform hover:scale-105"
        >
          <PhoneOff className="h-5 w-5" /> End Call
        </button>
      </div>
    </main>
  );
}
