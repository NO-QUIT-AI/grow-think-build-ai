import { z } from "zod";
import { codePath, readableCode } from "./github-rules";
export const updatePath = codePath.refine(readableCode, "Sensitive/binary files excluded");
export const updateChanges = z.array(z.object({ path: updatePath, before: z.string(), after: z.string().min(1).max(250000), sha: z.string().nullable() })).min(1).max(12);
export function assertUpdateBranch(base: string, target: string) {
  if (base === target || !/^noquit-ai\/update-[a-f0-9-]{36}$/.test(target)) throw new Error("Self-update sirf nayi NO QUIT AI branch par allowed hai.");
}
export function assertUpdateApproval(confirmed: boolean, status: string, baseSha: string, currentSha: string) {
  if (confirmed !== true) throw new Error("Owner approval required.");
  if (status !== "pending") throw new Error("Approval already used or unavailable.");
  if (baseSha !== currentSha) throw new Error("Repo badal gaya; fresh preview banayein.");
}
export function validateUpdatePaths(changes: z.infer<typeof updateChanges>, allowed: string[]) {
  if (new Set(changes.map(c => c.path)).size !== changes.length || changes.some(c => !allowed.includes(c.path))) throw new Error("Unexpected or duplicate file changes.");
}