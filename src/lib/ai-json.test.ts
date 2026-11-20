import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { parseAIJSON, validatedJSON } from "./ai-json";

describe("GitHub structured preview safety", () => {
  const schema = z.object({ after: z.string().min(1), summary: z.string() });
  it("preserves escaped source code and accepts fenced complete JSON", () => {
    const after = 'const title = "NO QUIT AI";\nexport { title };';
    assert.equal(parseAIJSON(`\n\`\`\`json\n${JSON.stringify({ after, summary: "Title updated" })}\n\`\`\`\n`, schema).after, after);
  });
  it("invalid branch preview JSON hands off to the next provider", async () => {
    let calls = 0;
    const result = await validatedJSON(schema, [async () => { calls++; return '{"after":"cut'; }, async () => { calls++; return JSON.stringify({ after: "valid code", summary: "Ready" }); }]);
    assert.equal(result.after, "valid code"); assert.equal(calls, 2);
  });
  it("wrong schema falls back without accepting an approval flag", async () => {
    const result = await validatedJSON(schema, [async () => '{"confirmed":true}', async () => '{"after":"safe","summary":"Review"}']);
    assert.deepEqual(result, { after: "safe", summary: "Review" });
  });
  it("all invalid output fails closed with no partial preview", async () => {
    await assert.rejects(validatedJSON(schema, [async () => '{"after":"cut']), /GitHub par kuch push nahi hua/);
  });
});