import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Github, GitBranch, GitMerge, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { chatGitHubConnection, startGitHubConnect, completeGitHubConnect, listGitHubRepos, selectGitHubRepo } from "@/lib/github.functions";
import { chatGitHubProposals, approveSelfUpdate, discardSelfUpdate, approveMainMerge, mainMergeCandidates } from "@/lib/self-update.functions";
import { updateChanges } from "@/lib/self-update-rules";

export function GitHubChatAction({ output, disabled, onConnected }: {
  output: Record<string, unknown>; disabled: boolean; onConnected: () => void;
}) {
  const { user } = useAuth();
  const statusFn = useServerFn(chatGitHubProposals), start = useServerFn(startGitHubConnect), complete = useServerFn(completeGitHubConnect);
  const list = useServerFn(listGitHubRepos), select = useServerFn(selectGitHubRepo), connectionFn = useServerFn(chatGitHubConnection);
  const merge = useServerFn(approveMainMerge), candidatesFn = useServerFn(mainMergeCandidates);
  const approve = useServerFn(approveSelfUpdate), discard = useServerFn(discardSelfUpdate);
  const previewId = typeof output['previewId'] === "string" ? output['previewId'] : null;
  const connection = output['chatAction'] === "github_connect";
  const account = useQuery({ queryKey: ["chat-github-connection", user?.id], queryFn: () => connectionFn(), enabled: !!user && connection });
  const status = useQuery({ queryKey: ["chat-github-review", user?.id, previewId], queryFn: () => statusFn(), enabled: !!user && !!previewId });
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [repos, setRepos] = useState<{ id: number; name: string; canPush: boolean }[]>([]);
  const [more, setMore] = useState(false), [page, setPage] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null), [ready, setReady] = useState(false);
  const [confirmMerge, setConfirmMerge] = useState(false);
  const proposal = status.data?.proposals.find(p => p.id === previewId);
  const candidates = useQuery({ queryKey: ["chat-github-merge", user?.id, proposal?.repo, previewId], queryFn: () => candidatesFn({ data: { repo: proposal?.repo ?? "" } }), enabled: !!user && proposal?.status === "pushed" });
  const mergeStatus = candidates.data?.find(p => p.id === previewId)?.mergeStatus;
  const connected = account.data?.connected ?? output['connected'] === true;
  useEffect(() => { if (account.data?.repo) setChosen(account.data.repo); }, [account.data?.repo]);
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
        await complete({ data: result }); setNotice("Connected to GitHub ✅"); await account.refetch(); await load();
      } finally { popup.close(); }
    });
  }
  const changes = updateChanges.safeParse(proposal?.changes);
  if (!connection && !previewId) return null;
  return <section aria-label="Chat GitHub action" className="my-3 min-w-0 space-y-3 border-y border-border py-3">
    {connection && !ready && <>
      <h3 className="font-semibold">{connected ? "Connected to GitHub ✅" : "Connect Your GitHub"}</h3>
      {account.isPending && <p className="text-sm text-muted-foreground">Connection check ho raha hai…</p>}
      {chosen && <p className="break-all text-sm text-primary">Selected repository: {chosen}</p>}
      <p className="text-sm">NO QUIT AI will only read your repos to help fix code. We will not delete anything without your permission.</p>
      <p className="text-xs text-muted-foreground">Reviewed code sirf Approve ke baad nayi branch mein jayega; main unchanged. AI review mein safe code AI service ko bheja jayega.</p>
      <div className="flex flex-wrap gap-2">
        {!connected && <Button disabled={busy || disabled || account.isPending} onClick={() => void connect()}><Github />Connect GitHub</Button>}
        {connected && <Button variant="outline" disabled={busy || disabled} onClick={() => void act(() => load())}><Github />Select repository</Button>}
      </div>
      <div className="max-h-60 overflow-auto">{repos.map(repo => <Button key={repo.id} variant={chosen === repo.name ? "secondary" : "ghost"} disabled={busy || !repo.canPush} onClick={() => setChosen(repo.name)} className="h-auto w-full justify-start whitespace-normal text-left"><Github className="shrink-0" /><span className="min-w-0 break-all">{repo.name}</span></Button>)}</div>
      {more && <Button variant="outline" disabled={busy} onClick={() => void act(() => load(page + 1))}>Load more</Button>}
      {connected && chosen && <><p className="break-all text-sm">{chosen} — is repo ko chat use karega?</p><Button disabled={busy || disabled} className="h-auto whitespace-normal" onClick={() => void act(async () => { const repo = chosen; await select({ data: { repo } }); await account.refetch(); setReady(true); setNotice("GitHub connected; repository confirmed ✅"); onConnected(); })}>Confirm repository & Continue</Button></>}
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
        {proposal.status === "pushed" && <div className="space-y-3"><p className="break-all text-sm text-primary">Nayi branch pushed ✅ {proposal.target_branch}</p><Button variant="outline" className="h-auto whitespace-normal" disabled={busy || disabled || candidates.isPending || mergeStatus !== null} onClick={() => setConfirmMerge(true)}><GitMerge />Confirm to Main Branch</Button>{mergeStatus === "merged" && <p role="status" className="text-sm text-primary">Main branch update ho gayi ✅</p>}{mergeStatus && mergeStatus !== "merged" && <p className="text-sm text-muted-foreground">Merge approval use ho chuki hai; automatic retry nahi hoga.</p>}{candidates.error && <p role="alert" className="text-sm text-destructive">Merge status load nahi hua.</p>}</div>}
      </>}
      {!status.isPending && !proposal && !status.error && <p className="text-sm text-muted-foreground">Preview unavailable for this account.</p>}
    </>}
    {busy && <Loader2 aria-label="GitHub working" className="h-4 w-4 animate-spin" />}
    {(error || status.error || account.error) && <p role="alert" className="break-words text-sm text-destructive">{error || (status.error instanceof Error ? status.error.message : account.error instanceof Error ? account.error.message : "Review unavailable.")}</p>}
    {notice && <p role="status" className="break-words text-sm text-primary">{notice}</p>}
    <Dialog open={confirmMerge} onOpenChange={open => { if (!busy) setConfirmMerge(open); }}><DialogContent><DialogHeader><DialogTitle>Main branch mein merge approve karein?</DialogTitle></DialogHeader><p className="break-all text-sm">{proposal?.repo}: {proposal?.target_branch} → main</p><p className="text-sm text-muted-foreground">Sirf reviewed code merge hoga. Connected hosting automatically deploy kar sakti hai; conflicts aur branch protection bypass nahi honge.</p><div className="flex flex-wrap gap-2"><Button disabled={busy || disabled || !proposal || mergeStatus !== null} onClick={() => { if (!proposal) return; setConfirmMerge(false); void act(async () => { try { await merge({ data: { id: proposal.id, repo: proposal.repo, confirmed: true } }); setNotice("Main branch update ho gayi ✅"); } finally { await candidates.refetch(); } }); }}><GitMerge />Approve & Merge To Main</Button><Button variant="outline" disabled={busy} onClick={() => setConfirmMerge(false)}>Cancel</Button></div></DialogContent></Dialog>
  </section>;
}