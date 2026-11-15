import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { githubChatTools } from "./github-chat-tools";

describe("chat GitHub tool boundary", () => {
  const options = { toolCallId: "test", messages: [] };
  it("connect requests user consent rather than silently authorizing", async () => {
    const tools = githubChatTools({ connect: async () => ({ connected: false, chatAction: "github_connect" }), read: async () => null, prepare: async () => null });
    assert.deepEqual(await tools.github_connect.execute?.({}, options), { connected: false, chatAction: "github_connect" });
  });
  it("reads only the requested safe file through the scoped reader", async () => {
    let path = "";
    const tools = githubChatTools({ connect: async () => ({}), read: async p => { path = p; return { content: "safe" }; }, prepare: async () => null });
    await tools.github_read_file.execute?.({ path: "src/main.ts" }, options);
    assert.equal(path, "src/main.ts");
  });
  it("push tool only prepares Before/After and cannot invoke a push", async () => {
    let prepared = "";
    const tools = githubChatTools({ connect: async () => ({}), read: async () => null, prepare: async request => { prepared = request; return { previewId: "preview", needsApproval: true }; } });
    assert.deepEqual(await tools.github_push_branch.execute?.({ request: "Add a feature" }, options), { previewId: "preview", needsApproval: true });
    assert.equal(prepared, "Add a feature");
  });
});