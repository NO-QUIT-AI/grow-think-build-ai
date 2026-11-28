import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Github, ArrowLeft, Folder, FileCode, ShieldCheck, Loader2, Search, Unplug, GitBranch, Wrench, ScanSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { readableCode } from "@/lib/github-rules";
import { GitHubSelfUpdate } from "@/components/GitHubSelfUpdate";
import { GitHubSmartChange } from "@/components/GitHubSmartChange";
import { githubStatus, chatGitHubConnection, startGitHubConnect, completeGitHubConnect, disconnectGitHub, listGitHubRepos, selectGitHubRepo, getGitHubTree, getGitHubFile, analyzeGitHubFile, fixGitHubFile, pushGitHubFix } from "@/lib/github.functions";

export const Route = createFileRoute("/_authenticated/github-connect")({
  head: () => ({ meta: [
    { title: "GitHub Connect — NO QUIT AI" },
    { name: "description", content: "Connect your own GitHub repositories, review code and approve fixes with NO QUIT AI." },
    { property: "og:title", content: "GitHub Connect — NO QUIT AI" },
    { property: "og:description", content: "Permission-based repository browsing, AI code review and approved GitHub fixes." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }), component: GitHubPage,
});
type Repo = { id: number; name: string; branch: string; private: boolean; canPush: boolean };
type Finding = { path: string; line: number; severity: string; message: string; fix: string };
type Preview = { id: string | null; path: string; before: string; after: string; summary: string };
function CodeView({ code }: { code: string }) {
  return <pre className="max-h-[60dvh] overflow-auto bg-secondary/40 p-3 text-xs leading-6"><code>{code.split("\n").map((line, i) => <span key={i} className="block"><span className="mr-4 inline-block w-8 select-none text-right text-muted-foreground">{i + 1}</span>{line || " "}</span>)}</code></pre>;
}
function GitHubPage() {
  const { user, loading } = useAuth();
  const statusFn = useServerFn(githubStatus), start = useServerFn(startGitHubConnect), complete = useServerFn(completeGitHubConnect), disconnect = useServerFn(disconnectGitHub);
  const list = useServerFn(listGitHubRepos), select = useServerFn(selectGitHubRepo), treeFn = useServerFn(getGitHubTree), fileFn = useServerFn(getGitHubFile);
  const connection = useServerFn(chatGitHubConnection);
  const analyze = useServerFn(analyzeGitHubFile), fix = useServerFn(fixGitHubFile), push = useServerFn(pushGitHubFix);
  const qc = useQueryClient();
  const status = useQuery({ queryKey: ["github-status", user?.id], queryFn: () => statusFn(), enabled: !!user });
  const [permission, setPermission] = useState(false), [pushConfirm, setPushConfirm] = useState(false);
  const [repos, setRepos] = useState<Repo[]>([]), [page, setPage] = useState(1), [more, setMore] = useState(false);
  const [repo, setRepo] = useState<Repo | null>(null), [files, setFiles] = useState<{ path: string; folder: boolean; size: number }[]>([]);
  const [persistedRepo, setPersistedRepo] = useState<string | null>(null);
  const [folder, setFolder] = useState(""), [file, setFile] = useState<{ path: string; content: string } | null>(null);
  const [search, setSearch] = useState(""), [busy, setBusy] = useState(""), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [findings, setFindings] = useState<Finding[]>([]), [preview, setPreview] = useState<Preview | null>(null);
  const stop = useRef(false);
  async function act(label: string, action: () => Promise<void>) {
    setBusy(label); setError("");
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : "Request complete nahi hui."); }
    finally { setBusy(""); }
  }
  async function loadRepos(next = 1) {
    const [result, saved] = await Promise.all([list({ data: { page: next } }), next === 1 ? connection() : Promise.resolve(null)]);
    setRepos(old => next === 1 ? result.repos : [...old, ...result.repos]); setPage(next); setMore(result.hasMore);
    if (saved) {
      setPersistedRepo(saved.repo);
      const restored = result.repos.find(r => r.name === saved.repo);
      if (restored) await choose(restored);
    }
  }
  useEffect(() => {
    if (status.data?.connected) void act("Repositories load ho rahi hain…", () => loadRepos());
    else { setRepos([]); setRepo(null); setPersistedRepo(null); setFiles([]); setFile(null); setFindings([]); setPreview(null); }
  }, [status.data?.connected, user?.id]);
  useEffect(() => () => { stop.current = true; }, []);
  async function connect() {
    setPermission(false);
    const popup = window.open("", "nqai-github", "width=600,height=720");
    if (!popup) { setError("Popups allow karein phir Connect dabayein."); return; }
    await act("GitHub permission ka intezar…", async () => {
      try {
        const started = await start();
        const result = await new Promise<{ code: string; nonce: string }>((resolve, reject) => {
          const cleanup = () => { window.removeEventListener("message", onMessage); window.clearInterval(poll); window.clearTimeout(timeout); };
          const onMessage = (event: MessageEvent) => {
            if (event.origin !== window.location.origin || event.source !== popup || event.data?.connectorId !== "github") return;
            if (event.data.type !== "github-complete" && event.data.type !== "github-failed") return;
            cleanup();
            if (event.data.type === "github-complete" && typeof event.data.code === "string" && typeof event.data.nonce === "string") resolve({ code: event.data.code, nonce: event.data.nonce });
            else reject(new Error("GitHub permission nahi mili; dobara try karein."));
          };
          window.addEventListener("message", onMessage);
          const poll = window.setInterval(() => { if (popup.closed) { cleanup(); reject(new Error("Permission window close ho gayi.")); } }, 500);
          const timeout = window.setTimeout(() => { cleanup(); reject(new Error("Permission timed out; dobara try karein.")); }, 300000);
          popup.location.href = started.authorizationUrl;
        });
        await complete({ data: result }); setNotice("Connected to GitHub ✅");
        await qc.invalidateQueries({ queryKey: ["github-status", user?.id] });
      } finally { popup.close(); }
    });
  }
  async function choose(r: Repo) {
    await act("Repository khul rahi hai…", async () => {
      const selected = await select({ data: { repo: r.name } });
      setPersistedRepo(r.name);
      setRepo({ ...r, ...selected }); setFile(null); setPreview(null); setFindings([]); setFolder("");
      const result = await treeFn({ data: { repo: r.name } }); setFiles(result.files);
      setNotice(result.truncated ? "Bari repository: GitHub ne partial file list di hai." : "");
    });
  }
  async function openFile(path: string) {
    if (!repo) return;
    await act("File read ho rahi hai…", async () => { setFile(await fileFn({ data: { repo: repo.name, path } })); setPreview(null); });
  }
  async function scan() {
    if (!repo) return;
    stop.current = false; setFindings([]); setPreview(null);
    await act("Code analyze ho raha hai…", async () => {
      const targets = files.filter(f => !f.folder && readableCode(f.path) && f.size <= 200000);
      let scanned = 0, skipped = 0;
      for (const target of targets) {
        if (stop.current) break;
        setBusy(`Analyze ${scanned + skipped + 1} / ${targets.length}: ${target.path}`);
        try {
          const result = await analyze({ data: { repo: repo.name, path: target.path } });
          setFindings(old => [...old, ...result.findings.map(f => ({ ...f, path: target.path }))]); scanned++;
        } catch (e) {
          skipped++; setError(`${target.path}: ${e instanceof Error ? e.message : "Review failed"}`);
          break;
        }
      }
      setNotice(`${scanned} files reviewed${skipped ? `; ${skipped} failed` : ""}${stop.current ? "; stopped" : ""}. AI review hai; compiler/tests run nahi hue. Sensitive aur binary files excluded.`);
    });
  }
  const children = files.filter(f => (folder ? f.path.startsWith(folder + "/") : true) && !f.path.slice(folder ? folder.length + 1 : 0).includes("/"));
  return <main className="min-h-screen bg-background px-4 py-6 text-foreground">
    <div className="mx-auto max-w-6xl">
      <Link to="/" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" />NO QUIT AI</Link>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5">
        <div className="flex items-center gap-3"><Github className="h-9 w-9 text-primary" /><div><h1 className="font-display text-2xl font-semibold">GitHub Connect</h1><p className="mt-1 text-sm text-muted-foreground">{status.data?.connected ? "Connected to GitHub ✅" : "Not Connected ❌"}</p></div></div>
        {user && <Button disabled={!!busy || status.isPending} variant={status.data?.connected ? "outline" : "default"} onClick={() => status.data?.connected ? void act("Disconnect ho raha hai…", async () => { await disconnect(); setNotice("GitHub disconnected."); await qc.invalidateQueries({ queryKey: ["github-status", user.id] }); }) : setPermission(true)}>{status.data?.connected ? <Unplug /> : <Github />}{status.data?.connected ? "Disconnect GitHub" : "Connect GitHub"}</Button>}
      </header>
      {user && !loading && <GitHubSelfUpdate userId={user.id} selectedRepo={repo?.name ?? persistedRepo} />}
      {loading ? <Loader2 className="animate-spin text-primary" /> : !user ? <Button asChild><Link to="/auth">GitHub connect karne ke liye Sign in</Link></Button> : !status.data?.connected ? <div className="py-10"><ShieldCheck className="mb-4 h-12 w-12 text-primary" /><h2 className="mb-2 text-xl font-semibold">Apni repository, apni permission.</h2><p className="max-w-lg text-muted-foreground">NO QUIT AI will only read your repos to help fix code. We will not delete anything without your permission.</p></div> : <>
        <div className="mb-6 grid gap-4 md:grid-cols-[320px_1fr]">
          <section className="min-w-0 border-r border-border pr-4"><h2 className="mb-3 font-semibold">Your repositories</h2><Input aria-label="Search repositories" placeholder="Repository dhoondo…" value={search} onChange={e => setSearch(e.target.value)} />
            <div className="mt-3 max-h-72 space-y-1 overflow-auto">{repos.filter(r => r.name.toLowerCase().includes(search.toLowerCase())).map(r => <Button key={r.id} disabled={!!busy} variant={repo?.id === r.id ? "secondary" : "ghost"} onClick={() => void choose(r)} className="h-auto w-full justify-start whitespace-normal py-3 text-left"><Github className="shrink-0" /><span className="min-w-0 break-all">{r.name}<small className="block text-muted-foreground">{r.private ? "Private" : "Public"}</small></span></Button>)}{!repos.length && !busy && <p className="py-3 text-sm text-muted-foreground">Koi repository nahi mili.</p>}</div>
            {more && <Button variant="outline" disabled={!!busy} onClick={() => void act("More repositories…", () => loadRepos(page + 1))} className="mt-3">Load more</Button>}
          </section>
          <section className="min-w-0">{!repo ? <p className="py-8 text-muted-foreground">Bhai, ek repository select karo.</p> : <><h2 className="break-all font-semibold">{repo.name}</h2><p className="my-2 flex items-center gap-2 text-sm text-muted-foreground"><GitBranch className="h-4 w-4" />{repo.branch}</p>
            <div className="mb-4 flex flex-wrap gap-2"><Button disabled={!!busy || !files.length} onClick={() => void scan()} className="h-auto min-h-9 whitespace-normal"><ScanSearch />Analyze Code - Kya Kharab Hai?</Button><Button disabled={!!busy || !file || !repo.canPush} variant="outline" onClick={() => file && void act("Fix preview ban rahi hai…", async () => { setPreview(await fix({ data: { repo: repo.name, path: file.path } })); })} className="h-auto min-h-9 whitespace-normal"><Wrench />Fix My Code - Theek Karo</Button></div>
            {!repo.canPush && <p className="mb-3 text-sm text-muted-foreground">Is repo par write permission nahi; sirf analyze kar sakte hain.</p>}
            <GitHubSmartChange key={repo.name} repo={repo.name} canPush={repo.canPush} />
            <div className="grid min-w-0 gap-3 lg:grid-cols-[220px_1fr]">
              <div className="max-h-96 overflow-auto rounded-lg border border-border p-2"><div className="mb-2 break-all text-xs text-muted-foreground">/{folder}</div>{folder && <Button size="sm" variant="ghost" onClick={() => setFolder(folder.split("/").slice(0, -1).join("/"))}>← Parent folder</Button>}{children.sort((a,b) => Number(b.folder)-Number(a.folder) || a.path.localeCompare(b.path)).map(f => <Button key={f.path} disabled={!!busy || (!f.folder && !readableCode(f.path))} variant={file?.path === f.path ? "secondary" : "ghost"} onClick={() => f.folder ? setFolder(f.path) : void openFile(f.path)} className="h-auto w-full justify-start whitespace-normal py-2 text-left">{f.folder ? <Folder /> : <FileCode />}<span className="min-w-0 break-all text-xs">{f.path.split("/").pop()}</span></Button>)}</div>
              <div className="min-w-0 overflow-hidden rounded-lg border border-border">{file ? <><p className="break-all border-b border-border px-3 py-2 text-sm">{file.path}</p><CodeView code={file.content} /></> : <p className="p-5 text-sm text-muted-foreground">Code file select karein.</p>}</div>
            </div>
          </>}</section>
        </div>
        {!!findings.length && <section className="border-t border-border py-5" aria-label="Code findings"><h2 className="mb-4 text-lg font-semibold">Kya kharab hai? — {findings.length} findings</h2>{findings.map((f,i) => <div key={i} className="mb-2 flex flex-wrap items-start gap-3 rounded-lg border border-border p-3"><div className="min-w-0 flex-1"><p className="break-all text-sm font-medium text-primary">{f.path}:{f.line} · {f.severity}</p><p className="mt-1 text-sm">{f.message}</p><p className="mt-1 text-xs text-muted-foreground">{f.fix}</p></div><Button variant="outline" size="sm" disabled={!!busy} onClick={() => void openFile(f.path)}>Open file</Button></div>)}</section>}
        {preview && <section className="border-t border-border py-5"><h2 className="mb-2 text-xl font-semibold">Before / After — {preview.path}</h2><p className="mb-4 text-sm text-muted-foreground">{preview.summary}</p><div className="grid min-w-0 gap-3 md:grid-cols-2"><div className="min-w-0 overflow-hidden rounded-lg border border-border"><h3 className="px-3 py-2">Before</h3><CodeView code={preview.before} /></div><div className="min-w-0 overflow-hidden rounded-lg border border-primary/40"><h3 className="px-3 py-2 text-primary">After</h3><CodeView code={preview.after} /></div></div>{preview.id ? <div className="mt-4 flex flex-wrap gap-2"><Button disabled={!!busy} onClick={() => setPushConfirm(true)}><Github />Push to GitHub?</Button><Button variant="outline" onClick={() => setPreview(null)}>Discard</Button></div> : <p className="mt-3 text-muted-foreground">No changes to push.</p>}</section>}
      </>}
      {busy && <div role="status" className="sticky bottom-4 mt-4 flex min-w-0 items-center gap-3 rounded-lg border border-primary/30 bg-background p-3"><Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" /><p className="min-w-0 flex-1 break-all text-sm">{busy}</p>{busy.startsWith("Analyze") && <Button size="sm" variant="outline" onClick={() => { stop.current = true; }}>Stop</Button>}</div>}
      {(error || status.error) && <p role="alert" className="mt-4 break-words text-sm text-destructive">{error || (status.error instanceof Error ? status.error.message : "Connection check failed.")}</p>}
      {notice && <p role="status" className="mt-4 text-sm text-muted-foreground">{notice}</p>}
      <Dialog open={permission} onOpenChange={setPermission}><DialogContent><DialogHeader><DialogTitle>GitHub permission</DialogTitle></DialogHeader><ShieldCheck className="h-8 w-8 text-primary" /><p>NO QUIT AI will only read your repos to help fix code. We will not delete anything without your permission.</p><p className="text-sm text-muted-foreground">GitHub repo access includes write permission for approved fixes. Hum sirf selected repo read karenge; push sirf aapke Yes par hoga. Delete ka option nahi hai. AI analysis mein code AI service ko bheja jayega; sensitive files excluded.</p><Button onClick={() => void connect()}><Github />Continue to GitHub</Button></DialogContent></Dialog>
      <Dialog open={pushConfirm} onOpenChange={setPushConfirm}><DialogContent><DialogHeader><DialogTitle>Push to GitHub?</DialogTitle></DialogHeader><p className="break-all">{repo?.name} · {repo?.branch} · {preview?.path}</p><p className="text-sm text-muted-foreground">Ye reviewed After code isi repository aur branch par commit hoga. AI fixes ko pehle check karein; tests run nahi hue.</p><div className="flex gap-2"><Button disabled={!!busy} onClick={() => { setPushConfirm(false); if (!preview?.id) return; const previewId = preview.id; void act("GitHub par push ho raha hai…", async () => { const result = await push({ data: { previewId, confirmed: true } }); setNotice(`GitHub pushed ✅ Commit ${result.commit.slice(0, 8)}`); setPreview(null); if (file) await openFile(file.path); }); }}>Yes, Push</Button><Button variant="outline" onClick={() => setPushConfirm(false)}>No, Cancel</Button></div></DialogContent></Dialog>
    </div>
  </main>;
}