/** HD upsell rules: long or 1080p videos go to a partner platform, never our server. */
export const FREE_PREVIEW_MAX_SEC = 30;
export type HdPartner = "creatomate" | "capcut";
export type Quality = "480p" | "720p" | "1080p";

export function needsHdPartner(opts: { durationSec: number; quality: Quality; oneHourHd?: boolean }) {
  return !!opts.oneHourHd || opts.durationSec > FREE_PREVIEW_MAX_SEC || opts.quality === "1080p";
}

export function partnerUrl(partner: HdPartner, images: string[], story: unknown) {
  if (partner === "capcut") return "https://www.capcut.com/tools/ai-video-maker?ref=noquitai";
  const u = new URL("https://creatomate.com");
  u.searchParams.set("via", "noquitai");
  u.searchParams.set("images", JSON.stringify(images.slice(0, 5)));
  u.searchParams.set("story", JSON.stringify(story).slice(0, 4000));
  return u.toString();
}
