import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const BONUS_PER_1000_VIEWS = 10;

async function ownerFromRequest(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const sb = createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data } = await sb.auth.getUser(token);
  if (!data.user) return null;
  const { data: ok } = await sb.rpc("is_owner", { _uid: data.user.id });
  return ok ? data.user : null;
}

/** Owner panel: users list, Pro banana, views par bonus credits. Sirf owners table wale. */
export const Route = createFileRoute("/api/owner")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await ownerFromRequest(request))) return new Response("Forbidden", { status: 403 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const [{ data: profiles }, { data: plans }, { data: videos }] = await Promise.all([
          supabaseAdmin.from("profiles").select("id, display_name, username").order("created_at", { ascending: false }).limit(200),
          supabaseAdmin.from("user_plans").select("user_id, plan"),
          supabaseAdmin.from("viral_videos").select("id, user_id, title, url, views, bonus_awarded, created_at").order("created_at", { ascending: false }).limit(100),
        ]);
        const planMap = new Map((plans ?? []).map((p) => [p.user_id, p.plan]));
        return Response.json({
          users: (profiles ?? []).map((p) => ({ ...p, plan: planMap.get(p.id) ?? "free" })),
          videos: videos ?? [],
          bonusPer1000: BONUS_PER_1000_VIEWS,
        });
      },
      POST: async ({ request }) => {
        if (!(await ownerFromRequest(request))) return new Response("Forbidden", { status: 403 });
        const body = (await request.json().catch(() => ({}))) as {
          action?: string; userId?: string; plan?: string; videoId?: string; views?: number;
        };
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        if (body.action === "set_plan" && body.userId) {
          const plan = body.plan === "pro" ? "pro" : "free";
          const { error } = await supabaseAdmin.from("user_plans").upsert({ user_id: body.userId, plan, updated_at: new Date().toISOString() });
          if (error) return new Response(error.message, { status: 500 });
          return Response.json({ ok: true });
        }
        if (body.action === "set_views" && body.videoId) {
          const views = Math.max(0, Math.floor(Number(body.views) || 0));
          const { error } = await supabaseAdmin.from("viral_videos").update({ views }).eq("id", body.videoId);
          if (error) return new Response(error.message, { status: 500 });
          return Response.json({ ok: true });
        }
        if (body.action === "award_bonus" && body.videoId) {
          const { data: v } = await supabaseAdmin.from("viral_videos").select("user_id, views, bonus_awarded").eq("id", body.videoId).maybeSingle();
          if (!v) return new Response("Not found", { status: 404 });
          if (v.bonus_awarded) return new Response("Bonus already diya ja chuka", { status: 409 });
          const amount = Math.floor(v.views / 1000) * BONUS_PER_1000_VIEWS;
          if (amount <= 0) return new Response("Kam az kam 1000 views chahiye", { status: 400 });
          const { error } = await supabaseAdmin.rpc("nqai_award", { _user: v.user_id, _amount: amount, _reason: `Viral video bonus (${v.views} views)` });
          if (error) return new Response(error.message, { status: 500 });
          await supabaseAdmin.from("viral_videos").update({ bonus_awarded: true }).eq("id", body.videoId);
          return Response.json({ ok: true, amount });
        }
        return new Response("Bad action", { status: 400 });
      },
    },
  },
});
