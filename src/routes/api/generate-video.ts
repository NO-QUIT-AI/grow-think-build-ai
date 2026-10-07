import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { userFromRequest } from "@/lib/auth-user.server";

/**
 * fal.ai video jobs — FAL_KEY sirf server pe.
 * kind "avatar": photo → video (Wan 2.2). kind "intro": viral build intro (Runway via fal), sirf Pro.
 * POST {kind, image_url, prompt} → {request_id}. GET ?kind=&id= → {status, video_url?}
 */
const MODELS = {
  avatar: "fal-ai/wan/v2.2-a14b/image-to-video",
  intro: "fal-ai/runway-gen3/turbo/image-to-video",
} as const;
type Kind = keyof typeof MODELS;
const appId = (k: Kind) => MODELS[k].split("/").slice(0, 2).join("/");

const PostSchema = z.object({
  kind: z.enum(["avatar", "intro"]),
  image_url: z.string().url().startsWith("https://").max(2000),
  prompt: z.string().min(3).max(1000),
});

async function isPro(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("user_plans").select("plan").eq("user_id", userId).maybeSingle();
  return data?.plan === "pro";
}

function falHeaders() {
  const key = process.env["FAL_KEY"];
  if (!key) throw new Error("FAL_KEY missing");
  return { Authorization: `Key ${key}`, "content-type": "application/json" };
}

export const Route = createFileRoute("/api/generate-video")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await userFromRequest(request);
        if (!user) return new Response("Unauthorized", { status: 401 });
        const parsed = PostSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });
        const { kind, image_url, prompt } = parsed.data;
        if (kind === "intro" && !(await isPro(user.id)))
          return Response.json({ error: "Intro clip sirf Pro users ke liye hai" }, { status: 403 });

        const body = kind === "intro" ? { prompt, image_url, duration: 5 } : { prompt, image_url };
        const res = await fetch(`https://queue.fal.run/${MODELS[kind]}`, {
          method: "POST",
          headers: falHeaders(),
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const t = await res.text();
          console.error(`fal submit failed [${res.status}]: ${t}`);
          return Response.json({ error: `Video service error (${res.status})`, detail: t.slice(0, 300) }, { status: res.status === 401 || res.status === 403 ? 502 : res.status });
        }
        const j = (await res.json()) as { request_id: string };
        return Response.json({ request_id: j.request_id, kind });
      },
      GET: async ({ request }) => {
        const user = await userFromRequest(request);
        if (!user) return new Response("Unauthorized", { status: 401 });
        const u = new URL(request.url);
        const kind = u.searchParams.get("kind") as Kind | null;
        const id = u.searchParams.get("id") ?? "";
        if (!kind || !(kind in MODELS) || !/^[0-9a-zA-Z-]{8,64}$/.test(id))
          return Response.json({ error: "Invalid input" }, { status: 400 });

        const base = `https://queue.fal.run/${appId(kind)}/requests/${id}`;
        const s = await fetch(`${base}/status`, { headers: falHeaders() });
        if (!s.ok) return Response.json({ error: `Status error (${s.status})` }, { status: 502 });
        const st = (await s.json()) as { status: string };
        if (st.status !== "COMPLETED") return Response.json({ status: st.status });

        const r = await fetch(base, { headers: falHeaders() });
        if (!r.ok) return Response.json({ status: "FAILED", error: `Result error (${r.status})` }, { status: 502 });
        const out = (await r.json()) as { video?: { url?: string } };
        return Response.json({ status: "COMPLETED", video_url: out.video?.url ?? null });
      },
    },
  },
});
