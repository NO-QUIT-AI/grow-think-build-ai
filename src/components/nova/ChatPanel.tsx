import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, Brain, Download, ImagePlus, Loader2, Sparkles, Wrench, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
  "Yaad rakho: main Roman Urdu me baat karta hoon",
];

function messageText(message: UIMessage) {
  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
    .trim();
}

export function ChatPanel({
  userId,
  onWorkChanged,
}: {
  userId: string;
  onWorkChanged: () => void;
}) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [initialMessages, setInitialMessages] = useState<UIMessage[] | null>(null);
  const [input, setInput] = useState("");
  const [attached, setAttached] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [edits, setEdits] = useState<{ id: string; before: string; after: string; prompt: string }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  function pickImage(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Sirf image file bhejein");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image 8MB se chhoti honi chahiye");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAttached(String(reader.result));
    reader.readAsDataURL(file);
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



  useEffect(() => {
    let active = true;
    (async () => {
      const { data: existing } = await supabase
        .from("conversations")
        .select("id")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let id = existing?.id ?? null;
      if (!id) {
        const { data: created, error } = await supabase
          .from("conversations")
          .insert({ user_id: userId, title: "NO QUIT AI thread" })
          .select("id")
          .single();
        if (error) {
          toast.error("Thread nahi ban saka");
          return;
        }
        id = created.id;
      }

      const { data: rows } = await supabase
        .from("messages")
        .select("id, role, content")
        .eq("conversation_id", id)
        .order("created_at", { ascending: true });

      if (!active) return;
      setConversationId(id);
      setInitialMessages(
        (rows ?? []).map((row) => ({
          id: row.id,
          role: row.role as UIMessage["role"],
          parts: [{ type: "text" as const, text: row.content }],
        })),
      );
    })();
    return () => {
      active = false;
    };
  }, [userId]);

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
    id: conversationId ?? "pending",
    messages: initialMessages ?? [],
    transport,
    onFinish: async ({ message }) => {
      if (!conversationId) return;
      const text = messageText(message);
      if (!text) return;
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        user_id: userId,
        role: "assistant",
        content: text,
      });
      await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", conversationId);
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
    if (!value || busy || !conversationId) return;

    setInput("");
    await supabase.from("messages").insert({
      conversation_id: conversationId,
      user_id: userId,
      role: "user",
      content: value,
    });
    void sendMessage({ text: value });
  }

  if (!initialMessages) {
    return (
      <div className="flex flex-1 items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Memory load ho rahi hai…
      </div>
    );
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
              Main har baat se seekhti hoon aur apni memory khud grow karti hoon. Kuch aisa poochho:
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
            <a
              href={edit.after}
              download={`noquit-ai-image-${edit.id.slice(0, 8)}.png`}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1.5 text-xs text-secondary-foreground transition-colors hover:border-primary"
            >
              <Download className="h-3.5 w-3.5" /> Download
            </a>
          </div>
        ))}

        {(busy || editing) && (
          <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
            <Brain className="h-4 w-4 text-primary node-pulse" />{" "}
            {editing ? "Image edit ho rahi hai…" : "NO QUIT AI soch rahi hai aur seekh rahi hai…"}
          </div>
        )}
        {error && <p className="px-1 text-xs text-destructive">{error.message}</p>}
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
              pickImage(event.target.files?.[0]);
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
            placeholder={attached ? "Image me kya change karna hai…" : "NO QUIT AI se kuch bhi poochho…"}
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
