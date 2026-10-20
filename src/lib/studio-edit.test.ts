// @ts-nocheck -- Bun test runner.
import { expect, test } from "bun:test";
import { assertEditBase, claudeFrames, editedCode, STUDIO_MODEL } from "./studio-edit";
test("uses the chosen Claude Sonnet 5 model", () => expect(STUDIO_MODEL).toBe("anthropic/claude-sonnet-5"));
test("edits only code and removes a whole response fence", () => {
  expect(editedCode('```html\n<h1>NO QUIT AI</h1>\n```')).toBe('<h1>NO QUIT AI</h1>');
});
test("rejects applying a preview to a changed file", () => {
  expect(() => assertEditBase("new", "old")).toThrow("File changed");
  expect(() => assertEditBase("old", "old")).not.toThrow();
});
test("streams split frames after ping and empty thinking without stalling", () => {
  let result = claudeFrames('data: {"type":"ping"}\n\ndata: {"type":"content_block_delta","delta":{"type":"thinking_delta","text":""}}\n\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"<h');
  expect(result.events.length).toBe(2);
  result = claudeFrames(result.rest + '1>"}}\n\ndata: {"type":"message_stop"}\n\n');
  expect(result.events[0].delta.text).toBe("<h1>");
  expect(result.events[1].type).toBe("message_stop");
});