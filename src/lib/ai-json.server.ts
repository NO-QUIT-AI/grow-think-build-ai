import { generateText } from "ai";
import { z } from "zod";
import { aiCandidates } from "./ai-provider.server";
import { validatedJSON } from "./ai-json";

export function aiJSON<T>(schema: z.ZodType<T>, instructions: string, input: string) {
  return validatedJSON(schema, aiCandidates(false, "coding").map(candidate => async () => {
    try {
      // Provider-neutral JSON instructions avoid unsupported native schema/JSON-mode APIs.
      const result = await generateText({ model: candidate.model,
        system: `${instructions}\nReturn one complete JSON object only; escape quotes and newlines inside source code.`, prompt: input, maxOutputTokens: 8000, maxRetries: 0,
        abortSignal: AbortSignal.timeout(45000) });
      return result.text;
    } catch (error) {
      console.warn(`[GitHub JSON] ${candidate.name} unavailable`, error instanceof Error ? error.name : "UnknownError");
      throw error;
    }
  }));
}