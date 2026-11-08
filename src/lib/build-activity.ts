import type { UIMessage } from "ai";

export type BuildStep = { id: string; tool: string; state: string; file?: string; table?: string; output: Record<string, unknown> };
export type BuildActivity = {
  id: string; prompt: string; status: string; text: string; code: string;
  steps: BuildStep[]; error?: string;
  approvePlan?: (id: string) => void;
  approveCost?: (id: string, tool: string) => void;
  cancel?: () => void;
};

export function isBuildRequest(text: string): boolean {
  const subject = /\b(app|website|site|page|dashboard|project|build|table|database|cv|portfolio|code|coding)\b/i;
  const action = /\b(build|create|make|develop|design|fix|edit|update|implement|banao|bana|bn[a-z]*|banaye|ban[a-z]*|bnao|likho|karo|kar\s+do)\b/i;
  return subject.test(text) && action.test(text);
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function string(value: unknown): string { return typeof value === "string" ? value : ""; }

export function readBuildStream(messages: UIMessage[]): Pick<BuildActivity, "text" | "code" | "steps"> {
  let text = "", code = "";
  const steps: BuildStep[] = [];
  for (const message of messages) {
    if (message.role !== "assistant") continue;
    for (const part of message.parts) {
      if (part.type === "text") text += part.text + "\n";
      if (!part.type.startsWith("tool-")) continue;
      const toolPart = part as unknown as { type: string; toolCallId?: string; state?: string; input?: unknown; output?: unknown };
      const input = record(toolPart.input), output = record(toolPart.output);
      const files = Array.isArray(input.files) ? input.files.map(record) : [];
      const nextCode = string(input.code) || string(input.html) || string(input.newContent) || files.map(f => string(f.content)).filter(Boolean).join("\n\n");
      if (nextCode) code = nextCode;
      steps.push({
        id: toolPart.toolCallId || `${message.id}-${steps.length}`,
        tool: part.type.slice(5),
        state: output.error || output.ok === false ? "output-error" : toolPart.state || "input-streaming",
        file: string(input.path) || string(input.file) || files.map(f => string(f.path)).filter(Boolean).join(", "),
        table: string(input.table),
        // Only approval fields are shared with the progress view, not tool secrets or private results.
        output: Object.fromEntries(Object.entries(output).filter(([key]) => ["planId", "costApprovalId", "steps", "tool", "cost", "error", "budgetBlocked"].includes(key))),
      });
    }
  }
  if (!code) code = /```(?:html|jsx|tsx|javascript|typescript|sql|css)?\s*\n([\s\S]*?)(?:```|$)/i.exec(text)?.[1] || "";
  return { text: text.trim(), code, steps };
}