import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { r2 } from "@/lib/r2.server";

/** CV data ab user ke Cloudflare R2 bucket me save hota hai: database/cvs/{userId}/{id}.json */

async function userIdFrom(request: Request): Promise<string | null> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const sb = createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data } = await sb.auth.getUser(token);
  return data.user?.id ?? null;
}

const ID = /^[a-zA-Z0-9-]{8,64}$/;

export const Route = createFileRoute("/api/cv-store")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const uid = await userIdFrom(request);
        if (!uid) return new Response("Unauthorized", { status: 401 });
        const { client, base } = r2();
        const prefix = `database/cvs/${uid}/`;
        const res = await client.fetch(`${base}?list-type=2&prefix=${encodeURIComponent(prefix)}&max-keys=200`);
        if (!res.ok) return new Response(`R2 list failed (${res.status})`, { status: 502 });
        const keys = [...(await res.text()).matchAll(/<Key>(.*?)<\/Key>/g)].map((m) => m[1]!);
        const rows = await Promise.all(
          keys.map(async (key) => {
            const r = await client.fetch(`${base}/${key}`);
            return r.ok ? await r.json() : null;
          }),
        );
        return Response.json({ cvs: rows.filter(Boolean) });
      },
      PUT: async ({ request }) => {
        const uid = await userIdFrom(request);
        if (!uid) return new Response("Unauthorized", { status: 401 });
        const body = (await request.json()) as { id?: string; title?: string; data?: unknown };
        const id = body.id && ID.test(body.id) ? body.id : crypto.randomUUID();
        const record = {
          id,
          title: String(body.title ?? "Mera CV").slice(0, 120),
          data: body.data ?? {},
          updated_at: new Date().toISOString(),
        };
        const payload = JSON.stringify(record);
        if (payload.length > 5 * 1024 * 1024) return new Response("CV bohat bara hai", { status: 413 });
        const { client, base } = r2();
        const res = await client.fetch(`${base}/database/cvs/${uid}/${id}.json`, {
          method: "PUT",
          body: payload,
          headers: { "content-type": "application/json" },
        });
        if (!res.ok) return new Response(`R2 save failed (${res.status})`, { status: 502 });
        return Response.json({ id });
      },
      DELETE: async ({ request }) => {
        const uid = await userIdFrom(request);
        if (!uid) return new Response("Unauthorized", { status: 401 });
        const id = new URL(request.url).searchParams.get("id") ?? "";
        if (!ID.test(id)) return new Response("Bad id", { status: 400 });
        const { client, base } = r2();
        const res = await client.fetch(`${base}/database/cvs/${uid}/${id}.json`, { method: "DELETE" });
        if (!res.ok && res.status !== 404) return new Response(`R2 delete failed (${res.status})`, { status: 502 });
        return Response.json({ ok: true });
      },
    },
  },
});
