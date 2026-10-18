import { supabase } from "@/integrations/supabase/client";

// call_invites is new and not yet present in the generated Database types,
// so this module uses an untyped handle scoped to call features only.
/* eslint-disable @typescript-eslint/no-explicit-any */
const db = supabase as any;

export type CallType = "audio" | "video";
export type CallStatus = "ringing" | "accepted" | "rejected" | "ended" | "missed";

export interface CallInvite {
  id: string;
  from_user: string;
  to_user: string;
  room_id: string;
  call_type: CallType;
  status: CallStatus;
  created_at: string;
}

// Prefix used for call history entries inside dm_messages (no schema change).
export const CALL_SYSTEM_PREFIX = "__call__:";

export function makeRoomId(fromUser: string, toUser: string): string {
  return `NOQUIT-PRIVATE-${fromUser.slice(0, 6)}-${toUser.slice(0, 6)}-${Date.now()}`;
}

export async function hasActiveCall(userId: string): Promise<boolean> {
  const { data } = await db
    .from("call_invites")
    .select("id")
    .or(`from_user.eq.${userId},to_user.eq.${userId}`)
    .in("status", ["ringing", "accepted"])
    .limit(1);
  return (data?.length ?? 0) > 0;
}

export async function createCallInvite(
  fromUser: string,
  toUser: string,
  callType: CallType,
): Promise<CallInvite | null> {
  const { data, error } = await db
    .from("call_invites")
    .insert({
      from_user: fromUser,
      to_user: toUser,
      room_id: makeRoomId(fromUser, toUser),
      call_type: callType,
      status: "ringing",
    })
    .select()
    .single();
  if (error) return null;
  return data as CallInvite;
}

export async function updateCallStatus(id: string, status: CallStatus): Promise<void> {
  await db.from("call_invites").update({ status }).eq("id", id);
}

export async function findConversationId(a: string, b: string): Promise<string | null> {
  const { data } = await db
    .from("dm_conversations")
    .select("id")
    .or(
      `and(user1_id.eq.${a},user2_id.eq.${b}),and(user1_id.eq.${b},user2_id.eq.${a})`,
    )
    .limit(1);
  return (data?.[0]?.id as string | undefined) ?? null;
}

// Call history lands in dm_messages as a prefixed system message — the
// private chat table structure stays untouched.
export async function sendCallSystemMessage(
  a: string,
  b: string,
  senderId: string,
  kind: string,
): Promise<void> {
  const conversationId = await findConversationId(a, b);
  if (!conversationId) return;
  await db.from("dm_messages").insert({
    conversation_id: conversationId,
    sender_id: senderId,
    text: `${CALL_SYSTEM_PREFIX}${kind}`,
  });
  await db
    .from("dm_conversations")
    .update({ last_message: "📞 Call", updated_at: new Date().toISOString() })
    .eq("id", conversationId);
}

// Looping ringtone built with WebAudio — no audio file needed.
export function startRingtone(): () => void {
  const Ctx =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return () => {};
  const ctx = new Ctx();
  const gain = ctx.createGain();
  gain.gain.value = 0.06;
  gain.connect(ctx.destination);
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.value = 880;
  osc.connect(gain);
  osc.start();
  let on = true;
  const interval = window.setInterval(() => {
    on = !on;
    gain.gain.setTargetAtTime(on ? 0.06 : 0.0001, ctx.currentTime, 0.02);
  }, 600);
  return () => {
    window.clearInterval(interval);
    try {
      osc.stop();
    } catch {
      /* already stopped */
    }
    void ctx.close();
  };
}
