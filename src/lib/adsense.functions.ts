import { createServerFn } from "@tanstack/react-start";

/**
 * Public ad configuration endpoint.
 * Only returns the AdSense publisher ID and ad-unit slot IDs — both are
 * public identifiers that already appear in the rendered page source.
 */
export const getPublicAdsConfig = createServerFn({ method: "GET" }).handler(
  async () => {
    return {
      client: (
        process.env["ADSENSE_PUBLISHER_ID"] ??
        process.env["NEXT_PUBLIC_ADSENSE_PUBLISHER_ID"] ??
        ""
      ).trim(),
      slots: {
        feed: (process.env["ADSENSE_SLOT_FEED"] ?? "").trim(),
        footer: (process.env["ADSENSE_SLOT_FOOTER"] ?? "").trim(),
      },
    };
  },
);
