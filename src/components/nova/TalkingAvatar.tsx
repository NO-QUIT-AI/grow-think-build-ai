import { useEffect, useRef, type MutableRefObject } from "react";
import { Loader2 } from "lucide-react";

import voiceAgent from "@/assets/voice-agent.jpg.asset.json";

type Phase = "listening" | "thinking" | "speaking";

/**
 * Photo-based talking avatar. Positions are % of the 9:16 source image.
 * Everything animates in one requestAnimationFrame loop via refs (no React re-renders) for smooth mobile.
 */
export function TalkingAvatar({
  phase,
  hearing,
  ampRef,
}: {
  phase: Phase;
  hearing: boolean;
  ampRef: MutableRefObject<number>;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const handRef = useRef<HTMLDivElement>(null);
  const mouthRef = useRef<HTMLDivElement>(null);
  const lidsRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({ phase, hearing });
  stateRef.current = { phase, hearing };

  useEffect(() => {
    let raf = 0;
    let nextBlink = performance.now() + 3000 + Math.random() * 1000;
    let blinkStart = -1;
    let level = 0;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const loop = (now: number) => {
      const { phase: p, hearing: h } = stateRef.current;
      const t = now / 1000;
      const speaking = p === "speaking";

      // Audio level: boundary spikes + syllable-like jitter, smoothed
      ampRef.current *= 0.9;
      const syllable = speaking ? 0.35 + 0.35 * Math.abs(Math.sin(t * 11)) * Math.abs(Math.sin(t * 4.3)) : 0;
      const target = speaking ? Math.min(1, syllable + ampRef.current * 0.6) : 0;
      level += (target - level) * 0.35;

      // Idle breathing
      const breathe = 1 + Math.sin(t * 1.6) * 0.008;
      if (wrapRef.current) wrapRef.current.style.transform = `scale(${breathe})`;

      // Head movement while talking
      if (headRef.current) {
        const k = speaking ? 1 : 0.25;
        const rx = Math.sin(t * 2.1) * 1.6 * k;
        const ty = Math.sin(t * 3.3) * 1.2 * k;
        headRef.current.style.transform = `translateY(${ty}px) rotate(${rx}deg)`;
      }

      // Hand gesture
      if (handRef.current) {
        const g = speaking ? Math.sin(t * 3.2) * 7 + level * 4 : Math.sin(t * 1.2) * 1;
        handRef.current.style.transform = `rotate(${g}deg) translateY(${speaking ? -level * 3 : 0}px)`;
      }

      // Lip-sync
      if (mouthRef.current) {
        const open = speaking ? 0.15 + level * 0.85 : 0;
        mouthRef.current.style.transform = `translate(-50%,-50%) scale(${0.9 + level * 0.25}, ${open})`;
        mouthRef.current.style.opacity = speaking ? "1" : "0";
      }

      // Blink every 3-4s
      if (now > nextBlink && blinkStart < 0) blinkStart = now;
      let lid = 0;
      if (blinkStart >= 0) {
        const d = (now - blinkStart) / 160;
        lid = d < 1 ? Math.sin(d * Math.PI) : 0;
        if (d >= 1) {
          blinkStart = -1;
          nextBlink = now + 3000 + Math.random() * 1000;
        }
      }
      if (lidsRef.current) lidsRef.current.style.transform = `scaleY(${lid})`;

      // Audio-reactive purple ring
      if (ctx && canvas) {
        const w = canvas.clientWidth;
        const hgt = canvas.clientHeight;
        if (canvas.width !== w * dpr) {
          canvas.width = w * dpr;
          canvas.height = hgt * dpr;
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, hgt);
        const cx = w / 2;
        const cy = hgt * 0.22;
        const base = w * 0.36;
        const pulse = p === "listening" ? (h ? 0.5 + 0.5 * Math.sin(t * 6) : 0.3 + 0.2 * Math.sin(t * 2.5)) : level;
        const r = base + pulse * w * 0.05;
        ctx.lineWidth = 2 + pulse * 4;
        ctx.strokeStyle = `rgba(168,110,255,${0.45 + pulse * 0.5})`;
        ctx.shadowColor = "rgba(150,90,255,0.9)";
        ctx.shadowBlur = 10 + pulse * 30;
        ctx.beginPath();
        const bars = 64;
        for (let i = 0; i <= bars; i += 1) {
          const a = (i / bars) * Math.PI * 2;
          const wob = speaking ? Math.sin(a * 6 + t * 8) * level * w * 0.015 : 0;
          const x = cx + Math.cos(a) * (r + wob);
          const y = cy + Math.sin(a) * (r + wob);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [ampRef]);

  const img = voiceAgent.url;
  const layer = "pointer-events-none absolute inset-0 h-full w-full select-none object-cover";

  return (
    <div className="relative aspect-[9/16] w-44 overflow-hidden rounded-3xl border border-primary/40 shadow-[0_0_40px_hsl(var(--primary)/0.35)] sm:w-52">
      <div ref={wrapRef} className="absolute inset-0 will-change-transform" style={{ transformOrigin: "50% 100%" }}>
        <img src={img} alt="NO QUIT AI voice agent" className={layer} draggable={false} />
        {/* Raised hand */}
        <div
          ref={handRef}
          className="absolute inset-0 will-change-transform"
          style={{ clipPath: "polygon(6% 28%, 32% 28%, 32% 46%, 6% 46%)", transformOrigin: "27% 44%" }}
        >
          <img src={img} alt="" className={layer} draggable={false} />
        </div>
        {/* Head */}
        <div
          ref={headRef}
          className="absolute inset-0 will-change-transform"
          style={{ clipPath: "ellipse(9% 8% at 50% 21%)", transformOrigin: "50% 28%" }}
        >
          <img src={img} alt="" className={layer} draggable={false} />
          <div ref={lidsRef} className="absolute inset-0" style={{ transformOrigin: "50% 18.6%" }}>
            <span className="absolute h-[1.4%] w-[5%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-background/95" style={{ left: "47.3%", top: "18.6%" }} />
            <span className="absolute h-[1.4%] w-[5%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-background/95" style={{ left: "53%", top: "18.6%" }} />
          </div>
          <div
            ref={mouthRef}
            className="absolute h-[1.6%] w-[5.5%] rounded-full bg-background shadow-[0_0_6px_hsl(var(--primary)/0.8)] will-change-transform"
            style={{ left: "50.2%", top: "23.6%", opacity: 0 }}
          />
        </div>
      </div>
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
      {phase === "thinking" && (
        <span className="absolute inset-0 flex items-center justify-center bg-background/30">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </span>
      )}
    </div>
  );
}
