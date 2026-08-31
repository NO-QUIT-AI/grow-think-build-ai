import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Brain, LogOut, UserPlus } from "lucide-react";
import logoAsset from "@/assets/logo.jpg.asset.json";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChatPanel } from "@/components/nova/ChatPanel";
import { MemoryPanel } from "@/components/nova/MemoryPanel";
import { BuildsPanel } from "@/components/nova/BuildsPanel";
import { StudioPanel } from "@/components/nova/StudioPanel";
import { MindPanel } from "@/components/nova/MindPanel";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NO QUIT AI — Self-Growing AI that Thinks, Learns & Builds" },
      {
        name: "description",
        content:
          "NO QUIT AI is a self-growing AI workspace: it thinks step by step, grows its own memory from every chat, and builds domain names and full app blueprints on request.",
      },
      { property: "og:title", content: "NO QUIT AI — Self-Growing AI that Thinks, Learns & Builds" },
      {
        property: "og:description",
        content:
          "Chat with a self-growing AI that saves what it learns and generates domains and complete app blueprints.",
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

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

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
            NO QUIT AI <span className="text-gradient">self-growing AI</span>
          </h1>
          <p className="text-xs text-muted-foreground">Sochti hai · seekhti hai · khud banati hai</p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => signOut()} aria-label="Sign out">
          <LogOut className="h-4 w-4" />
        </Button>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex min-h-0 flex-1 flex-col">
        <TabsList className="mb-3 grid w-full grid-cols-5">
          <TabsTrigger value="chat">Chat</TabsTrigger>
          <TabsTrigger value="memory">Memory</TabsTrigger>
          <TabsTrigger value="builds">Builds</TabsTrigger>
          <TabsTrigger value="studio">Studio</TabsTrigger>
          <TabsTrigger value="mind">Mind</TabsTrigger>
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
    </main>
  );
}
