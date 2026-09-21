import { createFileRoute } from "@tanstack/react-router";

type Body = { image?: string; prompt?: string; lang?: string };

export const Route = createFileRoute("/api/edit-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return new Response("AI is not configured", { status: 500 });

        const { image, prompt, lang } = (await request.json()) as Body;
        if (!image || !image.startsWith("data:image/")) {
          return new Response("Image is required", { status: 400 });
        }
        const defaults: Record<string, string> = {
          en: "Improve this image and make it clean and professional.",
          ur: "اس تصویر کو بہتر، صاف اور پروفیشنل بنائیں۔",
          hi: "इस तस्वीर को बेहतर, साफ़ और पेशेवर बनाएं।",
          ar: "حسّن هذه الصورة واجعلها نظيفة واحترافية.",
        };
        const instruction = (prompt ?? "").trim() || defaults[lang ?? "en"] || defaults.en;

        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-3.1-flash-image",
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: instruction },
                  { type: "image_url", image_url: { url: image } },
                ],
              },
            ],
            modalities: ["image", "text"],
          }),
        });

        if (!upstream.ok) {
          const text = await upstream.text();
          return new Response(text || "Image edit failed", { status: upstream.status });
        }

        const json = (await upstream.json()) as {
          data?: Array<{ b64_json?: string; url?: string }>;
        };
        const first = json.data?.[0];
        const url = first?.b64_json ? `data:image/png;base64,${first.b64_json}` : first?.url;
        if (!url) return new Response("Model ne image return nahi ki", { status: 502 });

        return new Response(JSON.stringify({ image: url }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
