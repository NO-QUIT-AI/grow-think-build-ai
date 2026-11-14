// @ts-nocheck -- Bun runner, matching the existing tests.
import { test, expect } from "bun:test";
import { authorizeCallPush, stalePushToken } from "./call-push-rules";
const invite = { from_user: "caller", status: "ringing", created_at: new Date().toISOString() };
test("only the originating caller can send incoming call push", () => {
  expect(authorizeCallPush(invite, "caller")).toBe("ringing");
  expect(() => authorizeCallPush(invite, "outsider")).toThrow();
});
test("expired invitations cannot send ringing push", () => {
  expect(() => authorizeCallPush({ ...invite, created_at: new Date(Date.now() - 31000).toISOString() }, "caller")).toThrow();
});
test("unregistered devices are removed without deleting tokens for unrelated errors", () => {
  expect(stalePushToken(404, "UNREGISTERED")).toBe(true);
  expect(stalePushToken(403, "PERMISSION_DENIED")).toBe(false);
});