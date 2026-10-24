// @ts-nocheck
import { expect, test } from "bun:test";
import { HELP_ENTRIES, matchHelpEntry } from "./help-guide";

test("common requests match the right feature", () => {
  expect(matchHelpEntry("website banana hai")?.id).toBe("builds");
  expect(matchHelpEntry("cv kaise banau")?.id).toBe("cv");
  expect(matchHelpEntry("points kaise kamau mining se")?.id).toBe("mining");
  expect(matchHelpEntry("jalsa offline chat")?.id).toBe("jalsa");
  expect(matchHelpEntry("image generate karo")?.id).toBe("ai-tools");
  expect(matchHelpEntry("domain check karna hai")?.id).toBe("domains");
});

test("unknown text returns null, every entry has 3 steps and a route", () => {
  expect(matchHelpEntry("xyzzy foobar")).toBeNull();
  for (const e of HELP_ENTRIES) {
    expect(e.steps.length).toBe(3);
    expect(e.route.startsWith("/")).toBe(true);
  }
});
