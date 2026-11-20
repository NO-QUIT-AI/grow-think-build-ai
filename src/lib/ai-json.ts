import { z } from "zod";

/** Validate before saving a proposal; never salvage partial code or execute model text. */
export function parseAIJSON<T>(text: string, schema: z.ZodType<T>): T {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  let value: unknown;
  try { value = JSON.parse(trimmed); }
  catch { throw new Error("AI ne incomplete ya invalid JSON diya; koi change save ya push nahi hua."); }
  return schema.parse(value);
}

export async function validatedJSON<T>(schema: z.ZodType<T>, attempts: (() => Promise<string>)[]): Promise<T> {
  for (const attempt of attempts) {
    try { return parseAIJSON(await attempt(), schema); }
    catch { /* Read-only generation may fail over; invalid proposals are never persisted. */ }
  }
  throw new Error("AI valid code preview nahi bana saka (response incomplete, quota ya timeout). Chhota change request karein; GitHub par kuch push nahi hua.");
}