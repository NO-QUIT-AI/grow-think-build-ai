import { createFileRoute } from "@tanstack/react-router";
import { userFromRequest } from "@/lib/auth-user.server";

const DEFAULT_QUERY = "What are top 3 trending features in AI CV builder apps in 2026?";

export const Route = createFileRoute("/api/scout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await userFromRequest(request);
        if (!user) return new Response("Unauthorized", { status: 401 });
        const body = (await request.json().catch(() => ({}))) as { query?: string };
        const query = (typeof body.query === "string" && body.query.trim() ? body.query : DEFAULT_QUERY).slice(0, 300);

        const signal = request.signal;
        const enc = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            const send = (o: unknown) => controller.enqueue(enc.encode(JSON.stringify(o) + "\n"));
            const log = (text: string, level: "info" | "ok" | "warn" | "error" = "info") => send({ type: "log", text, level });
            try {
              const scoutSystem =
                'You are a market research agent (A2A protocol). Reply ONLY JSON: {"features":[{"title":string,"why":string}]} with exactly 3 items.';
              const payload = JSON.stringify({ query, format: "json" });

              const { aiText } = await import("@/lib/ai-provider.server");
              const runScout = async (label: string) => {
                log(`${label}: Groq → DeepSeek → Gemini se research...`);
                const answer = await aiText(scoutSystem, payload, signal);
                log(`${label} ne jawab de diya ✓`, "ok");
                return { agent: label, by: "AI fallback", answer };
              };

              const results = await Promise.allSettled([runScout("Agent A"), runScout("Agent B")]);
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
              const summaryText = await aiText(sumSystem, sumUser, signal);
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
