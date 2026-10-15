import { ToolsMenu, CHAT_ACTION_EVT } from "@/components/nova/ToolsMenu";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  Brain,
  Download,
  ImagePlus,
  Loader2,
  Menu,

  Mic,
  Plus,
  Sparkles,
  Trash2,
  Volume2,
  Wrench,
  X,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { VoiceModal, getSpeechRecognition } from "@/components/nova/VoiceModal";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translations";
import { connectPollinations, generateWithUserKey, getUserPollinationsKey } from "@/lib/pollinations";

const VOICE_CACHE_KEY = "nqai_voice_cache";
function voiceKey(q: string, lang: string) {
  return `${lang}::${q.toLowerCase().trim()}`;
}
function loadVoiceCache(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(VOICE_CACHE_KEY) || "{}");
  } catch {
    return {};
  }
}
function readVoiceCache(q: string, lang: string): string | null {
  if (typeof window === "undefined") return null;
  return loadVoiceCache()[voiceKey(q, lang)] ?? null;
}
function writeVoiceCache(q: string, lang: string, answer: string) {
  if (typeof window === "undefined") return;
  const cache = loadVoiceCache();
  cache[voiceKey(q, lang)] = answer;
  const keys = Object.keys(cache);
  for (const k of keys.slice(0, Math.max(0, keys.length - 200))) delete cache[k];
  try {
    localStorage.setItem(VOICE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* storage full */
  }
}

const TOOL_LABELS: Record<string, TranslationKey> = {
  "tool-recall_knowledge": "toolRecall",
  "tool-save_knowledge": "toolSave",
  "tool-create_domains": "toolDomains",
  "tool-create_app_blueprint": "toolBlueprint",
  "tool-build_website": "toolWebsite",
};

const SUGGESTION_KEYS: TranslationKey[] = ["chatSuggestionDomain", "chatSuggestionApp", "chatSuggestionCv"];

type Thread = { id: string; title: string; updated_at: string };

function FreeImage({ urls, prompt }: { urls: string[]; prompt: string }) {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [skipConnect, setSkipConnect] = useState(false);
  const [userUrl, setUserUrl] = useState<string | null>(null);
  useEffect(() => {
    const has = !!getUserPollinationsKey();
    setConnected(has);
    if (!has) return;
    generateWithUserKey(prompt)
      .then(setUserUrl)
      .catch((e: unknown) => {
        if (e instanceof Error && e.message === "not-connected") setConnected(false);
        else setSkipConnect(true);
      });
  }, [prompt]);
  if (connected === null) return null;
  if (!connected && !skipConnect) {
    return (
      <div className="mb-3 max-w-sm space-y-2 rounded-xl border border-border bg-secondary p-4">
        <p className="text-sm">Pollinations se connect karo - 100% free hai, 1 click me</p>
        <button type="button" onClick={() => void connectPollinations().catch(() => toast.error("Connect start nahi hua"))} className="btn-green h-9 rounded-xl px-4 text-xs">
          Connect with Pollinations (Free)
        </button>
        <button type="button" onClick={() => setSkipConnect(true)} className="block text-xs text-muted-foreground underline">
          Bina connect try karo
        </button>
      </div>
    );
  }
  if (connected && !skipConnect) {
    return <FreeImageView urls={userUrl ? [userUrl] : []} prompt={prompt} waiting={!userUrl} />;
  }
  return <FreeImageView urls={urls} prompt={prompt} />;
}

function FreeImageView({ urls, prompt, waiting }: { urls: string[]; prompt: string; waiting?: boolean }) {
  const [idx, setIdx] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const url = urls[idx];
  function onFail() {
    if (idx + 1 >= urls.length) { setFailed(true); return; }
    setRetrying(true);
    setTimeout(() => { setIdx((n) => n + 1); }, 2000);
  }
  if (waiting) {
    return (
      <div className="mb-3 flex aspect-square w-full max-w-sm animate-pulse items-center justify-center rounded-xl border border-border bg-secondary text-xs text-primary">
        No Quit AI is creating your image...
      </div>
    );
  }
  async function download() {
    try {
      const blob = await (await fetch(url!)).blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `noquit-ai-image-${Date.now()}.jpg`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }
  return (
    <div className="mb-3 space-y-2">
      {!loaded && !failed && (
        <div className="flex aspect-square w-full max-w-sm animate-pulse items-center justify-center rounded-xl border border-border bg-secondary text-xs text-primary">
          {retrying ? "Thodi der lag rahi hai, dusra model try kar raha hu..." : "No Quit AI is creating your image..."}
        </div>
      )}
      {failed ? (
        <p className="text-xs text-destructive">Image nahi bani — thodi der baad dobara try karo.</p>
      ) : (
        <img
          key={url}
          src={url}
          alt={prompt}
          onLoad={() => setLoaded(true)}
          onError={onFail}
          className={loaded ? "w-full max-w-sm rounded-xl border border-border" : "hidden"}
        />
      )}
      {loaded && (
        <button type="button" onClick={() => void download()} className="btn-green h-9 rounded-xl px-4 text-xs">
          Download Image
        </button>
      )}
    </div>
  );
}

function messageText(message: UIMessage) {
  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
    .trim();
}

function formatDate(value: string) {
  const d = new Date(value);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString([], { day: "2-digit", month: "short", year: "2-digit" });
}

// Phone photos are huge; shrink them in the browser so the upload never fails.
async function compressImage(file: File, maxSide = 1600, quality = 0.85) {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("decode failed"));
    el.src = dataUrl;
  });

  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  if (scale === 1 && file.size <= 2 * 1024 * 1024) return dataUrl;

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}

