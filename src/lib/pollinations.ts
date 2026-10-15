/** Pollinations "Connect User Wallets" (BYOP) — OAuth code flow with PKCE, browser-only. */
import { getPollinationsAppKey } from "@/lib/pollinations.functions";

export const POLLINATIONS_REDIRECT = "https://noquitai.com/callback";
const USER_KEY = "nqai_pollinations_key";
const USER_KEY_EXP = "nqai_pollinations_exp";
const VERIFIER = "nqai_pollinations_verifier";
const STATE = "nqai_pollinations_state";
const RETURN = "nqai_pollinations_return";

function b64url(bytes: Uint8Array) {
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function rand(n = 32) {
  return b64url(crypto.getRandomValues(new Uint8Array(n)));
}

let appKey: string | null = null;
async function getAppKey() {
  if (!appKey) appKey = (await getPollinationsAppKey()).key;
  if (!appKey) throw new Error("Pollinations app key missing");
  return appKey;
}

export function getUserPollinationsKey(): string | null {
  if (typeof window === "undefined") return null;
  const k = localStorage.getItem(USER_KEY);
  const exp = Number(localStorage.getItem(USER_KEY_EXP) || 0);
  if (!k || (exp && Date.now() > exp)) return null;
  return k;
}

export function disconnectPollinations() {
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(USER_KEY_EXP);
}

export async function connectPollinations() {
  const clientId = await getAppKey();
  const verifier = rand(48);
  const state = rand(16);
  const challenge = b64url(
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))),
  );
  sessionStorage.setItem(VERIFIER, verifier);
  sessionStorage.setItem(STATE, state);
  sessionStorage.setItem(RETURN, window.location.pathname + window.location.search);
  const p = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: POLLINATIONS_REDIRECT,
    scope: "profile",
    models: "image",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  window.location.href = `https://enter.pollinations.ai/authorize?${p}`;
}

/** Called on /callback. Returns the path to go back to. */
export async function finishPollinationsConnect(code: string, state: string) {
  const verifier = sessionStorage.getItem(VERIFIER);
  if (!verifier || state !== sessionStorage.getItem(STATE)) throw new Error("State mismatch — dobara connect karo.");
  const res = await fetch("https://enter.pollinations.ai/api/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: await getAppKey(),
      redirect_uri: POLLINATIONS_REDIRECT,
      code_verifier: verifier,
    }),
  });
  const json = (await res.json()) as { access_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !json.access_token) throw new Error(json.error ?? `Token error ${res.status}`);
  localStorage.setItem(USER_KEY, json.access_token);
  localStorage.setItem(USER_KEY_EXP, String(Date.now() + (json.expires_in ?? 604800) * 1000));
  sessionStorage.removeItem(VERIFIER);
  sessionStorage.removeItem(STATE);
  const back = sessionStorage.getItem(RETURN) || "/";
  sessionStorage.removeItem(RETURN);
  return back;
}

/** Generates with the user's own pollen. Returns a blob: URL. */
export async function generateWithUserKey(prompt: string) {
  const key = getUserPollinationsKey();
  if (!key) throw new Error("not-connected");
  const url = `https://gen.pollinations.ai/image/${encodeURIComponent(prompt)}?model=flux&width=1024&height=1024&nologo=true&referrer=NO-QUIT-AI&seed=${Math.floor(Math.random() * 1e9)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
  if (res.status === 401 || res.status === 403) {
    disconnectPollinations();
    throw new Error("not-connected");
  }
  if (!res.ok || !res.headers.get("content-type")?.startsWith("image/")) throw new Error(`Image error ${res.status}`);
  return URL.createObjectURL(await res.blob());
}
