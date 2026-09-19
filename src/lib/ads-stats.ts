import { supabase } from "@/integrations/supabase/client";

export type AdStats = {
  total: number;
  today: number;
  last7: number;
  last30: number;
  viewers: number;
};

/** Log one ad view (best effort — never blocks the UI). */
export async function logAdImpression(slot: string, page?: string) {
  try {
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id;
    if (!userId) return;
    await supabase.from("ad_impressions").insert({ user_id: userId, slot, page: page ?? null });
  } catch {
    /* ignore */
  }
}

export async function fetchAdStats(): Promise<AdStats> {
  const { data, error } = await supabase.rpc("ad_stats");
  if (error || !data) return { total: 0, today: 0, last7: 0, last30: 0, viewers: 0 };
  return data as unknown as AdStats;
}

/**
 * Rough revenue estimate. Real money is paid by Google into the AdSense
 * account — this is only an indicative figure based on an assumed RPM.
 */
export function estimateEarnings(views: number, rpmUsd: number) {
  return (views / 1000) * rpmUsd;
}

export const OWNER_EMAIL = (
  (import.meta.env as Record<string, string | undefined>)["VITE_OWNER_EMAIL"] ??
  "noquitai1@gmail.com"
)
  .trim()
  .toLowerCase();
