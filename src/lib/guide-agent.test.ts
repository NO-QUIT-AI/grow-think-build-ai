// @ts-nocheck -- Bun test runner, matching existing project tests.
import { describe, expect, test } from "bun:test";
import { GUIDE_ID_PREFIX, isGuideMessageId } from "./guide-agent";

describe("guide-agent", () => {
  test("guide message ids are detected", () => {
    expect(isGuideMessageId(`${GUIDE_ID_PREFIX}123`)).toBe(true);
    expect(isGuideMessageId("va-123")).toBe(false);
    expect(isGuideMessageId("")).toBe(false);
  });

  test("emitGuideMessage is a no-op without window", () => {
    expect(() => {
      // Node/Bun test env me window nahi hota; crash nahi hona chahiye.
      const { emitGuideMessage } = require("./guide-agent");
      emitGuideMessage("test");
    }).not.toThrow();
  });
});
