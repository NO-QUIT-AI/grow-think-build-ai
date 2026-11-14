// @ts-nocheck -- Bun test runner.
import { expect, test } from "bun:test";
import { authorizeZegoCall, ZEGO_APP_ID } from "./zego-call-rules";
import { createZegoToken } from "./zego-token.server";

const invite = { room_id: "NOQUIT-PRIVATE-room", status: "accepted", from_user: "caller", to_user: "recipient", call_type: "audio" };
test("uses supplied AppID 977179357", () => expect(ZEGO_APP_ID).toBe(977179357));
test("accepted caller and recipient may join the same voice room", () => {
  expect(authorizeZegoCall(invite, "caller", invite.room_id)).toBe("audio");
  expect(authorizeZegoCall(invite, "recipient", invite.room_id)).toBe("audio");
});
test("video invitation selects video", () => expect(authorizeZegoCall({ ...invite, call_type: "video" }, "caller", invite.room_id)).toBe("video"));
test("outsiders cannot obtain call access", () => expect(() => authorizeZegoCall(invite, "outsider", invite.room_id)).toThrow());
test("ringing and ended calls cannot obtain tokens", () => {
  for (const status of ["ringing", "ended", "rejected", "missed"]) expect(() => authorizeZegoCall({ ...invite, status }, "caller", invite.room_id)).toThrow();
});
test("a different room cannot obtain tokens", () => expect(() => authorizeZegoCall(invite, "caller", "other-room")).toThrow());
test("Token04 decrypts to room-scoped join and publish permissions", async () => {
  // Synthetic test fixture only, never uses configured credentials.
  const fixtureKey = "0123456789abcdef0123456789abcdef";
  const token = await createZegoToken(977179357, "caller", invite.room_id, fixtureKey);
  expect(token.startsWith("04")).toBe(true);
  const bytes = Buffer.from(token.slice(2), "base64");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(fixtureKey), "AES-CBC", false, ["decrypt"]);
  const decoded = JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-CBC", iv: bytes.subarray(10, 26) }, key, bytes.subarray(28))));
  expect(decoded.app_id).toBe(977179357);
  expect(decoded.user_id).toBe("caller");
  expect(decoded.expire - decoded.ctime).toBe(3600);
  expect(JSON.parse(decoded.payload)).toEqual({ room_id: invite.room_id, privilege: { 1: 1, 2: 1 }, stream_id_list: [] });
});