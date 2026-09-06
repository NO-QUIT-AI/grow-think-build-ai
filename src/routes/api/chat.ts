import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { convertToModelMessages, streamText, tool, stepCountIs, type UIMessage } from "ai";
import { z } from "zod";

import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const SYSTEM_PROMPT = `Tum "NO QUIT AI" ho — ek self-growing AI jo khud sochti hai, khud structure banati hai aur har baat-cheet se seekh kar apni knowledge base khud grow karti hai.

Rules:
- User Urdu/Roman-Urdu/English kisi bhi zubaan me baat kare, usi zubaan me jawab do. Default Roman Urdu.
- Har jawab se pehle apni knowledge base recall karo (recall_knowledge tool) jab bhi topic personal ya pehle discuss hua ho.
- Jab bhi koi nayi durable seekh mile (user ki preference, project detail, koi fact, koi decision), save_knowledge tool se khud usay save karo. Ye tumhari self-growth hai — user ko kehna nahi parta.
- Jab user domain maange: create_domains tool chalao (8-12 creative, brandable, short names + reason + extension suggestion). Har naya build automatically Memories me save hota hai.
- Jab user app/website/product maange: create_app_blueprint tool chalao (complete structure: screens, features, data model, tech stack, roadmap). Har naya build automatically Memories me save hota hai.
- Jab user website/landing page/web app "bana do" kahe: build_website tool chalao aur ek COMPLETE single-file HTML do (inline <style> aur <script>, koi external file nahi, sirf CDN fonts allowed). Modern, responsive, dark ya brand ke hisaab se theme, real content — lorem ipsum nahi. Ye Studio cabin me live preview hota hai aur Memories me save hota hai.
- Website banane ke baad chat me sirf short summary do, poora HTML dobara chat me mat likho.
- Sochne ka tarika: pehle short "Sochne ka plan" (2-4 bullets), phir kaam, phir clean markdown output.
- Jhooth mat bolo. Jo nahi jaante, keh do aur seekhne ke liye sawal poocho.`;


const MAX_HTML = 300_000;
const MAX_TEXT_PART = 6_000;
const MAX_HISTORY = 14;

/**
 * Bade builds (jaise mining coin app with contract address) ka HTML history me
 * reh jata tha aur agla request token limit cross kar ke fail ho jata tha.
 * Isliye history trim + heavy tool outputs compact kar dete hain.
 */
function trimMessages(messages: UIMessage[]): UIMessage[] {
  return messages.slice(-MAX_HISTORY).map((message) => {
    const parts = (message.parts ?? []).map((part) => {
      const anyPart = part as Record<string, unknown>;
      const type = String(anyPart["type"] ?? "");

      if (type === "text" && typeof anyPart["text"] === "string") {
        const text = anyPart["text"] as string;
        if (text.length > MAX_TEXT_PART) {
          return { ...anyPart, text: `${text.slice(0, MAX_TEXT_PART)}\n…[trimmed]` };
        }
        return part;
      }

      if (type.startsWith("tool-")) {
        const next: Record<string, unknown> = { ...anyPart };
        const input = next["input"] as Record<string, unknown> | undefined;
        if (input && typeof input["html"] === "string") {
          next["input"] = { ...input, html: "[HTML build saved — Studio me maujood hai]" };
        }
        const output = next["output"];
        if (typeof output === "string" && output.length > 1_000) {
          next["output"] = `${output.slice(0, 1_000)}…[trimmed]`;
        } else if (output && typeof output === "object") {
          const compact = { ...(output as Record<string, unknown>) };
          if (typeof compact["html"] === "string") compact["html"] = "[trimmed]";
          next["output"] = compact;
        }
        return next;
      }

      return part;
    });
    return { ...message, parts } as UIMessage;
  });
}

