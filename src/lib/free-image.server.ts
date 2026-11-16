/** Prompt enhancement uses the same direct text-provider fallback. */
export async function enhanceImagePrompt(prompt: string) {
  try {
    const { aiText } = await import("./ai-provider.server");
    return (await aiText("Convert the user's idea into ONE detailed English image prompt, max 60 words. Reply with the prompt only.", prompt)).trim().slice(0, 500);
  } catch { return `${prompt}, ultra realistic, 4k, cinematic lighting, sharp focus`; }
}

export function pollinationsUrl(prompt: string, model: "flux" | "turbo" = "flux", seed = Math.floor(Math.random() * 1e9)) {
  const extra = model === "flux" ? "&enhance=true" : "";
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&model=${model}&nologo=true${extra}&seed=${seed}`;
}

/** Client tries these in order (each user's own IP limit). Last one is our server proxy. */
export async function generateImageFree(prompt: string) {
  // The chat model supplies an English painting prompt; no paid enhancement call.
  const enhanced = prompt.trim().slice(0, 1000);
  const urls = [
    pollinationsUrl(enhanced, "flux"),
    pollinationsUrl(enhanced, "turbo"),
  ];
  return { prompt: enhanced, url: urls[0], urls, provider: "huggingface-space" };
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
