import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { encryptBackup, decryptBackup } from "./security-crypto";
import { backupDue } from "./security-safety";

export const getSecurityBackup = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data, error } = await context.supabase.from("security_backup_settings").select("auto_enabled,last_backup_at,row_count").eq("user_id", context.userId).maybeSingle();
  if (error) throw new Error("Backup status load nahi hua.");
  return data ?? { auto_enabled: false, last_backup_at: null, row_count: 0 };
});

export const setSecurityBackup = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(z.object({ enabled: z.boolean() })).handler(async ({ context, data }) => {
  const existing = await context.supabase.from("security_backup_settings").select("user_id").eq("user_id", context.userId).maybeSingle();
  if (existing.error) throw new Error("Backup setting load nahi hui.");
  const result = existing.data
    ? await context.supabase.from("security_backup_settings").update({ auto_enabled: data.enabled }).eq("user_id", context.userId)
    : await context.supabase.from("security_backup_settings").insert({ user_id: context.userId, auto_enabled: data.enabled });
  if (result.error) throw new Error("Backup setting save nahi hui.");
  return { enabled: data.enabled };
});

export const runSecurityBackup = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(z.object({ automatic: z.boolean().default(false) })).handler(async ({ context, data }) => {
  const { supabase, userId } = context;
  const { data: setting, error: settingError } = await supabase.from("security_backup_settings").select("*").eq("user_id", userId).maybeSingle();
  if (settingError) throw new Error("Backup status unavailable.");
  if (data.automatic && (!setting?.auto_enabled || !backupDue(setting.last_backup_at, Date.now()))) return { saved: false };
  const secret = process.env["SECURITY_BACKUP_KEY"];
  if (!secret || !process.env["R2_ACCOUNT_ID"] || !process.env["R2_SECRET_ACCESS_KEY"] || !process.env["R2_ACCESS_KEY_ID"] || !process.env["R2_BUCKET_NAME"]) throw new Error("Encrypted cloud backup abhi configured nahi hai.");
  type Page = PromiseLike<{ data: unknown[] | null; error: unknown }>;
  const queries: Record<string, (start: number, end: number) => Page> = {
    conversations: (a,b) => supabase.from("conversations").select("*").eq("user_id", userId).order("id").range(a,b),
    messages: (a,b) => supabase.from("messages").select("*").eq("user_id", userId).order("id").range(a,b),
    coachAndResearch: (a,b) => supabase.from("scott_messages").select("*").eq("user_id", userId).order("id").range(a,b),
    localChatArchive: (a,b) => supabase.from("jalsa_messages").select("*").eq("owner_id", userId).order("id").range(a,b),
    friendConversations: (a,b) => supabase.from("dm_conversations").select("*").or(`user1_id.eq.${userId},user2_id.eq.${userId}`).order("id").range(a,b),
    friendMessages: (a,b) => supabase.from("dm_messages").select("*,dm_conversations!inner(user1_id,user2_id)").or(`user1_id.eq.${userId},user2_id.eq.${userId}`, { referencedTable: "dm_conversations" }).order("id").range(a,b),
    buildsAndDomains: (a,b) => supabase.from("memories").select("*").eq("user_id", userId).order("id").range(a,b),
    artifacts: (a,b) => supabase.from("artifacts").select("*").eq("user_id", userId).order("id").range(a,b),
    knowledge: (a,b) => supabase.from("knowledge").select("*").eq("user_id", userId).order("id").range(a,b),
  };
  const records: Record<string, unknown[]> = {};
  for (const [name, query] of Object.entries(queries)) {
    const rows: unknown[] = [];
    for (let offset = 0; ; offset += 500) {
      const page = await query(offset, offset + 499);
      if (page.error) throw new Error("Backup incomplete — data read failed. Dobara try karein.");
      rows.push(...(page.data ?? []));
      if ((page.data?.length ?? 0) < 500) break;
    }
    records[name] = rows;
  }
  const timestamp = new Date().toISOString();
  const text = JSON.stringify({ version: 1, userId, createdAt: timestamp, scope: "Saved chat text, build code and domain settings; uploaded media and unsynced local chats excluded", records });
  if (new TextEncoder().encode(text).length > 25 * 1024 * 1024) throw new Error("Backup 25 MB se bara hai; smaller export ke liye support contact karein. Purana backup safe hai.");
  const envelope = await encryptBackup(text, secret, userId);
  const objectId = crypto.randomUUID();
  const { r2 } = await import("./r2.server");
  const { client, base } = r2();
  const response = await client.fetch(`${base}/security-backups/${userId}/${objectId}.enc`, { method: "PUT", headers: { "content-type": "application/octet-stream" }, body: envelope });
  if (!response.ok) throw new Error("Cloud backup save nahi hua; purana backup safe hai.");
  const rowCount = Object.values(records).reduce((sum, rows) => sum + rows.length, 0);
  // Privileged metadata update only after user-scoped reads and successful encrypted write.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("security_backup_settings").upsert({ user_id: userId, auto_enabled: setting?.auto_enabled ?? false, last_backup_at: timestamp, object_id: objectId, row_count: rowCount });
  if (error) throw new Error("Backup saved, lekin status update nahi hua; dobara try karein.");
  if (setting?.object_id) {
    try { await client.fetch(`${base}/security-backups/${userId}/${setting.object_id}.enc`, { method: "DELETE" }); } catch { /* Keep old encrypted copy on cleanup failure. */ }
  }
  return { saved: true, timestamp, rowCount };
});

export const downloadSecurityBackup = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data, error } = await context.supabase.from("security_backup_settings").select("object_id").eq("user_id", context.userId).maybeSingle();
  if (error || !data?.object_id) throw new Error("Pehle Backup Now karein.");
  const secret = process.env["SECURITY_BACKUP_KEY"];
  if (!secret) throw new Error("Backup key unavailable.");
  const { r2 } = await import("./r2.server");
  const { client, base } = r2();
  const response = await client.fetch(`${base}/security-backups/${context.userId}/${data.object_id}.enc`);
  if (!response.ok) throw new Error("Backup download nahi hua.");
  return { text: await decryptBackup(await response.text(), secret, context.userId) };
});