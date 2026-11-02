export const PATCH_TARGETS = ["system-prompt", "persona", "tool-registry"] as const;
export type PatchTarget = (typeof PATCH_TARGETS)[number];
export const MAX_BROWSER_FIXES = 3;
export function timeContext(timezone: unknown, now = new Date()) {
  let zone = typeof timezone === "string" ? timezone : "UTC";
  try { new Intl.DateTimeFormat("en", { timeZone: zone }).format(now); } catch { zone = "UTC"; }
  return `CURRENT TIME: ${new Intl.DateTimeFormat("en-GB", { timeZone: zone, dateStyle: "full", timeStyle: "long" }).format(now)}. User timezone: ${zone}. UTC instant: ${now.toISOString()}. Calculate relative dates from stored timestamps; never invent deployment dates.`;
}
export function rankMemories<T extends { topic: string; content: string; tags?: string[] | null }>(rows: T[], query: string) {
  const words = [...new Set(query.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])];
  return rows.map(row => ({ ...row, score: words.reduce((score, word) => score + (row.topic.toLowerCase().includes(word) ? 3 : 0) + (row.content.toLowerCase().includes(word) ? 1 : 0) + (row.tags?.some(tag => tag.toLowerCase().includes(word)) ? 2 : 0), 0) })).filter(row => row.score > 0).sort((a,b) => b.score-a.score).slice(0,8);
}
export function summaryLines(question: string, answer: string) {
  const sentences = (answer.match(/[^.!?\n]+[.!?]?/g) ?? [answer]).map(s => s.trim()).filter(Boolean);
  return [`Request: ${question.replace(/\s+/g," ").slice(0,350)}`, ...[0,1,2].map(i => `Summary ${i+1}: ${(sentences[i] ?? (i===0 ? "Tool results saved in this conversation." : "No additional decision recorded.")).slice(0,500)}`)].join("\n");
}
export function validateRegistry(content: string, available: string[]) {
  const config = JSON.parse(content) as { disabled?: unknown };
  if (!Array.isArray(config.disabled) || config.disabled.some(name => typeof name !== "string" || !available.includes(name) || ["self_patch","self_revert","prepare_plan"].includes(name))) throw new Error("tool-registry requires {disabled: [existing tool names]}; safety tools cannot be disabled.");
  return config.disabled as string[];
}
export const ESTIMATED_TOOL_USD: Record<string, number> = { generate_image: 0.04, voiceover: 0.10, generate_video: 0.10, start_job: 0.10 };
export function approvalInput(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const { confirm: _confirm, ...args } = input as Record<string, unknown>;
  return args;
}
export function planNeedsApproval(calls: number, approved: boolean) {
  return !approved && calls >= 2;
}