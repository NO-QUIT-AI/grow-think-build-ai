import { createFileRoute } from "@tanstack/react-router";

/**
 * Error telemetry (Lovable-clone update 11): client errors owner ke liye
 * R2 me append hote hain. Public endpoint hai isliye sirf sanitized,
 * size-capped data accept hota hai — koi PII nahi.
 */
const MAX_MESSAGE = 500;
const MAX_STACK = 2000;

export const Route = createFileRoute("/api/public/error-report")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { message?: unknown; stack?: unknown; route?: unknown };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return Response.json({ ok: false }, { status: 400 });
        }
        const message = typeof body.message === "string" ? body.message.slice(0, MAX_MESSAGE) : "";
        if (!message) return Response.json({ ok: false }, { status: 400 });

        const entry = JSON.stringify({
          at: new Date().toISOString(),
          message,
          stack: typeof body.stack === "string" ? body.stack.slice(0, MAX_STACK) : undefined,
          route: typeof body.route === "string" ? body.route.slice(0, 200) : undefined,
        });

        try {
          const { r2 } = await import("@/lib/r2.server");
          const { client, base } = r2();
          const day = new Date().toISOString().slice(0, 10);
          const key = `telemetry/errors-${day}.jsonl`;
          const existing = await client.fetch(`${base}/${key}`);
          const prior = existing.ok ? await existing.text() : "";
          // Din ka log 500KB se bara ho to naya din/overwrite — runaway growth rokni hai.
          const next = prior.length > 500_000 ? `${entry}\n` : `${prior}${entry}\n`;
          await client.fetch(`${base}/${key}`, {
            method: "PUT",
            body: next,
            headers: { "content-type": "text/plain; charset=utf-8" },
          });
        } catch {
          // Telemetry kabhi app ko block nahi karti.
        }
        return Response.json({ ok: true });
      },
    },
  },
});
