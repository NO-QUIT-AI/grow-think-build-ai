// @ts-nocheck
import { expect, test } from "bun:test";
import { splitStory, captionWordAt } from "./auto-video";

test("the requested short story becomes five scenes without invented words", () => {
  const story = "Ek ladka gareebi se ameer banta hai";
  const scenes = splitStory(story);
  expect(scenes).toHaveLength(5);
  expect(scenes.map(s => s.text).join(" ")).toBe(story);
  expect(scenes[0]).toEqual({ id: 1, text: "Ek", voiceover_text: "Ek", search_keyword: "Ek" });
});
test("six or more sentences make six scenes, preserving every sentence", () => {
  const story = "One. Two. Three. Four. Five. Six. Seven.";
  const scenes = splitStory(story);
  expect(scenes).toHaveLength(6);
  expect(scenes.map(s => s.text).join(" ")).toBe(story);
});
test("empty stories cannot generate scenes", () => expect(splitStory("  ")).toEqual([]));
test("captions advance one word at a time", () => {
  expect(captionWordAt("Ek ladka gareebi se ameer", 0, 5)).toBe(0);
  expect(captionWordAt("Ek ladka gareebi se ameer", 2, 5)).toBe(2);
  expect(captionWordAt("Ek ladka gareebi se ameer", 5, 5)).toBe(4);
});