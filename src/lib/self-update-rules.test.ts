import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertUpdateBranch, assertUpdateApproval, updatePath, validateUpdatePaths, materializeUpdateChanges } from "./self-update-rules";
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
  it("accepts exactly two new files plus one read existing edit in one proposal", () => {
    const changes = materializeUpdateChanges([
      { path: "src/lib/new-feature.ts", after: "export const feature = true;" },
      { path: "src/lib/new-feature.test.ts", after: "import { feature } from './new-feature';" },
      { path: "src/routes/index.tsx", after: "export const enabled = true;" },
    ], [{ path: "src/routes/index.tsx", before: "export const enabled = false;", sha: "base-blob" }], [{ path: "src/routes/index.tsx", type: "blob", mode: "100644", sha: "base-blob" }]);
    assert.equal(changes.length, 3);
    assert.equal(changes.filter(c => c.sha === null).length, 2);
    assert.equal(changes.find(c => c.path === "src/routes/index.tsx")?.sha, "base-blob");
    assert.equal(changes.find(c => c.path === "src/lib/new-feature.ts")?.before, "");
  });
  it("permits package.json dependency additions from read original content", () => {
    const before = '{"dependencies":{"react":"19.0.0"}}';
    const after = '{"dependencies":{"react":"19.0.0","zod":"4.0.0"}}';
    const changes = materializeUpdateChanges([{ path: "package.json", after }], [{ path: "package.json", before, sha: "package-sha" }], [{ path: "package.json", type: "blob", mode: "100644", sha: "package-sha" }]);
    assert.equal(JSON.parse(changes[0]?.after ?? "{}").dependencies.zod, "4.0.0");
    assert.equal(changes[0]?.sha, "package-sha");
  });
  it("rejects unread existing files, symlinks and changed blob identities", () => {
    const proposal = [{ path: "src/app.ts", after: "new" }];
    const tree = [{ path: "src/app.ts", type: "blob", mode: "100644", sha: "old" }];
    assert.throws(() => materializeUpdateChanges(proposal, [], tree));
    assert.throws(() => materializeUpdateChanges(proposal, [{ path: "src/app.ts", before: "old", sha: "different" }], tree));
    assert.throws(() => materializeUpdateChanges(proposal, [{ path: "src/app.ts", before: "old", sha: "old" }], [{ ...tree[0], path: "src/app.ts", type: "blob", mode: "120000", sha: "old" }]));
  });
  it("rejects new sensitive/ambiguous paths and file-directory collisions", () => {
    for (const path of [".env", "../new.ts", "src//new.ts", "src\\new.ts", "src/%2e%2e/new.ts"]) assert.throws(() => materializeUpdateChanges([{ path, after: "new" }], [], []));
    assert.throws(() => materializeUpdateChanges([{ path: "src/new.ts", after: "new" }], [], [{ path: "src", type: "blob", mode: "120000" }]));
    assert.throws(() => materializeUpdateChanges([{ path: "src/file.ts", after: "new" }, { path: "src/file.ts/child.ts", after: "new" }], [], []));
    assert.throws(() => materializeUpdateChanges([{ path: "src/new.ts", after: "a" }, { path: "src/new.ts", after: "b" }], [], []));
  });
});