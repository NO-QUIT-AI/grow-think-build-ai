import { describe, expect, test } from "bun:test";
import { CALL_RING_TIMEOUT_MS, expectedCallStatus, isFreshRingingCall } from "./call-rules";

describe("call lifecycle", () => {
  const created_at = "2026-10-19T03:00:00Z";
  const start = Date.parse(created_at);
  test("ringing expires at the existing 30-second deadline", () => {
    expect(CALL_RING_TIMEOUT_MS).toBe(30_000);
    expect(isFreshRingingCall({ status: "ringing", created_at }, start + 29_999)).toBe(true);
    expect(isFreshRingingCall({ status: "ringing", created_at }, start + 30_000)).toBe(false);
  });
  test("accepted or cancelled invites never ring", () => {
    expect(isFreshRingingCall({ status: "accepted", created_at }, start)).toBe(false);
    expect(isFreshRingingCall({ status: "missed", created_at }, start)).toBe(false);
  });
  test("a timeout can only update a ringing invite, not an accepted one", () => {
    expect(expectedCallStatus("missed")).toBe("ringing");
    expect(expectedCallStatus("accepted")).toBe("ringing");
    expect(expectedCallStatus("ended")).toBe("accepted");
  });
});