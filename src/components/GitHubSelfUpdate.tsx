import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { GitBranch, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { selfUpdateStatus, bindSelfRepo, requestSelfUpdate, approveSelfUpdate, discardSelfUpdate } from "@/lib/self-update.functions";
import { updateChanges } from "@/lib/self-update-rules";
export function GitHubSelfUpdate({ userId, selectedRepo }: { userId: string; selectedRepo: string | null }) {
  const statusFn = useServerFn(selfUpdateStatus), bind = useServerFn(bindSelfRepo), request = useServerFn(requestSelfUpdate), approve = useServerFn(approveSelfUpdate), discard = useServerFn(discardSelfUpdate);
  const qc = useQueryClient();
  const key = ["self-update", userId];
  const status = useQuery({ queryKey: key, queryFn: () => statusFn() });
  const [instruction, setInstruction] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [bindConfirm, setBindConfirm] = useState(false), [approval, setApproval] = useState<string | null>(null), [review, setReview] = useState<string | null>(null);
  async function act(fn: () => Promise<void>) {
    setBusy(true); setError("");
    try { await fn(); await qc.invalidateQueries({ queryKey: key }); } catch (e) { setError(e instanceof Error ? e.message : "Self-update failed."); } finally { setBusy(false); }
  }
  if (!status.data?.owner) return status.error ? <p role="alert" className="text-sm text-destructive">Self-update permission check failed.</p> : null;
  const proposals = status.data.proposals;
  const selected = proposals.find(p => p.id === review);
  const parsed = updateChanges.safeParse(selected?.changes);
  const approving = proposals.find(p => p.id === approval);
  return <section className="my-6 min-w-0 border-y border-border py-6" aria-label="Self-updating NO QUIT AI">
    <h2 className="flex items-center gap-2 font-display text-xl font-semibold"><ShieldCheck className="text-primary" />Self-Updating NO QUIT AI</h2>
    <p className="mt-2 break-all text-sm text-muted-foreground">Apna repo: {status.data.repo ?? "Abhi select nahi kiya"}</p>
    {selectedRepo && selectedRepo !== status.data.repo && <Button className="mt-3 h-auto whitespace-normal" variant="outline" disabled={busy} onClick={() => setBindConfirm(true)}>Ye NO QUIT AI ka apna repo hai</Button>}
    {status.data.repo && <div className="mt-4 space-y-3"><Textarea aria-label="Self-update feature request" placeholder="Bhai, apne andar ye feature add kar…" value={instruction} onChange={e => setInstruction(e.target.value)} rows={3} maxLength={6000} /><Button disabled={busy || instruction.trim().length < 5} onClick={() => void act(async () => { const result = await request({ data: { request: instruction } }); setReview(result.previewId); setNotice("Proposal tayyar; abhi GitHub par kuch push nahi hua."); })}>{busy ? <Loader2 className="animate-spin" /> : <GitBranch />}Analyze & Prepare Changes</Button></div>}
    <div className="mt-5 space-y-2">{proposals.map(p => <div key={p.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-border py-3"><div className="min-w-0 flex-1"><p className="break-words text-sm font-medium">{p.request}</p><p className="break-all text-xs text-muted-foreground">{p.target_branch} · {p.status}</p></div><Button variant="outline" size="sm" onClick={() => setReview(p.id)}>Review</Button>{p.status === "pushed" && <Button asChild variant="ghost" size="sm"><a href={`https://github.com/${p.repo}/compare/${encodeURIComponent(p.base_branch)}...${encodeURIComponent(p.target_branch)}`} target="_blank" rel="noopener noreferrer">View branch</a></Button>}</div>)}</div>
    {selected && <div className="mt-5 min-w-0"><h3 className="font-semibold">Before / After</h3><p className="my-3 whitespace-pre-wrap text-sm text-muted-foreground">{selected.summary}</p>{parsed.success && parsed.data.map(c => <div key={c.path} className="mb-5 min-w-0"><h4 className="mb-2 break-all text-sm font-medium text-primary">{c.path}{c.sha ? "" : " · New file"}</h4><div className="grid min-w-0 gap-3 md:grid-cols-2">{[{ label: "Before", code: c.before }, { label: "After", code: c.after }].map(v => <div key={v.label} className="min-w-0 overflow-hidden rounded-lg border border-border"><p className="border-b border-border p-2 text-sm">{v.label}</p><pre className="max-h-80 overflow-auto bg-secondary/40 p-3 text-xs leading-6"><code>{v.code || "New file"}</code></pre></div>)}</div></div>)}{selected.status === "pending" && <div className="flex flex-wrap gap-2"><Button disabled={busy || !parsed.success} onClick={() => setApproval(selected.id)}><GitBranch />Approve & Push New Branch</Button><Button variant="outline" disabled={busy} onClick={() => void act(async () => { await discard({ data: { id: selected.id } }); setReview(null); })}>Discard</Button></div>}</div>}
    {error && <p role="alert" className="mt-3 break-words text-sm text-destructive">{error}</p>}{notice && <p role="status" className="mt-3 text-sm text-primary">{notice}</p>}
    <Dialog open={bindConfirm} onOpenChange={setBindConfirm}><DialogContent><DialogHeader><DialogTitle>NO QUIT AI ka apna repo?</DialogTitle></DialogHeader><p className="break-all">{selectedRepo}</p><p className="text-sm text-muted-foreground">Confirm karein ye isi app ka source repo hai. Self-updates sirf is repo par banengi.</p><Button disabled={busy} onClick={() => { setBindConfirm(false); if (selectedRepo) void act(async () => { await bind({ data: { repo: selectedRepo, confirmed: true } }); }); }}>Confirm own repository</Button></DialogContent></Dialog>
    <Dialog open={!!approval} onOpenChange={open => { if (!open) setApproval(null); }}><DialogContent><DialogHeader><DialogTitle>Approve self-update?</DialogTitle></DialogHeader><p className="break-all">{approving?.repo}</p><p className="break-all text-sm text-primary">New branch: {approving?.target_branch}</p><p className="text-sm text-muted-foreground">Sirf reviewed code nayi branch mein jayega. Main branch unchanged; merge aur publish nahi hoga. Tests abhi run nahi hue.</p><div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={() => { const id = approval; setApproval(null); if (id) void act(async () => { const result = await approve({ data: { id, confirmed: true } }); setNotice(`Nayi branch pushed ✅ ${result.branch}. Main unchanged.`); }); }}>Yes, approve new branch</Button><Button variant="outline" onClick={() => setApproval(null)}>No, cancel</Button></div></DialogContent></Dialog>
  </section>;
}