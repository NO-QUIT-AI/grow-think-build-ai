import { expect, test } from "bun:test";
import { needsHdPartner, partnerUrl } from "./hd-upsell";

test("15s 720p stays free", () => expect(needsHdPartner({ durationSec: 15, quality: "720p" })).toBe(false));
test("over 30s goes to partner", () => expect(needsHdPartner({ durationSec: 31, quality: "720p" })).toBe(true));
test("1080p goes to partner", () => expect(needsHdPartner({ durationSec: 15, quality: "1080p" })).toBe(true));
test("1 hour HD button goes to partner", () => expect(needsHdPartner({ durationSec: 15, quality: "720p", oneHourHd: true })).toBe(true));
test("creatomate link carries via + max 5 images", () => {
  const u = new URL(partnerUrl("creatomate", ["a", "b", "c", "d", "e", "f"], { t: 1 }));
  expect(u.searchParams.get("via")).toBe("noquitai");
  expect(JSON.parse(u.searchParams.get("images")!)).toHaveLength(5);
});
