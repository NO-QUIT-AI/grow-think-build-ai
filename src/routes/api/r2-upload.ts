import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { r2 } from "@/lib/r2.server";

/** Signed-in users ki images seedha Cloudflare R2 me: images/{userId}/{uuid}.{ext} */
export const Route = createFileRoute("/api/r2-upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!token) return new Response("Unauthorized", { status: 401 });
        const sb = createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data } = await sb.auth.getUser(token);
        const uid = data.user?.id;
        if (!uid) return new Response("Unauthorized", { status: 401 });

        const type = request.headers.get("content-type") ?? "";
        if (!/^image\/(png|jpe?g|webp|gif)$/.test(type)) return new Response("Sirf image", { status: 415 });
        const body = await request.arrayBuffer();
        if (body.byteLength > 10 * 1024 * 1024) return new Response("Too large", { status: 413 });
        const ext = type.split("/")[1]!.replace("jpeg", "jpg");
        const key = `images/${uid}/${crypto.randomUUID()}.${ext}`;
        const { client, base, publicUrl } = r2();
        const res = await client.fetch(`${base}/${key}`, {
          method: "PUT",
          body,
          headers: { "content-type": type },
        });
        if (!res.ok) return new Response(`R2 upload failed (${res.status})`, { status: 502 });
        return Response.json({ key, url: `${publicUrl}/${key}` });
      },
    },
  },
});
