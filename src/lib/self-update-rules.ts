import { z } from "zod";
import { codePath, readableCode } from "./github-rules";
export const updatePath = codePath.refine(path => readableCode(path) && !/[\\%\u0000-\u001f\u007f]/.test(path) && path.split("/").every(Boolean), "Unsafe/sensitive/binary files excluded");
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

export type UpdateContext = { path: string; before: string; sha: string | null };
export type UpdateTreeEntry = { path: string; type: string; mode: string; sha?: string };
// Existing edits must have been read at the pinned base. New files may be discovered during generation.
export function materializeUpdateChanges(proposed: { path: string; after: string }[], context: UpdateContext[], tree: UpdateTreeEntry[]) {
  const changes = proposed.map(change => {
    updatePath.parse(change.path);
    const original = context.find(file => file.path === change.path);
    const entry = tree.find(file => file.path === change.path);
    const parts = change.path.split("/");
    const blockedParent = parts.slice(0, -1).some((_, i) => {
      const parent = tree.find(file => file.path === parts.slice(0, i + 1).join("/"));
      return parent && (parent.type !== "tree" || parent.mode === "120000");
    });
    if (blockedParent || (entry && (!original?.sha || entry.type !== "blob" || !["100644", "100755"].includes(entry.mode) || entry.sha !== original.sha))) throw new Error("Existing file must be safely read before editing; request a fresh preview with this file.");
    if (!entry && original?.sha) throw new Error("File base mismatch.");
    return { ...change, before: original?.before ?? "", sha: original?.sha ?? null };
  });
  // Check duplicates before dropping unchanged files.
  validateUpdatePaths(changes, changes.map(change => change.path));
  if (changes.some(change => changes.some(other => other.path !== change.path && change.path.startsWith(other.path + "/")))) throw new Error("Proposal has conflicting file/directory paths.");
  return updateChanges.parse(changes.filter(change => change.before !== change.after));
}