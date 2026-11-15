import { describe, it, expect } from "bun:test";
import { assertPushApproval, assertSelectedRepo, readableCode, codePath, repoName } from "./github-rules";
describe("GitHub permission boundaries", () => {
  it("only reads the repository selected by the authenticated user", () => {
    expect(() => assertSelectedRepo("user/allowed", "user/other")).toThrow();
    expect(() => assertSelectedRepo(null, "user/allowed")).toThrow();
    expect(() => assertSelectedRepo("user/allowed", "user/allowed")).not.toThrow();
  });
  it("requires explicit Yes for push", () => {
    expect(() => assertPushApproval(false)).toThrow();
    expect(() => assertPushApproval(true)).not.toThrow();
  });
  it("rejects provider path traversal", () => {
    expect(codePath.safeParse("../other.ts").success).toBe(false);
    expect(repoName.safeParse("user/repo/../../apps").success).toBe(false);
    expect(codePath.safeParse("src/index.ts").success).toBe(true);
  });
  it("does not send sensitive files to AI", () => {
    expect(readableCode(".env.production")).toBe(false);
    expect(readableCode("firebase-service-account.json")).toBe(false);
    expect(readableCode("src/index.ts")).toBe(true);
  });
});