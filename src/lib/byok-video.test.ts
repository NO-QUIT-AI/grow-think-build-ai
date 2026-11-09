import { describe, expect, it } from "bun:test";
import { splitScript, scenesForMinutes } from "./byok-video";

describe("byok video", () => {
  it("splits long scripts into scenes of at most 22 words", () => {
    const script = Array.from({ length: 100 }, (_, i) => `word${i}`).join(" ") + ". Short end.";
    const scenes = splitScript(script);
    expect(scenes.every(s => s.split(" ").length <= 22)).toBe(true);
    expect(scenes.join(" ").split(" ").length).toBe(102);
  });
  it("1 hour at 5s clips needs 720 scenes", () => {
    expect(scenesForMinutes(60)).toBe(720);
  });
});
