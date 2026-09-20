import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Brain, Coins, FileText, LogOut, Users, UserPlus } from "lucide-react";
import logoAsset from "@/assets/logo.jpg.asset.json";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChatPanel } from "@/components/nova/ChatPanel";
import { MemoryPanel } from "@/components/nova/MemoryPanel";
import { BuildsPanel } from "@/components/nova/BuildsPanel";
import { StudioPanel } from "@/components/nova/StudioPanel";
import { MindPanel } from "@/components/nova/MindPanel";
import { InviteDialog } from "@/components/nova/InviteDialog";
import { useAuth } from "@/hooks/useAuth";
import { redeemReferral } from "@/lib/referral";
import { LegalFooter } from "@/components/legal/LegalPage";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NO QUIT AI — Build Websites, Apps & Domains from Chat" },
      {
        name: "description",
        content:
          "NO QUIT AI: describe your idea in a simple chat and get websites, app blueprints and domain names, with a builder community and NQAI rewards.",
      },
      { property: "og:title", content: "NO QUIT AI — Build Websites, Apps & Domains from Chat" },
      {
        property: "og:description",
        content:
          "Chat with NO QUIT AI and get complete websites, app blueprints and domain names — with a builder community and NQAI rewards.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState("chat");
  const [activeMemoryId, setActiveMemoryId] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) void redeemReferral(user.id);
  }, [user]);

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Brain className="h-8 w-8 text-primary node-pulse" />
      </main>
    );
  }

  function openMemoryInStudio(memoryId: string) {
    setActiveMemoryId(memoryId);
    setActiveTab("studio");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 pb-4 pt-5">
      <header className="mb-4 flex items-center gap-3">
        <img
          src={logoAsset.url}
          alt="NO QUIT AI logo"
          className="h-10 w-10 rounded-2xl border border-border object-cover"
        />
        <div className="flex-1">
          <h1 className="text-lg font-semibold leading-tight">
            NO QUIT AI <span className="text-gradient">build studio</span>
          </h1>
          <p className="text-xs text-muted-foreground">Websites · Apps · Domains — bas command do</p>
        </div>
        <Button variant="ghost" size="icon" asChild aria-label="CV Maker">
          <Link to="/cv">
            <FileText className="h-4 w-4" />
          </Link>
        </Button>
        <Button variant="ghost" size="icon" asChild aria-label="Community">
          <Link to="/community">
            <Users className="h-4 w-4" />
          </Link>
        </Button>

        <Button variant="ghost" size="icon" asChild aria-label="NQAI coins">
          <Link to="/earn">
            <Coins className="h-4 w-4" />
          </Link>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setInviteOpen(true)}
          aria-label="Invite friends"
        >
          <UserPlus className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => signOut()} aria-label="Sign out">
          <LogOut className="h-4 w-4" />
        </Button>
      </header>

      <InviteDialog userId={user.id} open={inviteOpen} onOpenChange={setInviteOpen} />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex min-h-0 flex-1 flex-col">
        <TabsList className="mb-3 grid w-full grid-cols-5 gap-0.5">
          <TabsTrigger value="chat" className="px-1 text-[11px]">Chat</TabsTrigger>
          <TabsTrigger value="memory" className="px-1 text-[11px]">Memory</TabsTrigger>
          <TabsTrigger value="builds" className="px-1 text-[11px]">Builds</TabsTrigger>
          <TabsTrigger value="studio" className="px-1 text-[11px]">Studio</TabsTrigger>
          <TabsTrigger value="mind" className="px-1 text-[11px]">Mind</TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="mt-0 flex min-h-0 flex-1 flex-col">
          <ChatPanel userId={user.id} onWorkChanged={() => setRefreshKey((key) => key + 1)} />
        </TabsContent>
        <TabsContent value="memory" className="mt-0 flex-1 overflow-y-auto">
          <MemoryPanel userId={user.id} refreshKey={refreshKey} />
        </TabsContent>
        <TabsContent value="builds" className="mt-0 flex-1 overflow-y-auto">
          <BuildsPanel
            userId={user.id}
            refreshKey={refreshKey}
            onOpenStudio={openMemoryInStudio}
          />
        </TabsContent>
        <TabsContent value="studio" className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden">
          <StudioPanel
            userId={user.id}
            refreshKey={refreshKey}
            activeMemoryId={activeMemoryId}
            onMemorySaved={() => setRefreshKey((key) => key + 1)}
          />
        </TabsContent>
        <TabsContent value="mind" className="mt-0 flex-1 overflow-y-auto">
          <MindPanel userId={user.id} refreshKey={refreshKey} />
        </TabsContent>
      </Tabs>
      <LegalFooter />
    </main>
  );
}
