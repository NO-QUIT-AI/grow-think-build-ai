import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Sparkles, GitBranch, FileSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { smartChangeRequest, approveSelfUpdate, discardSelfUpdate } from "@/lib/self-update.functions";

type Result = { previewId: string; branch: string; summary: string; found: string[]; changes: { path: string; before: string; after: string }[] };

export function GitHubSmartChange({ repo, canPush }: { repo: string; canPush: boolean }) {
  const prepare = useServerFn(smartChangeRequest), approve = useServerFn(approveSelfUpdate), discard = useServerFn(discardSelfUpdate);
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
    {done && <p className="mt-3 break-all text-sm text-primary">Nayi branch push ho gayi ✅ {done.branch} — <a className="underline" href={done.url} target="_blank" rel="noreferrer">GitHub par dekho</a>. Main branch ko touch nahi kiya.</p>}
    {result && <div className="mt-4 min-w-0">
      {result.found.length ? <div className="mb-3"><p className="flex items-center gap-2 font-medium text-primary"><FileSearch className="h-4 w-4" />Mila! Ye file hai:</p>{result.found.map(p => <p key={p} className="break-all font-mono text-sm">{p}</p>)}</div> : <p className="mb-3 text-sm text-muted-foreground">Koi file nahi mili ya change ki zaroorat nahi.</p>}
      <p className="mb-3 text-sm text-muted-foreground">{result.summary}</p>
      {result.changes.map(c => <div key={c.path} className="mb-3 grid min-w-0 gap-2 md:grid-cols-2"><div className="min-w-0 rounded-lg border border-border"><p className="break-all px-3 py-2 text-sm">Before — {c.path}</p><pre className="max-h-80 overflow-auto bg-secondary/40 p-3 text-xs">{c.before || "(nayi file)"}</pre></div><div className="min-w-0 rounded-lg border border-primary/40"><p className="break-all px-3 py-2 text-sm text-primary">After — {c.path}</p><pre className="max-h-80 overflow-auto bg-secondary/40 p-3 text-xs">{c.after}</pre></div></div>)}
      {result.changes.length > 0 && <div className="flex flex-wrap gap-2"><Button disabled={!!busy} onClick={() => void run("Nayi branch push ho rahi hai…", async () => { const r = await approve({ data: { id: result.previewId, confirmed: true } }); setDone(r); setResult(null); })}><GitBranch />Approve & Push New Branch</Button><Button variant="outline" disabled={!!busy} onClick={() => void run("Discard…", async () => { await discard({ data: { id: result.previewId } }); setResult(null); })}>Discard</Button></div>}
      <p className="mt-2 text-xs text-muted-foreground">Branch: {result.branch} · Main branch safe rahegi · tests run nahi hue.</p>
    </div>}
  </section>;
}
