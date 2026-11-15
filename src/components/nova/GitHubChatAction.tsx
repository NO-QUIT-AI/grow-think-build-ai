import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Github, GitBranch, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { startGitHubConnect, completeGitHubConnect, listGitHubRepos, selectGitHubRepo } from "@/lib/github.functions";
import { selfUpdateStatus, bindSelfRepo, approveSelfUpdate, discardSelfUpdate } from "@/lib/self-update.functions";
import { updateChanges } from "@/lib/self-update-rules";

export function GitHubChatAction({ output, disabled, onConnected }: {
  output: Record<string, unknown>; disabled: boolean; onConnected: () => void;
}) {
  const { user } = useAuth();
  const statusFn = useServerFn(selfUpdateStatus), start = useServerFn(startGitHubConnect), complete = useServerFn(completeGitHubConnect);
  const list = useServerFn(listGitHubRepos), select = useServerFn(selectGitHubRepo), bind = useServerFn(bindSelfRepo);
  const approve = useServerFn(approveSelfUpdate), discard = useServerFn(discardSelfUpdate);
  const previewId = typeof output.previewId === "string" ? output.previewId : null;
  const connection = output.chatAction === "github_connect";
  const status = useQuery({ queryKey: ["chat-github-review", user?.id, previewId], queryFn: () => statusFn(), enabled: !!user && !!previewId });
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [repos, setRepos] = useState<{ id: number; name: string; canPush: boolean }[]>([]);
  const [more, setMore] = useState(false), [page, setPage] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null), [ready, setReady] = useState(false);
  async function act(action: () => Promise<void>) {
    setBusy(true); setError("");
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : "GitHub request failed."); } finally { setBusy(false); }
  }
  async function load(next = 1) {
    const result = await list({ data: { page: next } });
    setRepos(old => next === 1 ? result.repos : [...old, ...result.repos]); setPage(next); setMore(result.hasMore);
  }
  async function connect() {
    const popup = window.open("", "nqai-chat-github", "width=600,height=720");
    if (!popup) { setError("Popups allow karein phir Connect dabayein."); return; }
    await act(async () => {
      try {
        const started = await start();
        const result = await new Promise<{ code: string; nonce: string }>((resolve, reject) => {
          const cleanup = () => { window.removeEventListener("message", onMessage); window.clearInterval(poll); window.clearTimeout(timeout); };
          const onMessage = (event: MessageEvent) => {
            if (event.origin !== window.location.origin || event.source !== popup || event.data?.connectorId !== "github") return;
            if (event.data.type !== "github-complete" && event.data.type !== "github-failed") return;
            cleanup();
            if (event.data.type === "github-complete" && typeof event.data.code === "string" && typeof event.data.nonce === "string") resolve({ code: event.data.code, nonce: event.data.nonce });
            else reject(new Error("GitHub permission nahi mili."));
          };
          window.addEventListener("message", onMessage);
          const poll = window.setInterval(() => { if (popup.closed) { cleanup(); reject(new Error("Permission window close ho gayi.")); } }, 500);
          const timeout = window.setTimeout(() => { cleanup(); reject(new Error("Permission timed out.")); }, 300000);
          popup.location.href = started.authorizationUrl;
        });
        await complete({ data: result }); setNotice("Connected to GitHub ✅"); await load();
      } finally { popup.close(); }
    });
  }
  const proposal = status.data?.proposals.find(p => p.id === previewId);
  const changes = updateChanges.safeParse(proposal?.changes);
  if (!connection && !previewId) return null;
  return <section aria-label="Chat GitHub action" className="my-3 min-w-0 space-y-3 border-y border-border py-3">
    {connection && !ready && <>
      <p className="text-sm">NO QUIT AI will only read your repos to help fix code. We will not delete anything without your permission.</p>
      <p className="text-xs text-muted-foreground">Reviewed code sirf Approve ke baad nayi branch mein jayega; main unchanged. AI review mein safe code AI service ko bheja jayega.</p>
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy || disabled} onClick={() => void connect()}><Github />{output.connected ? "Reconnect GitHub" : "Connect GitHub"}</Button>
        {output.connected === true && <Button variant="outline" disabled={busy || disabled} onClick={() => void act(() => load())}>Select repository</Button>}
      </div>
      <div className="max-h-60 overflow-auto">{repos.map(repo => <Button key={repo.id} variant={chosen === repo.name ? "secondary" : "ghost"} disabled={busy || !repo.canPush} onClick={() => setChosen(repo.name)} className="h-auto w-full justify-start whitespace-normal text-left"><Github className="shrink-0" /><span className="min-w-0 break-all">{repo.name}</span></Button>)}</div>
      {more && <Button variant="outline" disabled={busy} onClick={() => void act(() => load(page + 1))}>Load more</Button>}
      {chosen && <><p className="break-all text-sm">{chosen} — ye NO QUIT AI ka apna source repo hai?</p><Button disabled={busy || disabled} className="h-auto whitespace-normal" onClick={() => void act(async () => { const repo = chosen; await select({ data: { repo } }); await bind({ data: { repo, confirmed: true } }); setReady(true); setNotice("GitHub connected; own repository confirmed ✅"); onConnected(); })}>Confirm own repository & Continue</Button></>}
    </>}
    {previewId && <>
      {status.isPending && <p className="text-sm">Before / After load ho raha hai…</p>}
      {proposal && changes.success && <>
        <h3 className="font-semibold">Before / After</h3>
        <p className="whitespace-pre-wrap text-sm">{proposal.summary}</p>
        <p className="break-all text-xs text-primary">{proposal.repo} · {proposal.target_branch}</p>
        {changes.data.map(change => <div key={change.path} className="min-w-0 space-y-2">
          <p className="break-all text-sm font-medium">{change.path}</p>
          <div className="grid min-w-0 gap-2 md:grid-cols-2">{[{ label: "Before", code: change.before }, { label: "After", code: change.after }].map(value => <div key={value.label} className="min-w-0 overflow-hidden rounded-md border border-border"><p className="border-b border-border p-2 text-xs">{value.label}</p><pre className="max-h-64 overflow-auto bg-secondary/40 p-2 text-xs"><code>{value.code || "New file"}</code></pre></div>)}</div>
        </div>)}
        {proposal.status === "pending" ? <><p className="text-xs text-muted-foreground">Approve karne se sirf ye reviewed changes nayi branch mein push honge. Main untouched; merge/publish nahi hoga. Tests run nahi hue.</p><div className="flex flex-wrap gap-2"><Button disabled={busy || disabled} className="h-auto whitespace-normal" onClick={() => void act(async () => { const result = await approve({ data: { id: proposal.id, confirmed: true } }); setNotice(`Nayi branch pushed ✅ ${result.branch}. Main unchanged.`); await status.refetch(); })}><GitBranch />Approve & Push New Branch</Button><Button variant="outline" disabled={busy || disabled} onClick={() => void act(async () => { await discard({ data: { id: proposal.id } }); await status.refetch(); })}>Discard</Button></div></> : <p className="text-sm">Status: {proposal.status}</p>}
        {proposal.status === "pushed" && <Button asChild variant="outline"><a href={`https://github.com/${proposal.repo}/compare/${encodeURIComponent(proposal.base_branch)}...${encodeURIComponent(proposal.target_branch)}`} target="_blank" rel="noopener noreferrer">View new branch</a></Button>}
      </>}
      {!status.isPending && !proposal && !status.error && <p className="text-sm text-muted-foreground">Preview unavailable for this account.</p>}
    </>}
    {busy && <Loader2 aria-label="GitHub working" className="h-4 w-4 animate-spin" />}
    {(error || status.error) && <p role="alert" className="break-words text-sm text-destructive">{error || (status.error instanceof Error ? status.error.message : "Review unavailable.")}</p>}
    {notice && <p role="status" className="break-words text-sm text-primary">{notice}</p>}
  </section>;
}