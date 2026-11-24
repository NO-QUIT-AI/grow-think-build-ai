import { createFileRoute } from "@tanstack/react-router";

type Body = { image?: string; prompt?: string; lang?: string };

const toDataUrl = async (r: Response) => {
  const type = r.headers.get("content-type") ?? "image/png";
  const bytes = new Uint8Array(await r.arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${type};base64,${btoa(bin)}`;
};
const isImage = (r: Response) => r.ok && (r.headers.get("content-type") ?? "").startsWith("image/");

/** Free image edit: Pollinations Kontext (image-to-image) → Hugging Face instruct-pix2pix. No Lovable credits. */
export const Route = createFileRoute("/api/edit-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { image, prompt, lang } = (await request.json()) as Body;
        const m = image?.match(/^data:(image\/[\w.+-]+);base64,(.+)$/);
        if (!m) return new Response("Image is required", { status: 400 });
        const defaults: Record<string, string> = {
          en: "Improve this image and make it clean and professional.",
          ur: "Improve this image and make it clean and professional.",
          hi: "Improve this image and make it clean and professional.",
          ar: "Improve this image and make it clean and professional.",
        };
        const instruction = ((prompt ?? "").trim() || defaults[lang ?? "en"] || defaults["en"]!).slice(0, 800);
        const bytes = Uint8Array.from(atob(m[2]!), (c) => c.charCodeAt(0));
        if (bytes.length > 8 * 1024 * 1024) return new Response("Image 8MB se choti honi chahiye", { status: 413 });

        // 1) Pollinations Kontext needs a public source URL → temporary R2 upload.
        try {
          const { r2 } = await import("@/lib/r2.server");
          const { client, base, publicUrl } = r2();
          if (publicUrl) {
            const key = `tmp/edit/${crypto.randomUUID()}.${m[1]!.split("/")[1]?.replace("jpeg", "jpg") ?? "png"}`;
            const put = await client.fetch(`${base}/${key}`, { method: "PUT", body: bytes, headers: { "content-type": m[1]! } });
            if (put.ok) {
              const token = process.env["POLLINATIONS_TOKEN"];
              const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(instruction)}?model=kontext&nologo=true&image=${encodeURIComponent(`${publicUrl}/${key}`)}&seed=${Math.floor(Math.random() * 1e9)}`;
              const r = await fetch(url, { headers: token ? { authorization: `Bearer ${token}` } : {}, signal: AbortSignal.timeout(90_000) });
              if (isImage(r)) return Response.json({ image: await toDataUrl(r), provider: "pollinations" });
              console.error("[edit-image] pollinations", r.status, (await r.text()).slice(0, 200));
            }
          }
        } catch (e) { console.error("[edit-image] pollinations", e); }

        // 2) Hugging Face free image-to-image.
        try {
          const hf = process.env["HUGGINGFACE_API_KEY"];
          const headers: Record<string, string> = { "content-type": "application/json", accept: "image/png" };
          if (hf) headers["authorization"] = `Bearer ${hf}`;
          const r = await fetch("https://router.huggingface.co/hf-inference/models/timbrooks/instruct-pix2pix", {
            method: "POST", headers, signal: AbortSignal.timeout(90_000),
            body: JSON.stringify({ inputs: m[2], parameters: { prompt: instruction } }),
          });
          if (isImage(r)) return Response.json({ image: await toDataUrl(r), provider: "huggingface" });
          console.error("[edit-image] huggingface", r.status, (await r.text()).slice(0, 200));
        } catch (e) { console.error("[edit-image] huggingface", e); }

        return new Response("Free image edit abhi busy hai, thori dair baad dobara try karo", { status: 503 });
      },
    },
  },
});
