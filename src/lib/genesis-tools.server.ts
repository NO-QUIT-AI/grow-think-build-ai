import { tool } from "ai";
import { z } from "zod";
import { r2 } from "@/lib/r2.server";
import { vaultGet, vaultList } from "@/lib/vault.server";

/**
 * Genesis owner-only agent powers: project files (R2 project/), undo history,
 * Vercel deploy + rollback, web search, docs reading, secret vault requests.
 * Secret values kabhi tool output me nahi jaate.
 */
const MAX_FILE = 400_000;

const cleanProject = (p: string) => p.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "app";
function cleanPath(p: string) {
  const parts = p.replace(/\\/g, "/").split("/").filter((s) => s && s !== "." && s !== "..");
  if (!parts.length) throw new Error("Invalid path");
  return parts.join("/").slice(0, 200);
}
const fileKey = (project: string, path: string) => `project/${cleanProject(project)}/${cleanPath(path)}`;

async function getText(key: string) {
  const { client, base } = r2();
  const res = await client.fetch(`${base}/${encodeURI(key)}`);
  return res.ok ? await res.text() : null;
}
async function put(key: string, body: string) {
  const { client, base } = r2();
  const res = await client.fetch(`${base}/${encodeURI(key)}`, { method: "PUT", body, headers: { "content-type": "text/plain; charset=utf-8" } });
  if (!res.ok) throw new Error(`R2 write ${res.status}`);
}
async function del(key: string) {
  const { client, base } = r2();
  await client.fetch(`${base}/${encodeURI(key)}`, { method: "DELETE" });
}
async function list(prefix: string) {
  const { client, base } = r2();
  const keys: string[] = [];
  let token = "";
  for (let i = 0; i < 10; i++) {
    const res = await client.fetch(`${base}?list-type=2&prefix=${encodeURIComponent(prefix)}${token ? `&continuation-token=${encodeURIComponent(token)}` : ""}`);
    const xml = await res.text();
    keys.push(...[...xml.matchAll(/<Key>([^<]+)<\/Key>/g)].map((m) => m[1]!.replace(/&amp;/g, "&")));
    const next = xml.match(/<NextContinuationToken>([^<]+)</)?.[1];
    if (!next) break;
    token = next;
  }
  return keys;
}
/** Purani copy history me rakho taake undo ho sake. */
async function snapshot(project: string, path: string) {
  const old = await getText(fileKey(project, path));
  if (old !== null) await put(`project-history/${cleanProject(project)}/${cleanPath(path)}@${Date.now()}`, old);
}

