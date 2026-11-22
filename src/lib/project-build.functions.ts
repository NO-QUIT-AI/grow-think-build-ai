import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildExportChanges } from "./project-card";

const buildInput = z.object({ memoryId: z.string().uuid() });
export const getChatBuild = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(input => buildInput.parse(input)).handler(async ({ context, data }) => {
    const { data: build, error } = await context.supabase.from("memories").select("id,prompt,summary,code,blueprint,subdomain,project_type").eq("id", data.memoryId).eq("user_id", context.userId).single();
    if (error || !build || !build.code) throw new Error("Build unavailable for this account.");
    const blueprint = z.object({ name: z.string().optional() }).passthrough().safeParse(build.blueprint);
    return { id: build.id, title: blueprint.success ? blueprint.data.name ?? build.prompt.split(":")[0] ?? "Project" : build.prompt.split(":")[0] ?? "Project", summary: build.summary ?? "", html: build.code, subdomain: build.subdomain };
  });

// READ ONLY GitHub preparation; the existing one-use approval handler owns writes.
export const prepareBuildGitHub = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(input => buildInput.parse(input)).handler(async ({ context, data }) => {
    const { data: build, error } = await context.supabase.from("memories").select("id,code,summary").eq("id", data.memoryId).eq("user_id", context.userId).single();
    if (error || !build?.code) throw new Error("Build unavailable for this account.");
    const { data: workspace, error: workspaceError } = await context.supabase.from("github_workspaces").select("repo").eq("user_id", context.userId).maybeSingle();
    if (workspaceError || !workspace?.repo) throw new Error("Pehle isi chat mein GitHub connect aur repository select karein.");
    const { githubRequest, selectedWorkspace } = await import("./github.server");
    await selectedWorkspace(context.userId, workspace.repo);
    const info = await githubRequest(context.userId, `/repos/${workspace.repo}`) as { default_branch: string; permissions?: { push?: boolean } };
    if (!info.permissions?.push) throw new Error("Repository write permission required.");
    const base = await githubRequest(context.userId, `/repos/${workspace.repo}/git/ref/heads/${encodeURIComponent(info.default_branch)}`) as { object: { sha: string } };
    const tree = await githubRequest(context.userId, `/repos/${workspace.repo}/git/trees/${base.object.sha}?recursive=1`) as { tree: { path: string; type: string; mode: string; sha: string }[]; truncated: boolean };
    if (tree.truncated) throw new Error("Incomplete repository tree; safe export stopped.");
    const changes = buildExportChanges(build.id, build.code, tree.tree);
    const id = crypto.randomUUID(), branch = `noquit-ai/update-${id}`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: saveError } = await supabaseAdmin.from("github_self_updates").insert({ id, user_id: context.userId, repo: workspace.repo, base_branch: info.default_branch, base_sha: base.object.sha, target_branch: branch, request: `Export built project ${build.id}`, summary: `Built project export: ${build.summary ?? ""}. Exact saved HTML; repository ke existing files unchanged. Tests run nahi hue.`, changes });
    if (saveError) throw saveError;
    return { previewId: id, repo: workspace.repo, branch, needsApproval: true };
  });