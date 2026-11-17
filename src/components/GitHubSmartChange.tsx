import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Sparkles, GitBranch, FileSearch, GitMerge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { smartChangeRequest, approveSelfUpdate, discardSelfUpdate, approveMainMerge, mainMergeCandidates } from "@/lib/self-update.functions";

type Result = { previewId: string; branch: string; summary: string; found: string[]; changes: { path: string; before: string; after: string }[] };

export function GitHubSmartChange({ repo, canPush }: { repo: string; canPush: boolean }) {
  const prepare = useServerFn(smartChangeRequest), approve = useServerFn(approveSelfUpdate), discard = useServerFn(discardSelfUpdate);
  const merge = useServerFn(approveMainMerge), candidatesFn = useServerFn(mainMergeCandidates), queryClient = useQueryClient();
  const candidates = useQuery({ queryKey: ["github-main-merges", repo], queryFn: () => candidatesFn({ data: { repo } }) });
  const [selectedId, setSelectedId] = useState(""), [confirmMerge, setConfirmMerge] = useState(false);
  const [merged, setMerged] = useState<{ branch: string; url: string } | null>(null);
  const selected = candidates.data?.find(p => p.id === selectedId) ?? candidates.data?.[0];
  const [text, setText] = useState(""), [busy, setBusy] = useState(""), [error, setError] = useState(""), [done, setDone] = useState<{ branch: string; url: string } | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  async function run(label: string, fn: () => Promise<void>) { setBusy(label); setError(""); try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : "Request complete nahi hui."); } finally { setBusy(""); } }
  return <section className="mb-4 rounded-lg border border-primary/40 p-4">
    <h3 className="mb-2 font-semibold">Kya Change Karna Hai? Yahan Likho</h3>
    <Textarea aria-label="Change request" rows={4} value={text} onChange={e => setText(e.target.value)} placeholder={'Jaise: Home page ka title badal do, ya "Naya button add karo"'} />
    <Button className="mt-3 h-auto min-h-9 whitespace-normal" disabled={!!busy || text.trim().length < 5 || !canPush} onClick={() => void run("Repo mein file dhoond raha hoon…", async () => { setDone(null); setResult(null); setResult(await prepare({ data: { repo, request: text } }) as Result); })}><Sparkles />Change Karo - File Khud Dhoondo</Button>
    {!canPush && <p className="mt-2 text-sm text-muted-foreground">Is repo par write permission nahi.</p>}
    {busy && <p className="mt-3 flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin text-primary" />{busy}</p>}
    {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
    {done && <p className="mt-3 break-all text-sm text-primary">Nayi branch push ho gayi ✅ {done.branch} — <a className="underline" href={done.url} target="_blank" rel="noreferrer">GitHub par dekho</a>. Main merge ke liye alag approval chahiye.</p>}
    {result && <div className="mt-4 min-w-0">
      {result.found.length ? <div className="mb-3"><p className="flex items-center gap-2 font-medium text-primary"><FileSearch className="h-4 w-4" />Mila! Ye file hai:</p>{result.found.map(p => <p key={p} className="break-all font-mono text-sm">{p}</p>)}</div> : <p className="mb-3 text-sm text-muted-foreground">Koi file nahi mili ya change ki zaroorat nahi.</p>}
      <p className="mb-3 text-sm text-muted-foreground">{result.summary}</p>
      {result.changes.map(c => <div key={c.path} className="mb-3 grid min-w-0 gap-2 md:grid-cols-2"><div className="min-w-0 rounded-lg border border-border"><p className="break-all px-3 py-2 text-sm">Before — {c.path}</p><pre className="max-h-80 overflow-auto bg-secondary/40 p-3 text-xs">{c.before || "(nayi file)"}</pre></div><div className="min-w-0 rounded-lg border border-primary/40"><p className="break-all px-3 py-2 text-sm text-primary">After — {c.path}</p><pre className="max-h-80 overflow-auto bg-secondary/40 p-3 text-xs">{c.after}</pre></div></div>)}
      {result.changes.length > 0 && <div className="flex flex-wrap gap-2"><Button disabled={!!busy} onClick={() => void run("Nayi branch push ho rahi hai…", async () => { const r = await approve({ data: { id: result.previewId, confirmed: true } }); setDone(r); setSelectedId(result.previewId); setMerged(null); setResult(null); await queryClient.invalidateQueries({ queryKey: ["github-main-merges", repo] }); })}><GitBranch />Approve & Push New Branch</Button><Button variant="outline" disabled={!!busy} onClick={() => void run("Discard…", async () => { await discard({ data: { id: result.previewId } }); setResult(null); })}>Discard</Button></div>}
      <p className="mt-2 text-xs text-muted-foreground">Branch: {result.branch} · Main branch safe rahegi · tests run nahi hue.</p>
    </div>}
    {!result && selected && <div className="mt-4 min-w-0 border-t border-border pt-4">
      <label className="mb-2 block text-sm font-medium" htmlFor="main-merge-branch">Selected GitHub branch</label>
      <select id="main-merge-branch" className="mb-3 w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" value={selected.id} disabled={!!busy} onChange={e => { setSelectedId(e.target.value); setMerged(null); }}>
        {candidates.data?.map(p => <option key={p.id} value={p.id}>{p.branch}</option>)}
      </select>
      <Button className="h-auto min-h-9 whitespace-normal" variant="outline" disabled={!!busy || !canPush || selected.mergeStatus !== null} onClick={() => setConfirmMerge(true)}><GitMerge />Push This To Main Branch</Button>
      {(merged || selected.mergeStatus === "merged") && <p role="status" className="mt-3 break-all text-sm text-primary">Main branch update ho gayi ✅ — <a className="underline" href={merged?.url ?? `https://github.com/${repo}/tree/main`} target="_blank" rel="noreferrer">Main par dekho</a></p>}
      {selected.mergeStatus && selected.mergeStatus !== "merged" && <p role="status" className="mt-3 text-sm text-muted-foreground">Merge approval use ho chuki hai; GitHub par result check karein. Dobara automatic merge nahi hoga.</p>}
    </div>}
    {candidates.error && <p className="mt-3 text-sm text-destructive">Pushed branches load nahi hui; page dobara kholein.</p>}
    <Dialog open={confirmMerge} onOpenChange={open => { if (!busy) setConfirmMerge(open); }}>
      <DialogContent className="min-w-0">
        <DialogHeader><DialogTitle>Main branch mein merge approve karein?</DialogTitle></DialogHeader>
        <p className="break-all text-sm">{repo}: {selected?.branch} → main</p>
        <p className="text-sm text-muted-foreground">Reviewed code main mein jayega. Connected hosting automatically deploy kar sakti hai. Conflicts ya GitHub protection bypass nahi honge.</p>
        <div className="flex flex-wrap gap-2"><Button disabled={!!busy || !selected} onClick={() => { if (!selected) return; const id = selected.id; setConfirmMerge(false); void run("Main mein merge ho raha hai…", async () => { try { setMerged(await merge({ data: { id, repo, confirmed: true } })); } finally { await queryClient.invalidateQueries({ queryKey: ["github-main-merges", repo] }); } }); }}><GitMerge />Approve & Merge To Main</Button><Button variant="outline" disabled={!!busy} onClick={() => setConfirmMerge(false)}>Cancel</Button></div>
      </DialogContent>
    </Dialog>
  </section>;
}
