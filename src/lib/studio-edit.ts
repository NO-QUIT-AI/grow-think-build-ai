export const STUDIO_MODEL = "anthropic/claude-sonnet-5";
export type StudioContext = { memoryId: string; code: string };

export function editedCode(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```[^\n]*\n([\s\S]*?)\n```$/);
  return fenced?.[1] ?? trimmed;
}

export function assertEditBase(current: string, expected: string) {
  if (current !== expected) throw new Error("File changed. Reload the latest code before applying this edit.");
}

/** Split native Claude SSE incrementally, including frames divided across reads. */
export function claudeFrames(buffer: string) {
  const normalized = buffer.replace(/\r\n/g, "\n");
  const parts = normalized.split("\n\n");
  const rest = parts.pop() ?? "";
  const events: { type: string; delta?: { type?: string; text?: string; stop_reason?: string }; error?: { message?: string } }[] = [];
  for (const frame of parts) {
    const data = frame.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart()).join("\n");
    if (data && data !== "[DONE]") events.push(JSON.parse(data));
  }
  return { events, rest };
}