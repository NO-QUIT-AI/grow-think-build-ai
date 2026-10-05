import { useState } from "react";
import { Clapperboard, Copy, Download, Loader2, Youtube } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { renderHtmlToCanvas } from "@/lib/html-png";
import avatarAsset from "@/assets/nqai-pro-avatar.jpg.asset.json";

type Props = { html: string; title: string; memoryId?: string | null };

function narration(title: string) {
  return `Arey bhai, dekho! Maine abhi NO QUIT AI se sirf ek prompt me ${title} bana diya. Na code likha, na designer hire kiya. Ye dekho screens, buttons, sab kuch ready. Pehle aisa kaam din lagata tha, ab chand seconds. Tum bhi apna idea likho, aur NO QUIT AI tumhare liye build kar dega. Link bio me hai. No quit, just growth!`;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export function ViralVideoButton({ html, title, memoryId }: Props) {
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState("");
  const [result, setResult] = useState<{ url: string; local: string } | null>(null);

  async function generate() {
    if (!html || busy) return;
    if (typeof MediaRecorder === "undefined") return toast.error("Ye browser video record nahi kar sakta");
    setBusy(true);
    try {
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (!token) throw new Error("Pehle login karo");
      const { data: plan } = await supabase.from("user_plans").select("plan").eq("user_id", s.session!.user.id).maybeSingle();
      const pro = plan?.plan === "pro";
      const W = pro ? 1080 : 720;
      const H = pro ? 1920 : 1280;

      setStep("Awaaz ban rahi hai...");
      const ttsRes = await fetch("/api/tts", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ text: narration(title) }),
      });
      if (!ttsRes.ok) throw new Error(`Voice nahi bani (${ttsRes.status})`);
      const audioBuf = await ttsRes.arrayBuffer();

      setStep("Build ki screen capture ho rahi hai...");
      const [shot, avatar] = await Promise.all([renderHtmlToCanvas(html, 420, 2), loadImage(avatarAsset.url)]);

      setStep("Video record ho rahi hai...");
      const ac = new AudioContext();
      const decoded = await ac.decodeAudioData(audioBuf.slice(0));
      const duration = Math.min(45, Math.max(30, decoded.duration + 1.5));
      const dest = ac.createMediaStreamDestination();
      const src = ac.createBufferSource();
      src.buffer = decoded;
      const analyser = ac.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      analyser.connect(dest);

      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d")!;
      const stream = canvas.captureStream(30);
      dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
      const mime = ["video/mp4;codecs=avc1,mp4a", "video/webm;codecs=vp9,opus", "video/webm"].find((m) =>
        MediaRecorder.isTypeSupported(m),
      )!;
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: pro ? 6_000_000 : 2_500_000 });
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      const done = new Promise<void>((r) => (rec.onstop = () => r()));

      const amp = new Uint8Array(analyser.frequencyBinCount);
      const u = W / 720;
      const t0 = performance.now();
      let raf = 0;
      const draw = () => {
        const t = (performance.now() - t0) / 1000;
        analyser.getByteFrequencyData(amp);
        const level = amp.reduce((a, b) => a + b, 0) / amp.length / 255;
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, W, H);
        // Screen recording area (scrolling build)
        const sx = 40 * u, sy = 120 * u, sw = W - 80 * u, sh = H * 0.55;
        const scale = sw / shot.width;
        const maxScroll = Math.max(0, shot.height * scale - sh);
        const scroll = maxScroll * Math.min(1, Math.max(0, (t - 2) / (duration - 6)));
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(sx, sy, sw, sh, 24 * u);
        ctx.clip();
        ctx.drawImage(shot, 0, scroll / scale, shot.width, sh / scale, sx, sy, sw, sh);
        ctx.restore();
        ctx.strokeStyle = "#00ff88";
        ctx.lineWidth = 4 * u;
        ctx.beginPath();
        ctx.roundRect(sx, sy, sw, sh, 24 * u);
        ctx.stroke();
        // Header
        ctx.fillStyle = "#00ff88";
        ctx.font = `700 ${40 * u}px 'Space Grotesk', sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText("BUILD SPEEDRUN ⚡", W / 2, 80 * u);
        // Talking avatar
        const r = 150 * u + level * 18 * u;
        const cx = W / 2, cy = sy + sh + 210 * u;
        ctx.save();
        ctx.shadowColor = "#00ff88";
        ctx.shadowBlur = 30 * u + level * 60 * u;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = "#00ff88";
        ctx.fill();
        ctx.restore();
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r - 8 * u, 0, Math.PI * 2);
        ctx.clip();
        const s = Math.max((2 * r) / avatar.width, (2 * r) / avatar.height);
        const bob = Math.sin(t * 2) * 4 * u;
        ctx.drawImage(avatar, cx - (avatar.width * s) / 2, cy - (avatar.height * s) / 2 + bob, avatar.width * s, avatar.height * s);
        ctx.restore();
        // Title
        ctx.fillStyle = "#fff";
        ctx.font = `600 ${30 * u}px 'DM Sans', sans-serif`;
        ctx.fillText(title.slice(0, 34), W / 2, H - 90 * u);
        if (!pro) {
          ctx.globalAlpha = 0.75;
          ctx.fillStyle = "#00ff88";
          ctx.font = `700 ${28 * u}px 'Space Grotesk', sans-serif`;
          ctx.fillText("Made with NO QUIT AI", W / 2, H - 40 * u);
          ctx.globalAlpha = 1;
        }
        if (t < duration) raf = requestAnimationFrame(draw);
        else rec.stop();
      };
      rec.start(1000);
      src.start();
      draw();
      await done;
      cancelAnimationFrame(raf);
      void ac.close();

      const type = mime.startsWith("video/mp4") ? "video/mp4" : "video/webm";
      const blob = new Blob(chunks, { type });
      const local = URL.createObjectURL(blob);

      setStep("Cloud me save ho rahi hai...");
      const up = await fetch("/api/viral-video", {
        method: "POST",
        headers: {
          "content-type": type,
          authorization: `Bearer ${token}`,
          "x-title": encodeURIComponent(title),
          ...(memoryId ? { "x-memory-id": memoryId } : {}),
        },
        body: blob,
      });
      if (!up.ok) throw new Error(`Upload fail (${up.status})`);
      const { url } = (await up.json()) as { url: string };
      setResult({ url, local });
      toast.success("Viral video ready! 🎬");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Video nahi ban saki");
    } finally {
      setBusy(false);
      setStep("");
    }
  }

  return (
    <>
      <Button
        size="sm"
        className="btn-green h-9 flex-1 gap-1.5 rounded-xl text-xs sm:flex-none"
        disabled={busy || !html}
        onClick={() => void generate()}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clapperboard className="h-4 w-4" />}
        {busy ? step || "..." : "Generate Viral Build Video"}
      </Button>
      <Dialog open={!!result} onOpenChange={(o) => !o && setResult(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Build Speedrun video 🎬</DialogTitle>
          </DialogHeader>
          {result && (
            <div className="space-y-3">
              <video src={result.local} controls playsInline className="mx-auto max-h-[60vh] rounded-xl" />
              <div className="grid grid-cols-2 gap-2">
                <Button asChild size="sm" className="btn-green gap-1">
                  <a href={result.local} download={`${title.slice(0, 30) || "nqai"}-speedrun`}>
                    <Download className="h-4 w-4" /> Download
                  </a>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  onClick={() => void navigator.clipboard.writeText(result.url).then(() => toast.success("Link copy ho gaya"))}
                >
                  <Copy className="h-4 w-4" /> Copy Link
                </Button>
                <Button asChild size="sm" variant="outline">
                  <a href="https://www.tiktok.com/upload" target="_blank" rel="noopener noreferrer">TikTok</a>
                </Button>
                <Button asChild size="sm" variant="outline" className="gap-1">
                  <a href="https://www.youtube.com/upload" target="_blank" rel="noopener noreferrer">
                    <Youtube className="h-4 w-4" /> Shorts
                  </a>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Video download karke TikTok/Shorts par post karo. Zyada views par bonus credits milenge!
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
