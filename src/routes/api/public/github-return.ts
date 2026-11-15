import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/public/github-return")({
  server: { handlers: { GET: ({ request }) => {
    const url = new URL(request.url);
    const success = url.searchParams.get("success") === "true" && url.searchParams.get("connector_id") === "github" && url.searchParams.get("offline_access_allowed") !== "false" && !!url.searchParams.get("code");
    const payload = JSON.stringify({ type: success ? "github-complete" : "github-failed", connectorId: "github", nonce: url.searchParams.get("nonce"), code: success ? url.searchParams.get("code") : null }).replace(/</g, "\\u003c");
    return new Response(`<!doctype html><html><head><title>GitHub Connect — NO QUIT AI</title></head><body><p>${success ? "GitHub permission complete. App mein wapas ja rahe hain…" : "GitHub permission complete nahi hui. App mein dobara try karein."}</p><script>if(window.opener){window.opener.postMessage(${payload},window.location.origin);window.close();}</script></body></html>`, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" } });
  } } },
});