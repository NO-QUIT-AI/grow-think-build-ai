import { tool } from "ai";
import { z } from "zod";
import { vaultGet } from "@/lib/vault.server";

/**
 * Owner Vercel domain tools + durable permission grants + tool audit log.
 * Token/IDs come only from the vault (VERCEL_TOKEN, VERCEL_PROJECT_ID, VERCEL_TEAM_ID); values never returned.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = any;
export type Scope = "deploy" | "domain";
export const SCOPED_TOOLS: Record<string, Scope> = {
  vercel_deploy: "deploy",
  rollback_deploy: "deploy",
  vercel_add_domain: "domain",
};

export function cleanDomain(d: string) {
  const v = d.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!/^(?=.{3,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(v)) throw new Error("Invalid domain");
  return v;
}

async function vq(path: string, init?: RequestInit) {
  const token = await vaultGet("VERCEL_TOKEN");
  if (!token) throw new Error("VERCEL_TOKEN vault me nahi — request_secret('VERCEL_TOKEN') chalao.");
  const team = await vaultGet("VERCEL_TEAM_ID");
  const url = new URL(`https://api.vercel.com${path}`);
  if (team) url.searchParams.set("teamId", team);
  const res = await fetch(url, { ...init, headers: { authorization: `Bearer ${token}`, "content-type": "application/json" } });
  const json = (await res.json().catch(() => ({}))) as Record<string, any>;
  return { ok: res.ok, status: res.status, json };
}

async function projectRef(project: string | null) {
  if (project && project.trim()) {
    const p = project.trim();
    return /^prj_/.test(p) ? p : `nqai-${p.toLowerCase().replace(/[^a-z0-9-]/g, "-")}`;
  }
  const id = await vaultGet("VERCEL_PROJECT_ID");
  if (!id) throw new Error("Project do ya VERCEL_PROJECT_ID vault me save karo.");
  return id;
}

/** DNS records the user must set at their registrar. */
export function dnsRecordsFor(domain: string, apexA = "76.76.21.21", cname = "cname.vercel-dns.com") {
  const apex = domain.split(".").length === 2;
  return apex
    ? [{ type: "A", name: "@", value: apexA }]
    : [{ type: "CNAME", name: domain.split(".").slice(0, -2).join("."), value: cname }];
}

export async function hasGrant(sb: Sb, userId: string, scope: Scope) {
  const { data } = await sb.from("tool_permission_grants").select("scope").eq("user_id", userId).eq("scope", scope).maybeSingle();
  return !!data;
}

