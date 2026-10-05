import { createClient } from "@supabase/supabase-js";

/** Bearer token se signed-in user ka id nikalta hai (null agar login nahi). */
export async function userFromRequest(request: Request): Promise<{ id: string; email: string | null } | null> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const sb = createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data } = await sb.auth.getUser(token);
  return data.user ? { id: data.user.id, email: data.user.email ?? null } : null;
}