async function downloadDataUrl(dataUrl: string, filename: string) {
  try {
    // data: URLs are blocked/ignored by many mobile browsers; a Blob URL downloads reliably.
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  } catch {
    toast.error("Download nahi ho saki");
  }
}

export function ChatPanel({
  userId,
  onWorkChanged,
}: {
  userId: string;
  onWorkChanged: () => void;
}) {
  const { t } = useLanguage();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  // null = draft (naya chat jo abhi save nahi hua)
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [threadKey, setThreadKey] = useState(() => `draft-${Date.now()}`);
  const [loadingThread, setLoadingThread] = useState(false);

  const loadThreads = useCallback(async () => {
    const { data } = await supabase
      .from("conversations")
      .select("id, title, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(50);
    const rows = (data ?? []) as Thread[];
    setThreads(rows);
    return rows;
  }, [userId]);

  useEffect(() => {
    void loadThreads();
  }, [loadThreads]);

  const startNewChat = useCallback(() => {
    setConversationId(null);
    setInitialMessages([]);
    setThreadKey(`draft-${Date.now()}`);
    setHistoryOpen(false);
  }, []);

  const openThread = useCallback(async (id: string) => {
    setHistoryOpen(false);
    setLoadingThread(true);
    const { data: rows } = await supabase
      .from("messages")
      .select("id, role, content")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true });
    setInitialMessages(
      (rows ?? []).map((row) => ({
        id: row.id,
        role: row.role as UIMessage["role"],
        parts: [{ type: "text" as const, text: row.content }],
      })),
    );
    setConversationId(id);
    setThreadKey(id);
    setLoadingThread(false);
  }, []);

  // Pehla message bhejte hi chat save ho jati hai.
  const ensureConversation = useCallback(
    async (firstMessage: string) => {
      const title = firstMessage.slice(0, 48) || t("newChat");
      const { data: created, error } = await supabase
        .from("conversations")
        .insert({ user_id: userId, title })
        .select("id, title, updated_at")
        .single();
      if (error || !created) {
        toast.error(t("chatSaveFailed"));
        return null;
      }
      setThreads((prev) => [created as Thread, ...prev]);
      setConversationId(created.id);
      return created.id;
    },
    [userId, t],
  );

  async function deleteThread(id: string) {
    await supabase.from("messages").delete().eq("conversation_id", id);
    const { error } = await supabase.from("conversations").delete().eq("id", id);
    if (error) {
      toast.error(t("chatDeleteFailed"));
      return;
    }
    setThreads((prev) => prev.filter((t) => t.id !== id));
    if (conversationId === id) startNewChat();
    toast.success(t("chatDeleted"));
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-2 flex items-center gap-2">
        <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" aria-label={t("history")}>
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[85vw] max-w-sm border-r border-border/50 bg-background/70 p-0 backdrop-blur-xl duration-300">
            <SheetHeader className="sr-only">
              <SheetTitle>All Tools</SheetTitle>
            </SheetHeader>
            <ToolsMenu onNewChat={startNewChat} onClose={() => setHistoryOpen(false)} history={
            <div className="max-h-[50vh] overflow-y-auto p-1">
              {threads.length === 0 && (
                <p className="px-2 py-4 text-xs text-muted-foreground">{t("noSavedChats")}</p>
              )}
              {threads.map((thread) => (
                <div
                  key={thread.id}
                  className={`mb-1 flex items-center gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-secondary ${
                    thread.id === conversationId ? "bg-secondary" : ""
                  }`}
                >
                  <button
                    onClick={() => void openThread(thread.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="block truncate text-xs font-medium">{thread.title}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      {formatDate(thread.updated_at)}
                    </span>
                  </button>
                  <button
                    aria-label={t("deleteChat")}
                    onClick={() => void deleteThread(thread.id)}
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            } />
          </SheetContent>
        </Sheet>

        <div className="flex-1" />

        <Button size="sm" className="btn-green gap-1.5 text-xs" onClick={startNewChat}>
          <Plus className="h-4 w-4" /> {t("newChat")}
        </Button>
      </div>

      {loadingThread ? (
        <div className="flex flex-1 items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("chatLoading")}
        </div>
      ) : (
        <ChatThread
          key={threadKey}
          userId={userId}
          conversationId={conversationId}
          ensureConversation={ensureConversation}
          initialMessages={initialMessages}
          onWorkChanged={onWorkChanged}
          onTouched={(id) =>
            setThreads((prev) =>
              prev.map((t) => (t.id === id ? { ...t, updated_at: new Date().toISOString() } : t)),
            )
          }
        />
      )}
    </div>
  );
}

function ChatThread({
  userId,
  conversationId,
  ensureConversation,
  initialMessages,
  onWorkChanged,
  onTouched,
}: {
  userId: string;
  conversationId: string | null;
  ensureConversation: (firstMessage: string) => Promise<string | null>;
  initialMessages: UIMessage[];
  onWorkChanged: () => void;
  onTouched: (id: string) => void;
}) {
  const { lang, t } = useLanguage();
  const [input, setInput] = useState("");
  const [attached, setAttached] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [edits, setEdits] = useState<{ id: string; before: string; after: string; prompt: string }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const convRef = useRef<string | null>(conversationId);
  const [voiceOpen, setVoiceOpen] = useState(false);
  useEffect(() => {
    const h = (e: Event) => {
      const d = (e as CustomEvent<{ prefill?: string; voice?: boolean }>).detail;
      if (d?.prefill) setInput(d.prefill);
      if (d?.voice) setVoiceOpen(true);
    };
    window.addEventListener(CHAT_ACTION_EVT, h);
    return () => window.removeEventListener(CHAT_ACTION_EVT, h);
  }, []);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const voiceResolveRef = useRef<((text: string) => void) | null>(null);
  const voiceQuestionRef = useRef("");

  // AI jawab ko awaaz me sunao (browser ka speechSynthesis).
  function speak(id: string, text: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      toast.error("Voice not supported in this browser");
      return;
    }
    if (speakingId === id) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = { en: "en-US", ur: "ur-PK", hi: "hi-IN", ar: "ar-SA" }[lang] ?? "en-US";
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);
    setSpeakingId(id);
    window.speechSynthesis.speak(utterance);
  }

  useEffect(
    () => () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    },
    [],
  );

  useEffect(() => {
    if (conversationId) convRef.current = conversationId;
  }, [conversationId]);

  async function pickImage(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error(t("imageOnly"));
      return;
    }
    if (file.size > 30 * 1024 * 1024) {
      toast.error(t("imageTooLarge"));
      return;
    }
    try {
      setAttached(await compressImage(file));
    } catch {
      toast.error(t("imageLoadFailed"));
    }
  }

  async function runImageEdit(instruction: string) {
    if (!attached || editing) return;
    const before = attached;
    setEditing(true);
    setInput("");
    try {
      const res = await fetch("/api/edit-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: before, prompt: instruction, lang }),
      });
      if (!res.ok) throw new Error((await res.text()) || "Image edit fail hui");
      const json = (await res.json()) as { image?: string };
      if (!json.image) throw new Error("Model ne image return nahi ki");
      setEdits((prev) => [
        ...prev,
        { id: crypto.randomUUID(), before, after: json.image!, prompt: instruction },
      ]);
      setAttached(null);
      toast.success(t("imageEdited"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("imageEditFailed"));
    } finally {
      setEditing(false);
    }
  }

  useEffect(() => {
    try {
      const remix = localStorage.getItem("noquit_remix_prompt");
      if (remix) {
        setInput(remix);
        localStorage.removeItem("noquit_remix_prompt");
      }
    } catch {
      /* storage blocked */
    }
  }, []);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { lang },
        headers: async () => {
          const { data } = await supabase.auth.getSession();
          return { Authorization: `Bearer ${data.session?.access_token ?? ""}` };
        },
      }),
    [lang],
  );

  const { messages, sendMessage, setMessages, status, error } = useChat({
    messages: initialMessages,
    transport,
    onFinish: async ({ message }) => {
      const text = messageText(message);
      const cacheQ = voiceQuestionRef.current;
      const usedTool = (message.parts ?? []).some((p) => String(p.type).startsWith("tool-"));
      if (cacheQ && text && !usedTool && cacheQ.length <= 500) writeVoiceCache(cacheQ, lang, text);
      voiceQuestionRef.current = "";
      if (voiceResolveRef.current) {
        voiceResolveRef.current(text || t("aiNoReply"));
        voiceResolveRef.current = null;
      }
      const id = convRef.current;
      if (!text || !id) return;
      await supabase.from("messages").insert({
        conversation_id: id,
        user_id: userId,
        role: "assistant",
        content: text,
      });
      await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", id);
      onTouched(id);
      onWorkChanged();
    },
    onError: (err) => toast.error(err.message || t("aiNoReply")),
  });

  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function submit(text: string) {
    const value = text.trim();
    if (attached) {
      await runImageEdit(value || t("imageInstruction"));
      return;
    }
    if (!value || busy) return;
    if (readVoiceCache(value, lang)) {
      void askByVoice(value);
      return;
    }
    voiceQuestionRef.current = value;

    setInput("");
    let id = convRef.current;
    if (!id) {
      id = await ensureConversation(value);
      if (!id) return;
      convRef.current = id;
    }
    await supabase.from("messages").insert({
      conversation_id: id,
      user_id: userId,
      role: "user",
      content: value,
    });
    void sendMessage({ text: value });
  }

  // Voice agent: cache (device par save) me ho to AI call nahi, warna AI se poocho.
  async function askByVoice(question: string): Promise<string> {
    const cached = readVoiceCache(question, lang);
    if (cached) {
      setInput("");
      const stamp = Date.now();
      setMessages((prev) => [
        ...prev,
        { id: `vq-${stamp}`, role: "user", parts: [{ type: "text", text: question }] },
        { id: `va-${stamp}`, role: "assistant", parts: [{ type: "text", text: cached }] },
      ]);
      let id = convRef.current;
      if (!id) {
        id = await ensureConversation(question);
        if (id) convRef.current = id;
      }
      if (id) {
        await supabase.from("messages").insert([
          { conversation_id: id, user_id: userId, role: "user", content: question },
          { conversation_id: id, user_id: userId, role: "assistant", content: cached },
        ]);
        onTouched(id);
      }
      return cached;
    }
    // Voice mode: Groq (fallback DeepSeek) — chhota, insaan jaisa jawab.
    setInput("");
    const history = messages.slice(-6).map((m) => ({
      role: m.role === "user" ? ("user" as const) : ("assistant" as const),
      content: m.parts.map((p) => (p.type === "text" ? p.text : "")).join(" ").slice(0, 800),
    })).filter((m) => m.content.trim());
    const { data: s } = await supabase.auth.getSession();
    const res = await fetch("/api/voice-chat", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${s.session?.access_token ?? ""}` },
      body: JSON.stringify({ messages: [...history, { role: "user", content: question }] }),
    }).catch(() => null);
    const answer = res?.ok ? String(((await res.json()) as { text?: string }).text ?? "") : "";
    if (!answer) return t("aiNoReply");
    writeVoiceCache(question, lang, answer);
    const stamp = Date.now();
    setMessages((prev) => [
      ...prev,
      { id: `vq-${stamp}`, role: "user", parts: [{ type: "text", text: question }] },
      { id: `va-${stamp}`, role: "assistant", parts: [{ type: "text", text: answer }] },
    ]);
    let cid = convRef.current;
    if (!cid) {
      cid = await ensureConversation(question);
      if (cid) convRef.current = cid;
    }
    if (cid) {
      await supabase.from("messages").insert([
        { conversation_id: cid, user_id: userId, role: "user", content: question },
        { conversation_id: cid, user_id: userId, role: "assistant", content: answer },
      ]);
      onTouched(cid);
    }
    return answer;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto px-1 pb-4">
        {messages.length === 0 && (
          <div className="panel p-5">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium">
               <Sparkles className="h-4 w-4 text-primary" /> {t("chatReady")}
            </div>
            <p className="text-sm text-muted-foreground">
               {t("chatIntro")}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
               {SUGGESTION_KEYS.map((key) => {
                 const suggestion = t(key);
                 return (
                <button
                   key={key}
                  onClick={() => submit(suggestion)}
                  className="rounded-full border border-border bg-secondary px-3 py-1.5 text-xs text-secondary-foreground transition-colors hover:border-primary"
                >
                  {suggestion}
                </button>
                 );
               })}
            </div>
          </div>
        )}

        {messages.map((message) => {
          const isUser = message.role === "user";
          const tools = message.parts.filter((part) => part.type.startsWith("tool-"));
          const text = messageText(message);
          return (
            <div key={message.id} className={isUser ? "flex justify-end" : "flex justify-start"}>
              <div
                className={
                  isUser
                    ? "max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground"
                    : "panel max-w-[92%] px-4 py-3"
                }
              >
                {!isUser && tools.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {tools.map((part, index) => {
                      const label = TOOL_LABELS[part.type];
                      return (
                      <span
                        key={`${message.id}-tool-${index}`}
                        className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground"
                      >
                        <Wrench className="h-3 w-3 text-accent" />
                          {label ? t(label) : part.type.replace("tool-", "")}
                      </span>
                      );
                    })}
                  </div>
                )}
                {!isUser &&
                  tools
                    .filter((p) => p.type === "tool-generate_image_free")
                    .map((p, i) => {
                      const part = p as { state?: string; output?: { url?: string; urls?: string[]; prompt?: string } };
                      const out = part.output;
                      if (!out?.url)
                        return (
                          <p key={`img-${i}`} className="mb-2 animate-pulse text-xs text-primary">
                            No Quit AI is creating your image...
                          </p>
                        );
                      return <FreeImage key={`img-${i}`} urls={out.urls?.length ? out.urls : [out.url]} prompt={out.prompt ?? ""} />;
                    })}
                {text ? (
                  isUser ? (
                    <p className="whitespace-pre-wrap">{text}</p>
                  ) : (
                    <div className="space-y-3 text-sm leading-relaxed [&_a]:text-primary [&_code]:rounded [&_code]:bg-secondary [&_code]:px-1 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:font-semibold [&_li]:ml-4 [&_li]:list-disc [&_strong]:text-foreground">
                      <ReactMarkdown>{text}</ReactMarkdown>
                      <button
                        type="button"
                        aria-label="Read aloud"
                        onClick={() => speak(message.id, text)}
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                          speakingId === message.id
                            ? "border-primary bg-primary/15 text-primary"
                            : "border-border bg-secondary text-muted-foreground hover:border-primary"
                        }`}
                      >
                        <Volume2
                          className={`h-3.5 w-3.5 ${speakingId === message.id ? "node-pulse" : ""}`}
                        />
                        {speakingId === message.id ? "Speaking..." : "Listen"}
                      </button>
                    </div>
                  )
                ) : (
                   <span className="text-xs text-muted-foreground">{t("thinking")}</span>
                )}
              </div>
            </div>
          );
        })}

        {edits.map((edit) => (
          <div key={edit.id} className="panel space-y-3 p-3">
             <p className="text-xs text-muted-foreground">{t("imageEdit", { prompt: edit.prompt })}</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                 <p className="text-[11px] text-muted-foreground">{t("before")}</p>
                <img src={edit.before} alt="Original image" className="w-full rounded-lg border border-border" />
              </div>
              <div className="space-y-1">
                 <p className="text-[11px] text-muted-foreground">{t("after")}</p>
                <img src={edit.after} alt="AI se edit ki hui image" className="w-full rounded-lg border border-border" />
              </div>
            </div>
            <button
              type="button"
              onClick={() => void downloadDataUrl(edit.after, `noquit-ai-image-${edit.id.slice(0, 8)}.png`)}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1.5 text-xs text-secondary-foreground transition-colors hover:border-primary"
            >
               <Download className="h-3.5 w-3.5" /> {t("download")}
            </button>
          </div>
        ))}

        {(busy || editing) && (
          <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
            <Brain className="h-4 w-4 text-primary node-pulse" />{" "}
             {editing ? t("imageEditing") : t("aiThinking")}
          </div>
        )}
        {error && (
          <p className="px-1 text-xs text-destructive">
            {/credits|402|Payment Required|Not enough credits/i.test(error.message)
               ? t("aiCreditsEnded")
              : error.message}
          </p>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit(input);
        }}
        className="panel sticky bottom-0 flex flex-col gap-2 p-2"
      >
        {attached && (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/60 p-2">
             <img src={attached} alt={t("attachImage")} className="h-14 w-14 rounded-md object-cover" />
            <p className="flex-1 text-xs text-muted-foreground">
               {t("imageAttached")}
            </p>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => setAttached(null)}
               aria-label={t("removeImage")}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              void pickImage(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="shrink-0"
             aria-label={t("attachImage")}
            onClick={() => fileRef.current?.click()}
          >
            <ImagePlus className="h-4 w-4" />
          </Button>
          <Textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void submit(input);
              }
            }}
             placeholder={attached ? t("imageInstruction") : t("askNewQuestion")}
            rows={1}
            className="max-h-40 min-h-11 resize-none border-0 bg-transparent focus-visible:ring-0"
          />
          <button
            type="button"
            className="galaxy-orb h-10 w-10 shrink-0 hover:scale-105"
            aria-label="Voice chat"
            onClick={() => {
              if (!getSpeechRecognition()) {
                toast.error("Voice not supported in this browser");
                return;
              }
              setVoiceOpen(true);
            }}
          >
            <span className="galaxy-stars" />
            <Mic className="relative z-10 mx-auto h-4 w-4 text-primary-foreground" />
          </button>
          <Button
            type="submit"
            size="icon"
            disabled={busy || editing || (!attached && !input.trim())}
            className="glow shrink-0"
          >
            {busy || editing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
          </Button>
        </div>
      </form>

      {voiceOpen && (
        <VoiceModal
          lang={lang}
          onTranscript={setInput}
          ask={askByVoice}
          onClose={() => {
            voiceResolveRef.current?.("");
            voiceResolveRef.current = null;
            setVoiceOpen(false);
          }}
        />
      )}
    </div>
  );
}
