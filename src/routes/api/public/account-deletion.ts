import { createFileRoute } from "@tanstack/react-router";

/**
 * Account deletion requests (Play Console policy): public endpoint, isliye
 * sirf validated email + optional note accept hota hai. Requests owner ke
 * liye R2 me append hote hain; actual deletion owner verify karke karta hai.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_NOTE = 500;

export const Route = createFileRoute("/api/public/account-deletion")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { email?: unknown; note?: unknown };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return Response.json({ ok: false, error: "invalid_body" }, { status: 400 });
        }
        const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
        if (!EMAIL_RE.test(email) || email.length > 255) {
          return Response.json({ ok: false, error: "invalid_email" }, { status: 400 });
        }
        const note = typeof body.note === "string" ? body.note.slice(0, MAX_NOTE) : undefined;

        const entry = JSON.stringify({
          at: new Date().toISOString(),
          email,
          note,
        });

        try {
          const { r2 } = await import("@/lib/r2.server");
          const { client, base } = r2();
          const day = new Date().toISOString().slice(0, 10);
          const key = `telemetry/deletion-requests-${day}.jsonl`;
          const existing = await client.fetch(`${base}/${key}`);
          const prior = existing.ok ? await existing.text() : "";
          const next = prior.length > 500_000 ? `${entry}\n` : `${prior}${entry}\n`;
          await client.fetch(`${base}/${key}`, {
            method: "PUT",
            body: next,
            headers: { "content-type": "text/plain; charset=utf-8" },
          });
        } catch {
          // Storage fail ho to bhi user ko 200 — request email fallback se bhi aa sakti hai.
        }
        return Response.json({ ok: true });
      },
    },
  },
});
