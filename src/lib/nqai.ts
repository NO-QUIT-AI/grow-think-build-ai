import { supabase } from "@/integrations/supabase/client";

export const COIN = "NQAI";

export type NqaiWallet = {
  balance: number;
  streak: number;
  last_mined_at: string | null;
};

export type NqaiTx = {
  id: string;
  amount: number;
  reason: string;
  created_at: string;
};

export type MineResult = {
  ok: boolean;
  reward?: number | undefined;
  balance: number;
  streak: number;
  next_at: string | null;
};

export async function fetchWallet(userId: string): Promise<NqaiWallet> {
  const { data } = await supabase
    .from("nqai_wallets")
    .select("balance, streak, last_mined_at")
    .eq("user_id", userId)
    .maybeSingle();
  return {
    balance: Number(data?.balance ?? 0),
    streak: Number(data?.streak ?? 0),
    last_mined_at: data?.last_mined_at ?? null,
  };
}

export async function fetchTransactions(userId: string): Promise<NqaiTx[]> {
  const { data } = await supabase
    .from("nqai_transactions")
    .select("id, amount, reason, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(25);
  return (data ?? []).map((row) => ({
    id: row.id,
    amount: Number(row.amount),
    reason: row.reason,
    created_at: row.created_at,
  }));
}

export async function mine(): Promise<MineResult> {
  const { data, error } = await supabase.rpc("nqai_mine");
  if (error) throw error;
  const raw = data as unknown as Record<string, unknown>;
  return {
    ok: Boolean(raw["ok"]),
    reward: raw["reward"] != null ? Number(raw["reward"]) : undefined,
    balance: Number(raw["balance"] ?? 0),
    streak: Number(raw["streak"] ?? 0),
    next_at: (raw["next_at"] as string | null) ?? null,
  };
}

export function formatCoins(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function timeUntil(iso: string | null): string {
  if (!iso) return "";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "abhi";
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export type AdMineResult = MineResult & { reason?: string | undefined; multiplier: number };

/** Mining sirf ad dekhne ke baad — base 1 coin x invite multiplier. */
export async function mineWithAd(adWatched: boolean): Promise<AdMineResult> {
  const { data, error } = await supabase.rpc("nqai_mine_ad", { _ad_watched: adWatched });
  if (error) throw error;
  const raw = data as unknown as Record<string, unknown>;
  return {
    ok: Boolean(raw["ok"]),
    reason: (raw["reason"] as string | undefined) ?? undefined,
    reward: raw["reward"] != null ? Number(raw["reward"]) : undefined,
    balance: Number(raw["balance"] ?? 0),
    streak: Number(raw["streak"] ?? 0),
    multiplier: Number(raw["multiplier"] ?? 1),
    next_at: (raw["next_at"] as string | null) ?? null,
  };
}

/** Invite link share karne par rozana +1 coin. */
export async function claimShareBonus(): Promise<{ ok: boolean; balance: number; next_at: string | null }> {
  const { data, error } = await supabase.rpc("nqai_share_bonus");
  if (error) throw error;
  const raw = data as unknown as Record<string, unknown>;
  return {
    ok: Boolean(raw["ok"]),
    balance: Number(raw["balance"] ?? 0),
    next_at: (raw["next_at"] as string | null) ?? null,
  };
}

export async function fetchInviteCount(userId: string): Promise<number> {
  const { count } = await supabase
    .from("referrals")
    .select("id", { count: "exact", head: true })
    .eq("inviter_id", userId);
  return count ?? 0;
}
