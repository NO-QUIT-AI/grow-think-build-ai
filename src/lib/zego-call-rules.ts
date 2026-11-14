export const ZEGO_APP_ID = 977179357;

export function authorizeZegoCall(
  invite: { room_id: string; status: string; from_user: string; to_user: string; call_type: string } | null,
  userId: string,
  roomId: string,
) {
  if (!invite || invite.status !== "accepted" || invite.room_id !== roomId ||
      (invite.from_user !== userId && invite.to_user !== userId)) {
    throw new Error("Call ab active nahi hai ya aap is call ka hissa nahi hain.");
  }
  return invite.call_type === "video" ? "video" : "audio";
}