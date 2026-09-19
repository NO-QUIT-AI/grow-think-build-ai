import { createFileRoute } from "@tanstack/react-router";

/**
 * Serves /ads.txt from an env var so the publisher id is never hard-coded.
 * Set ADSENSE_PUBLISHER_ID (or VITE_ADSENSE_CLIENT), e.g. "ca-pub-1234567890123456".
 */
export const Route = createFileRoute("/ads.txt")({
  server: {
    handlers: {
      GET: () => {
        const raw =
          process.env["ADSENSE_PUBLISHER_ID"] ?? process.env["VITE_ADSENSE_CLIENT"] ?? "";
        const pub = raw.trim().replace(/^ca-pub-/, "");
        const body = /^\d{10,}$/.test(pub)
          ? `google.com, pub-${pub}, DIRECT, f08c47fec0942fa0\n`
          : "# ads.txt not configured yet: set ADSENSE_PUBLISHER_ID\n";
        return new Response(body, {
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
