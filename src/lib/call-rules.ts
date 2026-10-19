export const CALL_RING_TIMEOUT_MS = 30_000;

export type CallStatus = "ringing" | "accepted" | "rejected" | "ended" | "missed";

export function isFreshRingingCall(call: { status: CallStatus; created_at: string }, now = Date.now()): boolean {
  const created = Date.parse(call.created_at);
  return call.status === "ringing" && Number.isFinite(created) && now - created < CALL_RING_TIMEOUT_MS;
}

export function expectedCallStatus(next: CallStatus): CallStatus {
  return next === "ended" ? "accepted" : "ringing";
}