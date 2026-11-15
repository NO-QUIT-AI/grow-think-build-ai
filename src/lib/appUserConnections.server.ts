import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
function encryptionKey() {
  const raw = process.env['APP_USER_CONNECTION_KEY_SECRET'];
  if (!raw) throw new Error("Connection encryption not configured.");
  return Buffer.from(raw, "base64");
}
export async function saveConnectionKeyForUser(userId: string, connectorId: string, plaintext: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("app_user_connections").upsert({ user_id: userId, connector_id: connectorId, connection_key_ciphertext: Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64"), updated_at: new Date().toISOString() }, { onConflict: "user_id,connector_id" });
  if (error) throw error;
}
export async function getConnectionKeyForUser(userId: string, connectorId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("app_user_connections").select("connection_key_ciphertext").eq("user_id", userId).eq("connector_id", connectorId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const bytes = Buffer.from(data.connection_key_ciphertext, "base64");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), bytes.subarray(0, 12));
  decipher.setAuthTag(bytes.subarray(12, 28));
  return Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString("utf8");
}