const redact = (v: unknown) => {
  try {
    const s = JSON.stringify(v ?? null).replace(/(token|secret|password|key)"\s*:\s*"[^"]*"/gi, '$1":"[redacted]"');
    return JSON.parse(s.length > 8000 ? JSON.stringify(s.slice(0, 8000)) : s);
  } catch { return null; }
};

/** Wraps every tool: audit log row per call + permission gate for deploy/domain tools. */
export function withAuditAndGrants<T extends Record<string, any>>(tools: T, sb: Sb, userId: string): T {
  const out: Record<string, any> = {};
  for (const [name, t] of Object.entries(tools)) {
    if (!t || typeof t.execute !== "function") { out[name] = t; continue; }
    const exec = t.execute;
    out[name] = {
      ...t,
      execute: async (input: any, opts: any) => {
        let result: unknown; let ok = true;
        try {
          const scope = SCOPED_TOOLS[name];
          if (scope && !input?.confirm && !(await hasGrant(sb, userId, scope))) {
            result = { needsConfirm: true, scope, message: `${name} chalane se pehle user se OK lo, phir confirm: true ke saath dobara chalao. User "dobara na poocho" kahe to permission_grant(scope: "${scope}") chalao.` };
            return result;
          }
          const { confirm: _c, ...rest } = input ?? {};
          result = await exec(scope ? rest : input, opts);
          return result;
        } catch (e) {
          ok = false; result = { error: e instanceof Error ? e.message : String(e) };
          throw e;
        } finally {
          void sb.from("tool_audit_log").insert({ user_id: userId, tool: name, args: redact(input), result: redact(result), ok }).then(() => {}, () => {});
        }
      },
    };
    // Scoped tools accept optional confirm flag.
    if (SCOPED_TOOLS[name] && t.inputSchema instanceof z.ZodObject) {
      out[name].inputSchema = t.inputSchema.extend({ confirm: z.boolean().nullable().optional() });
    }
  }
  return out as T;
}

export const VERCEL_DOMAIN_PROMPT = `DOMAINS + PERMISSIONS:
- Custom domain lagana ho to vercel_add_domain(project, domain) chalao, phir user ko DNS records batao, phir vercel_check_domain(domain) se live/SSL confirm karo.
- VERCEL_TOKEN na ho to request_secret("VERCEL_TOKEN") — value kabhi chat me nahi.
- Deploy/domain tools needsConfirm dein to user se OK lo. User kahe "deploy/domain ke liye dobara na poocho" to permission_grant chalao; "phir se poocho" par permission_revoke.`;

export function vercelDomainTools(sb: Sb, userId: string) {
  return {
    vercel_add_domain: tool({
      description: "Vercel project par custom domain add karo. DNS records (A/CNAME) wapas deta hai jo user ko registrar par lagane hain. project khali ho to VERCEL_PROJECT_ID.",
      inputSchema: z.object({ project: z.string().nullable(), domain: z.string() }),
      execute: async ({ project, domain }) => {
        const d = cleanDomain(domain);
        const ref = await projectRef(project);
        const add = await vq(`/v10/projects/${encodeURIComponent(ref)}/domains`, { method: "POST", body: JSON.stringify({ name: d }) });
        if (!add.ok && add.json?.error?.code !== "domain_already_in_use") return { error: `Vercel ${add.status}: ${add.json?.error?.message ?? "failed"}` };
        const cfg = await vq(`/v6/domains/${encodeURIComponent(d)}/config`);
        const verification = (add.json?.verification ?? []) as { type: string; domain: string; value: string }[];
        return {
          added: add.ok, domain: d, project: ref,
          dns: dnsRecordsFor(d),
          verification: verification.map((v) => ({ type: v.type, name: v.domain, value: v.value })),
          misconfigured: cfg.json?.misconfigured ?? null,
        };
      },
    }),
    vercel_check_domain: tool({
      description: "Domain ka DNS + SSL status Vercel se check karo — live hai ya nahi.",
      inputSchema: z.object({ domain: z.string(), project: z.string().nullable() }),
      execute: async ({ domain, project }) => {
        const d = cleanDomain(domain);
        const cfg = await vq(`/v6/domains/${encodeURIComponent(d)}/config`);
        let verified: boolean | null = null;
        try {
          const ref = await projectRef(project);
          const pd = await vq(`/v9/projects/${encodeURIComponent(ref)}/domains/${encodeURIComponent(d)}`);
          if (pd.ok) verified = !!pd.json?.verified;
        } catch { /* project optional */ }
        let ssl = false; let httpStatus: number | null = null;
        try { const r = await fetch(`https://${d}`, { method: "HEAD", redirect: "manual" }); ssl = true; httpStatus = r.status; } catch { ssl = false; }
        const dnsOk = cfg.ok && cfg.json?.misconfigured === false;
        return { domain: d, dnsOk, verified, ssl, httpStatus, live: dnsOk && ssl, configuredBy: cfg.json?.configuredBy ?? null, dns: dnsRecordsFor(d) };
      },
    }),
    permission_grant: tool({
      description: "User ne kaha 'dobara na poocho' — scope (deploy/domain) ki permanent permission save karo.",
      inputSchema: z.object({ scope: z.enum(["deploy", "domain"]) }),
      execute: async ({ scope }) => {
        const { error } = await sb.from("tool_permission_grants").upsert({ user_id: userId, scope });
        return error ? { error: error.message } : { granted: scope };
      },
    }),
    permission_revoke: tool({
      description: "Saved permission hatao taake dobara poocha jaye.",
      inputSchema: z.object({ scope: z.enum(["deploy", "domain"]) }),
      execute: async ({ scope }) => {
        await sb.from("tool_permission_grants").delete().eq("user_id", userId).eq("scope", scope);
        return { revoked: scope };
      },
    }),
  };
}
