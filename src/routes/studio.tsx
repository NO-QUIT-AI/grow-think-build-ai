import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/studio")({
  head: () => ({
    meta: [
      { title: "Local Studio — NO QUIT AI (Ollama)" },
      { name: "description", content: "Chat with NO QUIT AI using your own free, offline Ollama model." },
      { property: "og:title", content: "Local Studio — NO QUIT AI" },
      { property: "og:description", content: "Free, offline, unlimited AI chat powered by Ollama on your own computer." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StudioPage,
});

type Msg = { role: "user" | "assistant" | "system"; content: string };
const HOST_KEY = "nqai_ollama_host";
const MODEL_KEY = "nqai_ollama_model";
const SYSTEM: Msg = {
  role: "system",
  content: "You are NO QUIT AI, a smart, friendly desi brother. Reply short and helpful, in the user's language (Roman Urdu/Hinglish ok).",
};

function StudioPage() {
  const [host, setHost] = useState("http://localhost:11434");
  const [model, setModel] = useState("llama3");
  const [models, setModels] = useState<string[]>([]);
  const [online, setOnline] = useState<boolean | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHost(localStorage.getItem(HOST_KEY) || "http://localhost:11434");
    setModel(localStorage.getItem(MODEL_KEY) || "llama3");
  }, []);

  async function check(h = host) {
    try {
      const r = await fetch(`${h.replace(/\/$/, "")}/api/tags`);
      if (!r.ok) throw new Error();
      const d = (await r.json()) as { models?: { name: string }[] };
      const names = (d.models ?? []).map((m) => m.name);
      setModels(names);
      setOnline(true);
      if (names.length && !names.some((n) => n.startsWith(model))) setModel(names[0]!);
    } catch {
      setOnline(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(() => void check(host), 300);
    localStorage.setItem(HOST_KEY, host);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host]);

  useEffect(() => localStorage.setItem(MODEL_KEY, model), [model]);
  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [msgs]);

  async function send() {
    const q = input.trim();
    if (!q || busy) return;
    setInput("");
    const next: Msg[] = [...msgs, { role: "user", content: q }];
    setMsgs([...next, { role: "assistant", content: "" }]);
    setBusy(true);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const r = await fetch(`${host.replace(/\/$/, "")}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, stream: true, messages: [SYSTEM, ...next.slice(-20)] }),
        signal: ac.signal,
      });
      if (!r.ok || !r.body) throw new Error(r.status === 404 ? `Model "${model}" nahi mila. Terminal me: ollama pull ${model}` : `Ollama error ${r.status}`);
      setOnline(true);
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let text = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const j = JSON.parse(line) as { message?: { content?: string }; error?: string };
            if (j.error) throw new Error(j.error);
            text += j.message?.content ?? "";
            setMsgs([...next, { role: "assistant", content: text }]);
          } catch (e) {
            if (e instanceof Error && !(e instanceof SyntaxError)) throw e;
          }
        }
      }
    } catch (e) {
      if (ac.signal.aborted) return;
      const isNet = e instanceof TypeError;
      if (isNet) setOnline(false);
      setMsgs([...next, { role: "assistant", content: isNet ? "⚠️ Ollama is not running, please start Ollama." : `⚠️ ${(e as Error).message}` }]);
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        <Link to="/" className="font-bold">NO QUIT <span className="text-primary">AI</span></Link>
        <span className="text-sm text-muted-foreground">Local Studio · Ollama</span>
        <span className={`ml-auto flex items-center gap-2 text-xs ${online ? "text-primary" : "text-destructive"}`}>
          <span className={`h-2 w-2 rounded-full ${online ? "bg-primary" : "bg-destructive"}`} />
          {online === null ? "Checking..." : online ? "Ollama connected" : "Ollama offline"}
        </span>
      </header>

      <div className="flex flex-wrap gap-2 border-b border-border px-4 py-2 text-sm">
        <input value={host} onChange={(e) => setHost(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-border bg-card px-3 py-2" aria-label="Ollama host" />
        {models.length ? (
          <select value={model} onChange={(e) => setModel(e.target.value)} className="rounded-lg border border-border bg-card px-3 py-2" aria-label="Model">
            {models.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        ) : (
          <input value={model} onChange={(e) => setModel(e.target.value)} className="w-32 rounded-lg border border-border bg-card px-3 py-2" aria-label="Model" />
        )}
        <button onClick={() => void check()} className="rounded-lg border border-border px-3 py-2">Retry</button>
      </div>

      {online === false && (
        <div className="m-4 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <p className="font-semibold">Ollama is not running, please start Ollama.</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
            <li>Install: <a className="text-primary underline" href="https://ollama.com/download" target="_blank" rel="noreferrer">ollama.com/download</a></li>
            <li>Model lo: <code>ollama pull llama3</code></li>
            <li>Is site ko allow karo, phir Ollama chalao: <code>OLLAMA_ORIGINS=* ollama serve</code></li>
          </ol>
        </div>
      )}

      <main className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {msgs.length === 0 && <p className="pt-16 text-center text-muted-foreground">Apne computer ka AI — free, offline, unlimited. Kuch bhi poocho.</p>}
        {msgs.map((m, i) => (
          <div key={i} className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 ${m.role === "user" ? "ml-auto bg-primary text-primary-foreground" : "bg-card"}`}>
            {m.content || (busy && i === msgs.length - 1 ? "Soch raha hoon..." : "")}
          </div>
        ))}
        <div ref={endRef} />
      </main>

      <form onSubmit={(e) => { e.preventDefault(); void send(); }} className="flex gap-2 border-t border-border p-3">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Message NO QUIT AI..." className="min-w-0 flex-1 rounded-xl border border-border bg-card px-4 py-3" />
        {busy ? (
          <button type="button" onClick={() => abortRef.current?.abort()} className="rounded-xl border border-border px-4">Stop</button>
        ) : (
          <button className="rounded-xl bg-primary px-5 font-semibold text-primary-foreground">Send</button>
        )}
      </form>
    </div>
  );
}
