// @ts-nocheck -- Bun test runner, matching existing project tests.
import { expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import config from "../../capacitor.config";

it("launches the full site at the requested Start URL", () => {
  expect(config.server?.url).toBe("https://noquitai.com/");
});

it("uses the requested Android versionCode 4", () => {
  const gradle = readFileSync(new URL("../../android/app/build.gradle", import.meta.url), "utf8");
  expect(gradle.match(/versionCode\s+(\d+)/)?.[1]).toBe("4");
});

it("preserves the Play Console package identity", () => {
  expect(config.appId).toBe("com.noquitai.app");
});