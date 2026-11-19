// @ts-nocheck -- Bun test runner.
import { afterEach, expect, test } from "bun:test";
import { aiCandidates, fallbackModel, createChatModel } from "./ai-provider.server";
const saved = { GROQ_API_KEY: process.env.GROQ_API_KEY, DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY, GEMINI_API_KEY: process.env.GEMINI_API_KEY };
afterEach(() => { for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
const options = { prompt: [], abortSignal: new AbortController().signal };
function mock(name, calls, parts, error = false) {
  return { name, model: { specificationVersion: "v4", provider: name, modelId: name, supportedUrls: {},
    doGenerate: async () => { calls.push(name); if (error) throw new Error("429"); return { content: [{ type: "text", text: name }] }; },
    doStream: async () => { calls.push(name); if (error) throw new Error("402"); return { stream: new ReadableStream({ start(c) { parts.forEach(p => c.enqueue(p)); c.close(); } }) }; },
  } };
}
test("provider order is exactly Groq → DeepSeek → Gemini", () => {
  process.env.GROQ_API_KEY = "test-groq"; process.env.DEEPSEEK_API_KEY = "test-deepseek"; process.env.GEMINI_API_KEY = "test-gemini";
  expect(aiCandidates().map(c => c.name)).toEqual(["Groq", "DeepSeek", "Gemini"]);
  expect(aiCandidates(true).map(c => c.name)).toEqual(["Groq", "Gemini"]);
});
test("missing keys are skipped rather than stopping the chain", () => {
  delete process.env.GROQ_API_KEY; delete process.env.DEEPSEEK_API_KEY; process.env.GEMINI_API_KEY = "test";
  expect(aiCandidates().map(c => c.name)).toEqual(["Gemini"]);
});
test("main chat uses approved Gemini 3.8 Flash with saved key even when other providers exist", () => {
  process.env.GROQ_API_KEY = "test-groq"; process.env.DEEPSEEK_API_KEY = "test-deepseek"; process.env.GEMINI_API_KEY = "test-gemini";
  expect(createChatModel().modelId).toBe("gemini-3.8-flash");
  expect(createChatModel().provider).toContain("gemini");
});
test("main chat does not silently substitute another provider without Gemini key", () => {
  process.env.GROQ_API_KEY = "test-groq"; delete process.env.GEMINI_API_KEY;
  expect(() => createChatModel()).toThrow("Saved Gemini key");
});
test("nonstream errors fall through DeepSeek to Gemini", async () => {
  const calls = [];
  const result = await fallbackModel([mock("Groq", calls, [], true), mock("DeepSeek", calls, [], true), mock("Gemini", calls, [])]).doGenerate(options);
  expect(calls).toEqual(["Groq", "DeepSeek", "Gemini"]);
  expect(result.content[0].text).toBe("Gemini");
});
test("stream error frames before output fail over and are not exposed", async () => {
  const calls = [];
  const model = fallbackModel([mock("Groq", calls, [{ type: "error", error: "quota" }]), mock("DeepSeek", calls, [], true), mock("Gemini", calls, [{ type: "text-delta", id: "1", delta: "hello" }])]);
  const result = await model.doStream(options);
  const parts = []; for await (const part of result.stream) parts.push(part);
  expect(calls).toEqual(["Groq", "DeepSeek", "Gemini"]);
  expect(parts).toEqual([{ type: "text-delta", id: "1", delta: "hello" }]);
});
test("never replays a tool call already emitted when a later stream error occurs", async () => {
  const calls = [];
  const model = fallbackModel([mock("Groq", calls, [{ type: "tool-call", toolCallId: "1", toolName: "save", input: "{}" }, { type: "error", error: "broken" }]), mock("DeepSeek", calls, [])]);
  const result = await model.doStream(options); for await (const part of result.stream) {}
  expect(calls).toEqual(["Groq"]);
});
test("cancellation stops without using the next provider", async () => {
  const calls = []; const abort = new AbortController(); abort.abort(new Error("cancelled"));
  await expect(fallbackModel([mock("Groq", calls, [], true), mock("DeepSeek", calls, [])]).doGenerate({ ...options, abortSignal: abort.signal })).rejects.toThrow("cancelled");
  expect(calls).toEqual([]);
});
test("all providers unavailable reports a safe final error", async () => {
  const calls = [];
  await expect(fallbackModel([mock("Groq", calls, [], true), mock("DeepSeek", calls, [], true), mock("Gemini", calls, [], true)]).doStream(options)).rejects.toThrow("Groq, DeepSeek aur Gemini");
  expect(calls).toEqual(["Groq", "DeepSeek", "Gemini"]);
});