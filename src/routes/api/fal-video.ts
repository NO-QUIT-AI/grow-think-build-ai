import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requirePro } from "@/lib/pro-user.server";

/** Photo → galaxy video via fal Wan 2.2 at 480p (cheap). Pro only, FAL_KEY server-side. */
const MODEL = "fal-ai/wan/v2.2-a14b/image-to-video";
const APP = "fal-ai/wan";
const HF_URL = "https://api-inference.huggingface.co/models/Wan-AI/Wan2.1-T2V-14B";

const Body = z.object({
  image_url: z.string().url().startsWith("https://").max(2000),
  prompt: z.string().min(3).max(1000),
});

function headers() {
  const key = process.env["FAL_KEY"];
  if (!key) throw new Error("FAL_KEY missing");
  return { Authorization: `Key ${key}`, "content-type": "application/json" };
}

export const Route = createFileRoute("/api/fal-video")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const pro = await requirePro(request);
        if (pro instanceof Response) return pro;
        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });
        const hfKey = process.env["HUGGINGFACE_API_KEY"];
        if (hfKey) {
          // Free HuggingFace path (text-to-video). 503 = model loading → wait 20s, retry 3x.
          let res: Response | null = null;
          for (let attempt = 0; attempt <= 3; attempt++) {
            res = await fetch(HF_URL, {
              method: "POST",
              headers: { Authorization: `Bearer ${hfKey}`, "content-type": "application/json" },
              body: JSON.stringify({ inputs: parsed.data.prompt }),
            });
            if (res.status !== 503 || attempt === 3) break;
            await new Promise((r) => setTimeout(r, 20_000));
          }
          if (!res || !res.ok) {
            const t = res ? await res.text() : "";
            console.error(`HF video failed [${res?.status}]: ${t}`);
            return Response.json({ error: `HuggingFace error (${res?.status})`, detail: t.slice(0, 300) }, { status: 502 });
          }
          const bytes = await res.arrayBuffer();
          const { r2 } = await import("@/lib/r2.server");
          const { client, base, publicUrl } = r2();
          const key = `videos/galaxy/${pro.id}/${Date.now()}-${crypto.randomUUID()}.mp4`;
          const up = await client.fetch(`${base}/${key}`, { method: "PUT", body: bytes, headers: { "content-type": "video/mp4" } });
          if (!up.ok) return Response.json({ error: `R2 upload failed (${up.status})` }, { status: 502 });
          return Response.json({ status: "COMPLETED", video_url: `${publicUrl}/${key}`, provider: "huggingface" });
        }
        const res = await fetch(`https://queue.fal.run/${MODEL}`, {
          method: "POST",
          headers: headers(),
          body: JSON.stringify({ ...parsed.data, resolution: "480p" }),
        });
        if (!res.ok) {
          const t = await res.text();
          console.error(`fal submit failed [${res.status}]: ${t}`);
          return Response.json({ error: `fal error (${res.status})`, detail: t.slice(0, 300) }, { status: 502 });
        }
        const j = (await res.json()) as { request_id: string };
        return Response.json({ id: j.request_id });
      },
      GET: async ({ request }) => {
        const pro = await requirePro(request);
        if (pro instanceof Response) return pro;
        const id = new URL(request.url).searchParams.get("id") ?? "";
        if (!/^[0-9a-zA-Z-]{8,64}$/.test(id)) return Response.json({ error: "Invalid input" }, { status: 400 });
        const base = `https://queue.fal.run/${APP}/requests/${id}`;
        const s = await fetch(`${base}/status`, { headers: headers() });
        if (!s.ok) return Response.json({ error: `Status error (${s.status})` }, { status: 502 });
        const st = (await s.json()) as { status: string };
        if (st.status !== "COMPLETED") return Response.json({ status: st.status });
        const r = await fetch(base, { headers: headers() });
        if (!r.ok) return Response.json({ status: "FAILED" }, { status: 502 });
        const out = (await r.json()) as { video?: { url?: string } };
        return Response.json({ status: "COMPLETED", video_url: out.video?.url ?? null });
      },
    },
  },
});
