// @ts-nocheck -- Bun test runner.
import { expect, test } from "bun:test";
import { finalTranscript, filterRepeatedWords, micAllowed, silenceElapsed, VOICE_AUDIO_CONSTRAINTS } from "./voice-turn";
test("microphone only enabled during unmuted listening", () => {
  expect(micAllowed("speaking", false)).toBe(false);
  expect(micAllowed("thinking", false)).toBe(false);
  expect(micAllowed("listening", true)).toBe(false);
  expect(micAllowed("listening", false)).toBe(true);
});
test("silence ends a turn at exactly 1.5 seconds, never before voice", () => {
  expect(silenceElapsed(100, 1599)).toBe(false);
  expect(silenceElapsed(100, 1600)).toBe(true);
  expect(silenceElapsed(0, 1600)).toBe(false);
});
test("only final recognition results append", () => {
  expect(finalTranscript("", [{isFinal:false,0:{transcript:"wrong interim"}}, {isFinal:true,0:{transcript:"Bhai website banao"}}],0)).toBe("Bhai website banao");
  expect(finalTranscript("Bhai website banao",[{isFinal:true,0:{transcript:"Bhai website banao"}}],0)).toBe("Bhai website banao");
});
test("fourth consecutive repeated word is discarded", () => {
  expect(filterRepeatedWords("bhai Bhai bhai bhai bhai website")).toBe("bhai Bhai bhai website");
  expect(filterRepeatedWords("yes yes yes")).toBe("yes yes yes");
});
test("voice streams suppress echo and noise", () => {
  expect(VOICE_AUDIO_CONSTRAINTS).toEqual({echoCancellation:true,noiseSuppression:true,autoGainControl:true});
});