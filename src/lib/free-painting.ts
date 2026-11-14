/** Public ZeroGPU Space: no owner token or paid inference API. */
export const PAINTING_SPACE = "https://black-forest-labs-flux-1-schnell.hf.space";
export const SPACE_TIMEOUT_MS = 25_000;

export function freePaintingSources(prompt: string) {
  return ["flux", "turbo"].map(model =>
    `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&model=${model}&nologo=true`,
  );
}

export async function paintingFromSpace(prompt: string, signal?: AbortSignal): Promise<string> {
  const bounded = AbortSignal.any([AbortSignal.timeout(SPACE_TIMEOUT_MS), ...(signal ? [signal] : [])]);
  const started = await fetch(`${PAINTING_SPACE}/gradio_api/call/infer`, {
    method: "POST", signal: bounded,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ data: [prompt.slice(0, 1000), 0, true, 1024, 1024, 4] }),
  });
  if (!started.ok) throw new Error(`Hugging Face Space: ${started.status}`);
  const job = await started.json() as { event_id?: string };
  if (!job.event_id || !/^[a-zA-Z0-9_-]+$/.test(job.event_id)) throw new Error("Space queue unavailable");
  const result = await fetch(`${PAINTING_SPACE}/gradio_api/call/infer/${job.event_id}`, { signal: bounded });
  if (!result.ok) throw new Error(`Hugging Face Space: ${result.status}`);
  const reader = result.body?.getReader();
  if (!reader) throw new Error("Space stream unavailable");
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true }).replace(/\r/g, "");
      let boundary = buffer.indexOf("\n\n");
      while (boundary >= 0) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        if (/^event: error/m.test(block)) throw new Error("Free Space busy or quota exhausted");
        if (/^event: complete/m.test(block)) {
          const data = block.split("\n").filter(line => line.startsWith("data: ")).map(line => line.slice(6)).join("\n");
          const output = JSON.parse(data) as [{ url?: string }];
          const url = output[0]?.url;
          if (!url || new URL(url).origin !== PAINTING_SPACE) throw new Error("Invalid Space image");
          return url;
        }
        boundary = buffer.indexOf("\n\n");
      }
    }
    throw new Error("Space returned no image");
  } finally { await reader.cancel().catch(() => undefined); }
}