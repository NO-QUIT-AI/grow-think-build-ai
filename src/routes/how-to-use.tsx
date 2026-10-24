import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  MessageCircle, Hammer, FileText, Globe, Search, Smartphone, Radio, Sparkles, Brain,
  Layers, Code2, Users, Coins, Lightbulb, type LucideIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { LegalFooter } from "@/components/legal/LegalPage";

type Guide = { id: string; title: string; icon: LucideIcon; what: string; steps: [string, string, string]; tip: string; subs?: { name: string; what: string }[] };

const GUIDES: Guide[] = [
  { id: "quick-chat", title: "Quick Chat (Main AI Chat)", icon: MessageCircle,
    what: "Ek smart AI assistant jo English, Roman Urdu, Hindi aur Arabic me sawal ka jawab deta hai aur kaam karta hai.",
    steps: ["Sign in karke home page par Chat tab kholo.", "Neeche box me apna sawal ya kaam likho — ya mic dabakar bolo.", "Send dabao; jawab turant aata hai aur History me auto-save hota hai."],
    tip: "Har nayi topic ke liye New Chat shuru karo — AI ka focus behtar rehta hai aur History saaf rehti hai." },
  { id: "my-builds", title: "My Builds (Website Builder)", icon: Hammer,
    what: "Ek sentence se poori website ya app bana deta hai, live preview ke saath.",
    steps: ["Chat me likho: “meri bakery ke liye website banao menu aur WhatsApp button ke saath”.", "AI page likhega aur Studio me live preview dikhayega.", "Changes ke liye chat karte raho; har message ek naya version banata hai."],
    tip: "Rang, font aur sections specific batao — jitni detail, utna behtar result." },
  { id: "my-cvs", title: "My CVs (CV Maker)", icon: FileText,
    what: "Minutes me professional resume banata hai jise PDF, ZIP ya link ki shakal me share kar sakte ho.",
    steps: ["Menu se My CVs ya /cv page kholo.", "Education, experience aur skills fill karo; AI Polish se text behtar karo.", "Download PDF, ZIP ya Copy Link se employer ko bhejo."],
    tip: "Har job ke liye CV ki copy banao aur skills us job ke mutabiq badlo." },
  { id: "my-websites", title: "My Websites", icon: Globe,
    what: "Aapki published websites aur unke free subdomain live links ek jagah dikhata hai.",
    steps: ["Builds tab me koi website build kholo.", "Subdomain name check karke Publish dabao.", "Visit ya Copy Link se live site share karo."],
    tip: "Subdomain chhota aur brand jaisa rakho — log aasani se yaad rakhte hain." },
  { id: "my-domains", title: "My Domains (Domain Search)", icon: Search,
    what: "Check karta hai ke aapka pasandida domain naam available hai aur alternatives suggest karta hai.",
    steps: ["Menu me My Domains kholo.", "Apne business ka naam likho aur search karo.", "Available naam chuno, ya pehle free subdomain se start karo."],
    tip: ".com sabse trusted hai; naam me hyphen aur numbers se bacho." },
  { id: "phone-tools", title: "Phone Tools", icon: Smartphone,
    what: "Rozmarra phone ke kaam app ke andar se ek tap me.",
    steps: ["Left side menu (Tools) kholo.", "PHONE TOOLS section me tool chuno.", "Number ya input do aur tool seedha phone ki app me khul jayega."],
    tip: "Search box me tool ka naam likho — sab se tez tareeqa.",
    subs: [
      { name: "WhatsApp Sender", what: "Number save kiye bina WhatsApp message bhejo." },
      { name: "Call Dialer", what: "Number type karke seedha call lagao." },
      { name: "Play Music", what: "Pasandida music jaldi chalao." },
      { name: "Flashlight", what: "Phone ki torch on/off karo." },
      { name: "Camera", what: "Photo lene ke liye camera kholo." },
      { name: "Instagram Opener", what: "Kisi profile ko seedha Instagram me kholo." },
    ] },
  { id: "jalsa", title: "Jalsa Mode Local Chat", icon: Radio,
    what: "Do phones QR code se direct local connection par chat karte hain; offline messages baad me sync hote hain.",
    steps: ["Menu me Jalsa Mode switch ON karo aur Go to Jalsa Chat dabao.", "Ek phone QR dikhaye, doosra scan kare.", "Connect hone ke baad message bhejo — offline queue khud sync hoti hai."],
    tip: "Dono phones ek hi Wi-Fi/hotspot par hon to connection sabse tez banta hai." },
  { id: "ai-tools", title: "AI Tools", icon: Sparkles,
    what: "Image, video, PDF, voice aur space photos ke liye free AI tools.",
    steps: ["Menu ke AI TOOLS section me jao.", "Tool chuno aur prompt, file ya script do.", "Result preview karo aur download/share karo."],
    tip: "Text to Image me style likho (jaise “cinematic, golden light”) — quality foran barh jati hai.",
    subs: [
      { name: "Text to Image", what: "Likhe hue prompt se tasveer banao." },
      { name: "Auto Story to Video", what: "Kahani se scenes, captions aur stock clips ke saath MP4 video." },
      { name: "PDF Reader", what: "PDF file ko app me kholkar parho." },
      { name: "Voice Tools", what: "AI se awaaz me baat karo — wo aapki zubaan me jawab deta hai." },
      { name: "Space Photo NASA", what: "Har din NASA ki nayi space photo aur explanation." },
    ] },
  { id: "memory", title: "Memory (Long-term AI Memory)", icon: Brain,
    what: "AI aapki preferences aur important baatein yaad rakhta hai taake har baar dobara na batana pade.",
    steps: ["Chat me baat karo — important cheezein khud memory me save hoti hain.", "Memory tab me dekho AI ne kya yaad rakha hai.", "Jo bhool jana chahiye use delete kar do."],
    tip: "Chat me likho “yaad rakho mera brand color green hai” — aage ke builds me apply hoga." },
  { id: "builds", title: "Builds (How builds work)", icon: Layers,
    what: "Har build versions me save hota hai — Planner, Builder aur Reviewer agents mil kar banate hain.",
    steps: ["Chat me build request bhejo.", "Agents plan karte, code likhte aur review karte hain.", "Builds tab me version kholo, Studio me edit ya publish karo."],
    tip: "Purana version hamesha safe rehta hai — bina dar ke experiment karo." },
  { id: "studio", title: "Studio (Code Editor)", icon: Code2,
    what: "Cursor-style code editor live preview ke saath; Ctrl+K se AI inline edit.",
    steps: ["Studio tab me build kholo.", "Code select karo aur Ctrl+K dabakar change likho.", "Diff review karo, Apply karo — galti ho to Undo."],
    tip: "Chhote, specific edits maango — diff saaf aur review aasaan rehta hai." },
  { id: "community", title: "My Story / Mind / Feed / Top Builders", icon: Users,
    what: "Apni kahani share karo, Mind se AI ko gehra sochne do, Feed par projects dikhao aur leaderboard par chadho.",
    steps: ["Community page se Feed kholo aur apna project post karo.", "Mind tab me lambe tasks AI ko step-by-step sochne do.", "Doosron ki madad karo aur Top Builders me rank badhao."],
    tip: "Post ke saath screenshot lagao — zyada feedback milta hai." },
  { id: "mining", title: "Mining (Earn Points)", icon: Coins,
    what: "Roz activity se NQAI points kamao: 0.5 coin/hour, 24 ghante ka session.",
    steps: ["Menu me Earn Points / Mining kholo.", "Start dabao — 24 ghante tak session chalta hai.", "Dosto ko invite karo: har invite +10 aur speed +0.1."],
    tip: "Session khatam hote hi dobara start karo taake koi ghanta zaya na ho." },
];

