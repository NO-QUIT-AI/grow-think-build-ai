import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  MessageCircle,
  Hammer,
  FileText,
  Globe,
  Phone,
  Radio,
  Sparkles,
  Brain,
  Code,
  Users,
  Coins,
  Mail,
  BookOpen,
  LifeBuoy,
  X,
  Send,
  ExternalLink,
  type LucideIcon,
} from "lucide-react";
import { HELP_ENTRIES, matchHelpEntry, type HelpEntry } from "@/lib/help-guide";

const ICONS: Record<string, LucideIcon> = {
  message: MessageCircle,
  hammer: Hammer,
  file: FileText,
  globe: Globe,
  phone: Phone,
  radio: Radio,
  sparkles: Sparkles,
  brain: Brain,
  code: Code,
  users: Users,
  coins: Coins,
  mail: Mail,
  book: BookOpen,
};

type ChatMsg =
  | { kind: "user"; text: string }
  | { kind: "guide"; entry: HelpEntry }
  | { kind: "fallback"; text: string };

const SUGGESTIONS = ["Website banana hai", "CV kaise banau?", "Points kaise kamau?", "Jalsa mode kya hai?"];

/**
 * Floating help assistant: user likhta hai kya karna hai, assistant usi
 * page par navigate kar deta hai aur step-by-step guide dikhata hai.
 */
export function HelpAssistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs]);

  function openEntry(entry: HelpEntry) {
    if (entry.tab) {
      window.dispatchEvent(new CustomEvent("nqai-open-tab", { detail: entry.tab }));
    }
    void navigate({ to: entry.route });
  }

  function ask(raw: string) {
    const text = raw.trim();
    if (!text) return;
    setInput("");
    const entry = matchHelpEntry(text);
    setMsgs((prev) => [
      ...prev,
      { kind: "user", text },
      entry
        ? { kind: "guide", entry }
        : {
            kind: "fallback",
            text: "Hmm, ye samajh nahi aaya. Try karo: 'website banana hai', 'CV banani hai', 'points kamane hain' — ya neeche se koi topic chuno.",
          },
    ]);
    if (entry) {
      // Thoda delay taake user guide padh sake, phir page khul jaye.
      window.setTimeout(() => openEntry(entry), 900);
    }
  }

  return (
    <>
      {/* Floating launcher */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Help Assistant"
        className="fixed bottom-4 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full border border-primary/40 bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-105"
      >
        {open ? <X className="h-5 w-5" /> : <LifeBuoy className="h-5 w-5" />}
      </button>

      {open && (
        <div className="fixed bottom-20 right-4 z-50 flex h-[28rem] w-[22rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
          <header className="flex items-center gap-2 border-b border-border bg-primary/10 px-4 py-3">
            <LifeBuoy className="h-5 w-5 text-primary" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">NO QUIT Help Assistant</p>
              <p className="truncate text-[11px] text-muted-foreground">
                Bolo kya karna hai — main page khol ke guide karunga
              </p>
            </div>
          </header>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
            {msgs.length === 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Assalam o Alaikum! Batao kya karna hai — main wahi page khol dunga aur step by step
                  sikha dunga. Misal:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => ask(s)}
                      className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] text-foreground hover:border-primary/50"
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  {HELP_ENTRIES.slice(0, 8).map((e) => {
                    const Icon = ICONS[e.icon] ?? Sparkles;
                    return (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => ask(e.title)}
                        className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-2 py-1.5 text-left text-[11px] text-foreground hover:border-primary/50"
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
                        <span className="truncate">{e.title}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {msgs.map((m, i) => {
              if (m.kind === "user") {
                return (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-xs text-primary-foreground">
                      {m.text}
                    </div>
                  </div>
                );
              }
              if (m.kind === "fallback") {
                return (
                  <div key={i} className="flex">
                    <div className="max-w-[90%] rounded-2xl rounded-bl-sm border border-border bg-background px-3 py-2 text-xs text-foreground">
                      {m.text}
                    </div>
                  </div>
                );
              }
              const Icon = ICONS[m.entry.icon] ?? Sparkles;
              return (
                <div key={i} className="flex">
                  <div className="w-full max-w-[95%] rounded-2xl rounded-bl-sm border border-primary/30 bg-background px-3 py-2.5">
                    <div className="mb-1 flex items-center gap-1.5">
                      <Icon className="h-4 w-4 text-primary" />
                      <p className="text-xs font-semibold text-foreground">{m.entry.title}</p>
                    </div>
                    <p className="mb-2 text-[11px] text-muted-foreground">{m.entry.what}</p>
                    <ol className="space-y-1.5">
                      {m.entry.steps.map((step, si) => (
                        <li key={si} className="flex gap-2 text-[11px] text-foreground">
                          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                            {si + 1}
                          </span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ol>
                    <p className="mt-2 rounded-lg bg-primary/10 px-2 py-1.5 text-[10px] text-foreground">
                      <span className="font-semibold text-primary">Pro Tip: </span>
                      {m.entry.tip}
                    </p>
                    <button
                      type="button"
                      onClick={() => openEntry(m.entry)}
                      className="mt-2 inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Page kholo
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <form
            className="flex items-center gap-2 border-t border-border px-3 py-2"
            onSubmit={(e) => {
              e.preventDefault();
              ask(input);
            }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Kya karna hai? likho..."
              className="h-9 flex-1 rounded-full border border-border bg-background px-3 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/60"
            />
            <button
              type="submit"
              aria-label="Send"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
