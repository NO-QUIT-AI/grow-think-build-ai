import type { VideoScene } from "./auto-video";
import { captionWordAt } from "./auto-video";
import wasmAsset from "@/assets/auto-video-core.wasm.asset.json";

type SpeechEngine = { loadConfig: (data: unknown) => void; loadVoice: (data: unknown) => void; speak: (text: string, options: Record<string, unknown>) => ArrayBuffer };
declare global { interface Window { noQuitSpeech?: SpeechEngine } }
let speechReady: Promise<SpeechEngine> | undefined;

async function offlineSpeech(): Promise<SpeechEngine> {
  if (!speechReady) speechReady = (async () => {
    if (!window.noQuitSpeech) await new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "/auto-video/voice/mespeak.js";
      script.onload = () => resolve(); script.onerror = () => reject(new Error("Free voice load nahi hui"));
      document.head.appendChild(script);
    });
    const engine = window.noQuitSpeech;
    if (!engine) throw new Error("Free voice unavailable");
    const [config, voice] = await Promise.all([fetch("/auto-video/voice/config.json").then(r => r.json()), fetch("/auto-video/voice/en-us.json").then(r => r.json())]);
    engine.loadConfig(config); engine.loadVoice(voice);
    return engine;
  })().catch(error => { speechReady = undefined; throw error; });
  return speechReady;
}

export async function freeVoice(text: string, natural: boolean): Promise<Blob> {
  if (natural && text.trim()) {
    try {
      const { EdgeTTS } = await import("edge-tts-universal/browser");
      const result = await Promise.race([new EdgeTTS(text, "en-US-GuyNeural").synthesize(), new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Edge blocked")), 8000))]);
      if (result.audio.size) return result.audio;
    } catch { /* Microsoft may block browser origins. Offline synthesis remains free. */ }
  }
  const engine = await offlineSpeech();
  const data = engine.speak(text.trim() || " ", { rawdata: "arraybuffer", speed: 155, amplitude: 100 });
  if (!data?.byteLength) throw new Error("Free voice generate nahi hui");
  return new Blob([data], { type: "audio/wav" });
}

function musicWav(seconds: number): Uint8Array {
  const rate = 22050, count = Math.ceil(seconds * rate);
  const buffer = new ArrayBuffer(44 + count * 2), view = new DataView(buffer);
  const str = (offset: number, value: string) => [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  str(0, "RIFF"); view.setUint32(4, 36 + count * 2, true); str(8, "WAVE"); str(12, "fmt "); view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); str(36, "data"); view.setUint32(40, count * 2, true);
  const notes = [261.63, 329.63, 392, 329.63];
  for (let i = 0; i < count; i++) { const t = i / rate, note = notes[Math.floor(t / 2) % notes.length] ?? 261.63; const fade = Math.min(1, t, seconds - t); view.setInt16(44 + i * 2, Math.sin(2 * Math.PI * note * t) * 1700 * Math.max(0, fade), true); }
  return new Uint8Array(buffer);
}

async function png(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("Caption failed")), "image/png"));
  return new Uint8Array(await blob.arrayBuffer());
}

