import { expect, test } from "vitest";
import { cleanTranscript, mergeFinal } from "./voice-transcript";
test("loop", () => {
  const s = "Achcha Mujhe yah batao ki baki hai theek";
  let f = ""; for (let i=0;i<5;i++) f = mergeFinal(f, s);
  expect(cleanTranscript(f)).toBe(s);
  expect(cleanTranscript(`${s} ${s} ${s}`)).toBe(s);
  expect(cleanTranscript("a".repeat(300)).length).toBe(200);
});
