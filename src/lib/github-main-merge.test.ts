import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertMainMerge, executeMainMerge, type MergeProposal } from "./github-main-merge";

const proposal: MergeProposal = { id: "preview", repo: "user/app", target_branch: "noquit-ai/update-00000000-0000-4000-8000-000000000001", status: "pushed", commit_sha: "reviewed-sha" };
describe("separately approved main merge", () => {
  it("does not merge without separate approval", () => assert.throws(() => assertMainMerge(false, proposal, "user/app", "reviewed-sha")));
  it("rejects a different selected repository", () => assert.throws(() => assertMainMerge(true, proposal, "other/app", "reviewed-sha")));
  it("requires an already approved and pushed branch", () => {
    for (const status of ["pending", "pushing", "failed", "discarded"]) assert.throws(() => assertMainMerge(true, { ...proposal, status }, "user/app", "reviewed-sha"));
  });
  it("rejects unreviewed changes added to the branch", () => assert.throws(() => assertMainMerge(true, proposal, "user/app", "new-sha")));
  it("never accepts main as the source", () => assert.throws(() => assertMainMerge(true, { ...proposal, target_branch: "main" }, "user/app", "reviewed-sha")));
  it("claims approval before merging a pinned reviewed commit into main and verifies readback", async () => {
    const events: string[] = [];
    const result = await executeMainMerge(proposal, "user/app", true, {
      request: async (path, init) => {
        events.push(path);
        if (init) { assert.equal(events.at(-2), "claim"); assert.equal(init.method, "POST"); assert.deepEqual(JSON.parse(String(init.body)), { base: "main", head: "reviewed-sha", commit_message: `NO QUIT AI approved merge: ${proposal.target_branch}` }); return { sha: "merge-sha" }; }
        if (path.includes("compare/")) return { status: "ahead" };
        return { object: { sha: path.endsWith("/main") ? "main-sha" : "reviewed-sha" } };
      },
      claim: async (main, source) => { assert.equal(main, "main-sha"); assert.equal(source, "reviewed-sha"); events.push("claim"); },
      finish: async (status, sha) => { assert.equal(status, "merged"); assert.equal(sha, "merge-sha"); events.push("confirmed"); },
    });
    assert.equal(result.sha, "merge-sha"); assert.equal(events.at(-1), "confirmed");
  });
  it("a consumed/concurrent approval cannot make a GitHub write", async () => {
    let writes = 0;
    await assert.rejects(executeMainMerge(proposal, "user/app", true, {
      request: async (_path, init) => { if (init) writes++; return { object: { sha: "reviewed-sha" } }; },
      claim: async () => { throw new Error("Approval already consumed"); }, finish: async () => {},
    }), /consumed/);
    assert.equal(writes, 0);
  });
  it("does not claim success or retry when GitHub rejects a merge", async () => {
    const statuses: string[] = []; let writes = 0;
    await assert.rejects(executeMainMerge(proposal, "user/app", true, {
      request: async (_path, init) => { if (init) { writes++; throw new Error("GitHub conflict"); } return { object: { sha: "reviewed-sha" } }; },
      claim: async () => {}, finish: async status => { statuses.push(status); },
    }), /conflict/);
    assert.deepEqual(statuses, ["unknown"]); assert.equal(writes, 1);
  });
});