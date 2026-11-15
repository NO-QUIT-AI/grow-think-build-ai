import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertUpdateBranch, assertUpdateApproval, updatePath, validateUpdatePaths } from "./self-update-rules";
const target = "noquit-ai/update-00000000-0000-4000-8000-000000000001";
describe("self-update safety", () => {
  it("never targets main or the original branch", () => {
    assert.throws(() => assertUpdateBranch("main", "main"));
    assert.throws(() => assertUpdateBranch("main", "feature/random"));
    assert.throws(() => assertUpdateBranch(target, target));
    assert.doesNotThrow(() => assertUpdateBranch("main", target));
  });
  it("requires explicit owner approval", () => { assert.throws(() => assertUpdateApproval(false, "pending", "abc", "abc")); assert.doesNotThrow(() => assertUpdateApproval(true, "pending", "abc", "abc")); });
  it("rejects reused approval", () => { assert.throws(() => assertUpdateApproval(true, "pushing", "abc", "abc")); assert.throws(() => assertUpdateApproval(true, "pushed", "abc", "abc")); });
  it("rejects stale base commits", () => { assert.throws(() => assertUpdateApproval(true, "pending", "old", "new")); });
  it("only proposes safe previously reviewed paths", () => {
    assert.equal(updatePath.safeParse(".env").success, false);
    assert.equal(updatePath.safeParse("../src/app.ts").success, false);
    const change = { path: "src/app.ts", before: "a", after: "b", sha: "sha" };
    assert.throws(() => validateUpdatePaths([change], ["src/other.ts"]));
    assert.throws(() => validateUpdatePaths([change, change], ["src/app.ts"]));
    assert.doesNotThrow(() => validateUpdatePaths([change], ["src/app.ts"]));
  });
});