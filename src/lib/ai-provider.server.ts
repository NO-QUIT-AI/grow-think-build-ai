import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText, type ModelMessage } from "ai";

type Model = ReturnType<ReturnType<typeof createOpenAICompatible>["chatModel"]>;
type StreamPart = Awaited<ReturnType<Model["doStream"]>>["stream"] extends ReadableStream<infer P> ? P : never;
type Candidate = { name: string; model: Model };
export type AITask = "chat" | "coding" | "voice";
const WAIT_MS = 30_000;
export function isCodingRequest(text: string) {
  return /\b(code|coding|github|repo|repository|studio|html|css|javascript|typescript|bug|function|component)\b|(?:app|website|page|button|project).*(?:build|create|make|edit|change|fix|bana|bna|badal|theek)|(?:build|create|make|edit|change|fix|bana|bna|badal|theek).*(?:app|website|page|button|project)/i.test(text);
}

// Called only from authenticated server handlers; no keys are read at import time.
export function aiCandidates(vision = false, task: AITask = "chat"): Candidate[] {
  const configs = [
    { name: "Groq", key: process.env["GROQ_API_KEY"], baseURL: "https://api.groq.com/openai/v1", model: vision ? "meta-llama/llama-4-scout-17b-16e-instruct" : "llama-3.3-70b-versatile" },
    { name: "DeepSeek", key: process.env["DEEPSEEK_API_KEY"], baseURL: "https://api.deepseek.com/v1", model: "deepseek-chat" },
    { name: "Gemini", key: process.env["GEMINI_API_KEY"], baseURL: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-3.8-flash" },
  ];
  if (task === "coding") configs.sort((a, b) => Number(b.name === "DeepSeek") - Number(a.name === "DeepSeek"));
  return configs.flatMap(c => {
    // DeepSeek chat does not accept images; do not silently discard attachments.
    if (!c.key || (vision && c.name === "DeepSeek")) return [];
    const provider = createOpenAICompatible({ name: c.name.toLowerCase(), baseURL: c.baseURL, apiKey: c.key,
      fetch: (input, init) => fetch(input, { ...init, signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(WAIT_MS)]) : AbortSignal.timeout(WAIT_MS) }) });
    return [{ name: c.name, model: provider.chatModel(c.model) }];
  });
}

/** Fail over at the model boundary, never replay already emitted text/tool calls. */
export function fallbackModel(candidates: Candidate[], waitMs = WAIT_MS): Model {
  const first = candidates[0];
  if (!first) throw new Error("AI keys configured nahi hain (Groq / DeepSeek / Gemini).");
  let active = 0;
  const stopped = (signal?: AbortSignal) => { if (signal?.aborted) throw signal.reason ?? new Error("Request cancelled"); };
  const bounded = async <T>(work: PromiseLike<T>, signal: AbortSignal): Promise<T> => {
    signal.throwIfAborted();
    let listener: (() => void) | undefined;
    try { return await Promise.race([work, new Promise<never>((_, reject) => {
      listener = () => reject(signal.reason);
      signal.addEventListener("abort", listener, { once: true });
    })]); } finally { if (listener) signal.removeEventListener("abort", listener); }
  };
  const deadline = (parent?: AbortSignal) => parent ? AbortSignal.any([parent, AbortSignal.timeout(waitMs)]) : AbortSignal.timeout(waitMs);
  return {
    specificationVersion: first.model.specificationVersion,
    provider: "noquit-fallback",
    modelId: candidates.map(c => c.name.toLowerCase()).join("-"),
    supportedUrls: first.model.supportedUrls,
    async doGenerate(options) {
      for (let i = active; i < candidates.length; i++) {
        stopped(options.abortSignal);
        const candidate = candidates[i];
        if (!candidate) continue;
        try {
          const signal = deadline(options.abortSignal);
          const result = await bounded(candidate.model.doGenerate({ ...options, abortSignal: signal }), signal);
          if (!result.content.some(p => p.type === "tool-call" || (p.type === "text" && p.text.trim()))) throw new Error("Empty AI response");
          active = i;
          return result;
        } catch {
          stopped(options.abortSignal);
          console.warn(`[AI] ${candidate.name} unavailable; trying next provider`);
        }
      }
      throw new Error("Groq, DeepSeek aur Gemini abhi jawab nahi de rahe; keys, balance ya quota check karein.");
    },
    async doStream(options) {
      for (let i = active; i < candidates.length; i++) {
        stopped(options.abortSignal);
        const candidate = candidates[i];
        if (!candidate) continue;
        let reader: ReadableStreamDefaultReader<StreamPart> | undefined;
        try {
          const signal = deadline(options.abortSignal);
          const result = await bounded(candidate.model.doStream({ ...options, abortSignal: signal }), signal);
          reader = result.stream.getReader();
          const held: StreamPart[] = [];
          let meaningful = false;
          while (!meaningful) {
            const next = await bounded(reader.read(), signal);
            if (next.done) throw new Error("Empty AI stream");
            if (next.value.type === "error") throw new Error("AI stream error");
            held.push(next.value);
            meaningful = next.value.type === "tool-call" || next.value.type === "tool-input-delta" || (next.value.type === "text-delta" && !!next.value.delta);
            if (next.value.type === "finish" && !meaningful) throw new Error("Empty AI stream");
          }
          active = i;
          const source = reader;
          return { ...result, stream: new ReadableStream({
            start(controller) { held.forEach(part => controller.enqueue(part)); },
            async pull(controller) {
              try { const next = await source.read(); if (next.done) controller.close(); else controller.enqueue(next.value); }
              catch (error) { controller.error(error); await source.cancel().catch(() => {}); }
            },
            cancel(reason) { return source.cancel(reason); },
          }) };
        } catch {
          await reader?.cancel().catch(() => {});
          stopped(options.abortSignal);
          console.warn(`[AI] ${candidate.name} stream unavailable; trying next provider`);
        }
      }
      throw new Error("Groq, DeepSeek aur Gemini abhi jawab nahi de rahe; keys, balance ya quota check karein.");
    },
  };
}

export function createAIModel(vision = false, task: AITask = "chat") { return fallbackModel(aiCandidates(vision, task)); }
export function createChatModel(coding = false) { return createAIModel(false, coding ? "coding" : "chat"); }
export async function aiText(system: string, input: string | ModelMessage[], signal?: AbortSignal, task: AITask = "chat") {
  const result = await generateText({ model: createAIModel(false, task), system,
    ...(typeof input === "string" ? { prompt: input } : { messages: input }), ...(signal ? { abortSignal: signal } : {}), maxRetries: 0 });
  return result.text;
}