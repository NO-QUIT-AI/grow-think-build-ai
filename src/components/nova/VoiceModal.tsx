import { ConversationProvider, useConversation } from "@elevenlabs/react";
import { detectSpeechLang } from "@/lib/voice-transcript";
import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import proAvatar from "@/assets/nqai-galaxy-avatar.jpg.asset.json";
import { VoiceSphere } from "./VoiceSphere";
import { finalTranscript, micAllowed, silenceElapsed, VOICE_AUDIO_CONSTRAINTS, VOICE_THRESHOLD } from "@/lib/voice-turn";

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
  phase, ampRef, micAmpRef, status, text, muted, onMute, onEnd, onTap, userTalking = false,
}: {
  userTalking?: boolean;
  phase: ScenePhase; ampRef: { current: number }; micAmpRef: { current: number }; status: string; text: string;
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

  const end = () => { try { navigator.vibrate?.(60); } catch { /* ignore */ } onEnd(); };

  return (
    <div className="fixed inset-0 z-[70] overflow-hidden bg-background" onClick={onTap}>
      <div aria-hidden className={`galaxy-layer galaxy-far ${phase === "speaking" ? "galaxy-glow" : ""}`} style={{ backgroundImage: `url(${proAvatar.url})` }} />
      <div ref={imgRef} aria-hidden className="galaxy-layer galaxy-near" style={{ backgroundImage: `url(${proAvatar.url})` }} />
      <div aria-hidden className="galaxy-stars pointer-events-none" />
      <div className="galaxy-overlay pointer-events-none" />
      <VoiceSphere aiAmpRef={ampRef} micAmpRef={micAmpRef} />
      <div className="relative z-10 flex h-full flex-col items-center justify-between px-6 pb-[calc(env(safe-area-inset-bottom)+120px)] pt-6">
        <div aria-hidden />
        <div aria-hidden />
        <div className="flex w-full flex-col items-center gap-6">
          <div aria-live="polite" className={`galaxy-text text-sm font-semibold transition-opacity duration-150 ${userTalking && !muted ? "opacity-100" : "opacity-0"}`}>Listening...</div>
          <div className="flex items-center gap-5">
            <Button variant="outline" type="button" onClick={(e) => { e.stopPropagation(); onMute(); }} className={`glass-btn galaxy-text flex h-16 ${userTalking && !muted ? "animate-pulse ring-2 ring-primary" : ""} items-center gap-2 rounded-full px-7 text-base font-semibold`}>
              {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              {muted ? "Unmute" : "Mute"}
            </Button>
            <Button type="button" onClick={(e) => { e.stopPropagation(); end(); }} className="btn-green flex h-16 items-center rounded-full px-10 text-base font-bold">
              End
            </Button>
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

function LegacyVoiceModal({ lang, onTranscript, ask, onClose }: {
  lang: string; onTranscript: (text: string) => void; ask: (text: string) => Promise<string>; onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [muted, setMuted] = useState(false);
  const [talking, setTalking] = useState(false);
  const [phase, setPhase] = useState<Phase>("listening");
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const phaseRef = useRef<Phase>("listening");
  const mutedRef = useRef(false);
  const aliveRef = useRef(true);
  const finalRef = useRef("");
  const pendingRef = useRef(false);
  const lastVoice = useRef(0);
  const turnRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  const ampRef = useRef(0);
  const micAmpRef = useRef(0);

  function setP(next: Phase) {
    phaseRef.current = next;
    setPhase(next);
    const allowed = micAllowed(next, mutedRef.current);
    streamRef.current?.getAudioTracks().forEach(track => { track.enabled = allowed; });
    if (!allowed) { micAmpRef.current = 0; setTalking(false); }
  }
  function startListening() {
    if (!aliveRef.current) return;
    pendingRef.current = false;
    finalRef.current = "";
    lastVoice.current = 0;
    setText("");
    setP("listening");
    if (!mutedRef.current) { try { recRef.current?.start(); } catch { /* already active */ } }
  }
  async function handleQuestion(value: string) {
    if (!value || !aliveRef.current) { startListening(); return; }
    const turn = ++turnRef.current;
    pendingRef.current = false;
    setP("thinking");
    try { recRef.current?.stop(); } catch { /* already stopped */ }
    finalRef.current = "";
    try {
      const answer = await ask(value);
      if (!aliveRef.current || turn !== turnRef.current) return;
      setP("speaking");
      void speakHuman(answer, detectSpeechLang(value), () => {
        if (aliveRef.current && turn === turnRef.current) startListening();
      }, ampRef);
    } catch { if (aliveRef.current && turn === turnRef.current) startListening(); }
  }
  function endTurn() {
    if (!micAllowed(phaseRef.current, mutedRef.current) || pendingRef.current) return;
    pendingRef.current = true;
    setP("thinking");
    // stop(), not abort(): allow the recognizer to deliver its last FINAL result.
    try { recRef.current?.stop(); } catch { void handleQuestion(finalRef.current); }
  }
  useEffect(() => {
    aliveRef.current = true;
    const Ctor = getSpeechRecognition();
    if (!Ctor) { toast.error("Voice not supported in this browser"); onClose(); return; }
    const rec = new Ctor();
    recRef.current = rec;
    rec.lang = "en-IN";
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = event => {
      if (mutedRef.current || (phaseRef.current !== "listening" && !pendingRef.current)) return;
      finalRef.current = finalTranscript(finalRef.current, event.results, event.resultIndex);
      setText(finalRef.current);
      onTranscript(finalRef.current);
    };
    rec.onend = () => {
      if (!aliveRef.current) return;
      if (pendingRef.current) { void handleQuestion(finalRef.current); return; }
      if (micAllowed(phaseRef.current, mutedRef.current)) {
        try { rec.start(); } catch { /* already active */ }
      }
    };
    rec.onerror = event => {
      if (event?.error === "not-allowed") { toast.error("Microphone permission blocked"); onClose(); }
    };
    let ctx: AudioContext | null = null;
    let raf = 0;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: VOICE_AUDIO_CONSTRAINTS });
        if (!aliveRef.current) { stream.getTracks().forEach(track => track.stop()); return; }
        streamRef.current = stream;
        ctx = new AudioContext();
        await ctx.resume();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        ctx.createMediaStreamSource(stream).connect(analyser);
        const bytes = new Uint8Array(analyser.fftSize);
        const tick = () => {
          const allowed = micAllowed(phaseRef.current, mutedRef.current);
          analyser.getByteTimeDomainData(bytes);
          let energy = 0;
          for (const byte of bytes) energy += ((byte - 128) / 128) ** 2;
          const volume = allowed ? Math.sqrt(energy / bytes.length) : 0;
          micAmpRef.current = volume;
          const detected = volume >= VOICE_THRESHOLD;
          setTalking(detected);
          if (detected) lastVoice.current = performance.now();
          else if (allowed && silenceElapsed(lastVoice.current, performance.now())) endTurn();
          raf = requestAnimationFrame(tick);
        };
        startListening();
        tick();
      } catch { toast.error("Microphone start nahi hua"); onClose(); }
    })();
    return () => {
      aliveRef.current = false;
      turnRef.current++;
      cancelAnimationFrame(raf);
      rec.onresult = null; rec.onend = null; rec.onerror = null;
      rec.abort();
      streamRef.current?.getTracks().forEach(track => track.stop());
      void ctx?.close();
      stopHuman();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);
  const toggleMute = () => {
    const next = !mutedRef.current;
    mutedRef.current = next; setMuted(next);
    streamRef.current?.getAudioTracks().forEach(track => { track.enabled = micAllowed(phaseRef.current, next); });
    if (next) {
      finalRef.current = ""; lastVoice.current = 0; micAmpRef.current = 0; setTalking(false);
      try { recRef.current?.abort(); } catch { /* already stopped */ }
    } else if (phaseRef.current === "listening") startListening();
  };
  const tap = () => {
    if (phaseRef.current === "speaking") { turnRef.current++; stopHuman(); ampRef.current = 0; startListening(); }
    else if (phaseRef.current === "listening" && finalRef.current) endTurn();
  };
  return <GalaxyScene phase={phase} ampRef={ampRef} micAmpRef={micAmpRef} status={phase === "speaking" ? "Speaking... (tap to interrupt)" : phase === "thinking" ? "Thinking..." : "Bolo, main sun raha hoon"}
    text={text} muted={muted} userTalking={talking} onMute={toggleMute} onEnd={onClose} onTap={tap} />;
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
  const [userTalking, setUserTalking] = useState(false);
  const [liveSpeaking, setLiveSpeaking] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [interrupted, setInterrupted] = useState(false);
  const micAmpRef = useRef(0);
  const lastVoice = useRef(0);
  const liveState = useRef({ speaking: false, muted: false, thinking: false });
  const talkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ampRef = useRef(0);
  const fellBack = useRef(false);
  const closing = useRef(false);

  const fallback = () => {
    if (fellBack.current || closing.current) return;
    fellBack.current = true;
    onFallback();
  };

  const conversation = useConversation({
    micMuted: muted || (liveSpeaking && !interrupted) || thinking,
    onModeChange: ({ mode }) => {
      setLiveSpeaking(mode === "speaking"); setThinking(false); setInterrupted(false);
      liveState.current.speaking = mode === "speaking";
      liveState.current.thinking = false;
      if (mode === "speaking") { setUserTalking(false); micAmpRef.current = 0; }
    },
    onConnect: () => setConnected(true),
    onDisconnect: () => {
      if (!closing.current) fallback();
    },
    onError: () => fallback(),
    onVadScore: ({ vadScore }: { vadScore: number }) => {
      if (liveState.current.speaking || liveState.current.muted || liveState.current.thinking || vadScore < 0.5) return;
      lastVoice.current = performance.now();
      setUserTalking(true);
    },
    onMessage: (m: any) => {
      if (m?.source === "user") { setHeard(String(m.message ?? "")); setThinking(true); setUserTalking(false); }
      else if (m?.message) setReply(String(m.message));
    },
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Mic aur token saath saath — foran pre-connect
        const tokenReq = supabase.auth.getSession().then(({ data: s }) => fetch("/api/voice-agent-token", {
          method: "POST",
          headers: { authorization: `Bearer ${s.session?.access_token ?? ""}` },
        }));
        const [permissionStream, res] = await Promise.all([navigator.mediaDevices.getUserMedia({ audio: VOICE_AUDIO_CONSTRAINTS }), tokenReq]);
        permissionStream.getTracks().forEach(track => track.stop());
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
      if (talkTimer.current) clearTimeout(talkTimer.current);
      void conversation.endSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const speaking = conversation.isSpeaking && !interrupted;
  liveState.current = { speaking, muted, thinking };
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      try {
        ampRef.current = speaking ? Math.min(1, conversation.getOutputVolume() * 2) : 0;
        const allowed = connected && !liveState.current.speaking && !liveState.current.muted && !liveState.current.thinking;
        micAmpRef.current = allowed ? conversation.getInputVolume() : 0;
        const active = allowed && micAmpRef.current >= VOICE_THRESHOLD;
        if (active) { lastVoice.current = performance.now(); setUserTalking(true); }
        else if (allowed && silenceElapsed(lastVoice.current, performance.now())) {
          lastVoice.current = 0; setUserTalking(false); setThinking(true);
        } else if (!allowed) setUserTalking(false);
      } catch {
        ampRef.current = speaking ? 0.6 : 0;
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [speaking, conversation, connected]);

  useEffect(() => { if (!conversation.isSpeaking) conversation.setVolume({ volume: 1 }); }, [conversation.isSpeaking]);
  const ready = useFastConnect(connected);
  const phase: ScenePhase = !ready ? "connecting" : speaking ? "speaking" : thinking ? "thinking" : "listening";
  const status = !ready ? "Connecting..." : speaking ? "Speaking... (bol kar tok sakte ho)" : muted ? "Muted" : "Bolo, main sun raha hoon";

  return (
    <GalaxyScene phase={phase} ampRef={ampRef} micAmpRef={micAmpRef} status={status} text={speaking && reply ? reply : heard}
      muted={muted} userTalking={userTalking && !speaking} onMute={() => setMuted((m) => !m)} onEnd={onClose}
      onTap={() => {
        if (!speaking) return;
        conversation.setVolume({ volume: 0 });
        conversation.sendUserActivity();
        setInterrupted(true); setThinking(false); setLiveSpeaking(false);
        lastVoice.current = 0;
      }} />
  );
}
