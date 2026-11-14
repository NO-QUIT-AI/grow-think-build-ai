import { Buffer } from "node:buffer";

// Token04 framing follows ZEGOCLOUD's server assistant; no credentials or tokens are logged.
export async function createZegoToken(appId: number, userId: string, roomId: string, secret: string) {
  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 3600;
  const random = crypto.getRandomValues(new Uint32Array(1));
  const payload = JSON.stringify({ room_id: roomId, privilege: { 1: 1, 2: 1 }, stream_id_list: [] });
  const plain = JSON.stringify({ app_id: appId, user_id: userId, nonce: random[0], ctime: now, expire: expiry, payload });
  const encoder = new TextEncoder();
  const iv = encoder.encode(Array.from(crypto.getRandomValues(new Uint8Array(16)), n => "0123456789abcdefghijklmnopqrstuvwxyz"[n % 36]).join(""));
  let encrypted: ArrayBuffer;
  try {
    const key = await crypto.subtle.importKey("raw", encoder.encode(secret), "AES-CBC", false, ["encrypt"]);
    encrypted = await crypto.subtle.encrypt({ name: "AES-CBC", iv }, key, encoder.encode(plain));
  } catch {
    throw new Error("ZEGOCLOUD call configuration invalid. Please update ServerSecret securely.");
  }
  const data = new Uint8Array(8 + 2 + iv.length + 2 + encrypted.byteLength);
  const view = new DataView(data.buffer);
  view.setBigInt64(0, BigInt(expiry));
  view.setUint16(8, iv.length);
  data.set(iv, 10);
  view.setUint16(10 + iv.length, encrypted.byteLength);
  data.set(new Uint8Array(encrypted), 12 + iv.length);
  return "04" + Buffer.from(data).toString("base64");
}