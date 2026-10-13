import { tool } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { r2 } from "@/lib/r2.server";
import { vaultGet } from "@/lib/vault.server";

/** Genesis add-ons: database, image, voiceover, video, docs export, project memory, deploy logs. Owner-only. */

const READ_TABLES = [
  "profiles", "community_posts", "post_comments", "post_likes", "conversations", "messages",
  "knowledge", "memories", "artifacts", "cv_documents", "nqai_wallets", "nqai_mining",
  "nqai_transactions", "referrals", "user_plans", "viral_videos", "notifications", "ad_impressions",
] as const;

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "app";

async function putBytes(key: string, body: BodyInit, type: string) {
  const { client, base, publicUrl } = r2();
  const res = await client.fetch(`${base}/${key}`, { method: "PUT", body, headers: { "content-type": type } });
  if (!res.ok) throw new Error(`R2 save ${res.status}`);
  return publicUrl ? `${publicUrl}/${key}` : key;
}
async function getJson<T>(key: string): Promise<T | null> {
  const { client, base } = r2();
  const res = await client.fetch(`${base}/${key}`);
  return res.ok ? ((await res.json()) as T) : null;
}

export const GENESIS_EXTRA_PROMPT = `GENESIS ADD-ONS:
- Multi-agent flow har bade build me: (1) PLANNER — 3-5 step plan likho, (2) CODER — write_file se files, (3) TESTER — read_file se dobara check karo, deploy ke baad deploy_logs dekho. ERROR aaye to khud padho, edit_file se fix karo, dobara deploy (max 3 baar) — self-improve loop.
- Har project ke shuru me project_memory_get chalao; important decisions project_memory_save me rakho (har project ki memory alag).
- BRAND: user ka style — black background (#000000), cyan accent (#00E5FF), white text, glow buttons. Jab tak user kuch aur na kahe, har website/app me ye theme lagao.
- db_query se database padh sakte ho (sirf read). Naya table chahiye to user ko batao ke owner panel/Lovable se banega.
- generate_image (image), voiceover (ElevenLabs awaaz), generate_video (fal.ai clip, phir video_status), export_doc (CV/invoice/report printable PDF link).
- quick_deploy = ek line me project Vercel par push.`;

