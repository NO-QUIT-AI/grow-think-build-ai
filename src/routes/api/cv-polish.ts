import { createFileRoute } from "@tanstack/react-router";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";

import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

type Body = { data?: Record<string, unknown> };

const SYSTEM = `Tum ek professional CV writer ho. User ka CV data JSON me milta hai.
Usay behtar banao: strong professional summary (2-3 lines) aur har experience ke liye 3-4 result-focused bullet points (har bullet nayi line par, action verb se shuru).
Jo zubaan user ne likhi hai wahi rakho (Roman Urdu ho to Roman Urdu, English ho to English).
Jhoote facts, jhooti companies ya jhooti dates mat banao — sirf jo diya hai usay polish karo.
Sirf JSON return karo is shape me, koi markdown ya extra text nahi:
{"summary":"...","experience":[{"role":"...","company":"...","period":"...","points":"line1\\nline2"}]}`;

export const Route = createFileRoute("/api/cv-polish")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!token) return new Response("Unauthorized", { status: 401 });

        const body = (await request.json()) as Body;
        if (!body.data) return new Response("CV data is required", { status: 400 });

        const apiKey = process.env["LOVABLE_API_KEY"];
        const deepseekKey = process.env["DEEPSEEK_API_KEY"];
        if (!apiKey && !deepseekKey) return new Response("AI is not configured", { status: 500 });

        const model = deepseekKey
          ? createOpenAICompatible({
              name: "deepseek",
              baseURL: "https://api.deepseek.com",
              apiKey: deepseekKey,
            }).chatModel("deepseek-chat")
          : createLovableAiGatewayProvider(apiKey!)("google/gemini-3.7-flash");

        try {
          const { text } = await generateText({
            model,
            system: SYSTEM,
            prompt: JSON.stringify(body.data).slice(0, 12_000),
          });
          const json = text.match(/\{[\s\S]*\}/)?.[0];
          if (!json) return new Response("AI ne sahi jawab nahi diya", { status: 502 });
          return new Response(json, { headers: { "Content-Type": "application/json" } });
        } catch (error) {
          const message = error instanceof Error ? error.message : "AI ruk gaya";
          const credits = /402|Payment Required|credits/i.test(message);
          return new Response(
            credits ? "AI credits khatam hain — thori dair baad try karein." : message,
            { status: 502 },
          );
        }
      },
    },
  },
});
