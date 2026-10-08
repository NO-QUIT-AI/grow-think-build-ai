import { cleanTranscript, mergeFinal } from "@/lib/voice-transcript";
import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import proAvatar from "@/assets/nqai-galaxy-avatar.jpg.asset.json";

let currentAudio: HTMLAudioElement | null = null;

/** ElevenLabs lifelike awaaz; fail ho to browser voice. */
export async function speakHuman(text: string, lang: string, onEnd: () => void, ampRef: { current: number }) {
  const clean = speakableText(text);
  try {
    const { data: s } = await supabase.auth.getSession();
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${s.session?.access_token ?? ""}` },
      body: JSON.stringify({ text: clean }),
    });
    if (!res.ok) throw new Error("tts");
    const url = URL.createObjectURL(await res.blob());
    const audio = new Audio(url);
    currentAudio = audio;
    let raf = 0;
    try {
      const ctx = new AudioContext();
      const an = ctx.createAnalyser();
      an.fftSize = 256;
      ctx.createMediaElementSource(audio).connect(an);
      an.connect(ctx.destination);
      const buf = new Uint8Array(an.frequencyBinCount);
      const tick = () => {
        an.getByteFrequencyData(buf);
        ampRef.current = Math.min(1, buf.reduce((a, b) => a + b, 0) / buf.length / 90);
        raf = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      ampRef.current = 0.6;
    }
    const done = () => {
      cancelAnimationFrame(raf);
      ampRef.current = 0;
      URL.revokeObjectURL(url);
      if (currentAudio === audio) currentAudio = null;
      onEnd();
    };
    audio.onended = done;
    audio.onerror = done;
    await audio.play();
  } catch {
    speakText(clean, lang, () => { ampRef.current = 0; onEnd(); }, () => { ampRef.current = 1; });
  }
}

export function stopHuman() {
  currentAudio?.pause();
  currentAudio = null;
  if (typeof window !== "undefined") window.speechSynthesis?.cancel();
}

function ProAvatar({ phase, ampRef }: { phase: string; ampRef: { current: number } }) {
  const ref = useRef<HTMLImageElement | null>(null);
  useEffect(() => {
    let raf = 0;
    const loop = (t: number) => {
      const a = ampRef.current;
      const breathe = Math.sin(t / 900) * 0.01;
      if (ref.current) ref.current.style.transform = `scale(${1.02 + breathe + a * 0.03}) rotate(${Math.sin(t / 700) * a * 1.5}deg)`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [ampRef]);
  return (
    <div className={`relative aspect-[3/4] w-52 overflow-hidden rounded-3xl border border-primary/40 transition-shadow duration-[400ms] sm:w-60 ${phase === "speaking" ? "shadow-[0_0_50px_hsl(var(--primary)/0.6)]" : "shadow-[0_0_25px_hsl(var(--primary)/0.25)]"}`}>
      <img ref={ref} src={proAvatar.url} alt="NO QUIT AI voice agent" className="h-full w-full object-cover will-change-transform" draggable={false} />
      {phase === "thinking" && <div className="absolute inset-x-0 bottom-3 text-center text-xs text-foreground">...</div>}
    </div>
  );
}

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
};

export function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

const LOCALES: Record<string, string> = { en: "en-US", ur: "hi-IN", hi: "hi-IN", ar: "ar-SA" };

/** Markdown / code hata ke bolne layak saaf text. */
export function speakableText(md: string) {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#*_>~|-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1500);
}

export function speakText(text: string, lang: string, onEnd?: () => void, onWord?: () => void) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    onEnd?.();
    return;
  }
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(speakableText(text));
  const locale = LOCALES[lang] ?? "hi-IN";
  u.lang = locale;
  u.rate = 1.05;
  u.pitch = 0.95;
  // Sab se natural (human jaisi) voice chuno: Neural/Natural/Google/Online voices pehle
  const matches = synth.getVoices().filter((v) => v.lang.replace("_", "-").startsWith(locale.slice(0, 2)));
  const score = (v: SpeechSynthesisVoice) =>
    (/natural|neural|online/i.test(v.name) ? 4 : 0) + (/google/i.test(v.name) ? 3 : 0) + (/premium|enhanced/i.test(v.name) ? 2 : 0) + (v.localService ? 0 : 1);
  const voice = matches.sort((a, b) => score(b) - score(a))[0];
  if (voice) u.voice = voice;
  u.onboundary = (event) => {
    if (event.name === "word" || event.charIndex >= 0) onWord?.();
  };
  u.onend = () => onEnd?.();
  u.onerror = () => onEnd?.();
  synth.speak(u);
}

type Phase = "listening" | "thinking" | "speaking";

export function VoiceModal({
  lang,
  onTranscript,
  ask,
  onClose,
}: {
  lang: string;
  onTranscript: (text: string) => void;
  ask: (text: string) => Promise<string>;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [reply, setReply] = useState("");
  const [muted, setMuted] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [phase, setPhase] = useState<Phase>("listening");
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalRef = useRef("");
  const lastSentRef = useRef({ text: "", at: 0 });
  const phaseRef = useRef<Phase>("listening");
  const mutedRef = useRef(false);
  const aliveRef = useRef(true);
  const ampRef = useRef(0);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  function setP(p: Phase) {
    phaseRef.current = p;
    setPhase(p);
  }

  function startListening() {
    if (!aliveRef.current) return;
    finalRef.current = "";
    setText("");
    setP("listening");
    try {
      recRef.current?.start();
    } catch {
      /* already started */
    }
  }

  async function handleQuestion(value: string) {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!value || phaseRef.current !== "listening") return;
    setP("thinking");
    try {
      recRef.current?.abort();
    } catch {
      /* ignore */
    }
    finalRef.current = "";
    try {
      const answer = await ask(value);
      if (!aliveRef.current) return;
      setReply(answer);
      // Speaking shuru — purana transcript buffer saaf
      finalRef.current = "";
      setText("");
      setP("speaking");
      void speakHuman(answer, lang, () => {
        if (aliveRef.current) startListening();
      }, ampRef);
    } catch {
      if (aliveRef.current) startListening();
    }
  }

  useEffect(() => {
    aliveRef.current = true;
    const Ctor = getSpeechRecognition();
    if (!Ctor) {
      toast.error("Voice not supported in this browser");
      onClose();
      return;
    }
    const rec = new Ctor();
    recRef.current = rec;
    rec.lang = LOCALES[lang] ?? "hi-IN";
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (event: any) => {
      if (mutedRef.current || phaseRef.current !== "listening") return;
      // Sirf FINAL results state me jaate hain; interim sirf dikhane ke liye.
      let interim = "";
      let final = finalRef.current;
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const chunk = String(event.results[i][0].transcript ?? "").trim();
        if (!chunk) continue;
        if (event.results[i].isFinal) final = mergeFinal(final, chunk);
        else interim = chunk;
      }
      final = cleanTranscript(final);
      finalRef.current = final;
      const shown = cleanTranscript(mergeFinal(final, interim));
      setText(shown);
      onTranscript(shown);
      setSpeaking(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      // VAD: 800ms khamoshi ke baad hi final
      timerRef.current = setTimeout(() => {
        const value = finalRef.current.trim() || shown;
        const now = Date.now();
        const key = value.toLowerCase();
        if (key === lastSentRef.current.text && now - lastSentRef.current.at < 2000) {
          finalRef.current = "";
          setText("");
          return;
        }
        lastSentRef.current = { text: key, at: now };
        void handleQuestion(value);
      }, 800);
    };
    rec.onerror = (event: any) => {
      if (event?.error === "not-allowed") {
        toast.error("Microphone permission blocked");
        onClose();
      }
    };
    rec.onend = () => {
      setSpeaking(false);
      // Mobile browsers band kar dete hain — listening phase me dobara chalu karo
      if (aliveRef.current && phaseRef.current === "listening") {
        try {
          rec.start();
        } catch {
          /* ignore */
        }
      }
    };
    // Voice khulte hi user se khud baat shuru kare
    const greet = "Arre bhai, kya haal hai? Bolo, aaj kya scene hai?";
    setReply(greet);
    setP("speaking");
    void speakHuman(greet, lang, () => {
      if (aliveRef.current) startListening();
    }, ampRef);

    return () => {
      aliveRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      rec.onresult = null;
      rec.onend = null;
      rec.onerror = null;
      try {
        rec.abort();
      } catch {
        /* ignore */
      }
      stopHuman();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  function stopOrSend() {
    if (phaseRef.current === "speaking") {
      stopHuman();
      startListening();
      return;
    }
    const value = (finalRef.current || text).trim();
    if (value) void handleQuestion(value);
    else onClose();
  }

  const active = (phase === "listening" && speaking && !muted) || phase === "speaking";
  const status =
    phase === "thinking"
      ? "Thinking..."
      : phase === "speaking"
        ? "Speaking... (tap to interrupt)"
        : muted
          ? "Muted"
          : speaking
            ? "Listening..."
            : "Bolo, main sun raha hoon";

  return (
    <div className="fixed inset-0 z-[70] flex flex-col items-center justify-between bg-background/80 px-6 py-8 backdrop-blur-xl">
      <div className="flex w-full items-center justify-end">
        <Button variant="ghost" size="icon" aria-label="Close voice chat" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex flex-col items-center gap-6">
        <button type="button" onClick={stopOrSend} aria-label="Voice agent" className="block bg-transparent">
          <ProAvatar phase={phase} ampRef={ampRef} />
        </button>

        <p className="text-center text-sm text-muted-foreground">{status}</p>
        {text && phase !== "speaking" && (
          <p className="max-w-md text-center text-base font-medium text-foreground">{text}</p>
        )}
        {reply && phase === "speaking" && (
          <p className="line-clamp-6 max-w-md text-center text-sm text-foreground/90">{speakableText(reply)}</p>
        )}
      </div>

      <div className="flex w-full flex-col items-center gap-6">
        <div className="flex h-12 items-end gap-1.5" aria-hidden>
          {Array.from({ length: 16 }).map((_, i) => (
            <span
              key={i}
              className="w-1.5 rounded-full bg-primary/70"
              style={{
                height: active ? "100%" : "12%",
                animation: active ? `voice-wave 1s ease-in-out ${i * 0.06}s infinite` : "none",
              }}
            />
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" size="lg" className="rounded-full" onClick={() => setMuted((m) => !m)}>
            {muted ? <MicOff className="mr-2 h-4 w-4" /> : <Mic className="mr-2 h-4 w-4" />}
            {muted ? "Unmute" : "Mute"}
          </Button>
          <Button type="button" size="lg" className="btn-green rounded-full px-8" onClick={onClose}>
            End
          </Button>
        </div>
      </div>
    </div>
  );
}
