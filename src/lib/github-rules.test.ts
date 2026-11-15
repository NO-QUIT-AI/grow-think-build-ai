import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertPushApproval, assertSelectedRepo, readableCode, codePath, repoName } from "./github-rules";
describe("GitHub permission boundaries", () => {
  it("only reads the repository selected by the authenticated user", () => {
    assert.throws(() => assertSelectedRepo("user/allowed", "user/other"));
    assert.throws(() => assertSelectedRepo(null, "user/allowed"));
    assert.doesNotThrow(() => assertSelectedRepo("user/allowed", "user/allowed"));
  });
  it("requires explicit Yes for push", () => {
    assert.throws(() => assertPushApproval(false));
    assert.doesNotThrow(() => assertPushApproval(true));
  });
  it("rejects provider path traversal", () => {
    assert.equal(codePath.safeParse("../other.ts").success, false);
    assert.equal(repoName.safeParse("user/repo/../../apps").success, false);
    assert.equal(codePath.safeParse("src/index.ts").success, true);
  });
  it("does not send sensitive files to AI", () => {
    assert.equal(readableCode(".env.production"), false);
    assert.equal(readableCode("firebase-service-account.json"), false);
    assert.equal(readableCode("src/index.ts"), true);
  });
});