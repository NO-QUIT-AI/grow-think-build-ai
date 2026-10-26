import { tool } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { r2 } from "@/lib/r2.server";
import { getText, list, writeGenesisFile, cleanProjectName } from "@/lib/genesis-tools.server";

/** Generated types in tables ko over-restrict karti hain; owner tools ke liye untyped admin client. */
async function adminClient(): Promise<SupabaseClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as SupabaseClient;
}

/**
 * Genesis autonomy pack (owner-only): db_write, read_project, write_files,
 * background jobs, cost guard, preview URLs, design self-review, persona,
 * team visibility. Lovable-clone updates 2,4,5,6,7,8,9,12,14.
 */

const MAX_FILE = 400_000;
const MAX_PROJECT_READ = 150_000;

/* ---------- 2. db_write ---------- */

const WRITE_TABLES = {
  users: "profiles",
  wallet: "nqai_wallets",
  posts: "community_posts",
  plans: "user_plans",
  invites: "referrals",
} as const;

const ALLOWED_COLS: Record<(typeof WRITE_TABLES)[keyof typeof WRITE_TABLES], string[]> = {
  profiles: ["id", "display_name", "username", "avatar_url", "bio", "total_apps_built", "reputation_points", "invite_code", "subdomain", "custom_domain", "domain_status"],
  nqai_wallets: ["user_id", "balance", "streak", "last_mined_at", "last_share_at"],
  community_posts: ["id", "user_id", "content", "category", "image_url", "app_link", "likes_count", "comments_count"],
  user_plans: ["user_id", "plan"],
  referrals: ["inviter_id", "invited_user_id"],
};

function pickAllowed(table: string, data: Record<string, unknown>) {
  const allowed = new Set(ALLOWED_COLS[table as keyof typeof ALLOWED_COLS] ?? []);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) if (allowed.has(k)) out[k] = v;
  return out;
}

/* ---------- 5. Cost guard ---------- */

/** Returns a confirmation request object, or null when the call may proceed. */
export function costGate(label: string, cost: string, confirm?: boolean | null) {
  if (confirm) return null;
  return {
    needsConfirm: true,
    cost,
    message: `${label} — approx cost ${cost}. Credit bachane ke liye pehle poocha ja raha hai. OK ho to same tool confirm: true ke saath dobara chalao.`,
  };
}

/* ---------- 6. Background jobs (state stored in R2) ---------- */

type Job = {
  id: string;
  kind: string;
  status: "running" | "done" | "error";
  createdAt: string;
  payload: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: string;
};

const jobKey = (id: string) => `jobs/${id}.json`;

async function saveJob(job: Job) {
  const { client, base } = r2();
  await client.fetch(`${base}/${jobKey(job.id)}`, {
    method: "PUT",
    body: JSON.stringify(job),
    headers: { "content-type": "application/json" },
  });
}

async function loadJob(id: string): Promise<Job | null> {
  const j = await getText(jobKey(id));
  if (!j) return null;
  try {
    return JSON.parse(j) as Job;
  } catch {
    return null;
  }
}

/* ---------- 14. Persona (permanent owner style) ---------- */

const PERSONA_KEY = "project-memory/_persona.json";

export async function loadPersona(): Promise<string> {
  const j = await getText(PERSONA_KEY);
  if (!j) return "";
  try {
    const p = JSON.parse(j) as { style?: string };
    return typeof p.style === "string" ? p.style.slice(0, 2000) : "";
  } catch {
    return "";
  }
}

/* ---------- Tools ---------- */

export const AUTONOMY_PROMPT = `AUTONOMY RULES (owner, sabse upar):
- SELF-FIX LOOP: Koi bhi tool error de to error padho, wajah samjho, input/code fix karo aur dobara chalao — max 5 retries. User se tabhi poocho jab 5 baar ke baad bhi fail ho. Har retry me wahi galti mat dohrao.
- TOOL CHAINING: "banao + deploy + test + report" jaise single command par poori chain khud chalao: write_files → vercel_deploy → deploy_status → design_review → short report. Beech me user se confirmation mat maango (paid cost guard ke siwa).
- COST GUARD: Paid tools (fal video, voiceover, AI image) pehli baar needsConfirm return karte hain — user se OK lekar confirm: true ke saath dobara chalao.
- BACKGROUND JOBS: Video/voice ke lambe kaam start_job se background me shuru karo aur chat jari rakho; result job_status se baad me do.
- MULTI-FILE: 2+ files likhni hon to write_files (ek call me saari), write_file bar bar nahi.
- read_project se poora project ek saath padho, file-by-file nahi.
- persona_save se user ka tone/style hamesha ke liye yaad rakho.`;

