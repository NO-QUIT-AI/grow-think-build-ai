import { createFileRoute } from "@tanstack/react-router";
import { userFromRequest } from "@/lib/auth-user.server";

const DEFAULT_QUERY = "What are top 3 trending features in AI CV builder apps in 2026?";

type Provider = { name: string; url: string; key: string; model: string };

async function ask(p: Provider, system: string, user: string, signal: AbortSignal) {
  const res = await fetch(p.url, {
    method: "POST",
    signal,
    headers: { authorization: `Bearer ${p.key}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: p.model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`${p.name} ${res.status}`);
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = json.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error(`${p.name} empty`);
  return text;
}

/** MASTER SCOUT: Groq + DeepSeek parallel, NDJSON stream of logs + final summary. */
export const Route = createFileRoute("/api/scout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await userFromRequest(request);
        if (!user) return new Response("Unauthorized", { status: 401 });
        const body = (await request.json().catch(() => ({}))) as { query?: string };
        const query = (typeof body.query === "string" && body.query.trim() ? body.query : DEFAULT_QUERY).slice(0, 300);

        const groqKey = process.env["GROQ_API_KEY"];
        const dsKey = process.env["DEEPSEEK_API_KEY"];
        const groq: Provider | null = groqKey
          ? { name: "Groq", url: "https://api.groq.com/openai/v1/chat/completions", key: groqKey, model: "llama-3.1-8b-instant" }
          : null;
        const deepseek: Provider | null = dsKey
          ? { name: "DeepSeek", url: "https://api.deepseek.com/chat/completions", key: dsKey, model: "deepseek-chat" }
          : null;

        const signal = request.signal;
        const enc = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            const send = (o: unknown) => controller.enqueue(enc.encode(JSON.stringify(o) + "\n"));
            const log = (text: string, level: "info" | "ok" | "warn" | "error" = "info") => send({ type: "log", text, level });
            try {
              if (!groq && !deepseek) {
                send({ type: "error", text: "Koi AI key set nahi hai." });
                return;
              }
              const scoutSystem =
                'You are a market research agent (A2A protocol). Reply ONLY JSON: {"features":[{"title":string,"why":string}]} with exactly 3 items.';
              const payload = JSON.stringify({ query, format: "json" });

              const runScout = async (primary: Provider | null, label: string) => {
                if (primary) {
                  log(`${primary.name} se connect ho raha hu...`);
                  try {
                    const out = await ask(primary, scoutSystem, payload, signal);
                    log(`${primary.name} ne jawab de diya ✓`, "ok");
                    return { agent: label, by: primary.name, answer: out };
                  } catch (e) {
                    log(`${primary.name} fail (${(e as Error).message}) — fallback...`, "warn");
                  }
                }
                const fb = primary === deepseek ? groq : deepseek;
                if (!fb) throw new Error(`${label} unavailable`);
                log(`${fb.name} jawab de raha hai (fallback)...`);
                const out = await ask(fb, scoutSystem, payload, signal);
                log(`${fb.name} fallback ✓`, "ok");
                return { agent: label, by: fb.name, answer: out };
              };

              const results = await Promise.allSettled([runScout(groq, "Agent A"), runScout(deepseek, "Agent B")]);
              const answers = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
              if (!answers.length) {
                send({ type: "error", text: "Dono AIs abhi available nahi. Thodi der baad try karo." });
                return;
              }
              send({ type: "answers", answers });

              log("Master Scout dono jawab mila raha hai...");
              const sumSystem =
                'You are NO QUIT AI, a desi brother. Combine the agents\' answers into Hinglish (Roman Urdu + English). Reply ONLY JSON: {"intro":"Bhai market me ye 3 cheezein chal rahi hain...","points":[{"title":string,"detail":string}],"outro":string} with exactly 3 points, short and punchy.';
              const sumUser = JSON.stringify({ query, answers: answers.map((a) => ({ by: a.by, answer: a.answer })) });
              let summaryText = "";
              for (const p of [deepseek, groq]) {
                if (!p) continue;
                try {
                  summaryText = await ask(p, sumSystem, sumUser, signal);
                  log(`Summary ${p.name} ne banayi ✓`, "ok");
                  break;
                } catch (e) {
                  log(`${p.name} summary fail (${(e as Error).message})`, "warn");
                }
              }
              if (!summaryText) {
                send({ type: "error", text: "Summary nahi ban saki." });
                return;
              }
              send({ type: "summary", summary: JSON.parse(summaryText) });
            } catch (e) {
              if (!signal.aborted) send({ type: "error", text: (e as Error).message });
            } finally {
              send({ type: "done" });
              controller.close();
            }
          },
        });
        return new Response(stream, {
          headers: { "content-type": "application/x-ndjson", "cache-control": "no-cache, no-transform" },
        });
      },
    },
  },
});
