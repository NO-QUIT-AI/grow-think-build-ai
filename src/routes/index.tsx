import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Brain, Coins, FileText, LogOut, Users, UserPlus, Radio } from "lucide-react";
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
import { LanguageSelector } from "@/components/LanguageSelector";
import { useT } from "@/i18n/LanguageContext";
import { useJalsaMode } from "@/hooks/useJalsaMode";
import type { StudioContext } from "@/lib/studio-edit";

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
  const t = useT();
  const { user, loading, signOut } = useAuth();
  const { enabled: jalsa } = useJalsaMode();
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState("chat");
  const [activeMemoryId, setActiveMemoryId] = useState<string | null>(null);
  const [studioContext, setStudioContext] = useState<StudioContext | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  useEffect(() => {
    if (user) void redeemReferral();
  }, [user]);

  useEffect(() => {
    const h = (e: Event) => setActiveTab(String((e as CustomEvent).detail));
    window.addEventListener("nqai-open-tab", h);
    return () => window.removeEventListener("nqai-open-tab", h);
  }, []);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Brain className="h-8 w-8 text-primary node-pulse" />
      </main>
    );
  }

  // Logged-out visitors (and search engines) see a public landing page with
  // full informational content instead of being bounced to the sign-in form.
  if (!user) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 pb-4 pt-5">
        <main className="flex w-full min-w-0 flex-col">
          <header className="mb-4 flex items-center gap-3">
            <img
              src={logoAsset.url}
              alt="NO QUIT AI logo"
              className="h-10 w-10 shrink-0 rounded-2xl border border-border object-cover"
            />
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-base font-semibold leading-tight md:text-lg">
                NO QUIT AI <span className="text-gradient">{t("buildStudio")}</span>
              </h1>
              <p className="truncate text-xs text-muted-foreground">{t("homeTagline")}</p>
            </div>
            <Button asChild size="sm" className="btn-green">
              <Link to="/auth">Sign in</Link>
            </Button>
          </header>
          <SeoContent />
          <LegalFooter />
        </main>
      </div>
    );
  }

  function openMemoryInStudio(memoryId: string) {
    setActiveMemoryId(memoryId);
    setActiveTab("studio");
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1280px] flex-col gap-6 px-4 pb-4 pt-5">
    <main className="flex w-full min-w-0 flex-col">
      <header className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <img
            src={logoAsset.url}
            alt="NO QUIT AI logo"
            className="h-10 w-10 shrink-0 rounded-2xl border border-border object-cover"
          />
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold leading-tight md:text-lg">
              NO QUIT AI <span className="text-gradient">{t("buildStudio")}</span>
            </h1>
            <p className="truncate text-xs text-muted-foreground">{t("homeTagline")}</p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-0.5 md:gap-1">
          <Button
            variant="ghost"
            asChild
            className="h-auto flex-col gap-0.5 px-2 py-1.5 text-[10px] text-muted-foreground"
          >
            <Link to="/cv" aria-label={t("cv")}>
              <FileText className="h-4 w-4" />
              {t("cv")}
            </Link>
          </Button>
          <Button
            variant="ghost"
            asChild
            className="h-auto flex-col gap-0.5 px-2 py-1.5 text-[10px] text-muted-foreground"
          >
            <Link to="/community" aria-label={t("community")}>
              <Users className="h-4 w-4" />
              {t("community")}
            </Link>
          </Button>
          <Button
            variant="ghost"
            asChild
            className="h-auto flex-col gap-0.5 px-2 py-1.5 text-[10px] text-muted-foreground"
          >
            <Link to="/earn" aria-label={t("mining")}>
              <Coins className="h-4 w-4" />
              {t("mining")}
            </Link>
          </Button>
          <Button
            variant="ghost"
            onClick={() => setInviteOpen(true)}
            aria-label={t("invite")}
            className="h-auto flex-col gap-0.5 px-2 py-1.5 text-[10px] text-muted-foreground"
          >
            <UserPlus className="h-4 w-4" />
            {t("invite")}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => signOut()} aria-label={t("logout")}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="mb-3 flex items-center justify-end">
        {jalsa && <Button asChild variant="outline" size="sm" className="mr-auto"><Link to="/jalsa-chat"><Radio /> Go to Jalsa Chat</Link></Button>}
        <LanguageSelector />
      </div>

      <InviteDialog userId={user.id} open={inviteOpen} onOpenChange={setInviteOpen} />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex min-h-0 flex-1 flex-col">
        <TabsList className="mb-3 grid w-full grid-cols-5 gap-0.5">
          <TabsTrigger value="chat" className="px-1 text-[11px]">{t("chat")}</TabsTrigger>
          <TabsTrigger value="memory" className="px-1 text-[11px]">{t("memory")}</TabsTrigger>
          <TabsTrigger value="builds" className="px-1 text-[11px]">{t("builds")}</TabsTrigger>
          <TabsTrigger value="studio" className="px-1 text-[11px]">{t("studio")}</TabsTrigger>
          <TabsTrigger value="mind" className="px-1 text-[11px]">{t("mind")}</TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="mt-0 flex min-h-0 flex-1 flex-col">
          <ChatPanel userId={user.id} studioContext={studioContext} onOpenStudio={openMemoryInStudio} onWorkChanged={() => setRefreshKey((key) => key + 1)} />
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
            onContextChanged={setStudioContext}
          />
        </TabsContent>
        <TabsContent value="mind" className="mt-0 flex-1 overflow-y-auto">
          <MindPanel userId={user.id} refreshKey={refreshKey} />
        </TabsContent>
      </Tabs>
      <SeoContent />
      <LegalFooter />
    </main>
    </div>
  );
}

