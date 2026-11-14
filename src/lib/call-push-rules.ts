import { isFreshRingingCall } from "./call-rules";
export function authorizeCallPush(invite: { from_user: string; status: "ringing" | "accepted" | "rejected" | "ended" | "missed"; created_at: string } | null, userId: string) {
  if (!invite || invite.from_user !== userId) throw new Error("Only the caller can dispatch this invitation");
  if (invite.status === "ringing" && !isFreshRingingCall(invite)) throw new Error("Call invitation expired");
  return invite.status;
}
export function stalePushToken(status: number, body: string) {
  return status === 404 && body.includes("UNREGISTERED");
}