function userClient(token: string) {
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { apikey: key, Authorization: `Bearer ${token}` } },
  });
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!token) return new Response("Unauthorized", { status: 401 });

        const supabase = userClient(token);
        const { data: userData, error: userError } = await supabase.auth.getUser(token);
        if (userError || !userData.user) return new Response("Unauthorized", { status: 401 });
        const userId = userData.user.id;

        const body = (await request.json()) as { messages?: unknown };
        if (!Array.isArray(body.messages)) {
          return new Response("Messages are required", { status: 400 });
        }

        const apiKey = process.env["LOVABLE_API_KEY"];
        const deepseekKey = process.env["DEEPSEEK_API_KEY"];
        if (!apiKey && !deepseekKey) return new Response("AI is not configured", { status: 500 });

        // Personal DeepSeek key maujood ho to wahi primary model hai —
        // Lovable credits khatam hone par bhi chat kabhi band nahi hoti.
        const deepseek = deepseekKey
          ? createOpenAICompatible({
              name: "deepseek",
              baseURL: "https://api.deepseek.com",
              apiKey: deepseekKey,
            })
          : null;
        const gateway = apiKey ? createLovableAiGatewayProvider(apiKey) : null;
        const model = deepseek ? deepseek.chatModel("deepseek-chat") : gateway!("google/gemini-3.7-flash");

        const tools = {
          recall_knowledge: tool({
            description: "Apni saved knowledge base me se relevant memories dhoondo.",
            inputSchema: z.object({ query: z.string() }),
            execute: async ({ query }) => {
              const { data } = await supabase
                .from("knowledge")
                .select("topic, content, tags, confidence")
                .eq("user_id", userId)
                .or(`topic.ilike.%${query}%,content.ilike.%${query}%`)
                .order("created_at", { ascending: false })
                .limit(8);
              return { memories: data ?? [] };
            },
          }),
          save_knowledge: tool({
            description:
              "Koi nayi durable seekh apni knowledge base me save karo taake future me yaad rahe.",
            inputSchema: z.object({
              topic: z.string(),
              content: z.string(),
              tags: z.array(z.string()),
              confidence: z.number(),
            }),
            execute: async ({ topic, content, tags, confidence }) => {
              const { error } = await supabase.from("knowledge").insert({
                user_id: userId,
                topic,
                content,
                tags,
                confidence: Math.min(1, Math.max(0, confidence)),
              });
              return error ? { saved: false, error: error.message } : { saved: true, topic };
            },
          }),
          create_domains: tool({
            description: "Domain name ideas generate karke save karo.",
            inputSchema: z.object({
              brief: z.string(),
              names: z.array(
                z.object({
                  name: z.string(),
                  extension: z.string(),
                  reason: z.string(),
                }),
              ),
            }),
            execute: async ({ brief, names }) => {
              const title = brief.slice(0, 80);
              const content = { brief, names };
              const [{ data, error }, { error: memoryError }] = await Promise.all([
                supabase
                  .from("artifacts")
                  .insert({
                    user_id: userId,
                    kind: "domains",
                    title,
                    content,
                  })
                  .select("id")
                  .single(),
                supabase.from("memories").insert({
                  user_id: userId,
                  prompt: brief,
                  project_type: "domains",
                  code: JSON.stringify(names),
                  summary: title,
                  blueprint: content,
                }),
              ]);
              if (error || memoryError) {
                return { saved: false, error: error?.message || memoryError?.message };
              }
              return { saved: true, id: data!.id, names };
            },
          }),
          create_app_blueprint: tool({
            description: "Puri app ka structure/blueprint banao aur save karo.",
            inputSchema: z.object({
              name: z.string(),
              summary: z.string(),
              screens: z.array(z.object({ title: z.string(), purpose: z.string() })),
              features: z.array(z.string()),
              data_model: z.array(z.object({ table: z.string(), fields: z.array(z.string()) })),
              tech_stack: z.array(z.string()),
              roadmap: z.array(z.string()),
            }),
            execute: async (blueprint) => {
              const [{ data, error }, { error: memoryError }] = await Promise.all([
                supabase
                  .from("artifacts")
                  .insert({
                    user_id: userId,
                    kind: "blueprint",
                    title: blueprint.name,
                    content: blueprint,
                  })
                  .select("id")
                  .single(),
                supabase.from("memories").insert({
                  user_id: userId,
                  prompt: `${blueprint.name}: ${blueprint.summary}`,
                  project_type: "blueprint",
                  code: "",
                  summary: blueprint.summary,
                  blueprint,
                }),
              ]);
              if (error || memoryError) {
                return { saved: false, error: error?.message || memoryError?.message };
              }
              return { saved: true, id: data!.id, name: blueprint.name };
            },
          }),
          build_website: tool({
            description:
              "Ek complete single-file HTML website/landing page/web app banao aur save karo. Studio cabin me live preview hoti hai.",
            inputSchema: z.object({
              name: z.string(),
              summary: z.string(),
              html: z.string(),
            }),
            execute: async ({ name, summary, html }) => {
              if (!html || html.trim().length < 30) {
                return { saved: false, error: "HTML khali tha — dobara complete HTML bhejo." };
              }
              if (html.length > MAX_HTML) {
                return {
                  saved: false,
                  error:
                    "HTML bohot bara hai. Ise chhota karo (kam inline data, sections short) aur dobara bhejo.",
                };
              }
              const content = { name, summary, html };
              const [{ data, error }, { error: memoryError }] = await Promise.all([
                supabase
                  .from("artifacts")
                  .insert({
                    user_id: userId,
                    kind: "website",
                    title: name,
                    content,
                  })
                  .select("id")
                  .single(),
                supabase.from("memories").insert({
                  user_id: userId,
                  prompt: `${name}: ${summary}`,
                  project_type: "website",
                  code: html,
                  summary,
                  blueprint: content,
                }),
              ]);
              if (error || memoryError) {
                return { saved: false, error: error?.message || memoryError?.message };
              }
              return { saved: true, id: data!.id, name, preview: "Studio cabin me live chal rahi hai" };
            },
          }),
        };


        const incoming = body.messages as UIMessage[];

        const result = streamText({
          model,
          system: SYSTEM_PROMPT,
          messages: await convertToModelMessages(trimMessages(incoming)),
          tools,
          stopWhen: stepCountIs(30),
          onError: ({ error }) => {
            console.error("[chat] stream error", error);
          },
        });

        return result.toUIMessageStreamResponse({
          originalMessages: incoming,
          onError: (error) => {
            const msg = error instanceof Error ? error.message : "";
            if (msg.includes("Payment Required") || msg.includes("Not enough credits") || msg.includes("402")) {
              return "AI credits khatam ho gaye hain. Lovable billing se credits add karo — ya phir apna OpenAI API key add karo.";
            }
            return msg ? `AI ruk gaya: ${msg}` : "AI ruk gaya — thora chhota prompt ya naya chat try karo.";
          },
        });
      },
    },
  },
});
