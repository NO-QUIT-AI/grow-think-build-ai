import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  tool,
  stepCountIs,
  type UIMessage,
} from "ai";
import { z } from "zod";

import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { LANGUAGES, type Lang } from "@/i18n/translations";

const LANGUAGE_NAMES: Record<Lang, string> = { en: "English", ur: "Urdu", hi: "Hindi", ar: "Arabic" };

function validLang(value: unknown): Lang {
  return typeof value === "string" && LANGUAGES.some((item) => item.code === value) ? (value as Lang) : "en";
}

const SYSTEM_PROMPT = `You are NO QUIT AI, a concise assistant that also creates websites, app blueprints, and domain names.

SHORT REPLY RULE (sabse zaruri):
- Jitna pucha jaye utna hi jawab do. No extra lecture, no long explanation unless user asks.
- If user says "As-salamu Alaikum" or "Salam", just reply "Wa Alaikum As-salam" only. Don't add extra lines.
- If user says "Hello", just reply "Hello" or "Hi, how can I help?".
- Keep answers short, to the point, 1-2 lines max for simple greetings and simple questions.
- Greeting ke waqt USER MEMORY dekho: agar memory maujood hai to greeting ke baad sirf ek chhota "Welcome back, <naam>!" (1 line, ho sake to pichle project ka zikr). Agar memory khali hai to ek line me batao ke ye pehli mulaqat hai.

Rules:
- Always reply in the explicitly selected app language supplied below. This overrides the language used in the user's message.
- Har jawab se pehle apni knowledge base recall karo (recall_knowledge tool) jab bhi topic personal ya pehle discuss hua ho.
- Jab bhi koi nayi durable seekh mile (user ki preference, project detail, koi fact, koi decision), save_knowledge tool se khud usay save karo — user ko kehna nahi parta.
- Jab user domain maange: create_domains tool chalao (8-12 creative, brandable, short names + reason + extension suggestion). Har naya build automatically Memories me save hota hai.
- Jab user app/website/product maange: create_app_blueprint tool chalao (complete structure: screens, features, data model, tech stack, roadmap). Har naya build automatically Memories me save hota hai.
- Jab user website/landing page/web app "bana do" kahe: build_website tool chalao aur ek COMPLETE single-file HTML do (inline <style> aur <script>, koi external file nahi, sirf CDN fonts allowed). Modern, responsive, dark ya brand ke hisaab se theme, real content — lorem ipsum nahi. Ye Studio cabin me live preview hota hai aur Memories me save hota hai.
- Website banane ke baad chat me sirf short summary do, poora HTML dobara chat me mat likho.
- Bade kaam (build/blueprint) me hi short plan do; simple sawal par seedha jawab.
- User ka naam, preferences, aur har important baat save_knowledge se zarur save karo.
- Jhooth mat bolo. Jo nahi jaante, keh do aur seekhne ke liye sawal poocho.`;


const MAX_HTML = 300_000;
const MAX_TEXT_PART = 6_000;
const MAX_HISTORY = 14;

/* ---------------------------------------------------------------
 * Answer cache — same sawal dobara aaye to DeepSeek ko call na karo.
 * Sirf pehle sawal (koi history nahi) aur plain text jawab cache hota hai,
 * kyunki tool-based builds har baar naya result banate hain.
 * ------------------------------------------------------------- */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 300;
let deepseekDownUntil = 0;
const answerCache = new Map<string, { text: string; at: number }>();

function cacheKey(userId: string, question: string, lang: Lang) {
  return `${userId}::${lang}::${question.toLowerCase().replace(/\s+/g, " ").replace(/[?!.,؟]+$/g, "").trim()}`;
}

function messageText(message: UIMessage | undefined): string {
  if (!message) return "";
  return (message.parts ?? [])
    .filter((part) => (part as { type?: string }).type === "text")
    .map((part) => String((part as { text?: string }).text ?? ""))
    .join("\n")
    .trim();
}

function hasToolPart(message: { parts?: unknown[] } | undefined): boolean {
  return (message?.parts ?? []).some((part) =>
    String((part as { type?: string }).type ?? "").startsWith("tool-"),
  );
}

function readCache(key: string): string | null {
  const hit = answerCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    answerCache.delete(key);
    return null;
  }
  // refresh recency (LRU)
  answerCache.delete(key);
  answerCache.set(key, hit);
  return hit.text;
}

