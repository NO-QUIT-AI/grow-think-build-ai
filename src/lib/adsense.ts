/**
 * Google AdSense configuration.
 * Publisher ID is never hard-coded — it comes from env vars.
 *
 *   VITE_ADSENSE_CLIENT      e.g. "ca-pub-1234567890123456"
 *   VITE_ADSENSE_SLOT_FEED   in-feed ad unit id (digits)
 *   VITE_ADSENSE_SLOT_FOOTER footer/bottom ad unit id (digits)
 *   VITE_ADSENSE_TEST        "true" -> render placeholders, never real ads
 */

const env = import.meta.env as Record<string, string | undefined>;

export const ADSENSE_CLIENT = (env["VITE_ADSENSE_CLIENT"] ?? "").trim();

export const AD_SLOTS = {
  feed: (env["VITE_ADSENSE_SLOT_FEED"] ?? "").trim(),
  footer: (env["VITE_ADSENSE_SLOT_FOOTER"] ?? "").trim(),
};

export type AdSlotName = keyof typeof AD_SLOTS;

/** Only load/serve real ads in production builds with a configured publisher id. */
export const adsEnabled =
  import.meta.env.PROD &&
  env["VITE_ADSENSE_TEST"] !== "true" &&
  /^ca-pub-\d{10,}$/.test(ADSENSE_CLIENT);

export const ADSENSE_SCRIPT_SRC = ADSENSE_CLIENT
  ? `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`
  : "";
