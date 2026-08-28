import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { streamText, Output } from "ai";
import { z } from "zod";

import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

function userClient(token: string) {
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { apikey: key, Authorization: `Bearer ${token}` } },
  });
}

const InsightSchema = z.object({
  topic: z.string(),
  content: z.string(),
  tags: z.array(z.string()),
  confidence: z.number(),
});

export const Route = createFileRoute("/api/mind")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!token) return new Response("Unauthorized", { status: 401 });

        const supabase = userClient(token);
        const { data: userData, error: userError } = await supabase.auth.getUser(token);
        if (userError || !userData.user) return new Response("Unauthorized", { status: 401 });
        const userId = userData.user.id;

        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) return new Response("AI is not configured", { status: 500 });

        const [{ data: known }, { data: builds }] = await Promise.all([
          supabase
            .from("knowledge")
            .select("topic, content")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(25),
          supabase
            .from("artifacts")
            .select("kind, title")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(15),
        ]);

        const gateway = createLovableAiGatewayProvider(apiKey);

        const result = streamText({
          model: gateway("google/gemini-3.7-flash"),
          system:
            "Tum NOVA ka 'Mind' ho — background thinking engine. Tumhara kaam: user ki maujooda knowledge aur builds dekh kar khud se EK naya, useful, non-duplicate insight/idea/next-step nikalna aur usay memory me add karna. Roman Urdu me likho, short aur actionable. Jo pehle se maujood hai wo dobara mat likho.",
          prompt: `Maujooda memories:\n${(known ?? [])
            .map((k) => `- ${k.topic}: ${k.content}`)
            .join("\n") || "- (khali)"}\n\nMaujooda builds:\n${(builds ?? [])
            .map((b) => `- [${b.kind}] ${b.title}`)
            .join("\n") || "- (khali)"}\n\nAb ek naya insight banao.`,
          output: Output.object({ schema: InsightSchema }),
        });

        try {
          const insight = await result.output;
          const row = {
            user_id: userId,
            topic: insight.topic.slice(0, 120),
            content: insight.content,
            tags: [...(insight.tags ?? []).slice(0, 5), "mind"],
            confidence: Math.min(1, Math.max(0, insight.confidence ?? 0.6)),
          };
          const { data, error } = await supabase
            .from("knowledge")
            .insert(row)
            .select("id, topic, content, tags, confidence, created_at")
            .single();
          if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
          return Response.json({ ok: true, insight: data });
        } catch (error) {
          return Response.json(
            { ok: false, error: error instanceof Error ? error.message : "Mind failed" },
            { status: 500 },
          );
        }
      },
    },
  },
});
