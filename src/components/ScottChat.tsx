import { useState, useRef, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Send, Loader2, HeartHandshake, Radar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getScottHistory, talkToScott } from "@/lib/scott.functions";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "@tanstack/react-router";

const COPY = {
  scott: { name: "Scott", title: "Scott — Your Coach", sub: "Bhai, aaj dil mein kya chal raha hai?", empty: "Bhai, main Scott hoon. Apna goal ya jo mushkil aa rahi hai batao—one step at a time.", ph: "Bhai, main quit karna chahta hoon…", Icon: HeartHandshake },
  scout: { name: "Scout", title: "Scout — Research Agent", sub: "Ideas, plans aur clients dhoondne ke liye.", empty: "Bhai, aaj kya scout karna hai?", ph: "Masalan: Lahore mein web design clients kaise dhoondun?", Icon: Radar },
} as const;

export function ScottChat({ agent = "scott" }: { agent?: "scott" | "scout" }) {
  const c = COPY[agent];
  const { user, loading } = useAuth();
  const history = useServerFn(getScottHistory);
  const talk = useServerFn(talkToScott);
  const queryClient = useQueryClient();
  const { data: messages = [], isPending, error: loadError } = useQuery({ queryKey: ["scott-chat", agent, user?.id], queryFn: () => history({ data: { agent } }), enabled: !!user });
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [messages, busy]);
  async function send() {
    const message = input.trim();
    if (!message || busy || !user) return;
    setBusy(true); setError("");
    try {
      await talk({ data: { message, agent } });
      setInput("");
      await queryClient.invalidateQueries({ queryKey: ["scott-chat", agent, user.id] });
    } catch (e) { setError(e instanceof Error ? e.message : "Connection nahi hua; dobara try karein."); }
    finally { setBusy(false); }
  }
  if (loading) return <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />;
  if (!user) return <Link to="/auth" className="text-primary">{c.name} se baat karne ke liye sign in karein</Link>;
  return <section className="mx-auto flex h-[70dvh] min-h-96 max-w-3xl flex-col">
    <div className="mb-4 flex items-center gap-3"><c.Icon className="h-8 w-8 text-primary" /><div><h1 className="text-xl font-semibold">{c.title}</h1><p className="text-sm text-muted-foreground">{c.sub}</p></div></div>
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-4" role="log" aria-label={`${c.name} conversation`}>
      {isPending && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
      {!isPending && !messages.length && <p className="text-lg text-muted-foreground">{c.empty}</p>}
      {messages.map(message => <div key={message.id} className={`max-w-[90%] whitespace-pre-wrap break-words rounded-lg px-4 py-3 ${message.role === "user" ? "ml-auto bg-primary/15 text-foreground" : "mr-auto bg-secondary text-foreground"}`}><p className="mb-1 text-xs font-medium text-muted-foreground">{message.role === "user" ? "You" : c.name}</p>{message.content}</div>)}
      {busy && <p className="flex items-center gap-2 text-sm text-primary"><Loader2 className="h-4 w-4 animate-spin" />{c.name} soch raha hai…</p>}
      <div ref={end} />
    </div>
    {(error || loadError) && <p role="alert" className="py-2 text-sm text-destructive">{error || "Purani chat load nahi hui; page dobara kholein."}</p>}
    <form onSubmit={e => { e.preventDefault(); void send(); }} className="flex items-end gap-2 border-t border-border pt-3">
      <Textarea aria-label={`Message ${c.name}`} placeholder={c.ph} value={input} onChange={e => setInput(e.target.value)} rows={3} maxLength={6000} disabled={busy} className="min-w-0 flex-1 resize-none" onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }} />
      <Button type="submit" size="icon" aria-label={`Send to ${c.name}`} disabled={busy || !input.trim()}><Send className="h-4 w-4" /></Button>
    </form>
  </section>;
}