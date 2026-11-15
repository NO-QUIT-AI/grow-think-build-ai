const encoder = new TextEncoder();
function encode(bytes: Uint8Array) {
  let result = "";
  for (const byte of bytes) result += String.fromCharCode(byte);
  return btoa(result);
}
function decode(text: string) { return Uint8Array.from(atob(text), c => c.charCodeAt(0)); }
async function keyFor(secret: string, owner: string) {
  const material = await crypto.subtle.importKey("raw", encoder.encode(secret), "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt: encoder.encode(owner), info: encoder.encode("NO QUIT AI security backup v1") }, material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
export async function encryptBackup(text: string, secret: string, owner: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: encoder.encode(owner) }, await keyFor(secret, owner), encoder.encode(text));
  return JSON.stringify({ version: 1, iv: encode(iv), ciphertext: encode(new Uint8Array(ciphertext)) });
}
export async function decryptBackup(envelope: string, secret: string, owner: string) {
  const data = JSON.parse(envelope);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decode(data.iv), additionalData: encoder.encode(owner) }, await keyFor(secret, owner), decode(data.ciphertext));
  return new TextDecoder().decode(plaintext);
}