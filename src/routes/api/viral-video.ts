import { createFileRoute } from "@tanstack/react-router";
import { r2 } from "@/lib/r2.server";
import { userFromRequest } from "@/lib/auth-user.server";

/** Build Speedrun video ko R2 videos/viral/{userId}/ me save karta hai aur record banata hai. */
export const Route = createFileRoute("/api/viral-video")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await userFromRequest(request);
        if (!user) return new Response("Unauthorized", { status: 401 });
        const type = (request.headers.get("content-type") ?? "").split(";")[0]!;
        if (!/^video\/(webm|mp4)$/.test(type)) return new Response("Sirf video", { status: 415 });
        const body = await request.arrayBuffer();
        if (body.byteLength > 80 * 1024 * 1024) return new Response("Too large", { status: 413 });

        const title = decodeURIComponent(request.headers.get("x-title") ?? "").slice(0, 120);
        const memoryId = request.headers.get("x-memory-id");
        const ext = type === "video/mp4" ? "mp4" : "webm";
        const key = `videos/viral/${user.id}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

        const { client, base, publicUrl } = r2();
        const res = await client.fetch(`${base}/${key}`, { method: "PUT", body, headers: { "content-type": type } });
        if (!res.ok) return new Response(`R2 upload failed (${res.status})`, { status: 502 });
        const url = `${publicUrl}/${key}`;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: plan } = await supabaseAdmin.from("user_plans").select("plan").eq("user_id", user.id).maybeSingle();
        const pro = plan?.plan === "pro";
        const { data: row } = await supabaseAdmin
          .from("viral_videos")
          .insert({
            user_id: user.id,
            memory_id: memoryId && /^[0-9a-f-]{36}$/.test(memoryId) ? memoryId : null,
            title,
            r2_key: key,
            url,
            watermarked: !pro,
          })
          .select("id")
          .single();
        return Response.json({ id: row?.id, key, url });
      },
    },
  },
});
