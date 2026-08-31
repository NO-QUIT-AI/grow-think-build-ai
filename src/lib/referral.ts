import { supabase } from "@/integrations/supabase/client";

const KEY = "nqa_ref";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function storeReferral(ref: string | null | undefined) {
  if (typeof window === "undefined" || !ref || !UUID.test(ref)) return;
  try {
    window.localStorage.setItem(KEY, ref);
  } catch {
    /* storage blocked */
  }
}

export function readReferral(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** Signup/sign-in ke baad invite ko record karta hai (sirf ek baar). */
export async function redeemReferral(userId: string) {
  const inviter = readReferral();
  if (!inviter || inviter === userId) return;
  await supabase.from("referrals").insert({ inviter_id: inviter, invited_user_id: userId });
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function inviteLink(userId: string) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/invite?ref=${userId}`;
}
