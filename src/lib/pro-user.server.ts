import { userFromRequest } from "@/lib/auth-user.server";

/** Signed-in + Pro check. Returns userId, or a Response to send back. */
export async function requirePro(request: Request): Promise<{ id: string } | Response> {
  const user = await userFromRequest(request);
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("user_plans").select("plan").eq("user_id", user.id).maybeSingle();
  if (data?.plan !== "pro") return Response.json({ error: "Ye feature sirf Pro users ke liye hai" }, { status: 403 });
  return { id: user.id };
}
