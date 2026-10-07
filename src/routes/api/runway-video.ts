import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requirePro } from "@/lib/pro-user.server";

/** Viral build intro via Runway gen4_turbo (5s). Pro only, RUNWAYML_API_SECRET server-side. */
const API = "https://api.dev.runwayml.com/v1";

const Body = z.object({
  image_url: z.string().url().startsWith("https://").max(2000),
  prompt: z.string().min(3).max(1000),
});

function headers() {
  const key = process.env["RUNWAYML_API_SECRET"];
  if (!key) throw new Error("RUNWAYML_API_SECRET missing");
  return { Authorization: `Bearer ${key}`, "X-Runway-Version": "2024-11-06", "content-type": "application/json" };
}

export const Route = createFileRoute("/api/runway-video")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const pro = await requirePro(request);
        if (pro instanceof Response) return pro;
        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });
        const res = await fetch(`${API}/image_to_video`, {
          method: "POST",
          headers: headers(),
          body: JSON.stringify({
            model: "gen4_turbo",
            promptImage: parsed.data.image_url,
            promptText: parsed.data.prompt,
            ratio: "720:1280",
            duration: 5,
          }),
        });
        if (!res.ok) {
          const t = await res.text();
          console.error(`runway submit failed [${res.status}]: ${t}`);
          return Response.json({ error: `Runway error (${res.status})`, detail: t.slice(0, 300) }, { status: 502 });
        }
        const j = (await res.json()) as { id: string };
        return Response.json({ id: j.id });
      },
      GET: async ({ request }) => {
        const pro = await requirePro(request);
        if (pro instanceof Response) return pro;
        const id = new URL(request.url).searchParams.get("id") ?? "";
        if (!/^[0-9a-zA-Z-]{8,64}$/.test(id)) return Response.json({ error: "Invalid input" }, { status: 400 });
        const r = await fetch(`${API}/tasks/${id}`, { headers: headers() });
        if (!r.ok) return Response.json({ error: `Status error (${r.status})` }, { status: 502 });
        const t = (await r.json()) as { status: string; output?: string[] };
        if (t.status === "SUCCEEDED") return Response.json({ status: "COMPLETED", video_url: t.output?.[0] ?? null });
        if (t.status === "FAILED" || t.status === "CANCELLED") return Response.json({ status: "FAILED" });
        return Response.json({ status: t.status });
      },
    },
  },
});
