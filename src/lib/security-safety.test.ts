// @ts-expect-error Bun test runner types are intentionally excluded from the browser project.
import { describe, expect, it } from "bun:test";
import { backupDue, deviceSafetyScore, linkWarnings } from "./security-safety";
import { encryptBackup, decryptBackup } from "./security-crypto";
describe("security safeguards", () => {
  it("scores 0 to 100 without claiming unknown checks passed", () => {
    expect(deviceSafetyScore(null, null, false)).toBe(0);
    expect(deviceSafetyScore(true, false, false)).toBe(40);
    expect(deviceSafetyScore(true, true, true)).toBe(100);
  });
  it("only schedules automatic backup at least 24 hours after success", () => {
    expect(backupDue("2026-11-15T00:00:00Z", Date.parse("2026-11-15T23:59:59Z"))).toBe(false);
    expect(backupDue("2026-11-15T00:00:00Z", Date.parse("2026-11-16T00:00:00Z"))).toBe(true);
  });
  it("warns on suspicious destinations and unsafe schemes", () => {
    expect(linkWarnings("http://bit.ly/free").length).toBe(2);
    expect(linkWarnings("https://google.com@192.168.1.1/").length).toBe(2);
    expect(linkWarnings("javascript:alert(1)").length).toBe(1);
    expect(linkWarnings("https://noquitai.com")).toEqual([]);
  });
  it("encrypts with fresh nonces and rejects wrong owner or modified content", async () => {
    const secret = "test-only-key-not-used-in-production";
    const text = '{"chats":["private chat"],"builds":["hello"],"domains":["example.com"]}';
    const first = await encryptBackup(text, secret, "owner-one");
    const second = await encryptBackup(text, secret, "owner-one");
    expect(first).not.toContain("private chat");
    expect(first).not.toBe(second);
    expect(await decryptBackup(first, secret, "owner-one")).toBe(text);
    await expect(decryptBackup(first, secret, "owner-two")).rejects.toThrow();
    const modified = JSON.parse(first); modified.ciphertext = "AAAA";
    await expect(decryptBackup(JSON.stringify(modified), secret, "owner-one")).rejects.toThrow();
  });
});