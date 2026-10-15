import { supabase } from "@/integrations/supabase/client";

/**
 * Backup copy to the owner's Cloudflare Worker. Fire-and-forget:
 * never throws, never blocks the main save in Lovable Cloud.
 */
export function backupToWorker(kind: "login" | "conversation" | "message" | "coins", data: unknown) {
  const base = ((import.meta.env["VITE_CLOUDFLARE_WORKER_URL"] as string | undefined) || "https://black-frost-f1d3.noquitai1.workers.dev").replace(/\/$/, "");
  if (!base || typeof window === "undefined") return;
  void (async () => {
    try {
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      await fetch(`${base}/api/backup`, {
        method: "POST",
        keepalive: true,
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ kind, data, user_id: s.session?.user.id ?? null, at: new Date().toISOString() }),
      });
    } catch (e) {
      console.warn("[worker-backup] skipped", e);
    }
  })();
}
