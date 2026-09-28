import { useEffect, useState } from "react";
import { X } from "lucide-react";

const EVT = "nqai-show-ad";
const tag = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;overflow:hidden;background:transparent"><script src="https://quge5.com/88/tag.min.js" data-zone="11875406" async data-cfasync="false"><\/script></body></html>`;

/** Trigger a one-time contained ad (after mining claim / CV download). */
export function showRewardAd() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVT));
}

export function RewardAdHost() {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(0);
  useEffect(() => {
    const on = () => {
      setKey((k) => k + 1);
      setOpen(true);
    };
    window.addEventListener(EVT, on);
    return () => window.removeEventListener(EVT, on);
  }, []);
  if (!open) return null;
  return (
    <div className="fixed bottom-4 left-1/2 z-50 w-[320px] max-w-[92vw] -translate-x-1/2 rounded-xl border border-border bg-card p-2.5 shadow-lg">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">Advertisement</p>
        <button aria-label="Close ad" onClick={() => setOpen(false)} className="rounded p-1 text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <iframe
        key={key}
        title="Advertisement"
        srcDoc={tag}
        sandbox="allow-scripts allow-same-origin"
        scrolling="no"
        className="block h-[250px] w-full border-0"
      />
    </div>
  );
}
