import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, X } from "lucide-react";
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

const LOCALES: Record<string, string> = {
  en: "en-US",
  ur: "ur-PK",
  hi: "hi-IN",
  ar: "ar-SA",
};

export function VoiceModal({
  lang,
  onTranscript,
  onSubmit,
  onClose,
}: {
  lang: string;
  onTranscript: (text: string) => void;
  onSubmit: (text: string) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [muted, setMuted] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalRef = useRef("");
  const submittedRef = useRef(false);
  const mutedRef = useRef(false);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    const Ctor = getSpeechRecognition();
    if (!Ctor) {
      toast.error("Voice not supported in this browser");
      onClose();
      return;
    }

    const rec = new Ctor();
    recRef.current = rec;
    rec.lang = LOCALES[lang] ?? "en-US";
    rec.continuous = true;
    rec.interimResults = true;

    const scheduleSend = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        const value = finalRef.current.trim();
        if (value && !submittedRef.current) {
          submittedRef.current = true;
          try {
            rec.stop();
          } catch {
            /* ignore */
          }
          onSubmit(value);
          onClose();
        }
      }, 2000);
    };

    rec.onresult = (event: any) => {
      if (mutedRef.current) return;
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
      scheduleSend();
    };

    rec.onerror = (event: any) => {
      if (event?.error === "not-allowed") {
        toast.error("Microphone permission blocked");
        onClose();
      }
    };

    rec.onend = () => setSpeaking(false);

    try {
      rec.start();
    } catch {
      /* already started */
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      rec.onresult = null;
      rec.onend = null;
      rec.onerror = null;
      try {
        rec.abort();
      } catch {
        /* ignore */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  function stopAndSend() {
    if (timerRef.current) clearTimeout(timerRef.current);
    const value = (finalRef.current || text).trim();
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
    if (value && !submittedRef.current) {
      submittedRef.current = true;
      onSubmit(value);
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[70] flex flex-col items-center justify-between bg-background/80 px-6 py-8 backdrop-blur-xl">
      <div className="flex w-full items-center justify-end">
        <Button variant="ghost" size="icon" aria-label="Close voice chat" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex flex-col items-center gap-6">
        <div className="relative flex h-44 w-44 items-center justify-center sm:h-56 sm:w-56">
          <span
            className={`absolute inset-0 rounded-full bg-primary/20 blur-2xl ${
              speaking && !muted ? "voice-pulse" : ""
            }`}
          />
          <div
            className={`flex h-40 w-40 items-center justify-center rounded-full border border-primary/40 bg-primary/15 shadow-[0_0_60px_-10px] shadow-primary/60 sm:h-52 sm:w-52 ${
              speaking && !muted ? "voice-pulse" : ""
            }`}
          >
            {muted ? (
              <MicOff className="h-14 w-14 text-muted-foreground" />
            ) : (
              <Mic className="h-14 w-14 text-primary" />
            )}
          </div>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          {muted ? "Muted" : speaking ? "Listening..." : "Tap to stop"}
        </p>
        {text && (
          <p className="max-w-md text-center text-base font-medium text-foreground">{text}</p>
        )}
      </div>

      <div className="flex w-full flex-col items-center gap-6">
        <div className="flex h-12 items-end gap-1.5" aria-hidden>
          {Array.from({ length: 16 }).map((_, i) => (
            <span
              key={i}
              className="w-1.5 rounded-full bg-primary/70"
              style={{
                height: speaking && !muted ? "100%" : "12%",
                animation:
                  speaking && !muted ? `voice-wave 1s ease-in-out ${i * 0.06}s infinite` : "none",
              }}
            />
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="rounded-full"
            onClick={() => setMuted((m) => !m)}
          >
            {muted ? <MicOff className="mr-2 h-4 w-4" /> : <Mic className="mr-2 h-4 w-4" />}
            {muted ? "Unmute" : "Mute"}
          </Button>
          <Button type="button" size="lg" className="btn-green rounded-full px-8" onClick={stopAndSend}>
            Stop
          </Button>
        </div>
      </div>
    </div>
  );
}