/**
 * Long-form informational content about NO QUIT AI Build Studio.
 * Lives at the bottom of the home page so visitors and search engines can
 * understand what the product does. Ads are never placed near it.
 */
function SeoContent() {
  return (
    <section
      aria-label="About NO QUIT AI Build Studio"
      className="prose-sm mt-10 max-w-none space-y-4 border-t border-border pt-8 text-sm leading-relaxed text-muted-foreground [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-foreground [&_li]:ml-4 [&_li]:list-disc [&_p]:mt-2"
    >
      <h2>What is NO QUIT AI Build Studio?</h2>
      <p>
        NO QUIT AI Build Studio is a free online workspace where you turn plain-language ideas into
        real digital products. Instead of learning to code, installing complicated software or
        hiring an expensive developer, you simply describe what you want in a chat — in English,
        Roman Urdu, Hindi or Arabic — and the AI assistant builds it for you. A live preview appears
        in the Studio panel, and every project is saved to your account so you can return tomorrow
        and keep improving it, one version at a time.
      </p>
      <p>
        The idea behind the platform is simple: talent is everywhere, but tools are not. A student
        in Lahore, a shopkeeper in Karachi, a freelancer in Dubai or a teacher in Delhi should all
        be able to put their ideas online without months of training. NO QUIT AI removes that
        barrier by combining a friendly chat assistant, a powerful code studio, a CV maker, a
        domain search tool and a set of phone and AI utilities in one place — all inside your
        browser, with nothing to install.
      </p>

      <h2>Website Builder — from a sentence to a live site</h2>
      <p>
        The Website Builder is the heart of NO QUIT AI. You type something like “make a one-page
        website for my home bakery with a menu, prices and a WhatsApp order button”, and the
        assistant writes the complete page for you. The Studio shows a live preview immediately, so
        you can see exactly what your visitors will see on their phones and computers.
      </p>
      <p>
        Editing works the same way: you keep chatting. Ask for bigger prices, a softer background,
        a new section for customer reviews, or a different font — each message produces a new
        version. The Studio also offers a Cursor-style inline editor: select any part of the code,
        press Ctrl+K, describe the change, review the diff, and apply or undo it with one click.
        Nothing is ever overwritten without your approval.
      </p>
      <p>
        When your site is ready, you can publish it to a free subdomain, copy the live link and
        share it on WhatsApp, Instagram or with customers directly. Your builds are stored safely in
        your account, and the Memory system means the assistant remembers your preferences, your
        brand colours and your previous decisions across sessions.
      </p>

      <h2>CV Maker — a professional resume in minutes</h2>
      <p>
        The CV Maker helps job seekers create a clean, professional resume without fighting with
        word processors. You answer simple questions about your education, experience and skills,
        and the tool formats everything into a polished document. You can export your CV as a PDF,
        download it as a ZIP file, or copy a shareable link to send to employers.
      </p>
      <p>
        The CV Maker is designed for real hiring situations in Pakistan, India, the Gulf and
        beyond: clear sections, honest formatting, and layouts that print well and look good on a
        phone screen. Your CVs are saved to your account, so when you gain a new skill or complete
        a new project, updating your resume takes seconds instead of hours.
      </p>

      <h2>Domain Search — find the right name for your idea</h2>
      <p>
        Every serious project needs a name on the internet. The Domain Search tool lets you check
        whether the name you want is available, explore alternatives, and connect a custom domain
        to the sites you build. Instead of visiting separate registrar websites and comparing
        confusing price tables, you search directly inside the same workspace where you build.
      </p>
      <p>
        For beginners, the tool explains the difference between free subdomains and custom domains
        in plain language, so you can start free today and upgrade to your own .com when your
        project grows. Your published builds remain live either way, and switching later does not
        break your existing links.
      </p>

      <h2>Phone Tools — built for how people actually communicate</h2>
      <p>
        NO QUIT AI includes a set of phone-focused tools designed around real life. Voice chat lets
        you talk to the assistant out loud instead of typing — useful when your hands are busy or
        when speaking feels more natural than writing. The voice system understands and replies in
        the language you use, including English, Urdu, Hindi and Arabic.
      </p>
      <p>
        Jalsa Mode provides a private, local chat experience: two phones can connect directly with
        a QR code and exchange messages over a local connection, with an offline queue that syncs
        when you are back online. Call features let you ring friends inside the app, and the
        messaging system keeps conversations private between accepted friends only — no strangers
        can message you without your approval.
      </p>

      <h2>AI Tools — an assistant that actually does the work</h2>
      <p>
        Beyond building websites, the AI assistant in NO QUIT AI is a general-purpose worker. It
        can research topics for you, summarise information, help write and improve text, generate
        and edit images, create story videos from a script, and answer questions in your own
        language. The Mind engine lets the assistant think through longer tasks step by step, while
        the Memory panel shows you exactly what it has remembered — and lets you delete anything
        you want forgotten.
      </p>
      <p>
        The assistant is honest about its limits. It marks uncertain answers, never invents contact
        details or facts about your business, and always lets you review generated content before
        it goes live. This makes it safe for real work: school assignments, business pages,
        portfolios, event invitations and more.
      </p>

      <h2>Community, rewards and the NO QUIT spirit</h2>
      <p>
        Building is more fun together. The community feed lets you share your projects, get
        feedback from other builders, and climb the Top Builders leaderboard by helping others.
        The Earn system rewards consistent activity with NQAI points, and inviting friends grows
        both your network and your rewards.
      </p>
      <p>
        The name NO QUIT AI is a promise: whatever you are building — a first website, a better CV,
        a small business page or a big idea — the platform is designed to help you keep going,
        version by version, until it is done. Create a free account, describe your first idea in
        the chat above, and see it come to life in the Studio today.
      </p>
    </section>
  );
}
