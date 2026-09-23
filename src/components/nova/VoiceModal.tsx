import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, MicOff, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

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

export function speakText(text: string, lang: string, onEnd?: () => void) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    onEnd?.();
    return;
  }
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(speakableText(text));
  const locale = LOCALES[lang] ?? "hi-IN";
  u.lang = locale;
  u.rate = 0.95; // flutter_tts 0.5 ≈ normal speed on the web
  const voice = synth.getVoices().find((v) => v.lang.replace("_", "-").startsWith(locale.slice(0, 2)));
  if (voice) u.voice = voice;
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
  const phaseRef = useRef<Phase>("listening");
  const mutedRef = useRef(false);
  const aliveRef = useRef(true);

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
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
    try {
      const answer = await ask(value);
      if (!aliveRef.current) return;
      setReply(answer);
      setP("speaking");
      speakText(answer, lang, () => {
        if (aliveRef.current) startListening();
      });
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
      let interim = "";
      let final = finalRef.current;
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const chunk = event.results[i][0].transcript as string;
        if (event.results[i].isFinal) final += chunk;
        else interim += chunk;
      }
      finalRef.current = final;
      const combined = (final + interim).trim();
      setText(combined);
      onTranscript(combined);
      setSpeaking(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => void handleQuestion(finalRef.current.trim() || combined), 2000);
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
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  function stopOrSend() {
    if (phaseRef.current === "speaking") {
      window.speechSynthesis?.cancel();
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
        <button
          type="button"
          onClick={stopOrSend}
          aria-label="Voice orb"
          className={`galaxy-orb h-44 w-44 sm:h-56 sm:w-56 ${active ? "voice-pulse" : ""}`}
        >
          <span className="galaxy-stars" />
          <span className="relative z-10 flex h-full w-full flex-col items-center justify-center gap-[10%]">
            <span className="flex w-full justify-center gap-[18%]" style={{ height: "22%" }}>
              <span className="galaxy-eye" style={{ width: "18%", height: "100%" }} />
              <span className="galaxy-eye" style={{ width: "18%", height: "100%" }} />
            </span>
            {phase === "thinking" ? (
              <Loader2 className="h-8 w-8 animate-spin text-primary-foreground" />
            ) : (
              <span
                className={`galaxy-mouth ${phase === "speaking" || (speaking && !muted) ? "galaxy-talking" : ""}`}
                style={muted ? { height: "3%", borderRadius: "9999px" } : undefined}
              />
            )}
          </span>
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
