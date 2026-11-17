import { assertUpdateBranch } from "./self-update-rules";

export type MergeProposal = { id: string; repo: string; target_branch: string; status: string; commit_sha: string | null };
export function assertMainMerge(confirmed: boolean, proposal: MergeProposal, selectedRepo: string, sourceSha: string) {
  if (confirmed !== true) throw new Error("Main merge ke liye alag approval chahiye.");
  if (proposal.repo !== selectedRepo) throw new Error("Selected repo badal gaya; usi repo ko select karein.");
  if (proposal.status !== "pushed" || !proposal.commit_sha) throw new Error("Pehle reviewed change ko nayi branch par push karein.");
  assertUpdateBranch("main", proposal.target_branch);
  if (sourceSha !== proposal.commit_sha) throw new Error("Branch code badal gaya; fresh Before/After approval chahiye.");
}

type MergeDependencies = {
  request: (path: string, init?: RequestInit) => Promise<unknown>;
  claim: (mainSha: string, sourceSha: string) => Promise<void>;
  finish: (status: "merged" | "unknown", sha?: string) => Promise<void>;
};

// No model tool receives this function; only the separate authenticated approval endpoint calls it.
export async function executeMainMerge(proposal: MergeProposal, selectedRepo: string, confirmed: boolean, deps: MergeDependencies) {
  assertMainMerge(confirmed, proposal, selectedRepo, proposal.commit_sha ?? "");
  const root = `/repos/${proposal.repo}`;
  const source = await deps.request(`${root}/git/ref/heads/${encodeURIComponent(proposal.target_branch)}`) as { object: { sha: string } };
  assertMainMerge(confirmed, proposal, selectedRepo, source.object.sha);
  const main = await deps.request(`${root}/git/ref/heads/main`) as { object: { sha: string } };
  await deps.claim(main.object.sha, source.object.sha);
  try {
    // Pin the reviewed commit, not the movable branch name. GitHub enforces conflicts and branch protection.
    const merge = await deps.request(`${root}/merges`, { method: "POST", body: JSON.stringify({ base: "main", head: source.object.sha, commit_message: `NO QUIT AI approved merge: ${proposal.target_branch}` }) }) as { sha?: string } | null;
    const check = await deps.request(`${root}/compare/${source.object.sha}...main`) as { status: string };
    if (check.status !== "ahead" && check.status !== "identical") throw new Error("Main merge confirmation nahi mili. GitHub check karein; retry na karein.");
    const latest = await deps.request(`${root}/git/ref/heads/main`) as { object: { sha: string } };
    await deps.finish("merged", merge?.sha ?? latest.object.sha);
    return { branch: proposal.target_branch, repo: proposal.repo, sha: merge?.sha ?? latest.object.sha, url: `https://github.com/${proposal.repo}/tree/main` };
  } catch (error) {
    // Network failures can happen after a successful remote merge: never replay a consumed approval.
    await deps.finish("unknown");
    throw error;
  }
}