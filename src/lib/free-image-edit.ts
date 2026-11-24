/** Browser-side free image edit via public ZeroGPU Spaces (each user's own free quota; no Lovable credits). */
export const EDIT_SPACES = [
  { base: "https://black-forest-labs-flux-1-kontext-dev.hf.space", data: (f: unknown, p: string) => [f, p, 0, true, 2.5, 28] },
  { base: "https://qwen-qwen-image-edit.hf.space", data: (f: unknown, p: string) => [f, p, 0, true, 4, 30, false] },
] as const;
export const EDIT_TIMEOUT_MS = 120_000;

async function dataUrlToBlob(dataUrl: string) {
  return (await fetch(dataUrl)).blob();
}

async function editOnSpace(space: (typeof EDIT_SPACES)[number], image: Blob, prompt: string, signal: AbortSignal) {
  const form = new FormData();
  form.append("files", image, "input.png");
  const up = await fetch(`${space.base}/gradio_api/upload`, { method: "POST", body: form, signal });
  if (!up.ok) throw new Error(`upload ${up.status}`);
  const [path] = (await up.json()) as string[];
  if (!path) throw new Error("upload failed");
  const file = { path, meta: { _type: "gradio.FileData" } };
  const start = await fetch(`${space.base}/gradio_api/call/infer`, {
    method: "POST", signal, headers: { "content-type": "application/json" },
    body: JSON.stringify({ data: space.data(file, prompt) }),
  });
  if (!start.ok) throw new Error(`queue ${start.status}`);
  const { event_id } = (await start.json()) as { event_id?: string };
  if (!event_id || !/^[\w-]+$/.test(event_id)) throw new Error("queue unavailable");
  const res = await fetch(`${space.base}/gradio_api/call/infer/${event_id}`, { signal });
  const text = await res.text();
  const block = text.replace(/\r/g, "").split("\n\n").find((b) => /^event: complete/m.test(b));
  if (!block) throw new Error("Space busy or quota exhausted");
  const data = block.split("\n").filter((l) => l.startsWith("data: ")).map((l) => l.slice(6)).join("\n");
  const out = JSON.parse(data) as unknown[];
  const first = out[0] as { url?: string } | Array<{ image?: { url?: string } }> | undefined;
  const url = Array.isArray(first) ? first[0]?.image?.url : first?.url;
  if (!url || new URL(url).origin !== space.base) throw new Error("Invalid Space image");
  const img = await fetch(url, { signal });
  if (!img.ok) throw new Error("image download failed");
  const blob = await img.blob();
  return await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("read failed"));
    r.readAsDataURL(blob);
  });
}

export async function freeImageEdit(imageDataUrl: string, prompt: string): Promise<string> {
  const blob = await dataUrlToBlob(imageDataUrl);
  let last: unknown;
  for (const space of EDIT_SPACES) {
    try {
      return await editOnSpace(space, blob, prompt, AbortSignal.timeout(EDIT_TIMEOUT_MS));
    } catch (e) { last = e; console.warn("[free-image-edit]", space.base, e); }
  }
  throw new Error(`Free image edit abhi busy hai, thori dair baad try karo (${last instanceof Error ? last.message : "unknown"})`);
}
