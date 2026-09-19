import { useEffect, useRef } from "react";

import { ADSENSE_CLIENT, AD_SLOTS, adsEnabled, type AdSlotName } from "@/lib/adsense";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

/**
 * Responsive AdSense unit.
 * - Renders nothing in dev / when unconfigured (a neutral placeholder instead).
 * - Never placed next to interactive controls; always clearly labelled "Ad".
 */
export function AdSlot({
  name,
  className,
  label = "Ad",
}: {
  name: AdSlotName;
  className?: string;
  label?: string;
}) {
  const ref = useRef<HTMLModElement | null>(null);
  const pushed = useRef(false);
  const slot = AD_SLOTS[name];
  const active = adsEnabled && slot.length > 0;

  useEffect(() => {
    if (!active || pushed.current || !ref.current) return;
    // Guard against double-push in StrictMode / re-renders.
    if (ref.current.getAttribute("data-adsbygoogle-status")) return;
    try {
      (window.adsbygoogle = window.adsbygoogle ?? []).push({});
      pushed.current = true;
      void logAdImpression(
        name,
        typeof window !== "undefined" ? window.location.pathname : undefined,
      );
    } catch {
      /* ad blocked or script unavailable — ignore silently */
    }
  }, [active, name]);

  if (!active) {
    if (import.meta.env.PROD) return null;
    return (
      <div
        className={cn(
          "my-3 rounded-xl border border-dashed border-border/60 p-4 text-center text-[11px] text-muted-foreground",
          className,
        )}
      >
        Ad space (development preview)
      </div>
    );
  }

  return (
    <div className={cn("my-3 overflow-hidden", className)}>
      <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <ins
        ref={ref}
        className="adsbygoogle block w-full"
        style={{ display: "block" }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
