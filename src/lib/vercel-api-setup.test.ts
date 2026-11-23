import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanEnvNames, isVercelApiRequest, vercelCloneUrl, vercelProjectUrls } from "./vercel-api-setup.ts";

test("detects Roman Urdu API request", () => { assert.equal(isVercelApiRequest("Bhai mery project m API add kro"), true); assert.equal(isVercelApiRequest("hello bhai"), false); });
test("env names sanitized", () => assert.deepEqual(cleanEnvNames("openai_key, OPENAI_KEY  bad-name 1X"), ["OPENAI_KEY", "BADNAME"]));
test("clone url carries names only", () => { const u = vercelCloneUrl("https://github.com/a/b", ["API_KEY"]); assert.match(u, /env=API_KEY/); assert.throws(() => vercelCloneUrl("https://evil.com/x", [])); });
test("project urls", () => assert.equal(vercelProjectUrls("Team", "app").env, "https://vercel.com/team/app/settings/environment-variables"));
