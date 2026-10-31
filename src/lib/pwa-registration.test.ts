import { expect, it } from "bun:test";
import { isPwaPreview } from "./pwa-registration";
it("never permits app-shell workers on editor previews", () => {
  for (const host of ["id-preview--abc.lovable.app", "preview-v2--abc.lovable.app", "project--abc-dev.gpt-eng.com", "workspace.lovableproject.com", "beta.lovable.dev"]) expect(isPwaPreview(host)).toBe(true);
  expect(isPwaPreview("noquitai.com")).toBe(false);
  expect(isPwaPreview("preview-v2--shop.example.com")).toBe(false);
});