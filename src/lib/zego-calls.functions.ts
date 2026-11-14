import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { authorizeZegoCall, ZEGO_APP_ID } from "./zego-call-rules";

export const getZegoCallAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(input => z.object({ inviteId: z.string().uuid(), roomId: z.string().min(1).max(128).regex(/^[\w-]+$/) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: invite, error } = await context.supabase.from("call_invites")
      .select("room_id,status,from_user,to_user,call_type").eq("id", data.inviteId).maybeSingle();
    if (error) throw new Error("Call invitation check nahi hui. Dobara try karo.");
    const callType = authorizeZegoCall(invite, context.userId, data.roomId);
    const secret = process.env["ZEGO_SERVER_SECRET"];
    if (!secret) throw new Error("ZEGOCLOUD ServerSecret abhi configured nahi hai.");
    const { createZegoToken } = await import("./zego-token.server");
    const token = await createZegoToken(ZEGO_APP_ID, context.userId, data.roomId, secret);
    return { appId: ZEGO_APP_ID, userId: context.userId, roomId: data.roomId, callType, token };
  });