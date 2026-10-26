import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/**
 * Daily auto report (Lovable-clone update 10): users, mining, posts ka
 * summary R2 me save hota hai taake owner kabhi bhi padh sake.
 */
export const Route = createFileRoute("/api/public/jobs/daily-report")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        const [users, wallets, posts, builds] = await Promise.all([
          supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
          supabaseAdmin.from("nqai_wallets").select("balance"),
          supabaseAdmin.from("community_posts").select("id", { count: "exact", head: true }).gte("created_at", since),
          supabaseAdmin.from("memories").select("id", { count: "exact", head: true }).gte("created_at", since),
        ]);

        const totalCoins = (wallets.data ?? []).reduce((sum, w) => sum + Number(w.balance ?? 0), 0);
        const report = {
          date: new Date().toISOString().slice(0, 10),
          totalUsers: users.count ?? 0,
          totalCoinsInWallets: Math.round(totalCoins * 100) / 100,
          postsLast24h: posts.count ?? 0,
          buildsLast24h: builds.count ?? 0,
          generatedAt: new Date().toISOString(),
        };

        const { r2 } = await import("@/lib/r2.server");
        const { client, base } = r2();
        await client.fetch(`${base}/reports/daily-${report.date}.json`, {
          method: "PUT",
          body: JSON.stringify(report, null, 2),
          headers: { "content-type": "application/json" },
        });

        return Response.json({ success: true, report });
      },
    },
  },
});
