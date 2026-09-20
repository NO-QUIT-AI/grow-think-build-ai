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
  Plus,
  Sparkles,
  Trash2,
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

const TOOL_LABELS: Record<string, string> = {
  "tool-recall_knowledge": "Memory recall ki",
  "tool-save_knowledge": "Nayi seekh save ki",
  "tool-create_domains": "Domain names banaye",
  "tool-create_app_blueprint": "App blueprint banaya",
  "tool-build_website": "Website live banayi",
};

const SUGGESTIONS = [
  "Mujhe apne coffee brand ke liye domain bana do",
  "Ek expense tracker app ka pura structure bna do",
  "Mujhe ek professional CV bana do",
];

type Thread = { id: string; title: string; updated_at: string };

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
      const title = firstMessage.slice(0, 48) || "Naya chat";
      const { data: created, error } = await supabase
        .from("conversations")
        .insert({ user_id: userId, title })
        .select("id, title, updated_at")
        .single();
      if (error || !created) {
        toast.error("Chat save nahi ho saki");
        return null;
      }
      setThreads((prev) => [created as Thread, ...prev]);
      setConversationId(created.id);
      return created.id;
    },
    [userId],
  );

  async function deleteThread(id: string) {
    await supabase.from("messages").delete().eq("conversation_id", id);
    const { error } = await supabase.from("conversations").delete().eq("id", id);
    if (error) {
      toast.error("Chat delete nahi hui");
      return;
    }
    setThreads((prev) => prev.filter((t) => t.id !== id));
    if (conversationId === id) startNewChat();
    toast.success("Chat delete ho gayi");
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-2 flex items-center gap-2">
        <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" aria-label="Chat history">
              <Menu className="h-4 w-4" /> History
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[85vw] max-w-sm p-0">
            <SheetHeader className="border-b border-border px-4 py-3">
              <SheetTitle className="text-sm">Purani chats</SheetTitle>
            </SheetHeader>
            <div className="max-h-[calc(100vh-4rem)] overflow-y-auto p-2">
              {threads.length === 0 && (
                <p className="px-2 py-4 text-xs text-muted-foreground">Abhi koi chat save nahi hui</p>
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
                    aria-label="Chat delete karo"
                    onClick={() => void deleteThread(thread.id)}
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </SheetContent>
        </Sheet>

        <div className="flex-1" />

        <Button size="sm" className="btn-green gap-1.5 text-xs" onClick={startNewChat}>
          <Plus className="h-4 w-4" /> New Chat
        </Button>
      </div>

      {loadingThread ? (
        <div className="flex flex-1 items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Chat load ho rahi hai…
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
          onNewChat={startNewChat}
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
  onNewChat,
}: {
  userId: string;
  conversationId: string | null;
  ensureConversation: (firstMessage: string) => Promise<string | null>;
  initialMessages: UIMessage[];
  onWorkChanged: () => void;
  onTouched: (id: string) => void;
  onNewChat: () => void;
}) {
  const [input, setInput] = useState("");
  const [attached, setAttached] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [edits, setEdits] = useState<{ id: string; before: string; after: string; prompt: string }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const convRef = useRef<string | null>(conversationId);

  useEffect(() => {
    if (conversationId) convRef.current = conversationId;
  }, [conversationId]);

  async function pickImage(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Sirf image file bhejein");
      return;
    }
    if (file.size > 30 * 1024 * 1024) {
      toast.error("Image bohot bari hai (30MB se kam bhejein)");
      return;
    }
    try {
      setAttached(await compressImage(file));
    } catch {
      toast.error("Image load nahi ho saki, dobara try karein");
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
        body: JSON.stringify({ image: before, prompt: instruction }),
      });
      if (!res.ok) throw new Error((await res.text()) || "Image edit fail hui");
      const json = (await res.json()) as { image?: string };
      if (!json.image) throw new Error("Model ne image return nahi ki");
      setEdits((prev) => [
        ...prev,
        { id: crypto.randomUUID(), before, after: json.image!, prompt: instruction },
      ]);
      setAttached(null);
      toast.success("Image edit ho gayi");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Image edit fail hui");
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
        headers: async () => {
          const { data } = await supabase.auth.getSession();
          return { Authorization: `Bearer ${data.session?.access_token ?? ""}` };
        },
      }),
    [],
  );

  const { messages, sendMessage, status, error } = useChat({
    messages: initialMessages,
    transport,
    onFinish: async ({ message }) => {
      const text = messageText(message);
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
    onError: (err) => toast.error(err.message || "AI se jawab nahi mila"),
  });

  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function submit(text: string) {
    const value = text.trim();
    if (attached) {
      await runImageEdit(value || "Is image ko behtar, clean aur professional bana do.");
      return;
    }
    if (!value || busy) return;

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

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto px-1 pb-4">
        {messages.length === 0 && (
          <div className="panel p-5">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium">
              <Sparkles className="h-4 w-4 text-primary" /> NO QUIT AI taiyar hai
            </div>
            <p className="text-sm text-muted-foreground">
              Kya banana hai? Command do — website, app ya domain names:
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => submit(suggestion)}
                  className="rounded-full border border-border bg-secondary px-3 py-1.5 text-xs text-secondary-foreground transition-colors hover:border-primary"
                >
                  {suggestion}
                </button>
              ))}
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
                    {tools.map((part, index) => (
                      <span
                        key={`${message.id}-tool-${index}`}
                        className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground"
                      >
                        <Wrench className="h-3 w-3 text-accent" />
                        {TOOL_LABELS[part.type] ?? part.type.replace("tool-", "")}
                      </span>
                    ))}
                  </div>
                )}
                {text ? (
                  isUser ? (
                    <p className="whitespace-pre-wrap">{text}</p>
                  ) : (
                    <div className="space-y-3 text-sm leading-relaxed [&_a]:text-primary [&_code]:rounded [&_code]:bg-secondary [&_code]:px-1 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:font-semibold [&_li]:ml-4 [&_li]:list-disc [&_strong]:text-foreground">
                      <ReactMarkdown>{text}</ReactMarkdown>
                    </div>
                  )
                ) : (
                  <span className="text-xs text-muted-foreground">Soch rahi hoon…</span>
                )}
              </div>
            </div>
          );
        })}

        {edits.map((edit) => (
          <div key={edit.id} className="panel space-y-3 p-3">
            <p className="text-xs text-muted-foreground">Image edit: {edit.prompt}</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <p className="text-[11px] text-muted-foreground">Pehle</p>
                <img src={edit.before} alt="Original image" className="w-full rounded-lg border border-border" />
              </div>
              <div className="space-y-1">
                <p className="text-[11px] text-muted-foreground">Baad me</p>
                <img src={edit.after} alt="AI se edit ki hui image" className="w-full rounded-lg border border-border" />
              </div>
            </div>
            <button
              type="button"
              onClick={() => void downloadDataUrl(edit.after, `noquit-ai-image-${edit.id.slice(0, 8)}.png`)}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1.5 text-xs text-secondary-foreground transition-colors hover:border-primary"
            >
              <Download className="h-3.5 w-3.5" /> Download
            </button>
          </div>
        ))}

        {(busy || editing) && (
          <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
            <Brain className="h-4 w-4 text-primary node-pulse" />{" "}
            {editing ? "Image edit ho rahi hai…" : "NO QUIT AI soch rahi hai…"}
          </div>
        )}
        {error && (
          <p className="px-1 text-xs text-destructive">
            {/credits|402|Payment Required|Not enough credits/i.test(error.message)
              ? "AI credits khatam ho gaye hain. Lovable billing se credits add karo."
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
            <img src={attached} alt="Attach ki hui image" className="h-14 w-14 rounded-md object-cover" />
            <p className="flex-1 text-xs text-muted-foreground">
              Image attached — likho kya change karna hai, phir bhejo.
            </p>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => setAttached(null)}
              aria-label="Image hatao"
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
            aria-label="Image attach karo"
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
            placeholder={attached ? "Image me kya change karna hai…" : "Naya sawal pucho..."}
            rows={1}
            className="max-h-40 min-h-11 resize-none border-0 bg-transparent focus-visible:ring-0"
          />
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
    </div>
  );
}
