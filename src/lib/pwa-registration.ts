export function isPwaPreview(hostname: string) {
  const host = hostname.toLowerCase();
  const label = host.split(".")[0] ?? "";
  const platform = /\.(lovable\.app|gpt-eng\.com|gptengineer\.run)$/.test(host);
  return (platform && (/^(?:id-preview|preview)(?:-[a-z0-9]+)?--.+$/.test(label) || /^project--.+-dev$/.test(label))) ||
    ["lovableproject.com", "lovableproject-dev.com", "beta.lovable.dev"].some((domain) => host === domain || host.endsWith(`.${domain}`));
}

export async function registerAppOfflineScreen() {
  if (!("serviceWorker" in navigator)) return;
  const refused = !import.meta.env.PROD || window.self !== window.top || isPwaPreview(window.location.hostname) || new URLSearchParams(window.location.search).get("sw") === "off";
  if (refused) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.filter((registration) => [registration.active, registration.waiting, registration.installing].some((worker) => worker && new URL(worker.scriptURL).pathname === "/sw.js")).map((registration) => registration.unregister()));
    return;
  }
  if (window.location.pathname !== "/android-app") return;
  const { registerSW } = await import("virtual:pwa-register");
  registerSW({ immediate: true });
}