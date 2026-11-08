import { describe, expect, it } from "bun:test";
import type { UIMessage } from "ai";
import { isBuildRequest, readBuildStream } from "./build-activity";

describe("build navigation", () => {
  it("opens build for English and Roman Urdu creation requests", () => {
    expect(isBuildRequest("Create a complete expense tracker app structure")).toBe(true);
    expect(isBuildRequest("Bhai mere liye app bnao")).toBe(true);
    expect(isBuildRequest("website banao")).toBe(true);
  });
  it("keeps ordinary questions in chat", () => {
    expect(isBuildRequest("What is a website?")).toBe(false);
    expect(isBuildRequest("Hello bhai")).toBe(false);
  });
});
describe("real build activity", () => {
  it("reads partial code and genuine table tool state without exposing result secrets", () => {
    const messages = [{ id: "a", role: "assistant", parts: [
      { type: "tool-file_edit", toolCallId: "f", state: "input-streaming", input: { code: "<h1>My app" } },
      { type: "tool-db_write", toolCallId: "d", state: "output-available", input: { table: "posts" }, output: { ok: false, error: "Denied", token: "private" } },
    ] }] as unknown as UIMessage[];
    const activity = readBuildStream(messages);
    expect(activity.code).toBe("<h1>My app");
    expect(activity.steps[0]?.state).toBe("input-streaming");
    expect(activity.steps[1]?.table).toBe("posts");
    expect(activity.steps[1]?.state).toBe("output-error");
    expect(activity.steps[1]?.output.token).toBeUndefined();
  });
});