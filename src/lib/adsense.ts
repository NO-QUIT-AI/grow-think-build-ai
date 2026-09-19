/**
 * Google AdSense configuration.
 * Publisher ID is never hard-coded — it comes from env vars only:
 *
 *   Server (preferred):  ADSENSE_PUBLISHER_ID, ADSENSE_SLOT_FEED, ADSENSE_SLOT_FOOTER
 *   Build-time fallback: VITE_ADSENSE_PUBLISHER_ID / VITE_ADSENSE_CLIENT,
 *                        VITE_ADSENSE_SLOT_FEED, VITE_ADSENSE_SLOT_FOOTER
 *   VITE_ADSENSE_TEST = "true" -> render placeholders, never real ads
 *
 * The server value is fetched at runtime via getPublicAdsConfig() and stored
 * in a tiny reactive store, because build-time VITE_ env injection is not
 * available for user-set values on this platform. The publisher ID is public
 * information (it ships in the page source anyway), so serving it from a
 * public endpoint is safe.
 */

import { useSyncExternalStore } from "react";

import { getPublicAdsConfig } from "./adsense.functions";

const env = import.meta.env as Record<string, string | undefined>;

export interface AdsConfig {
  client: string;
  slots: { feed: string; footer: string };
  /** true once the runtime fetch has settled (success or failure). */
  loaded: boolean;
}

export type AdSlotName = keyof AdsConfig["slots"];

let config: AdsConfig = {
  client: (
    env["VITE_ADSENSE_PUBLISHER_ID"] ??
    env["VITE_ADSENSE_CLIENT"] ??
    ""
  ).trim(),
  slots: {
    feed: (env["VITE_ADSENSE_SLOT_FEED"] ?? "").trim(),
    footer: (env["VITE_ADSENSE_SLOT_FOOTER"] ?? "").trim(),
  },
  loaded: false,
};

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function subscribeAdsConfig(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function getAdsConfig(): AdsConfig {
  return config;
}

/** Reactive hook for components that render ad units. */
export function useAdsConfig(): AdsConfig {
  return useSyncExternalStore(subscribeAdsConfig, getAdsConfig, getAdsConfig);
}

/** Real ads only in production, when not force-disabled by the test flag. */
export function isAdsActive(cfg: AdsConfig = config): boolean {
  return (
    import.meta.env.PROD &&
    env["VITE_ADSENSE_TEST"] !== "true" &&
    /^ca-pub-\d{10,}$/.test(cfg.client)
  );
}

let scriptInjected = false;

/** Inject the AdSense loader script once per page load. Idempotent. */
export function ensureAdsScript(client: string): void {
  if (scriptInjected || typeof document === "undefined") return;
  if (!isAdsActive({ ...config, client })) return;
  scriptInjected = true;
  const script = document.createElement("script");
  script.async = true;
  script.crossOrigin = "anonymous";
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`;
  document.head.appendChild(script);
}

let initPromise: Promise<void> | null = null;

/**
 * Fetch the runtime ad config from the server, update the store and inject
 * the loader script. Safe to call multiple times — only the first call does
 * work. Called once from the root component.
 */
export function initAdsConfig(): Promise<void> {
  if (config.loaded) return Promise.resolve();
  if (!initPromise) {
    initPromise = getPublicAdsConfig()
      .then((remote) => {
        config = {
          client: remote.client || config.client,
          slots: {
            feed: remote.slots.feed || config.slots.feed,
            footer: remote.slots.footer || config.slots.footer,
          },
          loaded: true,
        };
        emit();
        ensureAdsScript(config.client);
      })
      .catch(() => {
        config = { ...config, loaded: true };
        emit();
      });
  }
  return initPromise;
}
