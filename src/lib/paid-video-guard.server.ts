import { paidVideoLimits, type PaidVideoProvider } from "@/lib/paid-video-rules";

// Caller must authenticate (and check plan where applicable) before invoking.
// Database lock serializes reservations across workers and providers; fail closed.
export async function reservePaidVideo(userId: string, provider: PaidVideoProvider): Promise<string | Response> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const limits = paidVideoLimits(process.env);
  const { data, error } = await supabaseAdmin.rpc("reserve_paid_video", {
    p_user: userId, p_provider: provider,
    p_hour: limits.hour, p_day: limits.day, p_global_day: limits.globalDay,
  });
  if (error) return Response.json({ error: "Video cost protection unavailable. No generation submitted." }, { status: 503 });
  if (!data) return Response.json({ error: "Paid video generation limit reached. Please try later." }, { status: 429, headers: { "Retry-After": "3600", "Cache-Control": "no-store" } });
  return data;
}

export async function savePaidVideoTask(reservation: string, userId: string, provider: PaidVideoProvider, taskId: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("paid_video_requests")
    .update({ task_id: taskId }).eq("id", reservation).eq("user_id", userId).eq("provider", provider).is("task_id", null).select("id").maybeSingle();
  return !error && !!data;
}

export async function ownsPaidVideoTask(userId: string, provider: PaidVideoProvider, taskId: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("paid_video_requests").select("id")
    .eq("user_id", userId).eq("provider", provider).eq("task_id", taskId).maybeSingle();
  return !error && !!data;
}