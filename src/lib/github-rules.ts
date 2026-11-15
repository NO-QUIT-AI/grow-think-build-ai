import { z } from "zod";

export const repoName = z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/);
export const codePath = z.string().min(1).max(500).refine(path => !path.startsWith("/") && !path.split("/").some(p => p === ".." || p === "."));
export function readableCode(path: string) {
  if (/(^|\/)(\.env(?:\..*)?|node_modules|vendor|dist|build|\.git|package-lock.json|bun.lock|yarn.lock|pnpm-lock.yaml)(\/|$)/i.test(path)) return false;
  if (/(private.?key|credentials|service.account|google-services|secret)/i.test(path) || /\.(pem|key|p12|keystore)$/i.test(path)) return false;
  return /\.(tsx?|jsx?|py|java|go|rs|rb|php|vue|svelte|html|css|scss|json|yaml|yml|sql|md|sh|toml)$/i.test(path);
}
export function assertSelectedRepo(selected: string | null, requested: string) {
  if (!selected || selected !== requested) throw new Error("Pehle isi repository ko select karein.");
}
export function assertPushApproval(confirmed: boolean) {
  if (confirmed !== true) throw new Error("Push ke liye aapki permission chahiye.");
}
export const findingsSchema = z.object({ findings: z.array(z.object({ line: z.number().int().positive(), severity: z.enum(["error", "warning"]), message: z.string(), fix: z.string() })).max(30) });