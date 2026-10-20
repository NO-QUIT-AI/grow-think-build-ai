import { ConversationProvider, useConversation } from "@elevenlabs/react";
import { cleanTranscript, detectSpeechLang, mergeFinal } from "@/lib/voice-transcript";
import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
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

type ScenePhase = "connecting" | "listening" | "thinking" | "speaking";

/** Full-screen galaxy: speed changes smoothly with phase (60s idle, 8s listening, 20s speaking). */
function GalaxyScene({
  phase, ampRef, status, text, muted, onMute, onEnd, onTap,
}: {
  phase: ScenePhase; ampRef: { current: number }; status: string; text: string;
  muted: boolean; onMute: () => void; onEnd: () => void; onTap?: () => void;
}) {
  const imgRef = useRef<HTMLDivElement | null>(null);
  const ringRef = useRef<HTMLDivElement | null>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  useEffect(() => {
    let raf = 0;
    const loop = (t: number) => {
      const p = phaseRef.current;
      const a = ampRef.current;
      if (imgRef.current) imgRef.current.style.opacity = String(p === "speaking" ? 0.55 + a * 0.3 : 0.45);
      if (ringRef.current) {
        const k = p === "speaking" ? 0.4 + a : p === "listening" ? 0.25 + Math.abs(Math.sin(t / 500)) * 0.2 : 0.1;
        ringRef.current.style.transform = `translate(-50%,-50%) scale(${0.9 + k * 0.4})`;
        ringRef.current.style.opacity = String(Math.min(1, 0.25 + k));
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [ampRef]);

  void status; void text;
  useEffect(() => { if (text) console.log("[voice transcript]", text); }, [text]);
  const end = () => { try { navigator.vibrate?.(60); } catch { /* ignore */ } onEnd(); };

  return (
    <div className="fixed inset-0 z-[70] overflow-hidden bg-background" onClick={onTap}>
      <div aria-hidden className={`galaxy-layer galaxy-far ${phase === "speaking" ? "galaxy-glow" : ""}`} style={{ backgroundImage: `url(${proAvatar.url})` }} />
      <div ref={imgRef} aria-hidden className="galaxy-layer galaxy-near" style={{ backgroundImage: `url(${proAvatar.url})` }} />
      <div aria-hidden className="galaxy-stars pointer-events-none" />
      <div className="galaxy-overlay pointer-events-none" />
      <div ref={ringRef} aria-hidden className="pointer-events-none fixed left-1/2 top-[42%] h-64 w-64 rounded-full border-2 border-primary shadow-[0_0_60px_var(--primary)]" />
      <div className="relative z-10 flex h-full flex-col items-center justify-between px-6 pb-[calc(env(safe-area-inset-bottom)+120px)] pt-6">
        <div aria-hidden />
        <div aria-hidden />
        <div className="flex w-full flex-col items-center gap-6">
          <div className="flex items-center gap-5">
            <button type="button" onClick={(e) => { e.stopPropagation(); onMute(); }} className="glass-btn galaxy-text flex h-16 items-center gap-2 rounded-full px-7 text-base font-semibold">
              {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              {muted ? "Unmute" : "Mute"}
            </button>
            <button type="button" onClick={(e) => { e.stopPropagation(); end(); }} className="btn-green flex h-16 items-center rounded-full px-10 text-base font-bold">
              End
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Connecting max 0.8s dikhe, phir listening. */
function useFastConnect(connected: boolean) {
  const [quick, setQuick] = useState(false);
  useEffect(() => { const id = setTimeout(() => setQuick(true), 800); return () => clearTimeout(id); }, []);
  return connected || quick;
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

const LOCALES: Record<string, string> = { en: "en-IN", ur: "hi-IN", hi: "hi-IN", ar: "ar-SA" };

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

function LegacyVoiceModal({
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
      try { recRef.current?.start(); } catch { /* already running */ }
      const userLang = detectSpeechLang(value);

      void speakHuman(answer, userLang, () => {
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
    rec.lang = "en-IN"; // Latin script: English aur Roman Hindi dono
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (event: any) => {
      if (mutedRef.current) return;
      if (phaseRef.current === "speaking") {
        // Barge-in: user bola to AI foran chup
        const said = String(event.results[event.results.length - 1]?.[0]?.transcript ?? "").trim();
        if (said.split(/\s+/).length < 2) return;
        stopHuman();
        ampRef.current = 0;
        phaseRef.current = "listening";
        setPhase("listening");
      } else if (phaseRef.current !== "listening") return;
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
      if (aliveRef.current && phaseRef.current !== "thinking") {
        try {
          rec.start();
        } catch {
          /* ignore */
        }
      }
    };
    // AI pehle nahi bolega — sirf suno
    startListening();

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

  const status =
    phase === "thinking" ? "Soch raha hoon..."
      : phase === "speaking" ? "Speaking... (bol kar tok sakte ho)"
        : muted ? "Muted" : speaking ? "Sun raha hoon..." : "Bolo, main sun raha hoon";
  const shown = phase === "speaking" ? speakableText(reply) : text;

  return (
    <GalaxyScene phase={phase} ampRef={ampRef} status={status} text={shown} muted={muted}
      onMute={() => setMuted((m) => !m)} onEnd={onClose} onTap={stopOrSend} />
  );
}

type VoiceProps = {
  lang: string;
  onTranscript: (text: string) => void;
  ask: (text: string) => Promise<string>;
  onClose: () => void;
};

/** Pehle ElevenLabs live agent; fail / minute khatam → purani voice. */
export function VoiceModal(props: VoiceProps) {
  const [mode, setMode] = useState<"live" | "legacy">("live");
  if (mode === "legacy") return <LegacyVoiceModal {...props} />;
  return (
    <ConversationProvider>
      <LiveVoiceModal {...props} onFallback={() => setMode("legacy")} />
    </ConversationProvider>
  );
}

function LiveVoiceModal({ onClose, onFallback }: VoiceProps & { onFallback: () => void }) {
  const [reply, setReply] = useState("");
  const [heard, setHeard] = useState("");
  const [muted, setMuted] = useState(false);
  const [connected, setConnected] = useState(false);
  const ampRef = useRef(0);
  const fellBack = useRef(false);
  const closing = useRef(false);

  const fallback = () => {
    if (fellBack.current || closing.current) return;
    fellBack.current = true;
    onFallback();
  };

  const conversation = useConversation({
    micMuted: muted,
    onConnect: () => setConnected(true),
    onDisconnect: () => {
      if (!closing.current) fallback();
    },
    onError: () => fallback(),
    onMessage: (m: any) => {
      if (m?.source === "user") setHeard(String(m.message ?? ""));
      else if (m?.message) setReply(String(m.message));
    },
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        const { data: s } = await supabase.auth.getSession();
        const res = await fetch("/api/voice-agent-token", {
          method: "POST",
          headers: { authorization: `Bearer ${s.session?.access_token ?? ""}` },
        });
        if (!res.ok) throw new Error("token");
        const { token } = (await res.json()) as { token: string };
        if (cancelled) return;
        await conversation.startSession({ conversationToken: token, connectionType: "webrtc" });
      } catch {
        if (!cancelled) fallback();
      }
    })();
    return () => {
      cancelled = true;
      closing.current = true;
      void conversation.endSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const speaking = conversation.isSpeaking;
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      try {
        ampRef.current = speaking ? Math.min(1, conversation.getOutputVolume() * 2) : 0;
      } catch {
        ampRef.current = speaking ? 0.6 : 0;
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [speaking, conversation]);

  const ready = useFastConnect(connected);
  const phase: ScenePhase = !ready ? "connecting" : speaking ? "speaking" : "listening";
  const status = !ready ? "Connecting..." : speaking ? "Speaking... (bol kar tok sakte ho)" : muted ? "Muted" : "Bolo, main sun raha hoon";

  return (
    <GalaxyScene phase={phase} ampRef={ampRef} status={status} text={speaking && reply ? reply : heard}
      muted={muted} onMute={() => setMuted((m) => !m)} onEnd={onClose} />
  );
}
