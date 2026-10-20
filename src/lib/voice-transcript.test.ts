// @ts-nocheck
import { expect, test } from "bun:test";
import { cleanTranscript, detectSpeechLang, mergeFinal } from "./voice-transcript";
test("loop", () => {
  const s = "Achcha Mujhe yah batao ki baki hai theek";
  let f = ""; for (let i=0;i<5;i++) f = mergeFinal(f, s);
  expect(cleanTranscript(f)).toBe(s);
  expect(cleanTranscript(`${s} ${s} ${s}`)).toBe(s);
  expect(cleanTranscript("a".repeat(300)).length).toBe(200);
});
test("lang", () => {
  expect(detectSpeechLang("Hello how are you?")).toBe("en");
  expect(detectSpeechLang("Bhai kya haal hai?")).toBe("hi");
});
