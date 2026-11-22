import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Code2, Copy, Download, ExternalLink, Gamepad2, Github, Globe, Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { getChatBuild, prepareBuildGitHub } from "@/lib/project-build.functions";
import { liveUrls } from "./BuildDomain";
import { GitHubChatAction } from "./GitHubChatAction";

export function ChatProjectCard({ memoryId, userId, disabled }: { memoryId: string; userId: string; disabled: boolean }) {
  const getBuild = useServerFn(getChatBuild), prepare = useServerFn(prepareBuildGitHub);
  const build = useQuery({ queryKey: ["chat-project", userId, memoryId], queryFn: () => getBuild({ data: { memoryId } }) });
  const [view, setView] = useState<"preview" | "code" | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [copied, setCopied] = useState(false);
  const [github, setGithub] = useState(false), [review, setReview] = useState<Record<string, unknown> | null>(null);
  const [confirmPublish, setConfirmPublish] = useState(false);
  async function act(action: () => Promise<void>) {
    setBusy(true); setError("");
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : "Action failed; dobara try karein."); } finally { setBusy(false); }
  }
  async function exportGitHub() {
    await act(async () => { const result = await prepare({ data: { memoryId } }); setReview(result); setGithub(false); });
  }
  function download() {
    if (!build.data) return;
    const url = URL.createObjectURL(new Blob([build.data.html], { type: "text/html;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "index.html"; a.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  if (build.isPending) return <p className="my-3 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Project load ho raha hai…</p>;
  if (!build.data) return <div className="my-3"><p role="alert" className="text-sm text-destructive">Project load nahi hua.</p><Button variant="outline" size="sm" onClick={() => void build.refetch()}>Retry</Button></div>;
  const project = build.data, url = project.subdomain ? liveUrls(project.subdomain).share : null;
  return <article aria-label={`Project: ${project.title}`} className="my-3 w-full min-w-0 max-w-2xl overflow-hidden rounded-lg border border-primary/30 bg-background">
    <div className="flex items-start gap-3 border-b border-border p-4"><Gamepad2 className="mt-1 h-6 w-6 shrink-0 text-primary" /><div className="min-w-0 flex-1"><h3 className="break-words font-semibold">{project.title}</h3><p className="mt-1 break-words text-sm text-muted-foreground">{project.summary}</p></div><span className="shrink-0 rounded border border-border px-2 py-1 text-[10px] text-primary">{url ? "LIVE" : "DRAFT"}</span></div>
    <div className="space-y-3 p-4">
      <div className="flex flex-wrap gap-2"><Button disabled={disabled} onClick={() => setView("preview")}><Play />Play / Live Preview</Button><Button variant="outline" onClick={() => setView("code")}><Code2 />Code</Button><Button variant="outline" title="Download index.html" aria-label="Download project code" onClick={download}><Download /><span className="hidden sm:inline">Download</span></Button></div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy || disabled} onClick={() => setConfirmPublish(true)}><Globe />{url ? "Publish Changes" : "Publish Live"}</Button><Button variant="outline" disabled={busy || disabled} onClick={() => setGithub(value => !value)}><Github />Push to GitHub</Button>{busy && <Loader2 className="h-5 w-5 animate-spin" />}</div>
      {url && <div role="status" className="flex min-w-0 flex-wrap items-center gap-2"><a className="min-w-0 flex-1 break-all text-sm text-primary underline" href={url} target="_blank" rel="noopener noreferrer">{url}</a><Button variant="ghost" size="icon" aria-label="Copy live link" title={copied ? "Copied" : "Copy live link"} onClick={() => void act(async () => { await navigator.clipboard.writeText(url); setCopied(true); })}><Copy /></Button><Button variant="ghost" size="icon" aria-label="Visit live project" onClick={() => window.open(url, "_blank", "noopener,noreferrer")}><ExternalLink /></Button>{copied && <span className="text-xs text-primary">Copied</span>}</div>}
      {github && <><GitHubChatAction output={{ chatAction: "github_connect" }} disabled={busy || disabled} onConnected={() => void exportGitHub()} /><Button disabled={busy || disabled} onClick={() => void exportGitHub()}><Code2 />Prepare Before / After</Button></>}
      {review && <GitHubChatAction output={review} disabled={busy || disabled} onConnected={() => {}} />}
      {error && <p role="alert" className="break-words text-sm text-destructive">{error}</p>}
    </div>
    <Dialog open={view !== null} onOpenChange={open => { if (!open) setView(null); }}><DialogContent className="flex h-[85dvh] w-[96vw] max-w-6xl flex-col gap-3 p-4"><DialogHeader className="shrink-0 pr-7"><DialogTitle className="break-words">{project.title}</DialogTitle><DialogDescription>{view === "code" ? "index.html" : "Play / Live Preview"}</DialogDescription></DialogHeader><div className="flex shrink-0 gap-2"><Button size="sm" variant={view === "preview" ? "default" : "outline"} onClick={() => setView("preview")}><Play />Play</Button><Button size="sm" variant={view === "code" ? "default" : "outline"} onClick={() => setView("code")}><Code2 />Code</Button><Button size="sm" variant="outline" aria-label="Download project code" onClick={download}><Download /></Button></div>{view === "preview" ? <iframe title={`${project.title} live preview`} srcDoc={project.html} sandbox="allow-scripts allow-pointer-lock" className="min-h-0 w-full flex-1 rounded border border-border bg-background" /> : <pre className="min-h-0 flex-1 overflow-auto rounded border border-border bg-secondary p-3 text-xs"><code>{project.html}</code></pre>}</DialogContent></Dialog>
    <Dialog open={confirmPublish} onOpenChange={setConfirmPublish}><DialogContent><DialogHeader><DialogTitle>Publish Live?</DialogTitle><DialogDescription>Ye project public hoga; link wala koi bhi dekh sakta hai.</DialogDescription></DialogHeader><p className="break-words text-sm">{project.title}</p><div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={() => void act(async () => { const result = await supabase.rpc("publish_build", { _build_id: memoryId }); if (result.error || !result.data) throw new Error("Publish nahi ho saka; draft safe hai."); await build.refetch(); setConfirmPublish(false); })}><Globe />Confirm Publish Live</Button><Button variant="outline" disabled={busy} onClick={() => setConfirmPublish(false)}>Cancel</Button></div>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</DialogContent></Dialog>
  </article>;
}