export function genesisAutonomyTools() {
  return {
    db_write: tool({
      description:
        "Database me INSERT/UPDATE/DELETE karo (owner-only). tables: users, wallet, posts, plans, invites. update/delete ke liye match do (column=value).",
      inputSchema: z.object({
        table: z.enum(["users", "wallet", "posts", "plans", "invites"]),
        op: z.enum(["insert", "update", "delete"]),
        data: z.record(z.string(), z.unknown()).nullable(),
        match: z.record(z.string(), z.unknown()).nullable(),
      }),
      execute: async ({ table, op, data, match }) => {
        const real = WRITE_TABLES[table];
        const sb = await adminClient();
        const cleanData = data ? pickAllowed(real, data) : {};
        const cleanMatch = match ? pickAllowed(real, match) : {};
        if (op !== "insert" && Object.keys(cleanMatch).length === 0) {
          return { error: "update/delete ke liye match (column=value) lazmi hai — poori table affect na ho." };
        }
        if (op === "insert") {
          if (Object.keys(cleanData).length === 0) return { error: "insert ke liye data do (allowed columns dekho)." };
          const { data: row, error } = await sb.from(real).insert(cleanData).select().single();
          return error ? { error: error.message } : { inserted: true, row };
        }
        let q = op === "update" ? sb.from(real).update(cleanData) : sb.from(real).delete();
        for (const [k, v] of Object.entries(cleanMatch)) q = q.eq(k, v as string);
        const { data: rows, error } = await q.select();
        return error ? { error: error.message } : { ok: true, affected: rows?.length ?? 0 };
      },
    }),

    read_project: tool({
      description: "Poora project ek saath padho — saari files ek hi call me (file-by-file nahi).",
      inputSchema: z.object({ project: z.string() }),
      execute: async ({ project }) => {
        const name = cleanProjectName(project);
        const keys = await list(`project/${name}/`);
        if (!keys.length) return { error: "Project me koi file nahi" };
        const files: Record<string, string> = {};
        let total = 0;
        for (const k of keys.slice(0, 30)) {
          const path = k.split("/").slice(2).join("/");
          const text = (await getText(k)) ?? "";
          const room = MAX_PROJECT_READ - total;
          if (room <= 0) {
            files[path] = "[skipped — project bohot bara, read_file se padho]";
            continue;
          }
          files[path] = text.length > room ? `${text.slice(0, room)}\n…[truncated]` : text;
          total += files[path]!.length;
        }
        return { project: name, fileCount: keys.length, files };
      },
    }),

    write_files: tool({
      description: "Ek hi call me 5-6 files likho (multi-file write). Har file {path, content}.",
      inputSchema: z.object({
        project: z.string(),
        files: z.array(z.object({ path: z.string(), content: z.string() })).min(1).max(8),
      }),
      execute: async ({ project, files }) => {
        const name = cleanProjectName(project);
        const written: string[] = [];
        const errors: string[] = [];
        for (const f of files) {
          try {
            if (f.content.length > MAX_FILE) throw new Error("bohot bari");
            await writeGenesisFile(name, f.path, f.content);
            written.push(f.path);
          } catch (e) {
            errors.push(`${f.path}: ${e instanceof Error ? e.message : "fail"}`);
          }
        }
        return { project: name, written, errors };
      },
    }),

    start_job: tool({
      description:
        "Lamba kaam (video/voiceover) background me shuru karo — chat jari rehti hai. Result job_status se lo.",
      inputSchema: z.object({
        kind: z.enum(["video", "voiceover"]),
        prompt: z.string(),
        image_url: z.string().nullable(),
      }),
      execute: async ({ kind, prompt, image_url }) => {
        const id = crypto.randomUUID();
        const job: Job = { id, kind, status: "running", createdAt: new Date().toISOString(), payload: { prompt, image_url } };
        if (kind === "video") {
          const { startVideoGeneration } = await import("@/lib/video-providers.server");
          const started = await startVideoGeneration(prompt, image_url ?? null);
          if ("error" in started) {
            job.status = "error";
            job.error = started.error;
          } else {
            job.payload = { ...job.payload, ...started };
          }
        } else {
          job.status = "error";
          job.error = "voiceover background abhi supported nahi — voiceover tool seedha use karo.";
        }
        await saveJob(job);
        return { jobId: id, status: job.status, note: "Background me chal raha hai — job_status se check karo." };
      },
    }),

    job_status: tool({
      description: "Background job ka status/result check karo.",
      inputSchema: z.object({ id: z.string() }),
      execute: async ({ id }) => {
        const job = await loadJob(id);
        if (!job) return { error: "Job nahi mili" };
        if (job.status === "running" && job.kind === "video" && job.payload["requestId"]) {
          const { checkVideoGeneration } = await import("@/lib/video-providers.server");
          const res = await checkVideoGeneration(job.payload as { provider: string; requestId: string; model?: string });
          if (res.status === "done") {
            job.status = "done";
            job.result = { url: res.url ?? "" };
          } else if (res.status === "error") {
            job.status = "error";
            job.error = res.error ?? "unknown error";
          }
          await saveJob(job);
        }
        return { id, kind: job.kind, status: job.status, result: job.result ?? null, error: job.error ?? null };
      },
    }),

    preview_url: tool({
      description: "Bina full deploy ke instant live preview URL do (R2 public link).",
      inputSchema: z.object({ project: z.string() }),
      execute: async ({ project }) => {
        const name = cleanProjectName(project);
        const index = await getText(`project/${name}/index.html`);
        if (index === null) return { error: "index.html nahi mili — pehle write_files se banao." };
        const { publicUrl } = r2();
        if (!publicUrl) return { error: "R2 public URL configured nahi" };
        return { preview: `${publicUrl}/project/${name}/index.html`, note: "Ye instant preview hai; production ke liye vercel_deploy." };
      },
    }),

    design_review: tool({
      description:
        "Apni banayi hui site ka self-review: URL ka HTML fetch karke design flaws (viewport, alt tags, contrast, overflow risk) dhoondo aur fix list do.",
      inputSchema: z.object({ url: z.string() }),
      execute: async ({ url }) => {
        if (!/^https?:\/\//.test(url)) return { error: "http(s) URL chahiye" };
        const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 NQAI-DesignReview" } });
        const html = await res.text();
        const issues: string[] = [];
        if (!/name=["']viewport["']/i.test(html)) issues.push("viewport meta missing — mobile layout toot sakta hai");
        const imgs = html.match(/<img\b[^>]*>/gi) ?? [];
        const noAlt = imgs.filter((t) => !/alt=/i.test(t)).length;
        if (noAlt) issues.push(`${noAlt} images me alt missing — accessibility/SEO fix karo`);
        if (!/<title>[^<]+<\/title>/i.test(html)) issues.push("<title> khali ya missing");
        if (/width:\s*\d{4,}px/i.test(html)) issues.push("bohot bari fixed px width — horizontal overflow risk");
        if (/#fff(fff)?\b[^;}]*background|background[^;}]*#fff(fff)?\b/i.test(html) && /color:\s*#fff/i.test(html))
          issues.push("white text on white background ka risk — contrast check karo");
        if (!/media\s*\(/i.test(html) && !/sm:|md:|lg:/i.test(html)) issues.push("responsive breakpoints nahi mile — mobile par check karo");
        return { url, status: res.status, issues, verdict: issues.length ? `${issues.length} flaws mile — fix karo` : "Clean — koi obvious flaw nahi" };
      },
    }),

    list_users: tool({
      description: "Team/admin view: users, unke plans aur builds count dekho (owner-only).",
      inputSchema: z.object({ limit: z.number().nullable() }),
      execute: async ({ limit }) => {
        const sb = await adminClient();
        const [{ data: profiles }, { data: plans }, { data: roles }] = await Promise.all([
          sb.from("profiles").select("id, username, display_name, total_apps_built, reputation_points, created_at").order("created_at", { ascending: false }).limit(Math.min(limit ?? 20, 100)),
          sb.from("user_plans").select("user_id, plan"),
          sb.from("user_roles").select("user_id, role"),
        ]);
        const planMap = new Map((plans ?? []).map((p) => [p.user_id, p.plan]));
        const roleMap = new Map((roles ?? []).map((r) => [r.user_id, r.role]));
        return {
          users: (profiles ?? []).map((p) => ({
            id: p.id,
            name: p.display_name || p.username,
            plan: planMap.get(p.id) ?? "free",
            role: roleMap.get(p.id) ?? "user",
            builds: p.total_apps_built,
            points: p.reputation_points,
          })),
        };
      },
    }),

    persona_save: tool({
      description: "Apna tone/style hamesha ke liye save karo — har future chat me system prompt ka hissa banega.",
      inputSchema: z.object({ style: z.string() }),
      execute: async ({ style }) => {
        const { client, base } = r2();
        await client.fetch(`${base}/${PERSONA_KEY}`, {
          method: "PUT",
          body: JSON.stringify({ style: style.slice(0, 2000), updatedAt: new Date().toISOString() }),
          headers: { "content-type": "application/json" },
        });
        return { saved: true, note: "Ab se har chat me ye style follow hoga." };
      },
    }),
  };
}
