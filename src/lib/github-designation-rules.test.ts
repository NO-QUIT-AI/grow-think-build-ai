import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertRepoDesignation, githubReconnectPatch } from "./github-designation-rules";

const repo = "NO-QUIT-AI/grow-think-build-ai";
describe("private source designation", () => {
  it("allows the connected selected writeable repo without granting app-owner roles", () => {
    assert.doesNotThrow(() => assertRepoDesignation(repo, repo, repo, true));
    assert.throws(() => assertRepoDesignation(null, repo, repo, true));
    assert.throws(() => assertRepoDesignation("other/repo", repo, repo, true));
    assert.throws(() => assertRepoDesignation(repo, repo, "other/repo", true));
    assert.throws(() => assertRepoDesignation(repo, repo, repo, false));
  });
  it("reconnecting cannot null the selected repo, branch or own designation", () => {
    const patch = githubReconnectPatch("user", "nonce");
    const workspace = { user_id: "user", repo, branch: "main", ownRepo: repo };
    assert.deepEqual({ ...workspace, ...patch }, { user_id: "user", repo, branch: "main", ownRepo: repo, oauth_nonce: "nonce" });
    assert.equal(Object.hasOwn(patch, "repo"), false);
    assert.equal(Object.hasOwn(patch, "branch"), false);
  });
});