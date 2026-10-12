import { r2 } from "@/lib/r2.server";

/** Owner ka secret vault: AES-GCM encrypted values in R2 vault/. Values kabhi chat/UI me wapas nahi jaate. */
const enc = new TextEncoder();
const dec = new TextDecoder();

async function aesKey() {
  const raw = process.env["VAULT_KEY"];
  if (!raw) throw new Error("VAULT_KEY missing");
  const hash = await crypto.subtle.digest("SHA-256", enc.encode(raw));
  return crypto.subtle.importKey("raw", hash, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export function safeSecretName(name: string) {
  const n = name.toUpperCase().replace(/[^A-Z0-9_]/g, "_").slice(0, 64);
  if (!/^[A-Z_][A-Z0-9_]*$/.test(n)) throw new Error("Invalid secret name");
  return n;
}

const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function vaultSet(name: string, value: string) {
  const key = await aesKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(value)));
  const { client, base } = r2();
  const res = await client.fetch(`${base}/vault/${safeSecretName(name)}.enc`, {
    method: "PUT",
    body: JSON.stringify({ iv: b64(iv), ct: b64(ct), at: new Date().toISOString() }),
    headers: { "content-type": "application/json" },
  });
  if (!res.ok) throw new Error(`Vault save failed (${res.status})`);
}

export async function vaultGet(name: string): Promise<string | null> {
  const n = safeSecretName(name);
  const { client, base } = r2();
  const res = await client.fetch(`${base}/vault/${n}.enc`);
  if (res.ok) {
    const { iv, ct } = (await res.json()) as { iv: string; ct: string };
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, await aesKey(), unb64(ct));
    return dec.decode(pt);
  }
  return process.env[n] ?? null;
}

export async function vaultList(): Promise<string[]> {
  const { client, base } = r2();
  const res = await client.fetch(`${base}?list-type=2&prefix=vault/`);
  const xml = await res.text();
  return [...xml.matchAll(/<Key>vault\/([^<]+)\.enc<\/Key>/g)].map((m) => m[1]!);
}
