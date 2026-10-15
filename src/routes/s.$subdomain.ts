import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const notFound = `<!doctype html><html><head><meta charset="utf-8"><title>Not found — NO QUIT AI</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#05070d;color:#e6f7ff;font-family:system-ui"><div style="text-align:center"><h1 style="font-size:64px;margin:0;color:#22d3ee">404</h1><p>Ye subdomain abhi kisi app se linked nahi hai.</p><a href="https://noquitai.com" style="color:#22d3ee">noquitai.com par apni app banao</a></div></body></html>`;

export async function serveSubdomain(sub: string): Promise<Response> {
  const sb = createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data } = await sb.rpc("get_site_by_subdomain", { _subdomain: sub.toLowerCase() });
  const html = typeof data === "string" && data ? data : null;
  return new Response(html ?? notFound, {
    status: html ? 200 : 404,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=60" },
  });
}

export const Route = createFileRoute("/s/$subdomain")({
  server: {
    handlers: {
      GET: async ({ params }) => serveSubdomain(params.subdomain),
    },
  },
});
