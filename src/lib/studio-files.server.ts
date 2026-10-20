import type { SupabaseClient } from "@supabase/supabase-js";
import { tool } from "ai";
import { z } from "zod";
import type { Database, Json } from "@/integrations/supabase/types";
import { assertEditBase } from "./studio-edit";

type Client = SupabaseClient<Database>;
export async function studioMemory(sb: Client, userId: string, id: string) {
  const { data, error } = await sb.from("memories").select("id,user_id,prompt,project_type,code,summary,blueprint,version").eq("id", id).eq("user_id", userId).single();
  if (error || !data) throw new Error("Studio file not found.");
  if (data.project_type !== "website") throw new Error("Open a website file in Studio first.");
  return data;
}

export async function saveStudioFile(sb: Client, userId: string, id: string, content: string, expected: string, undo = false) {
  const memory = await studioMemory(sb, userId, id);
  assertEditBase(memory.code, expected);
  const blueprint = memory.blueprint && typeof memory.blueprint === "object" && !Array.isArray(memory.blueprint) ? memory.blueprint : {};
  const history = Array.isArray(blueprint["studio_history"]) ? blueprint["studio_history"].filter((v): v is string => typeof v === "string") : [];
  const next = undo ? history.at(-1) : content;
  if (next === undefined) throw new Error("No previous file version.");
  if (undo) history.pop(); else history.push(memory.code);
  const { data, error } = await sb.from("memories").update({
    code: next, version: memory.version + 1,
    blueprint: { ...blueprint, html: next, studio_history: history.slice(-10) } as Json,
  }).eq("id", id).eq("user_id", userId).eq("version", memory.version).select("id").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("File changed. Reload before applying.");
  // Mirror the same file through the existing Genesis writer for owners, without exposing owner tools to other users.
  try {
    const { data: owner } = await sb.rpc("is_owner", { _uid: userId });
    if (owner) {
      const { writeGenesisFile } = await import("./genesis-tools.server");
      await writeGenesisFile(`studio-${id}`, "index.html", next);
    }
    const { r2 } = await import("./r2.server");
    const { client, base } = r2();
    const response = await client.fetch(`${base}/builds/${userId}/${id}.html`, { method: "PUT", body: next, headers: { "content-type": "text/html; charset=utf-8" } });
    if (!response.ok) throw new Error(`R2 ${response.status}`);
  } catch { console.warn("[studio] File saved; R2 mirror pending"); }
  return { saved: true, memoryId: id, code: next, canUndo: history.length > 0 };
}

export function studioFileTools(sb: Client, userId: string, activeId?: string) {
  return {
    file_edit: tool({
      description: "Edit the active Studio index.html. Returns memoryId for opening Studio. Preserves persistent file_undo history.",
      inputSchema: z.object({ memoryId: z.string().uuid().nullable(), content: z.string().min(30).max(300_000) }),
      execute: async ({ memoryId, content }) => {
        const id = memoryId ?? activeId;
        if (!id) return { error: "No active file. Create it with build_website first." };
        try {
          const memory = await studioMemory(sb, userId, id);
          return await saveStudioFile(sb, userId, id, content, memory.code);
        } catch (e) { return { error: e instanceof Error ? e.message : "Edit failed" }; }
      },
    }),
    file_undo: tool({
      description: "Restore the previous saved Studio file version.",
      inputSchema: z.object({ memoryId: z.string().uuid().nullable() }),
      execute: async ({ memoryId }) => {
        const id = memoryId ?? activeId;
        if (!id) return { error: "No active Studio file" };
        try {
          const memory = await studioMemory(sb, userId, id);
          return await saveStudioFile(sb, userId, id, "", memory.code, true);
        } catch (e) { return { error: e instanceof Error ? e.message : "Undo failed" }; }
      },
    }),
  };
}