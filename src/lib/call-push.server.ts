import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { stalePushToken } from "./call-push-rules";

export async function sendCallPush(db: SupabaseClient<Database>, invite: Database["public"]["Tables"]["call_invites"]["Row"], status: string, apiKey: string, connectionKey: string) {
  const { data: devices, error } = await db.from("call_push_devices").select("token").eq("user_id", invite.to_user);
  if (error) throw error;
  if (!devices?.length) return { sent: 0 };
  const claim = await db.from("call_push_dispatches").insert({ invite_id: invite.id, status });
  if (claim.error?.code === "23505") return { sent: 0 };
  if (claim.error) throw claim.error;
  let sent = 0;
  try {
    for (const device of devices) {
      // A recipient's token is never returned to the caller.
      const response = await fetch("https://connector-gateway.lovable.dev/firebase_messaging/v1/projects/_/messages:send", {
        method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "X-Connection-Api-Key": connectionKey, "Content-Type": "application/json" },
        body: JSON.stringify({ message: { token: device.token, data: { kind: "incoming_call", inviteId: invite.id, callType: invite.call_type, status, expiresAt: String(Date.parse(invite.created_at) + 30_000) }, android: { priority: "high", ttl: "30s", collapse_key: invite.id } } }),
      });
      if (!response.ok) {
        const body = await response.text();
        if (stalePushToken(response.status, body)) { await db.from("call_push_devices").delete().eq("token", device.token); continue; }
        // Do not log the provider body: it may contain a private device token.
        throw new Error(`Firebase push failed [${response.status}]: ${body.replaceAll(device.token, "[device]")}`);
      }
      sent++;
    }
    return { sent };
  } catch (error) {
    await db.from("call_push_dispatches").delete().eq("invite_id", invite.id).eq("status", status);
    throw error;
  }
}