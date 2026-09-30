import { createFileRoute } from "@tanstack/react-router";
import { r2 } from "@/lib/r2.server";

const MAX = 100 * 1024 * 1024;

export const Route = createFileRoute("/api/public/r2-video")({
  server: {
    handlers: {
      GET: async () => {
        const { client, base, publicUrl } = r2();
        const res = await client.fetch(`${base}?list-type=2&prefix=videos/&max-keys=100`);
        const xml = await res.text();
        if (!res.ok) return Response.json({ error: `R2 list failed (${res.status})` }, { status: 502 });
        const files = [...xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)].map((m) => {
          const c = m[1] ?? "";
          const key = /<Key>(.*?)<\/Key>/.exec(c)?.[1] ?? "";
          const size = Number(/<Size>(.*?)<\/Size>/.exec(c)?.[1] ?? 0);
          const uploaded = /<LastModified>(.*?)<\/LastModified>/.exec(c)?.[1] ?? "";
          return { key, name: key.replace(/^videos\/\d+-/, ""), size, uploaded, url: `${publicUrl}/${key}` };
        });
        files.sort((a, b) => b.uploaded.localeCompare(a.uploaded));
        return Response.json({ files });
      },
      POST: async ({ request }) => {
        const len = Number(request.headers.get("content-length") ?? 0);
        if (!len || len > MAX) return Response.json({ error: "Video 100MB se chhoti honi chahiye" }, { status: 413 });
        const type = request.headers.get("content-type") ?? "";
        if (!type.startsWith("video/")) return Response.json({ error: "Sirf video file" }, { status: 400 });
        const raw = request.headers.get("x-file-name") ?? "video.mp4";
        const safe = decodeURIComponent(raw).replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80) || "video.mp4";
        const key = `videos/${Date.now()}-${safe}`;
        const { client, base, publicUrl } = r2();
        const body = await request.arrayBuffer();
        const res = await client.fetch(`${base}/${key}`, { method: "PUT", body, headers: { "content-type": type } });
        if (!res.ok) return Response.json({ error: `R2 upload failed (${res.status}): ${(await res.text()).slice(0, 200)}` }, { status: 502 });
        return Response.json({ key, name: safe, size: body.byteLength, url: `${publicUrl}/${key}` });
      },
    },
  },
});
