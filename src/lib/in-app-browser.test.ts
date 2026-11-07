// @ts-nocheck -- Bun test runner.
import { describe, expect, it } from "bun:test";
import { chromeIntentUrl, isInAppBrowser } from "./in-app-browser";

describe("isInAppBrowser", () => {
  it("flags WhatsApp, Instagram and Android WebView", () => {
    expect(isInAppBrowser("Mozilla/5.0 (Linux; Android 14) WhatsApp/2.24")).toBe(true);
    expect(isInAppBrowser("Mozilla/5.0 (iPhone) Instagram 300.0")).toBe(true);
    expect(isInAppBrowser("Mozilla/5.0 (Linux; Android 14; wv) AppleWebKit/537.36 Chrome/120")).toBe(true);
  });
  it("allows normal Chrome and Safari", () => {
    expect(isInAppBrowser("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36")).toBe(false);
    expect(isInAppBrowser("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1")).toBe(false);
  });
  it("builds a Chrome intent link", () => {
    expect(chromeIntentUrl("https://noquitai.com/auth")).toBe(
      "intent://noquitai.com/auth#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=https%3A%2F%2Fnoquitai.com%2Fauth;end",
    );
  });
});
