import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useEffect } from "react";
import { Brain, Layers, Sparkles, Wand2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import logoAsset from "@/assets/logo.jpg.asset.json";
import { storeReferral } from "@/lib/referral";

export const Route = createFileRoute("/invite")({
  validateSearch: (search: Record<string, unknown>) => ({
    ref: typeof search["ref"] === "string" ? (search["ref"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Invite: NO QUIT AI — Websites, Apps & Domains from Chat" },
      {
        name: "description",
        content:
          "Tumhe NO QUIT AI par invite kiya gaya hai — command do aur websites, app blueprints aur domain names bana kar live preview pao. Free sign up karo.",
      },
      { property: "og:title", content: "Invite: NO QUIT AI — Websites, Apps & Domains from Chat" },
      {
        property: "og:description",
        content: "Join NO QUIT AI: chat karo aur apne liye websites aur apps banwao.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InvitePage,
});

function InvitePage() {
  const { ref } = useSearch({ from: "/invite" });

  useEffect(() => {
    storeReferral(ref);
  }, [ref]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-4 py-10">
      <div className="panel p-7">
        <div className="mb-5 flex items-center gap-3">
          <img
            src={logoAsset.url}
            alt="NO QUIT AI logo"
            className="h-12 w-12 rounded-2xl border border-border object-cover"
          />
          <div>
            <h1 className="text-xl font-semibold">
              NO QUIT AI <span className="text-gradient">invite</span>
            </h1>
            <p className="text-xs text-muted-foreground">
              Websites · Apps · Domains — bas command do
            </p>
          </div>
        </div>

        <p className="mb-5 text-sm text-muted-foreground">
          Tumhe NO QUIT AI par bulaya gaya hai. Sirf command do — AI plan banati
          hai, code likhti hai aur live preview kar deti hai.
        </p>

        <ul className="mb-6 space-y-3 text-sm">
          <Perk icon={<Sparkles className="h-4 w-4 text-primary" />}>
            Domain names, brand ideas — seconds me
          </Perk>
          <Perk icon={<Layers className="h-4 w-4 text-accent" />}>
            Poori app ka blueprint: screens, features, data model
          </Perk>
          <Perk icon={<Wand2 className="h-4 w-4 text-primary" />}>
            Website build + Studio me live preview + shortcut app
          </Perk>
          <Perk icon={<Brain className="h-4 w-4 text-accent" />}>
            Mind engine har chat se khud nayi soch add karta hai
          </Perk>
        </ul>

        <Button asChild className="w-full">
          <Link to="/auth">Free account banao</Link>
        </Button>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Pehle se account hai?{" "}
          <Link to="/auth" className="text-primary underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}

function Perk({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-0.5">{icon}</span>
      <span className="text-muted-foreground">{children}</span>
    </li>
  );
}
