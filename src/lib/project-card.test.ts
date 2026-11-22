import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildExportChanges, decodeProjectTurn, encodeProjectTurn, manualBuildTools } from "./project-card";
const id = "12345678-1234-4234-8234-123456789abc";
describe("user-controlled project builds", () => {
  it("does not expose automatic publishing tools to the chat model", () => {
    assert.deepEqual(Object.keys(manualBuildTools({ build_website: {}, github_push_to_new_branch: {}, vercel_deploy: {}, quick_deploy: {}, rollback_deploy: {}, run_command: {}, preview_url: {} })), ["build_website", "github_push_to_new_branch"]);
  });
  it("exports exact built code as a new isolated file with Before/After", () => {
    assert.deepEqual(buildExportChanges(id, "<html>Playable game</html>", []), [{ path: `builds/${id}/index.html`, before: "", after: "<html>Playable game</html>", sha: null }]);
  });
  it("never overwrites an existing build file", () => {
    assert.throws(() => buildExportChanges(id, "new code", [{ path: `builds/${id}/index.html`, type: "blob", mode: "100644", sha: "old" }]), /already exists/);
  });
  it("rejects exports through a symlink", () => {
    assert.throws(() => buildExportChanges(id, "code", [{ path: "builds", type: "blob", mode: "120000" }]));
  });
  it("restores saved project and review references without storing HTML in chat", () => {
    assert.deepEqual(decodeProjectTurn(encodeProjectTurn("Ready", [id, id], [id])), { nqaiTurn: 1, text: "Ready", projects: [id], reviews: [id] });
    assert.equal(decodeProjectTurn("ordinary chat").text, "ordinary chat");
  });
});