export const Route = createFileRoute("/how-to-use")({
  head: () => ({
    meta: [
      { title: "How to Use Guide — NO QUIT AI Features" },
      { name: "description", content: "Complete NO QUIT AI guide: chat, website builder, CV maker, domains, phone tools, Jalsa, AI tools, Studio, memory and mining — step by step." },
      { property: "og:title", content: "How to Use Guide — NO QUIT AI Features" },
      { property: "og:description", content: "Har NO QUIT AI feature ka step-by-step guide with pro tips." },
      { property: "og:type", content: "article" },
      { property: "og:url", content: "https://noquitai.com/how-to-use" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://noquitai.com/how-to-use" }],
  }),
  component: HowToUse,
});

function HowToUse() {
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return GUIDES;
    return GUIDES.filter((g) => JSON.stringify(g).toLowerCase().includes(s));
  }, [q]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <Link to="/" className="text-xs text-muted-foreground hover:text-primary">← NO QUIT AI</Link>
      <h1 className="mt-3 text-3xl font-semibold">How to Use <span className="text-gradient">Guide</span></h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        NO QUIT AI ke har feature ka asaan guide — kya kaam karta hai, 3 steps me kaise use karein, aur ek pro tip.
      </p>
      <div className="relative mt-5 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Feature search karo... (e.g. CV, video)" className="pl-9" />
      </div>

      <div className="mt-8 grid gap-8 md:grid-cols-[220px_1fr]">
        <nav aria-label="Table of contents" className="hidden md:block">
          <div className="sticky top-6 rounded-2xl border border-border bg-card/60 p-3">
            <p className="px-2 pb-2 text-[10px] font-semibold tracking-widest text-muted-foreground">CONTENTS</p>
            {GUIDES.map((g, i) => (
              <a key={g.id} href={`#${g.id}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:bg-secondary hover:text-primary">
                <g.icon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{i + 1}. {g.title}</span>
              </a>
            ))}
          </div>
        </nav>

        <div className="grid gap-5 lg:grid-cols-2">
          {list.length === 0 && <p className="text-sm text-muted-foreground">Koi feature nahi mila.</p>}
          {list.map((g) => (
            <article key={g.id} id={g.id} className="scroll-mt-6 rounded-2xl border border-border bg-card/60 p-5 transition-colors hover:border-primary/50">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <g.icon className="h-5 w-5" />
                </div>
                <h2 className="text-base font-semibold">{g.title}</h2>
              </div>
              <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-primary">Kya kaam karta hai?</h3>
              <p className="mt-1 text-sm text-muted-foreground">{g.what}</p>
              {g.subs && (
                <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
                  {g.subs.map((s) => (
                    <li key={s.name} className="rounded-lg border border-border/60 bg-background/40 px-2.5 py-1.5 text-xs">
                      <span className="font-medium text-foreground">{s.name}</span>
                      <span className="block text-muted-foreground">{s.what}</span>
                    </li>
                  ))}
                </ul>
              )}
              <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-primary">Kaise use kare?</h3>
              <ol className="mt-2 space-y-2">
                {g.steps.map((s, i) => (
                  <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">{i + 1}</span>
                    <span><b className="text-foreground">Step {i + 1}:</b> {s}</span>
                  </li>
                ))}
              </ol>
              <div className="mt-4 flex gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs">
                <Lightbulb className="h-4 w-4 shrink-0 text-primary" />
                <p><b className="text-foreground">Pro Tip:</b> <span className="text-muted-foreground">{g.tip}</span></p>
              </div>
            </article>
          ))}
        </div>
      </div>
      <LegalFooter />
    </div>
  );
}
