import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { repoName } from "./github-rules";
export const selfUpdateStatus = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data: owner, error } = await context.supabase.rpc("is_owner", { _uid: context.userId });
  if (error) throw error;
  if (owner !== true) return { owner: false, repo: null, proposals: [] };
  const { data: repo, error: repoError } = await context.supabase.from("github_self_repos").select("repo").eq("user_id", context.userId).maybeSingle();
  const { data: proposals, error: proposalsError } = await context.supabase.from("github_self_updates").select("*").eq("user_id", context.userId).order("created_at", { ascending: false }).limit(10);
  if (repoError || proposalsError) throw repoError || proposalsError;
  return { owner: true, repo: repo?.repo ?? null, proposals: proposals ?? [] };
});
export const bindSelfRepo = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(i => z.object({ repo: repoName, confirmed: z.literal(true) }).parse(i)).handler(async ({ context, data }) => {
  const { requireSelfOwner } = await import("./self-update.server");
  await requireSelfOwner(context.supabase, context.userId);
  const { selectedWorkspace, githubRequest } = await import("./github.server");
  await selectedWorkspace(context.userId, data.repo);
  const info = await githubRequest(context.userId, `/repos/${data.repo}`) as { permissions?: { push?: boolean } };
  if (!info.permissions?.push) throw new Error("Repo write permission required.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("github_self_repos").upsert({ user_id: context.userId, repo: data.repo });
  if (error) throw error;
  return { repo: data.repo };
});
export const requestSelfUpdate = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(i => z.object({ request: z.string().trim().min(5).max(6000) }).parse(i)).handler(async ({ context, data }) => {
  const { prepareSelfUpdate } = await import("./self-update.server");
  return prepareSelfUpdate(context.supabase, context.userId, data.request);
});
export const approveSelfUpdate = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(i => z.object({ id: z.string().uuid(), confirmed: z.literal(true) }).parse(i)).handler(async ({ context, data }) => {
  const { pushSelfUpdate } = await import("./self-update.server");
  return pushSelfUpdate(context.supabase, context.userId, data.id, data.confirmed);
});
export const chatGitHubProposals = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data, error } = await context.supabase.from("github_self_updates").select("*").eq("user_id", context.userId).order("created_at", { ascending: false }).limit(10);
  if (error) throw error;
  return { proposals: data ?? [] };
});
export const discardSelfUpdate = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(i => z.object({ id: z.string().uuid() }).parse(i)).handler(async ({ context, data }) => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("github_self_updates").update({ status: "discarded" }).eq("id", data.id).eq("user_id", context.userId).eq("status", "pending");
  if (error) throw error;
  return { ok: true };
});export const smartChangeRequest = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(i => z.object({ repo: repoName, request: z.string().trim().min(5).max(6000) }).parse(i)).handler(async ({ context, data }) => {
  const { prepareSelfUpdate } = await import("./self-update.server");
  return prepareSelfUpdate(context.supabase, context.userId, data.request, data.repo);
});
