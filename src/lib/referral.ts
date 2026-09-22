import { supabase } from "@/integrations/supabase/client";

const KEY = "nqa_ref";
const CODE = /^[A-Za-z0-9-]{4,64}$/;

export function storeReferral(ref: string | null | undefined) {
  if (typeof window === "undefined" || !ref || !CODE.test(ref)) return;
  try {
    window.localStorage.setItem(KEY, ref.trim().toUpperCase());
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

/** Har user ka apna unique invite code. */
export async function fetchInviteCode(_userId?: string): Promise<string> {
  const { data } = await supabase.rpc("nqai_my_invite_code");
  return typeof data === "string" ? data : "";
}

/**
 * Signup/sign-in ke baad invite code redeem karta hai (sirf ek baar).
 * Points sirf isi waqt milte hain — jab naya user kisi ke code se join kare.
 */
export async function redeemReferral(): Promise<boolean> {
  const code = readReferral();
  if (!code) return false;
  try {
    const { data, error } = await supabase.rpc("nqai_redeem_invite", { _code: code });
    if (error) return false;
    const ok = Boolean((data as Record<string, unknown> | null)?.["ok"]);
    try {
      window.localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    return ok;
  } catch {
    return false;
  }
}

export function inviteLink(code: string) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/invite?ref=${code}`;
}
