import { useEffect, useRef, type CSSProperties } from "react";

// Publisher ID is already loaded in <head> (src/routes/__root.tsx).
const AD_CLIENT = "ca-pub-2482034823952749";

export function AdSense({ adSlot, style }: { adSlot: string; style?: CSSProperties }) {
  const ref = useRef<HTMLModElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || el.getAttribute("data-adsbygoogle-status")) return;
    try {
      const w = window as unknown as { adsbygoogle?: unknown[] };
      (w.adsbygoogle = w.adsbygoogle ?? []).push({});
    } catch {
      /* blocked — ignore */
    }
  }, [adSlot]);

  return (
    <div className="my-4 overflow-hidden rounded-xl border border-primary/30 bg-card/40 p-2">
      <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Advertisement</p>
      <ins
        ref={ref}
        className="adsbygoogle"
        style={{ display: "block", ...style }}
        data-ad-client={AD_CLIENT}
        data-ad-slot={adSlot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