export function genesisExtraTools(opts: { lovableKey?: string; deploy: (project: string) => Promise<unknown> }) {
  return {
    db_query: tool({
      description: "Database table se rows padho (read-only). filters: column=value.",
      inputSchema: z.object({
        table: z.enum(READ_TABLES),
        columns: z.string().nullable(),
        filters: z.array(z.object({ column: z.string(), value: z.string() })).nullable(),
        limit: z.number().nullable(),
      }),
      execute: async ({ table, columns, filters, limit }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        let q = (supabaseAdmin as unknown as SupabaseClient).from(table).select(columns || "*");
        for (const f of filters ?? []) q = q.eq(f.column.replace(/[^a-z0-9_]/gi, ""), f.value);
        const { data, error } = await q.limit(Math.min(Math.max(limit ?? 20, 1), 100));
        return error ? { error: error.message } : { rows: data, count: data?.length ?? 0 };
      },
    }),
    generate_image: tool({
      description: "Prompt se image banao aur link do.",
      inputSchema: z.object({ prompt: z.string() }),
      execute: async ({ prompt }) => {
        if (!opts.lovableKey) return { error: "Image AI configured nahi" };
        const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
          method: "POST",
          headers: { "Lovable-API-Key": opts.lovableKey, "X-Lovable-AIG-SDK": "fetch", "content-type": "application/json" },
          body: JSON.stringify({ model: "openai/gpt-image-2.5-sunburst", prompt, n: 1, size: "1024x1024" }),
        });
        const j = (await res.json().catch(() => ({}))) as { data?: { b64_json?: string; url?: string }[]; error?: { message?: string }; message?: string };
        if (!res.ok) return { error: res.status === 402 ? "AI credits khatam" : j.error?.message || j.message || `Image fail ${res.status}` };
        const item = j.data?.[0];
        if (item?.url) return { url: item.url };
        if (!item?.b64_json) return { error: "Image nahi aayi" };
        const bytes = Uint8Array.from(atob(item.b64_json), (c) => c.charCodeAt(0));
        const url = await putBytes(`images/genesis/${Date.now()}-${crypto.randomUUID()}.png`, bytes, "image/png");
        return { url, markdown: `![image](${url})` };
      },
    }),
    voiceover: tool({
      description: "Text ka ElevenLabs voiceover (mp3) banao aur link do.",
      inputSchema: z.object({ text: z.string(), voiceId: z.string().nullable() }),
      execute: async ({ text, voiceId }) => {
        const key = process.env["ELEVENLABS_API_KEY"];
        if (!key) return { error: "ElevenLabs key nahi" };
        const voice = /^[A-Za-z0-9]{10,40}$/.test(voiceId ?? "") ? voiceId! : "pFZP5JQG7iQjIQuC4Bku";
        const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
          method: "POST",
          headers: { "xi-api-key": key, "content-type": "application/json" },
          body: JSON.stringify({ text: text.slice(0, 4000), model_id: "eleven_multilingual_v2", voice_settings: { stability: 0.7, similarity_boost: 0.8 } }),
        });
        if (!res.ok) return { error: `Voice fail (${res.status})` };
        const url = await putBytes(`audio/genesis/${Date.now()}-${crypto.randomUUID()}.mp3`, await res.arrayBuffer(), "audio/mpeg");
        return { url };
      },
    }),
    generate_video: tool({
      description: "fal.ai se chhota video clip shuru karo (text ya image se). Phir video_status se check karo.",
      inputSchema: z.object({ prompt: z.string(), image_url: z.string().nullable() }),
      execute: async ({ prompt, image_url }) => {
        const key = (await vaultGet("FAL_KEY")) ?? "";
        if (!key) return { error: "FAL_KEY nahi" };
        const model = image_url ? "fal-ai/wan/v2.2-a14b/image-to-video" : "fal-ai/wan/v2.2-a14b/text-to-video";
        const res = await fetch(`https://queue.fal.run/${model}`, {
          method: "POST",
          headers: { authorization: `Key ${key}`, "content-type": "application/json" },
          body: JSON.stringify({ prompt, resolution: "480p", ...(image_url ? { image_url } : {}) }),
        });
        const j = (await res.json().catch(() => ({}))) as { request_id?: string; detail?: unknown };
        if (!res.ok) return { error: res.status === 403 || res.status === 402 ? "fal.ai balance khatam — fal.ai/dashboard/billing par top up karo" : `fal ${res.status}: ${JSON.stringify(j.detail ?? j).slice(0, 200)}` };
        return { id: j.request_id, model, next: "video_status chalao" };
      },
    }),
    video_status: tool({
      description: "fal.ai video ka status / final link.",
      inputSchema: z.object({ id: z.string(), model: z.string() }),
      execute: async ({ id, model }) => {
        const key = (await vaultGet("FAL_KEY")) ?? "";
        const base = `https://queue.fal.run/${model.split("/").slice(0, 2).join("/")}/requests/${encodeURIComponent(id)}`;
        const s = (await (await fetch(`${base}/status`, { headers: { authorization: `Key ${key}` } })).json()) as { status?: string };
        if (s.status !== "COMPLETED") return { status: s.status ?? "UNKNOWN" };
        const r = (await (await fetch(base, { headers: { authorization: `Key ${key}` } })).json()) as { video?: { url?: string } };
        return { status: "COMPLETED", url: r.video?.url };
      },
    }),
    export_doc: tool({
      description: "CV / invoice / report ka printable document banao. html = poora styled HTML body. Link khol kar Print → Save as PDF.",
      inputSchema: z.object({ title: z.string(), kind: z.enum(["cv", "invoice", "report", "other"]), html: z.string() }),
      execute: async ({ title, kind, html }) => {
        const doc = `<!doctype html><html><head><meta charset="utf-8"><title>${title.replace(/</g, "")}</title><style>@page{size:A4;margin:16mm}body{font-family:system-ui,sans-serif;color:#111}@media print{.np{display:none}}</style></head><body><button class="np" onclick="print()" style="position:fixed;top:12px;right:12px;padding:10px 16px;background:#00E5FF;border:0;border-radius:8px;font-weight:700">Download PDF</button>${html}</body></html>`;
        const url = await putBytes(`docs/${kind}/${slug(title)}-${Date.now()}.html`, doc, "text/html; charset=utf-8");
        return { url, tip: "Link khol ke Download PDF dabao" };
      },
    }),
    project_memory_get: tool({
      description: "Project ki apni long-term memory padho (har project alag).",
      inputSchema: z.object({ project: z.string() }),
      execute: async ({ project }) => {
        const m = await getJson<{ notes: { at: string; note: string }[] }>(`project-memory/${slug(project)}.json`);
        return { project: slug(project), notes: m?.notes ?? [] };
      },
    }),
    project_memory_save: tool({
      description: "Project ke baare me important baat yaad rakho.",
      inputSchema: z.object({ project: z.string(), note: z.string() }),
      execute: async ({ project, note }) => {
        const key = `project-memory/${slug(project)}.json`;
        const m = (await getJson<{ notes: { at: string; note: string }[] }>(key)) ?? { notes: [] };
        m.notes = [...m.notes, { at: new Date().toISOString(), note: note.slice(0, 1000) }].slice(-60);
        await putBytes(key, JSON.stringify(m), "application/json");
        return { saved: true, total: m.notes.length };
      },
    }),
    deploy_logs: tool({
      description: "Vercel deploy ke build logs/errors padho (self-fix ke liye).",
      inputSchema: z.object({ id: z.string() }),
      execute: async ({ id }) => {
        const token = await vaultGet("VERCEL_TOKEN");
        if (!token) return { error: "VERCEL_TOKEN nahi" };
        const res = await fetch(`https://api.vercel.com/v3/deployments/${encodeURIComponent(id)}/events?limit=200`, { headers: { authorization: `Bearer ${token}` } });
        const ev = (await res.json().catch(() => [])) as { type?: string; text?: string; payload?: { text?: string } }[];
        const lines = (Array.isArray(ev) ? ev : []).map((e) => e.text ?? e.payload?.text ?? "").filter(Boolean);
        const errors = lines.filter((l) => /error|failed|cannot|not found/i.test(l));
        return { errors: errors.slice(-20), tail: lines.slice(-30) };
      },
    }),
    quick_deploy: tool({
      description: "Ek line me project Vercel par push karo.",
      inputSchema: z.object({ project: z.string() }),
      execute: async ({ project }) => opts.deploy(project),
    }),
  };
}
