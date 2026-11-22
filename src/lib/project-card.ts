import { z } from "zod";
import { materializeUpdateChanges, type UpdateTreeEntry } from "./self-update-rules";

export const USER_FIRST_BUILDER_PROMPT = `USER-FIRST BUILD AND BUG RULES:
- For websites, web apps AND playable games, use build_website with complete working HTML, CSS and JavaScript. The result appears as a Project Card INSIDE Chat. Stay in Chat; do not navigate away automatically.
- Build creation is a private draft. Never automatically publish/deploy or push it. Only the user's Publish Live button publishes; Push to GitHub prepares Before/After, then a separate Approve & Push New Branch click writes. Main requires its own separate confirmation.
- For bug checking, first inspect relevant code and available evidence, explain the likely cause and a minimal safe solution. Distinguish verified findings from guesses. Preserve unrelated code, UI, permissions and dependencies. Do not claim tests passed unless actually run.
- GitHub bug fixes must use github_read_file / github_push_to_new_branch for immutable Before/After review; NEVER directly modify main. For active Studio bugs explain diagnosis before using file_edit, which retains undo history.`;

const storedTurn = z.object({ nqaiTurn: z.literal(1), text: z.string(), projects: z.array(z.string().uuid()), reviews: z.array(z.string().uuid()) });
export function manualBuildTools<T>(tools: Record<string, T>) {
  const blocked = new Set(["vercel_deploy", "quick_deploy", "rollback_deploy", "run_command", "preview_url"]);
  return Object.fromEntries(Object.entries(tools).filter(([name]) => !blocked.has(name)));
}
export function encodeProjectTurn(text: string, projects: string[], reviews: string[]) {
  return projects.length || reviews.length ? JSON.stringify(storedTurn.parse({ nqaiTurn: 1, text, projects: [...new Set(projects)], reviews: [...new Set(reviews)] })) : text;
}
export function decodeProjectTurn(content: string) {
  try { const parsed = storedTurn.safeParse(JSON.parse(content)); if (parsed.success) return parsed.data; } catch { /* ordinary message */ }
  return { text: content, projects: [], reviews: [] };
}
export function buildExportChanges(memoryId: string, html: string, tree: UpdateTreeEntry[]) {
  z.string().uuid().parse(memoryId);
  const path = `builds/${memoryId}/index.html`;
  if (tree.some(entry => entry.path === path)) throw new Error("Build already exists in this repo; review an edit instead of overwriting it.");
  return materializeUpdateChanges([{ path, after: html }], [], tree);
}