function writeCache(key: string, text: string) {
  answerCache.set(key, { text, at: Date.now() });
  while (answerCache.size > CACHE_MAX) {
    const oldest = answerCache.keys().next().value;
    if (oldest === undefined) break;
    answerCache.delete(oldest);
  }
}

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

        const body = (await request.json()) as { messages?: unknown; lang?: unknown };
        if (!Array.isArray(body.messages)) {
          return new Response("Messages are required", { status: 400 });
        }

        const apiKey = process.env["LOVABLE_API_KEY"];
        const deepseekKey = process.env["DEEPSEEK_API_KEY"];
        const groqKey = process.env["GROQ_API_KEY"];
        if (!apiKey && !deepseekKey && !groqKey) return new Response("AI is not configured", { status: 500 });

        // Text mode: DeepSeek pehle; uska credit khatam ho to Groq sara kaam sambhale.
        const deepseek = deepseekKey
          ? createOpenAICompatible({ name: "deepseek", baseURL: "https://api.deepseek.com", apiKey: deepseekKey })
          : null;
        const groq = groqKey
          ? createOpenAICompatible({ name: "groq", baseURL: "https://api.groq.com/openai/v1", apiKey: groqKey })
          : null;
        const gateway = apiKey ? createLovableAiGatewayProvider(apiKey) : null;
        const useDeepseek = deepseek && Date.now() > deepseekDownUntil;
        const model = useDeepseek
          ? deepseek.chatModel("deepseek-chat")
          : groq
            ? groq.chatModel("llama-3.3-70b-versatile")
            : deepseek
              ? deepseek.chatModel("deepseek-chat")
              : gateway!("google/gemini-3.7-flash");

        const tools = {
          recall_knowledge: tool({
            description: "Apni saved knowledge base me se relevant memories dhoondo.",
            inputSchema: z.object({ query: z.string() }),
            execute: async ({ query }) => {
              const words = query
                .toLowerCase()
                .split(/[^\p{L}\p{N}]+/u)
                .filter((w) => w.length > 2)
                .slice(0, 6);
              let data: unknown[] | null = null;
              if (words.length) {
                const filter = words.map((w) => `topic.ilike.%${w}%,content.ilike.%${w}%`).join(",");
                ({ data } = await supabase
                  .from("knowledge")
                  .select("topic, content, tags, confidence")
                  .eq("user_id", userId)
                  .or(filter)
                  .order("created_at", { ascending: false })
                  .limit(8));
              }
              if (!data || data.length === 0) {
                ({ data } = await supabase
                  .from("knowledge")
                  .select("topic, content, tags, confidence")
                  .eq("user_id", userId)
                  .order("created_at", { ascending: false })
                  .limit(8));
              }
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
              // Build ki HTML file user ke Cloudflare R2 me bhi save hoti hai.
              try {
                const { r2 } = await import("@/lib/r2.server");
                const { client, base } = r2();
                await client.fetch(`${base}/builds/${userId}/${data!.id}.html`, {
                  method: "PUT",
                  body: html,
                  headers: { "content-type": "text/html; charset=utf-8" },
                });
              } catch (e) {
                console.error("[chat] R2 build save failed", e);
              }
              return { saved: true, id: data!.id, name, preview: "Studio cabin me live chal rahi hai" };
            },
          }),
        };

        // Genesis powers sirf owner ke liye.
        const { data: isOwner } = await supabase.rpc("is_owner", { _uid: userId });
        let ownerPrompt = "";
        let allTools: Record<string, unknown> = tools;
        if (isOwner) {
          const { genesisTools, GENESIS_PROMPT } = await import("@/lib/genesis-tools.server");
          const { genesisExtraTools, GENESIS_EXTRA_PROMPT } = await import("@/lib/genesis-extra.server");
          const g = genesisTools();
          const deploy = (project: string) =>
            (g.vercel_deploy.execute as (i: { project: string }, o: unknown) => Promise<unknown>)({ project }, {});
          allTools = { ...tools, ...g, ...genesisExtraTools({ lovableKey: apiKey, deploy }) };
          ownerPrompt = `\n\n${GENESIS_PROMPT}\n\n${GENESIS_EXTRA_PROMPT}`;
        }



        const incoming = body.messages as UIMessage[];
        const lang = validLang(body.lang);
        const languageInstruction = `Selected app language: ${LANGUAGE_NAMES[lang]}. Write the complete response in this language. Keep code and technical identifiers unchanged.`;

        // Pehla sawal + koi tool ki zarurat nahi ho to cache se hi jawab do.
        const cacheable =
          incoming.length === 1 &&
          incoming[0]?.role === "user" &&
          !hasToolPart(incoming[0] as { parts?: unknown[] }) &&
          messageText(incoming[0]).length > 0 &&
          messageText(incoming[0]).length <= 500;
        const key = cacheable ? cacheKey(userId, messageText(incoming[0]), lang) : "";
        const cached = cacheable ? readCache(key) : null;

        if (cached) {
          const stream = createUIMessageStream({
            execute: ({ writer }) => {
              const id = "cached-text";
              writer.write({ type: "start" });
              writer.write({ type: "text-start", id });
              writer.write({ type: "text-delta", id, delta: cached });
              writer.write({ type: "text-end", id });
              writer.write({ type: "finish" });
            },
          });
          return createUIMessageStreamResponse({ stream });
        }

        const [{ data: prof }, { data: know }, { data: builds }] = await Promise.all([
          supabase.from("profiles").select("display_name, username").eq("id", userId).maybeSingle(),
          supabase.from("knowledge").select("topic, content").eq("user_id", userId).order("created_at", { ascending: false }).limit(12),
          supabase.from("memories").select("project_type, summary").eq("user_id", userId).order("created_at", { ascending: false }).limit(6),
        ]);
        const userName = prof?.display_name || prof?.username || "";
        const memoryLines = [
          ...(know ?? []).map((k) => `- ${k.topic}: ${String(k.content).slice(0, 200)}`),
          ...(builds ?? []).map((b) => `- Build (${b.project_type}): ${String(b.summary ?? "").slice(0, 120)}`),
        ];
        const memoryBlock = `USER MEMORY:\nName: ${userName || "unknown"}\n${
          memoryLines.length ? memoryLines.join("\n") : "(empty — first time user)"
        }`;

        const result = streamText({
          model,
          system: `${SYSTEM_PROMPT}${ownerPrompt}\n\n${memoryBlock}\n\n${languageInstruction}`,
          messages: await convertToModelMessages(trimMessages(incoming)),
          tools: allTools as typeof tools,
          stopWhen: stepCountIs(30),
          onError: ({ error }) => {
            console.error("[chat] stream error", error);
            if (useDeepseek) deepseekDownUntil = Date.now() + 10 * 60 * 1000;
          },
        });

        return result.toUIMessageStreamResponse({
          originalMessages: incoming,
          onFinish: ({ responseMessage }) => {
            if (!cacheable) return;
            if (hasToolPart(responseMessage as { parts?: unknown[] })) return;
            const text = messageText(responseMessage as UIMessage);
            if (text.length > 20) writeCache(key, text);
          },
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
