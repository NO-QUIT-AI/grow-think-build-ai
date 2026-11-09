import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Download, ExternalLink, KeyRound, Trash2, Film, Square } from "lucide-react";
import { toast } from "sonner";
import { PROVIDERS, loadKeys, saveKeys, splitScript, falGenerate, mergeClips, type ByokKeys, type ByokProvider } from "@/lib/byok-video";

export const Route = createFileRoute("/byok-video")({
  head: () => ({
    meta: [
      { title: "Bring Your Own Key Movie Maker — NO QUIT AI" },
      { name: "description", content: "Apni Fal.ai key se lambi AI videos banayein. Key sirf aap ke browser me rehti hai." },
      { property: "og:title", content: "BYOK Movie Maker — NO QUIT AI" },
      { property: "og:description", content: "Script likhein, scenes me tootay, apni key se generate, browser me jod kar download." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ByokVideo,
});

type SceneState = { text: string; status: "pending" | "working" | "done" | "error"; url?: string; error?: string };

function ByokVideo() {
  const [keys, setKeys] = useState<ByokKeys>({});
  const [draft, setDraft] = useState<ByokKeys>({});
  const [model, setModel] = useState("fal-ai/ltx-video");
  const [script, setScript] = useState("");
  const [scenes, setScenes] = useState<SceneState[]>([]);
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState("");
  const [movie, setMovie] = useState<string>();
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => { const k = loadKeys(); setKeys(k); setDraft(k); }, []);

  const save = (p: ByokProvider) => { const next = { ...keys, [p]: draft[p]?.trim() }; setKeys(next); saveKeys(next); toast.success(`${PROVIDERS[p].name} key is device par save ho gayi`); };
  const remove = (p: ByokProvider) => { const next = { ...keys }; delete next[p]; setKeys(next); setDraft({ ...draft, [p]: "" }); saveKeys(next); toast.success("Key delete ho gayi"); };

  const done = scenes.filter(s => s.status === "done").length;

  async function generate() {
    const key = keys.fal;
    if (!key) { toast.error("Pehle Fal.ai key connect karein"); return; }
    const parts = scenes.length ? scenes : splitScript(script).map(text => ({ text, status: "pending" as const }));
    if (!parts.length) { toast.error("Script likhein"); return; }
    const ctrl = new AbortController(); abortRef.current = ctrl;
    setBusy(true); setMovie(undefined);
    const list: SceneState[] = parts.map(s => ({ ...s })); setScenes([...list]);
    try {
      for (let i = 0; i < list.length; i++) {
        if (list[i]!.status === "done") continue;
        list[i] = { ...list[i]!, status: "working" }; setScenes([...list]);
        setLabel(`Scene ${i + 1} of ${list.length} ban raha hai…`);
        try {
          const url = await falGenerate(key, model, list[i]!.text, ctrl.signal);
          list[i] = { ...list[i]!, status: "done", url };
        } catch (e) {
          if (ctrl.signal.aborted) throw e;
          list[i] = { ...list[i]!, status: "error", error: (e as Error).message };
          setScenes([...list]); throw e;
        }
        setScenes([...list]);
      }
      setLabel("Clips download ho rahe hain…");
      const blobs = await Promise.all(list.map(s => fetch(s.url!).then(r => r.blob())));
      const out = await mergeClips(blobs, setLabel);
      setMovie(URL.createObjectURL(out)); setLabel("Movie tayyar hai!");
    } catch (e) {
      toast.error((e as Error).message); setLabel("Ruk gaya — dobara 'Generate' dabane se baqi scenes se continue hoga.");
    } finally { setBusy(false); }
  }

  return (
    <main className="min-h-screen bg-background text-foreground px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-2">
          <Link to="/" className="text-sm text-muted-foreground">← NO QUIT AI</Link>
          <h1 className="font-heading text-3xl font-bold flex items-center gap-2"><Film className="h-7 w-7 text-primary" /> BYOK Movie Maker</h1>
          <p className="text-muted-foreground">Apni AI key lagayein, apna kharcha khud. Key sirf is device ke browser me save hoti hai — hamare server par kabhi nahi jaati.</p>
        </header>

        <section className="space-y-4 rounded-xl border border-border bg-card p-5">
          <h2 className="font-heading text-xl font-semibold flex items-center gap-2"><KeyRound className="h-5 w-5" /> Connect Your AI Key</h2>
          {(Object.keys(PROVIDERS) as ByokProvider[]).map(p => (
            <div key={p} className="space-y-2 rounded-lg border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{PROVIDERS[p].name}{keys[p] ? " ✓" : ""}</span>
                <a href={PROVIDERS[p].getKey} target="_blank" rel="noreferrer" className="text-sm text-primary inline-flex items-center gap-1">Get Key <ExternalLink className="h-3 w-3" /></a>
              </div>
              <p className="text-xs text-muted-foreground">{PROVIDERS[p].note}</p>
              <div className="flex gap-2">
                <Input type="password" placeholder="API key paste karein" value={draft[p] ?? ""} onChange={e => setDraft({ ...draft, [p]: e.target.value })} />
                <Button onClick={() => save(p)} disabled={!draft[p]?.trim()}>Save</Button>
                {keys[p] && <Button variant="outline" size="icon" aria-label="Delete key" onClick={() => remove(p)}><Trash2 className="h-4 w-4" /></Button>}
              </div>
            </div>
          ))}
        </section>

        <section className="space-y-4 rounded-xl border border-border bg-card p-5">
          <h2 className="font-heading text-xl font-semibold">Apni kahani / script</h2>
          <Textarea rows={8} value={script} disabled={busy} onChange={e => { setScript(e.target.value); setScenes([]); }} placeholder="Poori kahani likhein — app isay 5-10 second ke scenes me tod degi." />
          <div className="flex flex-wrap items-center gap-2">
            <Input className="max-w-xs" value={model} onChange={e => setModel(e.target.value)} aria-label="Fal model" disabled={busy} />
            <Button variant="outline" disabled={busy || !script.trim()} onClick={() => setScenes(splitScript(script).map(text => ({ text, status: "pending" })))}>Scenes banao</Button>
            {busy ? <Button variant="destructive" onClick={() => abortRef.current?.abort()}><Square className="h-4 w-4" /> Stop</Button>
              : <Button onClick={generate} disabled={!script.trim()}>Generate (meri key se)</Button>}
          </div>
          <p className="text-xs text-muted-foreground">Har scene ka kharcha aap ke Fal.ai account se katega. Lambi movie = zyada scenes = zyada kharcha. Tab khula rakhein.</p>
        </section>

        {scenes.length > 0 && (
          <section className="space-y-3 rounded-xl border border-border bg-card p-5">
            <div className="flex justify-between text-sm"><span>{label || `${scenes.length} scenes tayyar`}</span><span>Scene {done} / {scenes.length} complete</span></div>
            <Progress value={(done / scenes.length) * 100} />
            <ol className="max-h-80 space-y-1 overflow-auto text-sm">
              {scenes.map((s, i) => (
                <li key={i} className="flex gap-2"><span className="w-16 shrink-0 text-muted-foreground">#{i + 1} {s.status === "done" ? "✅" : s.status === "working" ? "⏳" : s.status === "error" ? "❌" : "•"}</span><span className="line-clamp-2">{s.error ?? s.text}</span></li>
              ))}
            </ol>
          </section>
        )}

        {movie && (
          <section className="space-y-3 rounded-xl border border-primary bg-card p-5">
            <video src={movie} controls className="w-full rounded-lg" />
            <Button asChild><a href={movie} download="no-quit-ai-movie.mp4"><Download className="h-4 w-4" /> Download Movie</a></Button>
          </section>
        )}
      </div>
    </main>
  );
}
