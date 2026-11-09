export type ByokProvider = "fal" | "replicate" | "runway";
export const BYOK_STORAGE = "nqai.byok.keys";

export const PROVIDERS: Record<ByokProvider, { name: string; getKey: string; browserReady: boolean; note: string }> = {
  fal: { name: "Fal.ai", getKey: "https://fal.ai/dashboard/keys", browserReady: true, note: "Best / Recommended — seedha aap ke browser se chalta hai." },
  replicate: { name: "Replicate", getKey: "https://replicate.com/account/api-tokens", browserReady: false, note: "Replicate browser se direct call allow nahi karta, is liye key server pe bheje baghair abhi generation nahi ho sakti." },
  runway: { name: "Runway", getKey: "https://dev.runwayml.com/", browserReady: false, note: "Runway browser se direct call allow nahi karta, is liye key server pe bheje baghair abhi generation nahi ho sakti." },
};

export type ByokKeys = Partial<Record<ByokProvider, string>>;

export function loadKeys(): ByokKeys {
  try { return JSON.parse(localStorage.getItem(BYOK_STORAGE) || "{}") as ByokKeys; } catch { return {}; }
}
export function saveKeys(keys: ByokKeys) { localStorage.setItem(BYOK_STORAGE, JSON.stringify(keys)); }

/** Split a long script into scenes of roughly 5–10 seconds (~2.5 spoken words/sec). */
export function splitScript(script: string, maxWords = 22): string[] {
  const sentences = script.replace(/\s+/g, " ").trim().split(/(?<=[.!?।؟])\s+/).filter(Boolean);
  const scenes: string[] = [];
  let cur: string[] = [];
  const push = () => { if (cur.length) scenes.push(cur.join(" ")); cur = []; };
  for (const s of sentences) {
    const words = s.split(" ");
    if (words.length > maxWords) { push(); for (let i = 0; i < words.length; i += maxWords) scenes.push(words.slice(i, i + maxWords).join(" ")); continue; }
    if (cur.length + words.length > maxWords) push();
    cur.push(...words);
  }
  push();
  return scenes;
}

/** Scenes needed for a target length when each clip is ~sceneSeconds long. */
export function scenesForMinutes(minutes: number, sceneSeconds = 5) { return Math.ceil((minutes * 60) / sceneSeconds); }

const sleep = (ms: number, signal: AbortSignal) => new Promise<void>((res, rej) => {
  const t = setTimeout(res, ms); signal.addEventListener("abort", () => { clearTimeout(t); rej(new Error("Cancel ho gaya")); }, { once: true });
});

/** Generates one clip on Fal.ai directly from the browser with the user's own key. Returns a video URL. */
export async function falGenerate(key: string, model: string, prompt: string, signal: AbortSignal): Promise<string> {
  const headers = { Authorization: `Key ${key}`, "Content-Type": "application/json" };
  const res = await fetch(`https://queue.fal.run/${model}`, { method: "POST", headers, body: JSON.stringify({ prompt }), signal });
  if (!res.ok) throw new Error(`Fal.ai [${res.status}]: ${(await res.text()).slice(0, 200)}`);
  const job = await res.json() as { status_url: string; response_url: string };
  for (let i = 0; i < 200; i++) {
    await sleep(i < 5 ? 3000 : 6000, signal);
    const st = await fetch(job.status_url, { headers, signal }).then(r => r.json()) as { status: string };
    if (st.status === "COMPLETED") break;
    if (st.status === "FAILED" || st.status === "ERROR") throw new Error("Fal.ai scene fail ho gaya");
  }
  const out = await fetch(job.response_url, { headers, signal });
  if (!out.ok) throw new Error(`Fal.ai result [${out.status}]: ${(await out.text()).slice(0, 200)}`);
  const data = await out.json() as { video?: { url?: string } };
  if (!data.video?.url) throw new Error("Fal.ai ne video URL nahi diya");
  return data.video.url;
}

/** Joins clips into one MP4 using in-browser ffmpeg. */
export async function mergeClips(blobs: Blob[], onProgress: (label: string) => void): Promise<Blob> {
  const { FFmpeg } = await import("@ffmpeg/ffmpeg");
  const { toBlobURL } = await import("@ffmpeg/util");
  const wasmAsset = (await import("@/assets/auto-video-core.wasm.asset.json")).default;
  const ff = new FFmpeg();
  onProgress("Editor load ho raha hai…");
  await ff.load({ coreURL: await toBlobURL("/auto-video/ffmpeg/ffmpeg-core.js", "text/javascript"), wasmURL: await toBlobURL(wasmAsset.url, "application/wasm") });
  try {
    for (let i = 0; i < blobs.length; i++) {
      onProgress(`Scene ${i + 1}/${blobs.length} tayyar ho raha hai…`);
      await ff.writeFile(`in${i}.mp4`, new Uint8Array(await blobs[i]!.arrayBuffer()));
      const code = await ff.exec(["-y", "-i", `in${i}.mp4`, "-vf", "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,fps=24,setsar=1,format=yuv420p", "-an", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "24", `s${i}.mp4`]);
      if (code !== 0) throw new Error(`Scene ${i + 1} convert fail`);
      await ff.deleteFile(`in${i}.mp4`);
    }
    onProgress("Saare scenes jod rahe hain…");
    await ff.writeFile("list.txt", blobs.map((_, i) => `file 's${i}.mp4'`).join("\n"));
    if (await ff.exec(["-y", "-f", "concat", "-safe", "0", "-i", "list.txt", "-c", "copy", "-movflags", "+faststart", "movie.mp4"]) !== 0) throw new Error("Merge fail");
    const data = await ff.readFile("movie.mp4");
    if (typeof data === "string") throw new Error("Merge fail");
    return new Blob([new Uint8Array(data)], { type: "video/mp4" });
  } finally { ff.terminate(); }
}
