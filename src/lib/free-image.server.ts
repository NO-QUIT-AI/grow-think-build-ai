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

export function pollinationsUrl(prompt: string, seed = Math.floor(Math.random() * 1e9)) {
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&model=flux&enhance=true&nologo=true&seed=${seed}`;
}

export async function generateImageFree(prompt: string) {
  const enhanced = await enhanceImagePrompt(prompt);
  return { prompt: enhanced, url: pollinationsUrl(enhanced) };
}
