// Values are typed only on Vercel's own page; NO QUIT AI builds links with variable NAMES only.
export function isVercelApiRequest(text: string) {
  return /\b(api|env|environment|key|secret)\b/i.test(text) && /\b(add|lagao|laga|daal|dal|set|kro|karo|kar)\b/i.test(text) && /\b(project|vercel|deploy|app)\b/i.test(text) && !/\bgithub\b.*\b(connect|jod)\b/i.test(text);
}

export function cleanEnvNames(raw: string) {
  return [...new Set(raw.split(/[\s,]+/).map(n => n.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "")).filter(n => /^[A-Z_][A-Z0-9_]{0,99}$/.test(n)))].slice(0, 20);
}

export function vercelCloneUrl(repoUrl: string, envNames: string[]) {
  const repo = repoUrl.trim();
  if (!/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/.test(repo)) throw new Error("GitHub repo link sahi dalein, jaise https://github.com/user/project");
  const p = new URLSearchParams({ "repository-url": repo.replace(/\/$/, "") });
  if (envNames.length) { p.set("env", envNames.join(",")); p.set("envDescription", "Paste your API keys here — NO QUIT AI never sees them."); }
  return `https://vercel.com/new/clone?${p.toString()}`;
}

export function vercelProjectUrls(scope: string, project: string) {
  const safe = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
  const base = `https://vercel.com/${safe(scope)}/${safe(project)}`;
  return { env: `${base}/settings/environment-variables`, deployments: `${base}/deployments` };
}
