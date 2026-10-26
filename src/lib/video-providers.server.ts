import { vaultGet } from "@/lib/vault.server";
import { r2 } from "@/lib/r2.server";

/**
 * Free-first video provider chain (Lovable-clone update 3):
 *   1. FAL (paid, if key exists)
 *   2. HuggingFace Inference (HF_TOKEN — free tier)
 *   3. Google AI Studio Veo (GOOGLE_AI_KEY — free quota)
 *   4. Pollinations poster image (always free) as honest fallback
 * Ek bhi key na ho to chain khud agle provider par chali jati hai.
 */

export type VideoStart =
  | { provider: "fal" | "veo"; requestId: string; model: string }
  | { provider: "huggingface" | "pollinations"; url: string; done: true }
  | { error: string };

async function tryFal(prompt: string, imageUrl: string | null): Promise<VideoStart | null> {
  const key = (await vaultGet("FAL_KEY")) ?? "";
  if (!key) return null;
  const model = imageUrl ? "fal-ai/wan/v2.2-a14b/image-to-video" : "fal-ai/wan/v2.2-a14b/text-to-video";
  const res = await fetch(`https://queue.fal.run/${model}`, {
    method: "POST",
    headers: { authorization: `Key ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ prompt, resolution: "480p", ...(imageUrl ? { image_url: imageUrl } : {}) }),
  });
  const j = (await res.json().catch(() => ({}))) as { request_id?: string };
  if (!res.ok || !j.request_id) return null;
  return { provider: "fal", requestId: j.request_id, model };
}

async function tryHuggingFace(prompt: string): Promise<VideoStart | null> {
  const key = process.env["HF_TOKEN"] ?? (await vaultGet("HF_TOKEN")) ?? "";
  if (!key) return null;
  const res = await fetch("https://api-inference.huggingface.co/models/damo-vilab/text-to-video-synthesis", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ inputs: prompt.slice(0, 500) }),
  });
  if (!res.ok) return null;
  const type = res.headers.get("content-type") ?? "";
  if (!type.includes("video") && !type.includes("octet-stream")) return null;
  const bytes = await res.arrayBuffer();
  if (bytes.byteLength < 10_000) return null;
  const { client, base, publicUrl } = r2();
  const key2 = `videos/free/${Date.now()}-${crypto.randomUUID()}.mp4`;
  const put = await client.fetch(`${base}/${key2}`, { method: "PUT", body: bytes, headers: { "content-type": "video/mp4" } });
  if (!put.ok) return null;
  return { provider: "huggingface", url: publicUrl ? `${publicUrl}/${key2}` : key2, done: true };
}

async function tryVeo(prompt: string): Promise<VideoStart | null> {
  const key = process.env["GOOGLE_AI_KEY"] ?? (await vaultGet("GOOGLE_AI_KEY")) ?? "";
  if (!key) return null;
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/veo-2.0-generate-001:predictLongRunning?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ instances: [{ prompt: prompt.slice(0, 500) }], parameters: { aspectRatio: "16:9" } }),
    },
  );
  const j = (await res.json().catch(() => ({}))) as { name?: string };
  if (!res.ok || !j.name) return null;
  return { provider: "veo", requestId: j.name, model: "veo-2.0-generate-001" };
}

async function pollinationsPoster(prompt: string): Promise<VideoStart> {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt.slice(0, 300))}?width=1280&height=720&nologo=true`;
  return {
    provider: "pollinations",
    url,
    done: true,
  };
}

/** Chain chalao: FAL → HuggingFace → Veo → Pollinations poster. */
export async function startVideoGeneration(prompt: string, imageUrl: string | null): Promise<VideoStart> {
  const tried: string[] = [];
  const fal = await tryFal(prompt, imageUrl).catch(() => null);
  if (fal) return fal;
  tried.push("fal");
  if (!imageUrl) {
    const hf = await tryHuggingFace(prompt).catch(() => null);
    if (hf) return hf;
    tried.push("huggingface");
    const veo = await tryVeo(prompt).catch(() => null);
    if (veo) return veo;
    tried.push("veo");
  }
  const poster = await pollinationsPoster(prompt);
  return { ...poster, note: `Video providers (${tried.join(", ")}) unavailable — free poster image di hai. HF_TOKEN ya GOOGLE_AI_KEY vault me daalo to unlimited free videos.` } as VideoStart;
}

export async function checkVideoGeneration(payload: {
  provider: string;
  requestId: string;
  model?: string;
}): Promise<{ status: "running" | "done" | "error"; url?: string; error?: string }> {
  if (payload.provider === "fal") {
    const key = (await vaultGet("FAL_KEY")) ?? "";
    const base = `https://queue.fal.run/${(payload.model ?? "").split("/").slice(0, 2).join("/")}/requests/${encodeURIComponent(payload.requestId)}`;
    const s = (await (await fetch(`${base}/status`, { headers: { authorization: `Key ${key}` } })).json().catch(() => ({}))) as { status?: string };
    if (s.status !== "COMPLETED") return { status: s.status === "FAILED" ? "error" : "running", error: s.status === "FAILED" ? "fal failed" : undefined };
    const r = (await (await fetch(base, { headers: { authorization: `Key ${key}` } })).json().catch(() => ({}))) as { video?: { url?: string } };
    return r.video?.url ? { status: "done", url: r.video.url } : { status: "error", error: "fal result empty" };
  }
  if (payload.provider === "veo") {
    const key = process.env["GOOGLE_AI_KEY"] ?? (await vaultGet("GOOGLE_AI_KEY")) ?? "";
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/${payload.requestId}?key=${encodeURIComponent(key)}`);
    const j = (await res.json().catch(() => ({}))) as {
      done?: boolean;
      error?: { message?: string };
      response?: { generateVideoResponse?: { generatedSamples?: { video?: { uri?: string } }[] } };
    };
    if (j.error) return { status: "error", error: j.error.message ?? "veo error" };
    if (!j.done) return { status: "running" };
    const uri = j.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
    return uri ? { status: "done", url: uri } : { status: "error", error: "veo result empty" };
  }
  return { status: "error", error: "Unknown provider" };
}
