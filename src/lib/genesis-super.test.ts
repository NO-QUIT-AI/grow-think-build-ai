// @ts-nocheck -- Bun runner, matching project tests.
import { test, expect } from "bun:test";
import { timeContext, rankMemories, summaryLines, validateRegistry, MAX_BROWSER_FIXES, PATCH_TARGETS, ESTIMATED_TOOL_USD, approvalInput, planNeedsApproval } from "./genesis-super";
test("user timezone determines local weekday", () => { expect(timeContext("Asia/Dubai",new Date("2026-11-01T22:00:00Z"))).toContain("Monday"); });
test("summary contains three to five lines", () => { expect(summaryLines("Build a cafe", "Saved. Deployed. Tested.").split("\n")).toHaveLength(4); });
test("memory search ranks topic above content matches", () => { expect(rankMemories([{topic:"other",content:"cafe"},{topic:"cafe",content:"saved"}],"cafe")[0].topic).toBe("cafe"); });
test("registry cannot disable owner confirmation tools", () => { expect(() => validateRegistry('{"disabled":["self_patch"]}',["self_patch"])).toThrow(); });
test("self patches only target three runtime configurations", () => { expect(PATCH_TARGETS).toEqual(["system-prompt","persona","tool-registry"]); });
test("browser self-fix is capped at three", () => { expect(MAX_BROWSER_FIXES).toBe(3); });
test("existing paid tool estimates cover background entry", () => { expect(ESTIMATED_TOOL_USD.start_job).toBe(0.10); });
test("third tool requires approved plan",()=>{expect(planNeedsApproval(1,false)).toBe(false);expect(planNeedsApproval(2,false)).toBe(true);expect(planNeedsApproval(2,true)).toBe(false);});
test("model confirmation cannot change paid approval arguments",()=>{expect(approvalInput({prompt:"cafe",confirm:true})).toEqual({prompt:"cafe"});expect(approvalInput({prompt:"different"})).not.toEqual(approvalInput({prompt:"cafe"}));});
test("nullable memory tags are safe",()=>{expect(rankMemories([{topic:"cafe",content:"saved",tags:null}],"cafe")).toHaveLength(1);});