async function vercel(path: string, init?: RequestInit) {
  const token = await vaultGet("VERCEL_TOKEN");
  if (!token) throw new Error("VERCEL_TOKEN vault me nahi — request_secret se mangwao.");
  const res = await fetch(`https://api.vercel.com${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(`Vercel ${res.status}: ${JSON.stringify((json as { error?: unknown }).error ?? json).slice(0, 300)}`);
  return json;
}

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export const GENESIS_PROMPT = `GENESIS MODE (owner): Tum Lovable-style coding agent ho. Tumhare paas asli tools hain — kabhi mat kaho "main files edit/deploy nahi kar sakta".
- "app/website banao" par: list_files dekho, phir write_file se real files likho (project name kebab-case, e.g. index.html, style.css, app.js; React chahiye to package.json + vite setup bhi), phir vercel_deploy chala ke live link do.
- Badlav ke liye read_file + edit_file. Galti ho to undo_file. Purana deploy wapas chahiye to list_deployments + rollback_deploy.
- Latest docs ke liye web_search aur browse_docs.
- Koi API key chahiye to request_secret(name) chalao — user safe box me daalega. Key ki value kabhi chat me mat likho, mat maango ke chat me paste kare. Keys sirf vault se aati hain.
- Terminal (npm install/build) Vercel khud deploy ke waqt chalata hai.
- Har bade kaam ke baad chhota summary + live link do.`;

export function genesisTools() {
  return {
    list_files: tool({
      description: "Project (ya saare projects) ki files list karo. project khali ho to saare projects dikhao.",
      inputSchema: z.object({ project: z.string().nullable() }),
      execute: async ({ project }) => {
        const keys = await list(project ? `project/${cleanProject(project)}/` : "project/");
        if (!project) return { projects: [...new Set(keys.map((k) => k.split("/")[1]))] };
        return { project: cleanProject(project), files: keys.map((k) => k.split("/").slice(2).join("/")) };
      },
    }),
    read_file: tool({
      description: "Project ki ek file padho.",
      inputSchema: z.object({ project: z.string(), path: z.string() }),
      execute: async ({ project, path }) => {
        const text = await getText(fileKey(project, path));
        return text === null ? { error: "File nahi mili" } : { path, content: text.slice(0, 60_000) };
      },
    }),
    write_file: tool({
      description: "Project me file banao ya poori overwrite karo (purani copy undo ke liye save hoti hai).",
      inputSchema: z.object({ project: z.string(), path: z.string(), content: z.string() }),
      execute: async ({ project, path, content }) => {
        if (content.length > MAX_FILE) return { error: "File bohot bari hai, chhoti files me todo." };
        await snapshot(project, path);
        await put(fileKey(project, path), content);
        return { written: cleanPath(path), project: cleanProject(project), bytes: content.length };
      },
    }),
    edit_file: tool({
      description: "File me exact text dhoond ke replace karo.",
      inputSchema: z.object({ project: z.string(), path: z.string(), find: z.string(), replace: z.string() }),
      execute: async ({ project, path, find, replace }) => {
        const key = fileKey(project, path);
        const text = await getText(key);
        if (text === null) return { error: "File nahi mili" };
        if (!text.includes(find)) return { error: "Find wala text file me nahi mila — pehle read_file karo." };
        await snapshot(project, path);
        await put(key, text.replace(find, replace));
        return { edited: cleanPath(path) };
      },
    }),
    delete_file: tool({
      description: "Project se file delete karo (undo_file se wapas aa sakti hai).",
      inputSchema: z.object({ project: z.string(), path: z.string() }),
      execute: async ({ project, path }) => {
        await snapshot(project, path);
        await del(fileKey(project, path));
        return { deleted: cleanPath(path) };
      },
    }),
    undo_file: tool({
      description: "File ka pichla version wapas lao (undo).",
      inputSchema: z.object({ project: z.string(), path: z.string() }),
      execute: async ({ project, path }) => {
        const prefix = `project-history/${cleanProject(project)}/${cleanPath(path)}@`;
        const versions = (await list(prefix)).sort();
        const last = versions.at(-1);
        if (!last) return { error: "Koi purana version nahi" };
        const text = await getText(last);
        if (text === null) return { error: "Version padh nahi saka" };
        await put(fileKey(project, path), text);
        await del(last);
        return { restored: cleanPath(path), from: new Date(Number(last.split("@").pop())).toISOString() };
      },
    }),
    vercel_deploy: tool({
      description: "Project ki saari files Vercel par production deploy karo aur live link do. Vercel khud npm install/build chalata hai.",
      inputSchema: z.object({ project: z.string() }),
      execute: async ({ project }) => {
        const name = cleanProject(project);
        const keys = await list(`project/${name}/`);
        if (!keys.length) return { error: "Project me koi file nahi" };
        const files = await Promise.all(
          keys.map(async (k) => ({ file: k.split("/").slice(2).join("/"), data: (await getText(k)) ?? "" })),
        );
        const hasPkg = files.some((f) => f.file === "package.json");
        const json = await vercel("/v13/deployments?skipAutoDetectionConfirmation=1", {
          method: "POST",
          body: JSON.stringify({
            name: `nqai-${name}`,
            target: "production",
            files,
            projectSettings: hasPkg ? undefined : { framework: null, buildCommand: null, outputDirectory: null, installCommand: null },
          }),
        });
        return {
          deployed: true,
          id: json["id"],
          status: json["readyState"],
          url: `https://${json["url"]}`,
          live: `https://nqai-${name}.vercel.app`,
        };
      },
    }),
    deploy_status: tool({
      description: "Vercel deploy ka status check karo (BUILDING/READY/ERROR).",
      inputSchema: z.object({ id: z.string() }),
      execute: async ({ id }) => {
        const j = await vercel(`/v13/deployments/${encodeURIComponent(id)}`);
        return { status: j["readyState"], url: `https://${j["url"]}` };
      },
    }),
    list_deployments: tool({
      description: "Project ke purane Vercel deploys dikhao (rollback ke liye).",
      inputSchema: z.object({ project: z.string() }),
      execute: async ({ project }) => {
        const j = await vercel(`/v6/deployments?app=nqai-${cleanProject(project)}&limit=10`);
        const deps = (j["deployments"] as { uid: string; url: string; state: string; created: number }[]) ?? [];
        return { deployments: deps.map((d) => ({ id: d.uid, url: `https://${d.url}`, state: d.state, at: new Date(d.created).toISOString() })) };
      },
    }),
    rollback_deploy: tool({
      description: "Purane deploy ko dobara production par lao (rollback).",
      inputSchema: z.object({ project: z.string(), deploymentId: z.string() }),
      execute: async ({ project, deploymentId }) => {
        const j = await vercel("/v13/deployments", {
          method: "POST",
          body: JSON.stringify({ name: `nqai-${cleanProject(project)}`, deploymentId, target: "production" }),
        });
        return { rolledBack: true, url: `https://${j["url"]}`, live: `https://nqai-${cleanProject(project)}.vercel.app` };
      },
    }),
    web_search: tool({
      description: "Internet par search karo (latest docs/info).",
      inputSchema: z.object({ query: z.string() }),
      execute: async ({ query }) => {
        const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
          headers: { "user-agent": "Mozilla/5.0 NQAI-Genesis" },
        });
        const html = await res.text();
        const results = [...html.matchAll(/<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g)]
          .slice(0, 6)
          .map((m) => {
            let url = m[1]!;
            const u = url.match(/uddg=([^&]+)/);
            if (u) url = decodeURIComponent(u[1]!);
            return { title: stripHtml(m[2]!), url, snippet: stripHtml(m[3]!) };
          });
        return results.length ? { results } : { error: `Search se kuch nahi mila (${res.status})` };
      },
    }),
    browse_docs: tool({
      description: "Kisi docs/web page ka text padho.",
      inputSchema: z.object({ url: z.string() }),
      execute: async ({ url }) => {
        if (!/^https?:\/\//.test(url)) return { error: "http(s) URL chahiye" };
        const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 NQAI-Genesis", accept: "text/html,text/plain,text/markdown" } });
        const text = await res.text();
        return { status: res.status, text: stripHtml(text).slice(0, 15_000) };
      },
    }),
    request_secret: tool({
      description: "User se API key safe masked box me mangwao. Value chat me kabhi nahi aati.",
      inputSchema: z.object({ name: z.string(), reason: z.string() }),
      execute: async ({ name, reason }) => {
        const n = name.toUpperCase().replace(/[^A-Z0-9_]/g, "_");
        const have = (await vaultList()).includes(n);
        return { name: n, reason, alreadySaved: have, masked: have ? "••••••••" : null };
      },
    }),
  };
}
