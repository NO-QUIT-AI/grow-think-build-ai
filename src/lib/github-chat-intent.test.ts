import { test } from "node:test";
import assert from "node:assert/strict";
import { isGitHubConnectRequest } from "./github-chat-intent";
test("Roman Urdu GitHub connection opens consent in the same chat", () => {
  assert.equal(isGitHubConnectRequest("Bhai, mera project hai, isko GitHub sy connect kar do"), true);
});
test("GitHub edits are not mistaken for consent-only requests", () => {
  assert.equal(isGitHubConnectRequest("GitHub connect karke ye code change kar do"), false);
});
test("other project requests do not open GitHub consent", () => {
  assert.equal(isGitHubConnectRequest("Mera home page ka title badal do"), false);
});