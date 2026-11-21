import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { repoName } from "./github-rules";
import { assertRepoDesignation } from "./github-designation-rules";
export const selfUpdateStatus = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data: owner, error } = await context.supabase.rpc("is_owner", { _uid: context.userId });
  if (error) throw error;
  const { data: repo, error: repoError } = await context.supabase.from("github_self_repos").select("repo").eq("user_id", context.userId).maybeSingle();
  const { data: proposals, error: proposalsError } = await context.supabase.from("github_self_updates").select("*").eq("user_id", context.userId).order("created_at", { ascending: false }).limit(10);
  if (repoError || proposalsError) throw repoError || proposalsError;
  return { owner: owner === true, repo: repo?.repo ?? null, proposals: proposals ?? [] };
});
export const bindSelfRepo = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(i => z.object({ repo: repoName, confirmed: z.literal(true) }).parse(i)).handler(async ({ context, data }) => {
  const { selectedWorkspace, githubRequest } = await import("./github.server");
  const workspace = await selectedWorkspace(context.userId, data.repo);
  const info = await githubRequest(context.userId, `/repos/${data.repo}`) as { full_name: string; permissions?: { push?: boolean } };
  assertRepoDesignation(workspace.repo, data.repo, info.full_name, info.permissions?.push === true);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: saved, error } = await supabaseAdmin.from("github_self_repos").upsert({ user_id: context.userId, repo: data.repo }, { onConflict: "user_id" }).select("repo").single();
  if (error) throw error;
  if (saved?.repo !== data.repo) throw new Error("Own repository designation save nahi hui.");
  return { repo: saved.repo };
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

export const approveMainMerge = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(i => z.object({ id: z.string().uuid(), repo: repoName, confirmed: z.literal(true) }).parse(i)).handler(async ({ context, data }) => {
  const { mergeSelfUpdateToMain } = await import("./self-update.server");
  return mergeSelfUpdateToMain(context.userId, data.id, data.repo, data.confirmed);
});

export const mainMergeCandidates = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(i => z.object({ repo: repoName }).parse(i)).handler(async ({ context, data }) => {
  const { selectedWorkspace } = await import("./github.server");
  await selectedWorkspace(context.userId, data.repo);
  const [updates, merges] = await Promise.all([
    context.supabase.from("github_self_updates").select("id,target_branch,commit_sha").eq("user_id", context.userId).eq("repo", data.repo).eq("status", "pushed").order("created_at", { ascending: false }).limit(10),
    context.supabase.from("github_main_merges").select("preview_id,status,merged_sha").eq("user_id", context.userId).eq("repo", data.repo),
  ]);
  if (updates.error || merges.error) throw updates.error || merges.error;
  return (updates.data ?? []).map(p => ({ id: p.id, branch: p.target_branch, mergeStatus: merges.data?.find(m => m.preview_id === p.id)?.status ?? null }));
});
