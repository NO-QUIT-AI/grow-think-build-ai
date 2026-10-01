import { useEffect, useRef, useSyncExternalStore } from "react";

import {
  ensureAdsScript,
  getAdsConfig,
  isAdsActive,
  subscribeAdsConfig,
  type AdSlotName,
  type AdsConfig,
} from "@/lib/adsense";
import { logAdImpression } from "@/lib/ads-stats";
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
  const config: AdsConfig = useSyncExternalStore(
    subscribeAdsConfig,
    getAdsConfig,
    getAdsConfig,
  );
  const slot = config.slots[name];
  const active = isAdsActive(config) && slot.length > 0;

  useEffect(() => {
    if (!active || pushed.current || !ref.current) return;
    // Guard against double-push in StrictMode / re-renders.
    if (ref.current.getAttribute("data-adsbygoogle-status")) return;
    try {
      ensureAdsScript(config.client);
      (window.adsbygoogle = window.adsbygoogle ?? []).push({});
      pushed.current = true;
      void logAdImpression(
        name,
        typeof window !== "undefined" ? window.location.pathname : undefined,
      );
    } catch {
      /* ad blocked or script unavailable — ignore silently */
    }
  }, [active, name, config.client]);

  if (!active) {
    if (import.meta.env.PROD) return null;
    return (
      <div
        className={cn(
          "my-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border/50 px-3 py-1.5 text-[10px] text-muted-foreground/60",
          className,
        )}
      >
        <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
        Ad space — abhi khali hai
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
        data-ad-client={config.client}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
