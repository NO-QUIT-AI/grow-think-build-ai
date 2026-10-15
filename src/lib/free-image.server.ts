/** Free image generation: prompt enhance (DeepSeek → Groq Llama 3.3) + Pollinations (no key). */
async function enhanceWith(url: string, key: string, model: string, prompt: string) {
  const res = await fetch(url, {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "Convert the user's idea (any language) into ONE detailed English image prompt, max 60 words: subject, style, lighting, quality (ultra realistic, 4k, sharp focus). Reply with the prompt only.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`${model} ${res.status}`);
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = json.choices?.[0]?.message?.content?.trim().replace(/^["']|["']$/g, "");
  if (!text) throw new Error("empty");
  return text.slice(0, 500);
}

export async function enhanceImagePrompt(prompt: string) {
  const ds = process.env["DEEPSEEK_API_KEY"];
  const groq = process.env["GROQ_API_KEY"];
  if (ds) {
    try { return await enhanceWith("https://api.deepseek.com/chat/completions", ds, "deepseek-chat", prompt); }
    catch (e) { console.error("[free-image] deepseek", e); }
  }
  if (groq) {
    try { return await enhanceWith("https://api.groq.com/openai/v1/chat/completions", groq, "llama-3.3-70b-versatile", prompt); }
    catch (e) { console.error("[free-image] groq", e); }
  }
  return `${prompt}, ultra realistic, 4k, cinematic lighting, sharp focus`;
}

export function pollinationsUrl(prompt: string, model: "flux" | "turbo" = "flux", seed = Math.floor(Math.random() * 1e9)) {
  const extra = model === "flux" ? "&enhance=true" : "";
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&model=${model}&nologo=true${extra}&seed=${seed}`;
}

/** Client tries these in order (each user's own IP limit). Last one is our server proxy. */
export async function generateImageFree(prompt: string) {
  const enhanced = await enhanceImagePrompt(prompt);
  const urls = [
    pollinationsUrl(enhanced, "flux"),
    pollinationsUrl(enhanced, "turbo"),
    `/api/free-image?prompt=${encodeURIComponent(enhanced)}`,
  ];
  return { prompt: enhanced, url: urls[0], urls };
}

/** Server fallback: Pollinations with POLLINATIONS_TOKEN (if set), then HuggingFace FLUX.1-schnell. */
export async function serverImage(prompt: string): Promise<Response> {
  const token = process.env["POLLINATIONS_TOKEN"];
  if (token) {
    try {
      const r = await fetch(pollinationsUrl(prompt, "flux"), { headers: { authorization: `Bearer ${token}` } });
      if (r.ok && r.headers.get("content-type")?.startsWith("image/")) return r;
      console.error("[free-image] pollinations token", r.status);
    } catch (e) { console.error("[free-image] pollinations token", e); }
  }
  const hf = process.env["HUGGINGFACE_API_KEY"];
  const headers: Record<string, string> = { "content-type": "application/json", accept: "image/png" };
  if (hf) headers["authorization"] = `Bearer ${hf}`;
  // api-inference.huggingface.co is retired; router is the current free endpoint.
  const r = await fetch("https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell", {
    method: "POST", headers, body: JSON.stringify({ inputs: prompt }),
  });
  if (!r.ok || !r.headers.get("content-type")?.startsWith("image/")) {
    console.error("[free-image] huggingface", r.status, (await r.text()).slice(0, 200));
    return new Response("All free image providers failed", { status: 502 });
  }
  return r;
}
