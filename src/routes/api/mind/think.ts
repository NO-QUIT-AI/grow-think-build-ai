import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { streamText, Output } from "ai";
import { z } from "zod";

import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { LANGUAGES, type Lang } from "@/i18n/translations";

const LANGUAGE_NAMES: Record<Lang, string> = { en: "English", ur: "Urdu", hi: "Hindi", ar: "Arabic" };

function userClient(token: string) {
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { apikey: key, Authorization: `Bearer ${token}` } },
  });
}

const ThoughtSchema = z.object({
  thought: z.string(),
  source_chat: z.string(),
});

export const Route = createFileRoute("/api/mind/think")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => ({}))) as { lang?: unknown };
        const lang: Lang = typeof body.lang === "string" && LANGUAGES.some((item) => item.code === body.lang)
          ? (body.lang as Lang)
          : "en";
        const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!token) return new Response("Unauthorized", { status: 401 });

        const supabase = userClient(token);
        const { data: userData, error: userError } = await supabase.auth.getUser(token);
        if (userError || !userData.user) return new Response("Unauthorized", { status: 401 });
        const userId = userData.user.id;

        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) return new Response("AI is not configured", { status: 500 });

        const [{ data: memories }, { data: past }] = await Promise.all([
          supabase
            .from("memories")
            .select("prompt, project_type, summary, created_at")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(10),
          supabase
            .from("mind_thoughts")
            .select("thought")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(10),
        ]);

        const memoryText =
          (memories ?? [])
            .map((m) => `- [${m.project_type}] ${m.prompt} :: ${m.summary ?? ""}`)
            .join("\n") || "- (abhi koi build/memory nahi)";
        const pastText =
          (past ?? []).map((p) => `- ${p.thought}`).join("\n") || "- (koi purani soch nahi)";

        const gateway = createLovableAiGatewayProvider(apiKey);

        const result = streamText({
          model: gateway("google/gemini-3.7-flash"),
          system:
            `You are NO QUIT AI's background thinking engine. Produce one new, concrete, actionable insight from the user's latest memories. Write 1–3 short lines in ${LANGUAGE_NAMES[lang]}. Do not repeat old thoughts. source_chat must contain a short piece of the source prompt, or 'general'.`,
          prompt: `Aakhri memories:\n${memoryText}\n\nPurani sochein (repeat na karo):\n${pastText}\n\nAb ek bilkul nayi soch nikalo.`,
          output: Output.object({ schema: ThoughtSchema }),
        });

        try {
          const generated = await result.output;
          const isAuto = new URL(request.url).searchParams.get("manual") !== "1";
          const { data, error } = await supabase
            .from("mind_thoughts")
            .insert({
              user_id: userId,
              thought: generated.thought.trim(),
              source_chat: (generated.source_chat || "general").slice(0, 200),
              is_auto: isAuto,
            })
            .select("id, thought, source_chat, is_auto, created_at")
            .single();
          if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
          return Response.json({ ok: true, thought: data });
        } catch (error) {
          return Response.json(
            { ok: false, error: error instanceof Error ? error.message : "Mind think failed" },
            { status: 500 },
          );
        }
      },
    },
  },
});
