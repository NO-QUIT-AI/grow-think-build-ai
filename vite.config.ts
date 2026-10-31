// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  vite: {
    plugins: [VitePWA({
      strategies: "generateSW", filename: "sw.js", manifest: false,
      injectRegister: null, registerType: "autoUpdate", devOptions: { enabled: false },
      workbox: {
        globPatterns: ["android-offline.html", "android/icon-*.png"],
        navigateFallback: "/android-offline.html",
        navigateFallbackAllowlist: [/^\/android-app\/?$/],
        navigateFallbackDenylist: [/^\/~oauth/, /^\/api\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [{
          urlPattern: ({ request, url }) => request.mode === "navigate" && url.pathname === "/android-app",
          handler: "NetworkFirst",
          options: { cacheName: "nqai-android-navigation", networkTimeoutSeconds: 5, cacheableResponse: { statuses: [200] }, expiration: { maxEntries: 1, maxAgeSeconds: 86400 } },
        }, {
          urlPattern: ({ url, sameOrigin }) => sameOrigin && /\/assets\/[^/]+-[a-zA-Z0-9_-]+\.(?:js|css|woff2)$/.test(url.pathname),
          handler: "CacheFirst", options: { cacheName: "nqai-hashed-assets", expiration: { maxEntries: 80, maxAgeSeconds: 604800 } },
        }],
      },
    })],
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
