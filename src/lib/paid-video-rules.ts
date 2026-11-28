export type PaidVideoProvider = "runway" | "fal-avatar" | "fal-intro";

function limit(value: string | undefined, fallback: number, maximum: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= maximum ? parsed : fallback;
}

export function paidVideoLimits(env: Record<string, string | undefined>) {
  return {
    hour: limit(env["PAID_VIDEO_USER_HOURLY_LIMIT"], 3, 100),
    day: limit(env["PAID_VIDEO_USER_DAILY_LIMIT"], 10, 1000),
    globalDay: limit(env["PAID_VIDEO_GLOBAL_DAILY_LIMIT"], 50, 10000),
  };
}

export function messageCacheKey(userId: string, conversationId: string): string {
  return `nqai_cached_messages_${userId}_${conversationId}`;
}