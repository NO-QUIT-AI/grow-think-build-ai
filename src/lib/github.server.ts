import { callAsAppUser, appUserReconnectRequired } from "@/integrations/lovable/appUserConnector";
import { getConnectionKeyForUser } from "./appUserConnections.server";
import { assertSelectedRepo, readableCode } from "./github-rules";
export const GITHUB_SCOPES = ["read:user", "repo"];
export const GATEWAY = "https://connector-gateway.lovable.dev";
export async function githubRequest(userId: string, path: string, init?: RequestInit): Promise<unknown> {
  const connectionAPIKey = await getConnectionKeyForUser(userId, "github");
  if (!connectionAPIKey) throw new Error("Pehle GitHub connect karein.");
  const response = await callAsAppUser({ gatewayBaseUrl: GATEWAY, connectorId: "github", connectionAPIKey, path, requiredScopes: GITHUB_SCOPES, init: { ...init, headers: { Accept: "application/vnd.github+json", "Content-Type": "application/json" } } });
  if (await appUserReconnectRequired(response)) throw new Error("GitHub access renew karein — Disconnect phir Connect karein.");
  if (!response.ok) {
    const body = await response.text();
    console.error("GitHub provider error", response.status, body);
    throw new Error(`GitHub (${response.status}): ${response.status === 403 || response.status === 429 ? "Permission ya rate limit; GitHub account check karein." : response.status === 409 ? "Code badal gaya hai; dobara analyze karein." : "Request complete nahi hui."}`);
  }
  return response.status === 204 ? null : response.json();
}
export async function selectedWorkspace(userId: string, repo: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("github_workspaces").select("repo,branch").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  assertSelectedRepo(data?.repo ?? null, repo);
  if (!data?.branch) throw new Error("Repository branch missing.");
  return data;
}
export async function readCode(userId: string, repo: string, path: string) {
  const workspace = await selectedWorkspace(userId, repo);
  if (!readableCode(path)) throw new Error("Binary ya sensitive file AI ko nahi bheji jayegi.");
  const data = await githubRequest(userId, `/repos/${repo}/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(workspace.branch ?? "")}`) as { type?: string; content?: string; encoding?: string; sha?: string; size?: number };
  if (data.type !== "file" || data.encoding !== "base64" || !data.content || !data.sha) throw new Error("Code file read nahi hui.");
  if ((data.size ?? 0) > 200000) throw new Error("Is file ka size 200 KB se zyada hai; review skipped.");
  return { path, sha: data.sha, content: Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf8"), branch: workspace.branch ?? "" };
}