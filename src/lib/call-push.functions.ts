import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { authorizeCallPush } from "./call-push-rules";

export const registerCallPush = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(input => z.object({ token: z.string().min(20).max(4096) }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("register_call_push_device", { device_token: data.token });
    if (error) throw error;
    return { registered: true };
  });

export const dispatchCallPush = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(input => z.object({ inviteId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: invite, error } = await context.supabase.from("call_invites").select("*").eq("id", data.inviteId).maybeSingle();
    if (error) throw error;
    const status = authorizeCallPush(invite, context.userId);
    if (!invite) throw new Error("Invitation unavailable");
    const apiKey = process.env["LOVABLE_API_KEY"];
    const connectionKey = process.env["FIREBASE_MESSAGING_API_KEY"];
    if (!apiKey || !connectionKey) throw new Error("Firebase push sending is not configured");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendCallPush } = await import("./call-push.server");
    return sendCallPush(supabaseAdmin, invite, status, apiKey, connectionKey);
  });