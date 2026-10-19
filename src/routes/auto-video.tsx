import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Clapperboard, Download, Film, Loader2, Music, Play, RefreshCw, Upload, Volume2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { splitStory, type StockClip, type VideoScene } from "@/lib/auto-video";

export const Route = createFileRoute("/auto-video")({
  head: () => ({ meta: [
    { title: "Auto Story to Video — NO QUIT AI" },
    { name: "description", content: "Turn your story into a vertical video with free browser voice, stock clips, animated captions and local MP4 export." },
    { property: "og:title", content: "Auto Story to Video — NO QUIT AI" },
    { property: "og:description", content: "Create story videos with a scene timeline, free voiceover and browser-only editing." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: AutoVideo,
});

function AutoVideo() {
  const [story, setStory] = useState("");
  const [scenes, setScenes] = useState<VideoScene[]>([]);
  const [selected, setSelected] = useState(0);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [natural, setNatural] = useState(false);
  const [music, setMusic] = useState(true);
  const [musicFile, setMusicFile] = useState<File>();
  const [result, setResult] = useState<string>();
  const [previewClip, setPreviewClip] = useState<string>();
  const [clipBusy, setClipBusy] = useState(false);
  const [choices, setChoices] = useState<StockClip[]>([]);
  const cancel = useRef<AbortController | null>(null);
  const player = useRef<HTMLVideoElement>(null);
  const resultRef = useRef<string | undefined>(undefined);
  const active = scenes[selected];

  useEffect(() => {
    if (!active?.localClip) { setPreviewClip(active?.clip?.url); return; }
    const url = URL.createObjectURL(active.localClip); setPreviewClip(url);
    return () => URL.revokeObjectURL(url);
  }, [active?.localClip, active?.clip?.url]);
  useEffect(() => () => { cancel.current?.abort(); if (resultRef.current) URL.revokeObjectURL(resultRef.current); window.speechSynthesis?.cancel(); }, []);

  function clearResult() {
    if (resultRef.current) URL.revokeObjectURL(resultRef.current);
    resultRef.current = undefined; setResult(undefined); setProgress(0);
  }
  function updateScene(patch: Partial<VideoScene>) {
    clearResult(); setScenes(old => old.map((s, i) => i === selected ? { ...s, ...patch } : s));
  }
  async function stock(keyword: string, signal?: AbortSignal): Promise<StockClip[]> {
    const { data } = await supabase.auth.getSession();
    if (!data.session) { setNotice("Free stock clips ke liye login karo. Apne clips abhi choose kar sakte ho."); return []; }
    const response = await fetch(`/api/auto-video-clips?q=${encodeURIComponent(keyword)}`, { headers: { authorization: `Bearer ${data.session.access_token}` }, signal: signal ?? null });
    const body = await response.json() as { clips?: StockClip[]; error?: string; configured?: boolean };
    if (!response.ok) throw new Error(body.error ?? "Clips unavailable");
    if (body.configured === false) setNotice("Pexels ki free key abhi connected nahi. Apne clips choose karo, ya text-scene video export karo.");
    return body.clips ?? [];
  }
  async function searchClips() {
    if (!active || clipBusy) return; setClipBusy(true); setError("");
    try { const clips = await stock(active.search_keyword); setChoices(clips); if (!clips.length) toast("Koi clip nahi mila; apna clip choose karo."); }
    catch (e) { setError(e instanceof Error ? e.message : "Clip search fail"); }
    finally { setClipBusy(false); }
  }
  async function render(items: VideoScene[], controller: AbortController) {
    const { renderStoryVideo } = await import("@/lib/auto-video-render");
    const blob = await renderStoryVideo(items, { natural, music, musicFile, signal: controller.signal, onProgress: (percent, label) => { setProgress(percent); setStatus(label); } });
    if (controller.signal.aborted) return;
    const url = URL.createObjectURL(blob); resultRef.current = url; setResult(url); toast.success("Video ready — download karo!");
  }
  async function generate(fresh: boolean) {
    if (busy || (!story.trim() && fresh)) return;
    setBusy(true); setError(""); setNotice(""); clearResult(); window.speechSynthesis?.cancel();
    const controller = new AbortController(); cancel.current = controller;
    try {
      let items = scenes;
      if (fresh) {
        items = splitStory(story); setScenes(items); setSelected(0); setChoices([]); setStatus("Story se scenes ban rahe hain…");
        for (let i = 0; i < items.length; i++) {
          if (controller.signal.aborted) throw new Error("Render cancel ho gaya");
          const scene = items[i]; if (!scene) continue;
          try { const clips = await stock(scene.search_keyword, controller.signal); const clip = clips[0]; if (clip) items = items.map((s, j) => j === i ? { ...s, clip } : s); }
          catch (e) { if (controller.signal.aborted) throw e; setNotice("Stock clips unavailable. Text scenes use ho rahi hain; apna clip bhi choose kar sakte ho."); }
        }
        setScenes(items);
      }
      await render(items, controller);
    } catch (e) { setError(controller.signal.aborted ? "Render cancel ho gaya. Scenes abhi bhi yahan hain." : e instanceof Error ? e.message : "Video nahi ban saki"); }
    finally { setBusy(false); cancel.current = null; }
  }
  function listen() {
    if (!active || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel(); const speech = new SpeechSynthesisUtterance(active.voiceover_text); speech.rate = 0.95; window.speechSynthesis.speak(speech);
  }
  async function playResult() {
    try { await player.current?.play(); }
    catch { toast.error("Is browser mein MP4 play nahi hui; download karke video player mein kholo."); }
  }

  return (
    <main className="auto-video-page mx-auto min-h-screen max-w-6xl px-4 py-6 sm:px-8">
      <header className="mb-8 flex items-center gap-3 border-b border-border pb-5">
        <Button variant="ghost" size="icon" asChild><Link to="/" aria-label="Back to NO QUIT AI"><ArrowLeft className="h-5 w-5" /></Link></Button>
        <Clapperboard className="h-7 w-7 shrink-0 text-primary" />
        <div className="min-w-0"><p className="text-xs font-semibold text-primary">NO QUIT AI</p><h1 className="text-xl font-bold sm:text-2xl">Auto Story to Video</h1></div>
        <span className="ml-auto shrink-0 text-xs font-semibold text-accent">FREE</span>
      </header>

      <section className="border-b border-border pb-7">
        <div className="mb-3 flex items-center justify-between gap-2"><label htmlFor="story" className="font-display text-lg font-semibold">01 / Your story</label><span className="text-xs text-muted-foreground">9:16 · MP4</span></div>
        <Textarea id="story" value={story} disabled={busy} onChange={e => setStory(e.target.value)} placeholder="Ek ladka gareebi se ameer banta hai…" className="min-h-32 rounded-lg bg-card text-base" />
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <Button disabled={busy || !story.trim()} onClick={() => void generate(true)} className="gap-2 rounded-lg">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clapperboard className="h-4 w-4" />}Generate Video Auto</Button>
          <label className="flex items-center gap-2 text-sm"><Switch checked={music} disabled={busy} onCheckedChange={value => { setMusic(value); clearResult(); }} />Background music</label>
          <label className="flex items-center gap-2 text-sm"><Switch checked={natural} disabled={busy} onCheckedChange={value => { setNatural(value); clearResult(); }} />Try Edge voice</label>
          <Button variant="outline" size="sm" asChild className="rounded-lg"><label className={busy ? "pointer-events-none" : "cursor-pointer"}><Music className="mr-2 h-4 w-4" />{musicFile?.name ?? "Choose music"}<input aria-label="Choose background music" type="file" accept="audio/*" hidden disabled={busy} onChange={e => { setMusicFile(e.target.files?.[0]); setMusic(true); clearResult(); }} /></label></Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Offline voice: robotic English pronunciation. Edge voice may be blocked; offline voice stays available.</p>
      </section>

      {notice && <p role="status" className="mt-4 border-l-2 border-accent bg-accent/10 p-3 text-sm text-foreground">{notice}</p>}
      {error && <p role="alert" className="mt-4 border-l-2 border-destructive bg-destructive/10 p-3 text-sm">{error}</p>}

      <section className="border-b border-border py-7">
        <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">02 / Timeline</h2><span className="text-xs text-muted-foreground">{scenes.length ? `${scenes.length} scenes` : "No scenes yet"}</span></div>
        {scenes.length === 0 ? <div className="flex h-32 items-center justify-center gap-2 border-y border-dashed border-border text-sm text-muted-foreground"><Film className="h-5 w-5" />Your story starts here</div> : <>
          <div className="flex gap-3 overflow-x-auto pb-3">
            {scenes.map((scene, i) => <Button key={scene.id} variant="ghost" disabled={busy} onClick={() => { setSelected(i); setChoices([]); }} aria-label={`Select scene ${i + 1}`} aria-pressed={i === selected} className={`relative h-36 w-40 shrink-0 flex-col items-start justify-end overflow-hidden rounded-lg border p-3 text-left ${i === selected ? "border-primary bg-primary/10" : "border-border bg-card"}`}>
              {scene.clip && <img src={scene.clip.thumbnail} alt="" className="absolute inset-0 h-full w-full object-cover" />}
              <div className="relative flex w-full flex-col gap-1 rounded bg-background/90 p-2"><span className="text-xs text-primary">SCENE {String(scene.id).padStart(2, "0")}</span><span className="line-clamp-2 whitespace-normal text-xs">{scene.text || "Pause"}</span><span className="text-[10px] text-muted-foreground">{scene.localClip ? scene.localClip.name : scene.clip ? "Pexels" : "Text scene"}</span></div>
            </Button>)}
          </div>
          {active && <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div><label htmlFor="scene-text" className="mb-2 block text-xs text-muted-foreground">Scene {active.id} · Caption & voiceover</label><Textarea id="scene-text" disabled={busy} value={active.text} onChange={e => updateScene({ text: e.target.value, voiceover_text: e.target.value })} className="rounded-lg" /><Button size="sm" variant="ghost" disabled={busy || !active.text} onClick={listen} className="mt-1 gap-2"><Volume2 className="h-4 w-4" />Listen</Button></div>
            <div className="space-y-3"><label htmlFor="keyword" className="block text-xs text-muted-foreground">Clip search</label><div className="flex gap-2"><Input id="keyword" disabled={busy} value={active.search_keyword} onChange={e => updateScene({ search_keyword: e.target.value })} className="min-w-0 rounded-lg" /><Button variant="outline" size="icon" disabled={busy || clipBusy} onClick={() => void searchClips()} aria-label="Search replacement clips" title="Search replacement clips">{clipBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}</Button></div>
              <Button variant="outline" asChild className="w-full rounded-lg"><label className={busy ? "pointer-events-none" : "cursor-pointer"}><Upload className="mr-2 h-4 w-4" />Replace with my clip<input aria-label="Replace scene clip" type="file" hidden accept="video/*" disabled={busy} onChange={e => { const file = e.target.files?.[0]; if (file) updateScene({ localClip: file, clip: undefined }); }} /></label></Button>
              {active.clip && <a href={active.clip.page} target="_blank" rel="noopener noreferrer" className="text-xs text-primary">Video by {active.clip.author} on Pexels ↗</a>}
              {(active.clip || active.localClip) && <Button size="sm" variant="ghost" disabled={busy} onClick={() => updateScene({ clip: undefined, localClip: undefined })}><X className="mr-1 h-3 w-3" />Remove clip</Button>}
            </div>
          </div>}
          {choices.length > 0 && <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">{choices.map((clip, i) => <Button key={clip.url} variant="ghost" onClick={() => { updateScene({ clip, localClip: undefined }); setChoices([]); }} disabled={busy} className="h-24 overflow-hidden rounded-lg p-0" aria-label={`Use replacement clip ${i + 1}`}><img src={clip.thumbnail} alt={`Clip by ${clip.author}`} className="h-full w-full object-cover" /></Button>)}</div>}
        </>}
      </section>

      <section className="py-7">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">03 / Preview & export</h2>{scenes.length > 0 && <Button variant="outline" onClick={() => void generate(false)} disabled={busy} className="gap-2 rounded-lg"><RefreshCw className="h-4 w-4" />Render changes</Button>}</div>
        <div className="grid items-start gap-6 sm:grid-cols-[280px_1fr]">
          <div className="video-stage relative mx-auto aspect-[9/16] w-full max-w-[280px] overflow-hidden rounded-lg border border-border">
            {result || previewClip ? <video ref={player} key={result ?? previewClip} src={result ?? previewClip} controls playsInline preload="metadata" className="h-full w-full object-cover" /> : <div className="flex h-full flex-col justify-between p-6"><p className="text-xs font-semibold text-primary">NO QUIT AI / STORY</p><div><Film className="mb-4 h-8 w-8 text-primary" /><p className="font-display text-xl font-bold">{active?.text || "Your next story."}</p></div><p className="text-xs text-muted-foreground">9:16</p></div>}
            {previewClip && !result && active?.text && <p className="video-caption pointer-events-none absolute bottom-24 left-3 right-3 text-center text-xl font-bold">{active.text}</p>}
          </div>
          <div className="space-y-5 py-2">
            <div className="flex items-center justify-between text-sm"><span role="status">{busy ? status : result ? "MP4 ready" : "Ready when you are"}</span><span className="font-mono text-primary">{Math.round(progress)}%</span></div>
            <Progress value={progress} aria-label="Video rendering progress" className="h-2" />
            {busy && <Button variant="outline" onClick={() => cancel.current?.abort()} className="gap-2 rounded-lg"><X className="h-4 w-4" />Cancel render</Button>}
            {result && <div className="flex flex-wrap gap-3"><Button onClick={() => void playResult()} className="gap-2 rounded-lg"><Play className="h-4 w-4" />Play</Button><Button asChild variant="outline" className="gap-2 rounded-lg"><a href={result} download="NO-QUIT-AI-story.mp4"><Download className="h-4 w-4" />Download MP4</a></Button></div>}
            <dl className="divide-y divide-border text-sm"><div className="flex justify-between py-3"><dt className="text-muted-foreground">Format</dt><dd>360 × 640 · 12 fps</dd></div><div className="flex justify-between py-3"><dt className="text-muted-foreground">Voice</dt><dd>{natural ? "Edge / offline fallback" : "Offline free voice"}</dd></div><div className="flex justify-between py-3"><dt className="text-muted-foreground">Captions</dt><dd>Word pop</dd></div><div className="flex justify-between py-3"><dt className="text-muted-foreground">Export</dt><dd>On this device</dd></div></dl>
          </div>
        </div>
      </section>
    </main>
  );
}