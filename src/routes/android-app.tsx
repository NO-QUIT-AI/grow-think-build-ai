import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { ArrowUp, Code2, Download, Loader2, LogOut, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/android-app")({
  head: () => ({
    meta: [
      { title: "NO QUIT AI - Build Studio | Android Workspace" },
      { name: "description", content: "Build and preview websites with NO QUIT AI, plus practical text tools. Android v1 workspace." },
      { property: "og:title", content: "NO QUIT AI - Build Studio" },
      { property: "og:description", content: "Your website builder and practical tools workspace." },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
      { name: "theme-color", content: "#050706" },
    ],
    links: [{ rel: "manifest", href: "/android/manifest.json" }],
  }),
  component: AndroidWorkspace,
});

function AndroidWorkspace() {
  const { user, loading, signOut } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [tab, setTab] = useState<"builder" | "builds" | "tools">("builder");
  const [prompt, setPrompt] = useState("");
  const [toolText, setToolText] = useState("");
  const [builds, setBuilds] = useState<{ id: string; prompt: string; code: string }[]>([]);
  const [selected, setSelected] = useState<{ id: string; prompt: string; code: string } | null>(null);
  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/chat", headers: async () => {
    const { data } = await supabase.auth.getSession();
    return { Authorization: `Bearer ${data.session?.access_token ?? ""}` };
  }, body: { product: "android-v1", lang: "en" } }), []);
  const { messages, sendMessage, status, error, stop } = useChat({ transport });
  const busy = status === "submitted" || status === "streaming";
  useEffect(() => {
    if (!user || busy) return;
    void supabase.from("memories").select("id,prompt,code").eq("user_id", user.id).eq("project_type", "website").order("created_at", { ascending: false }).limit(30).then(({ data }) => { setBuilds(data ?? []); });
  }, [user?.id, busy]);
  async function login() {
    setAuthBusy(true); setAuthError("");
    try { const { error } = await supabase.auth.signInWithPassword({ email, password }); if (error) setAuthError(error.message); }
    catch { setAuthError("Unable to connect. Please try again."); }
    finally { setAuthBusy(false); }
  }
  function downloadBuild() {
    if (!selected) return;
    const url = URL.createObjectURL(new Blob([selected.code], { type: "text/html" }));
    const link = document.createElement("a"); link.href = url; link.download = "noquit-website.html"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  return <main className="android-page flex min-h-dvh flex-col bg-background text-foreground">
    <header className="flex items-center gap-3 border-b border-border px-4 py-4">
      <img src="/android/icon-192.png" width="40" height="40" alt="NQ" className="rounded-lg" />
      <div className="min-w-0"><h1 className="text-lg font-bold">NO QUIT AI</h1><p className="text-xs text-muted-foreground">Build Studio</p></div>
      {user && <Button className="ml-auto" variant="ghost" size="icon" title="Sign out" onClick={() => void signOut()}><LogOut className="h-4 w-4" /></Button>}
    </header>
    {loading ? <div className="flex flex-1 items-center justify-center"><Loader2 className="animate-spin" aria-label="Loading" /></div> : !user ?
      <section className="mx-auto w-full max-w-md space-y-5 px-6 py-12"><h2 className="text-2xl font-bold">Your next website starts here.</h2><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void login(); }}>
        <Input type="email" aria-label="Email" placeholder="Email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        <Input type="password" aria-label="Password" placeholder="Password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
        {authError && <p role="alert" className="text-sm text-destructive">{authError}</p>}
        <Button disabled={authBusy} className="w-full">{authBusy ? "Signing in…" : "Sign in"}</Button>
      </form><p className="text-sm text-muted-foreground">Use your existing NO QUIT AI account.</p><Button variant="outline" className="w-full" onClick={() => setTab("tools")}><Wrench className="mr-2 h-4 w-4" />Open text tools</Button></section> :
      <nav aria-label="Workspace" className="flex gap-2 border-b border-border p-3">{(["builder", "builds", "tools"] as const).map((item) => <Button key={item} variant={tab === item ? "default" : "ghost"} onClick={() => setTab(item)}>{item === "builder" ? "Builder" : item === "builds" ? "My Websites" : "Tools"}</Button>)}</nav>}
    {tab === "tools" ? <section className="mx-auto w-full max-w-3xl space-y-4 p-5"><h2 className="text-xl font-bold">Text tools</h2><Textarea aria-label="Tool text" rows={8} value={toolText} onChange={(event) => setToolText(event.target.value)} /><p className="text-sm text-muted-foreground">{toolText.trim() ? toolText.trim().split(/\s+/).length : 0} words · {toolText.length} characters</p><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setToolText(toolText.toUpperCase())}>UPPERCASE</Button><Button variant="outline" onClick={() => setToolText(toolText.toLowerCase())}>lowercase</Button><Button variant="outline" onClick={() => setToolText(toolText.replace(/\s+/g, " ").trim())}>Clean spaces</Button></div></section> : user && tab === "builder" ?
      <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col p-4"><div className="flex-1 space-y-5 py-5">{messages.length === 0 && <div className="py-8"><Code2 className="mb-5 h-9 w-9 text-primary" /><h2 className="text-2xl font-bold">What shall we build?</h2><div className="mt-5 flex flex-wrap gap-2">{["Build a cafe website", "Create my portfolio", "Suggest a domain name"].map((text) => <Button key={text} variant="outline" onClick={() => setPrompt(text)}>{text}</Button>)}</div></div>}
      {messages.map((message) => <div key={message.id} className="space-y-2"><p className="text-xs font-semibold text-primary">{message.role === "user" ? "You" : "NO QUIT AI"}</p>{message.parts.map((part, index) => part.type === "text" ? <p key={index} className="whitespace-pre-wrap break-words text-sm leading-7">{part.text}</p> : part.type.startsWith("tool-") ? <p key={index} className="text-sm text-muted-foreground">{part.type.replace("tool-", "").replaceAll("_", " ")}</p> : null)}</div>)}
      {error && <p role="alert" className="text-sm text-destructive">The request failed. Check your connection and try again.</p>}</div>
      <form className="flex gap-2 pb-5" onSubmit={(event) => { event.preventDefault(); if (!prompt.trim() || busy) return; void sendMessage({ text: prompt.trim() }); setPrompt(""); }}><Textarea aria-label="Website idea" placeholder="Describe your website…" value={prompt} onChange={(event) => setPrompt(event.target.value)} className="min-w-0 flex-1" />{busy ? <Button type="button" variant="outline" onClick={() => void stop()}>Stop</Button> : <Button size="icon" title="Build website" disabled={!prompt.trim()}><ArrowUp className="h-5 w-5" /></Button>}</form></section> : user && tab === "builds" ?
      <section className="space-y-4 p-4">{selected ? <><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setSelected(null)}>Back to websites</Button><Button onClick={downloadBuild}><Download className="mr-2 h-4 w-4" />HTML</Button></div><iframe title="Website preview" srcDoc={selected.code} sandbox="allow-scripts" referrerPolicy="no-referrer" className="h-[65dvh] w-full border border-border bg-card" /></> : builds.length ? builds.map((build) => <Button key={build.id} className="h-auto w-full justify-start whitespace-normal py-4 text-left" variant="outline" onClick={() => setSelected(build)}>{build.prompt}</Button>) : <p className="py-10 text-center text-muted-foreground">No websites yet.</p>}</section> : null}
    <footer className="mt-auto border-t border-border p-4 text-center text-xs text-muted-foreground"><a href="https://noquitai.com/privacy" target="_blank" rel="noreferrer">Privacy</a><span className="mx-3">·</span><a href="https://noquitai.com/contact" target="_blank" rel="noreferrer">Support & account deletion</a></footer>
  </main>;
}