export async function renderStoryVideo(scenes: VideoScene[], options: { natural: boolean; music: boolean; musicFile?: File | undefined; onProgress: (percent: number, label: string) => void; signal: AbortSignal }): Promise<Blob> {
  const { FFmpeg } = await import("@ffmpeg/ffmpeg");
  const { toBlobURL } = await import("@ffmpeg/util");
  const ff = new FFmpeg();
  const urls: string[] = [];
  const abort = () => ff.terminate();
  options.signal.addEventListener("abort", abort, { once: true });
  const check = () => { if (options.signal.aborted) throw new Error("Render cancel ho gaya"); };
  let phase = 0, span = 1;
  ff.on("progress", ({ progress }) => options.onProgress(Math.min(99, phase + Math.max(0, Math.min(1, progress)) * span), "Video render ho rahi hai…"));
  try {
    options.onProgress(1, "Free editor load ho raha hai…");
    const coreURL = await toBlobURL("/auto-video/ffmpeg/ffmpeg-core.js", "text/javascript"); urls.push(coreURL);
    const wasmURL = await toBlobURL(wasmAsset.url, "application/wasm"); urls.push(wasmURL);
    check();
    await ff.load({ coreURL, wasmURL });
    const ac = new AudioContext();
    const durations: number[] = [];
    try {
      for (let i = 0; i < scenes.length; i++) {
        check(); const scene = scenes[i]; if (!scene) continue;
        options.onProgress(5 + i * 2, `Scene ${i + 1}: free voice…`);
        const voice = await freeVoice(scene.voiceover_text, options.natural);
        const audio = await ac.decodeAudioData(await voice.arrayBuffer());
        durations.push(Math.max(1, audio.duration + 0.25));
        await ff.writeFile(`voice${i}.wav`, new Uint8Array(await voice.arrayBuffer()));
      }
    } finally { await ac.close(); }

    const css = getComputedStyle(document.documentElement);
    const captionFill = css.getPropertyValue("--video-caption").trim();
    const captionStroke = css.getPropertyValue("--video-caption-stroke").trim();
    const canvas = document.createElement("canvas"); canvas.width = 360; canvas.height = 640;
    const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("Canvas unavailable");
    for (let i = 0; i < scenes.length; i++) {
      check(); const scene = scenes[i]; if (!scene) continue;
      const duration = durations[i] ?? 2;
      phase = 18 + i * 65 / scenes.length; span = 65 / scenes.length;
      options.onProgress(phase, `Scene ${i + 1}: captions aur clip…`);
      let hasClip = false;
      if (scene.localClip || scene.clip) {
        const blob: Blob = scene.localClip ?? await fetch(scene.clip?.url ?? "", { signal: options.signal }).then(r => { if (!r.ok) throw new Error("Clip download fail; apna clip choose karo"); return r.blob(); });
        await ff.writeFile("clip.mp4", new Uint8Array(await blob.arrayBuffer())); hasClip = true;
      }
      const words = scene.text.split(/\s+/).filter(Boolean);
      const frames = Math.ceil(duration * 12);
      for (let frame = 0; frame < frames; frame++) {
        check(); ctx.clearRect(0, 0, 360, 640);
        if (!hasClip) {
          ctx.fillStyle = css.getPropertyValue("--video-stage").trim(); ctx.fillRect(0, 0, 360, 640);
          ctx.fillStyle = css.getPropertyValue("--video-accent").trim(); ctx.fillRect(28, 80, 48, 4);
          ctx.font = "600 16px sans-serif"; ctx.textAlign = "left"; ctx.fillText(`NO QUIT AI / ${String(i + 1).padStart(2, "0")}`, 28, 64);
          ctx.font = "700 28px sans-serif"; ctx.fillStyle = captionFill;
          const lines: string[] = []; let line = "";
          for (const word of words) { if (ctx.measureText(`${line} ${word}`).width > 300 && line) { lines.push(line); line = word; } else line = `${line} ${word}`.trim(); }
          if (line) lines.push(line);
          lines.forEach((text, row) => ctx.fillText(text, 28, 200 + row * 38));
        }
        const index = captionWordAt(scene.text, frame / 12, duration);
        const word = words[index] ?? "";
        const elapsed = frame / 12 - index * duration / Math.max(1, words.length);
        const scale = 1 + 0.16 * Math.max(0, 1 - elapsed / 0.16);
        ctx.save(); ctx.translate(180, 515); ctx.scale(scale, scale);
        ctx.font = "900 32px sans-serif"; ctx.textAlign = "center"; ctx.lineJoin = "round"; ctx.lineWidth = 7;
        ctx.strokeStyle = captionStroke; ctx.fillStyle = captionFill;
        ctx.strokeText(word, 0, 0, 300); ctx.fillText(word, 0, 0, 300); ctx.restore();
        await ff.writeFile(`cap${String(frame).padStart(5, "0")}.png`, await png(canvas));
      }
      const inputs = hasClip ? ["-stream_loop", "-1", "-i", "clip.mp4", "-i", `voice${i}.wav`, "-framerate", "12", "-i", "cap%05d.png"] : ["-framerate", "12", "-i", "cap%05d.png", "-i", `voice${i}.wav`];
      const filters = hasClip ? "[0:v]scale=360:640:force_original_aspect_ratio=increase,crop=360:640,setsar=1,fps=12[base];[base][2:v]overlay=0:0:shortest=1,format=yuv420p[v]" : "[0:v]format=yuv420p[v]";
      const exit = await ff.exec(["-y", ...inputs, "-filter_complex", filters, "-map", "[v]", "-map", "1:a", "-af", "apad", "-t", String(duration), "-c:v", "libx264", "-preset", "ultrafast", "-crf", "26", "-c:a", "aac", "-ar", "22050", "-ac", "1", `scene${i}.mp4`]);
      if (exit !== 0) throw new Error(`Scene ${i + 1} render fail`);
      for (let f = 0; f < frames; f++) await ff.deleteFile(`cap${String(f).padStart(5, "0")}.png`);
      await ff.deleteFile(`voice${i}.wav`); if (hasClip) await ff.deleteFile("clip.mp4");
    }
    check(); phase = 85; span = 13;
    await ff.writeFile("list.txt", scenes.map((_, i) => `file 'scene${i}.mp4'`).join("\n"));
    if (await ff.exec(["-y", "-f", "concat", "-safe", "0", "-i", "list.txt", "-c", "copy", "joined.mp4"]) !== 0) throw new Error("Merge failed");
    let output = "joined.mp4";
    if (options.music) {
      const total = durations.reduce((a, b) => a + b, 0);
      await ff.writeFile("music.audio", options.musicFile ? new Uint8Array(await options.musicFile.arrayBuffer()) : musicWav(total));
      if (await ff.exec(["-y", "-i", "joined.mp4", "-stream_loop", "-1", "-i", "music.audio", "-filter_complex", "[1:a]volume=0.18[m];[0:a][m]amix=inputs=2:duration=first:normalize=0[a]", "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-movflags", "+faststart", "final.mp4"]) !== 0) throw new Error("Music mix failed");
      output = "final.mp4";
    }
    const data = await ff.readFile(output);
    if (typeof data === "string") throw new Error("Invalid export");
    const copy = new Uint8Array(data.length); copy.set(data);
    options.onProgress(100, "Video ready!");
    return new Blob([copy.buffer], { type: "video/mp4" });
  } finally { options.signal.removeEventListener("abort", abort); ff.terminate(); urls.forEach(url => URL.revokeObjectURL(url)); }
}