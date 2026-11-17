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

const HF_FLUX_URL = "https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell";
const HF_TIMEOUT_MS = 45_000;

function isImage(res: Response) {
  return res.ok && !!res.headers.get("content-type")?.startsWith("image/");
}

async function tryHuggingFace(prompt: string): Promise<Response | null> {
  const hf = process.env["HUGGINGFACE_API_KEY"];
  const headers: Record<string, string> = { "content-type": "application/json", accept: "image/png" };
  if (hf) headers["authorization"] = `Bearer ${hf}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HF_TIMEOUT_MS);
  try {
    const r = await fetch(HF_FLUX_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({ inputs: prompt }),
      signal: controller.signal,
    });
    if (!isImage(r)) {
      console.error("[free-image] huggingface busy/failed", r.status);
      return null;
    }
    return r;
  } catch (e) {
    console.error("[free-image] huggingface error", e);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function tryPollinations(prompt: string, model: "flux" | "turbo" = "flux"): Promise<Response | null> {
  // Pollinations public tier: no key required. Optional token only raises limits.
  const token = process.env["POLLINATIONS_TOKEN"];
  const headers: Record<string, string> = {};
  if (token) headers["authorization"] = `Bearer ${token}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HF_TIMEOUT_MS);
  try {
    const r = await fetch(pollinationsUrl(prompt, model), { headers, signal: controller.signal });
    if (!isImage(r)) {
      console.error("[free-image] pollinations busy/failed", model, r.status);
      return null;
    }
    return r;
  } catch (e) {
    console.error("[free-image] pollinations error", model, e);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Load-balanced free image generation:
 * 1) Try Hugging Face (FLUX.1-schnell) first.
 * 2) On HF busy/fail/slow, automatically fall back to Pollinations (flux, then turbo).
 * 3) Both providers are 100% free; no Adobe AI / credits involved.
 * The returned Response can be dropped straight into Adobe Express for manual edit.
 */
export async function serverImage(prompt: string): Promise<Response> {
  const clean = prompt.trim().slice(0, 1000);
  const hf = await tryHuggingFace(clean);
  if (hf) return hf;
  const pFlux = await tryPollinations(clean, "flux");
  if (pFlux) return pFlux;
  const pTurbo = await tryPollinations(clean, "turbo");
  if (pTurbo) return pTurbo;
  return new Response("All free image providers failed", { status: 502 });
}

/** Client-tries-in-order hints: HF-first then Pollinations URLs (each user's own IP limit). */
export async function generateImageFree(prompt: string) {
  const enhanced = prompt.trim().slice(0, 1000);
  const primary = `/api/free-image?prompt=${encodeURIComponent(enhanced)}`;
  const urls = [
    primary,
    pollinationsUrl(enhanced, "flux"),
    pollinationsUrl(enhanced, "turbo"),
  ];
  return { prompt: enhanced, url: urls[0], urls, provider: "huggingface-first+" };
}
