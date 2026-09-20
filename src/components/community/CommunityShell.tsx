import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Bell, Coins, FileText, Home, MessageCircle, Sparkles, Trophy, Users } from "lucide-react";

import { LegalFooter } from "@/components/legal/LegalPage";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { fetchProfiles, nameOf, timeAgo, type CommunityProfile } from "@/lib/community";
import {
  fetchIncomingRequests,
  respondFriendRequest,
  type FriendRequest,
} from "@/lib/friends";

type Notification = {
  id: string;
  actor_id: string | null;
  type: string;
  body: string | null;
  read: boolean;
  created_at: string;
};

const TYPE_TEXT: Record<string, string> = {
  like: "ne aapki post like ki",
  comment: "ne aapki post par comment kiya",
  follow: "ne aapko follow kiya",
  message: "ne aapko message bheja",
};

function NotificationBell({ userId }: { userId: string }) {
  const [items, setItems] = useState<Notification[]>([]);
  const [actors, setActors] = useState<Record<string, CommunityProfile>>({});

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("notifications")
      .select("id, actor_id, type, body, read, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30);
    const rows = (data ?? []) as Notification[];
    setItems(rows);
    setActors(await fetchProfiles(rows.map((r) => r.actor_id ?? "")));
  }, [userId]);

  useEffect(() => {
    void load();
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load, userId]);

  const unread = items.filter((item) => !item.read).length;

  async function markAllRead() {
    if (unread === 0) return;
    await supabase.from("notifications").update({ read: true }).eq("user_id", userId).eq("read", false);
    void load();
  }

  return (
    <Popover onOpenChange={(open) => open && void markAllRead()}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold text-primary-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b border-border px-3 py-2 text-xs font-medium">Notifications</div>
        <div className="max-h-80 overflow-y-auto">
          {items.length === 0 && (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              Abhi koi notification nahi.
            </p>
          )}
          {items.map((item) => (
            <div key={item.id} className="border-b border-border/60 px-3 py-2 last:border-0">
              <p className="text-xs">
                <span className="font-medium">{nameOf(actors[item.actor_id ?? ""])}</span>{" "}
                {TYPE_TEXT[item.type] ?? item.type}
              </p>
              {item.body && (
                <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{item.body}</p>
              )}
              <p className="mt-0.5 text-[10px] text-muted-foreground">{timeAgo(item.created_at)}</p>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

const NAV = [
  { to: "/", label: "Studio", icon: Sparkles },
  { to: "/community", label: "Feed", icon: Home },
  { to: "/messages", label: "Chat", icon: MessageCircle },
  { to: "/leaderboard", label: "Top", icon: Trophy },
  { to: "/cv", label: "CV", icon: FileText },
  { to: "/earn", label: "Earn", icon: Coins },
] as const;

export function CommunityShell({
  userId,
  title,
  subtitle,
  children,
}: {
  userId: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  const [me, setMe] = useState<CommunityProfile | null>(null);

  useEffect(() => {
    void fetchProfiles([userId]).then((map) => setMe(map[userId] ?? null));
  }, [userId]);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-3 pb-24 pt-4">
      <header className="mb-3 flex items-center gap-2">
        <div className="flex-1">
          <h1 className="text-lg font-semibold leading-tight">{title}</h1>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <NotificationBell userId={userId} />
        <Button
          variant="ghost"
          size="icon"
          aria-label="Mera profile"
          onClick={() =>
            me?.username && navigate({ to: "/u/$username", params: { username: me.username } })
          }
        >
          <Users className="h-4 w-4" />
        </Button>
      </header>

      {children}

      <LegalFooter />

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-around px-2 py-2">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: true }}
              className="flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] text-muted-foreground"
              activeProps={{ className: "text-primary" }}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
