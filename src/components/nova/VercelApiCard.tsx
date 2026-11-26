import { useState } from "react";
import { ExternalLink, Rocket, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cleanEnvNames, vercelCloneUrl, vercelProjectUrls } from "@/lib/vercel-api-setup";

export function VercelApiCard() {
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [names, setNames] = useState("");
  const [scope, setScope] = useState(""); const [project, setProject] = useState("");
  const [repo, setRepo] = useState(""); const [error, setError] = useState("");
  const envs = cleanEnvNames(names);
  const open = (url: string) => window.open(url, "_blank", "noopener,noreferrer");
  const go = (kind: "env" | "deployments" | "new") => {
    setError("");
    try {
      if (kind === "new") { open(vercelCloneUrl(repo, envs)); return; }
      if (!scope.trim() || !project.trim()) throw new Error("Enter both your Vercel team/username and project name.");
      open(vercelProjectUrls(scope, project)[kind]);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };
  return (
    <div className="space-y-3 rounded-xl border border-primary/40 bg-card p-4">
      <p className="text-sm text-muted-foreground">API keys are added directly on Vercel — NO QUIT AI never sees your keys. First, enter the variable names:</p>
      <Input aria-label="API variable names" placeholder="OPENAI_API_KEY, DATABASE_URL" value={names} onChange={e => setNames(e.target.value)} />
      {envs.length > 0 && <p className="text-xs text-primary">Variables: {envs.join(", ")}</p>}
      <div className="flex gap-2">
        <Button size="sm" variant={mode === "existing" ? "default" : "outline"} onClick={() => setMode("existing")}>Existing Vercel project</Button>
        <Button size="sm" variant={mode === "new" ? "default" : "outline"} onClick={() => setMode("new")}>New deploy (from GitHub)</Button>
      </div>
      {mode === "existing" ? <>
        <div className="grid gap-2 sm:grid-cols-2">
          <Input aria-label="Vercel team or username" placeholder="Vercel team / username" value={scope} onChange={e => setScope(e.target.value)} />
          <Input aria-label="Vercel project name" placeholder="Project name" value={project} onChange={e => setProject(e.target.value)} />
        </div>
        <ol className="list-decimal pl-5 text-xs text-muted-foreground"><li>Tap "Add API Keys" to open the Vercel page.</li><li>Paste a value for each name and tap Save.</li><li>Tap "Redeploy & Run", then redeploy the latest deployment.</li></ol>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => go("env")}><KeyRound /> Add API Keys on Vercel</Button>
          <Button size="sm" variant="outline" onClick={() => go("deployments")}><Rocket /> Redeploy & Run</Button>
        </div>
      </> : <>
        <Input aria-label="GitHub repository link" placeholder="https://github.com/user/project" value={repo} onChange={e => setRepo(e.target.value)} />
        <p className="text-xs text-muted-foreground">Vercel will ask for each API key, then deploy your project live.</p>
        <Button size="sm" onClick={() => go("new")}><ExternalLink /> Open Vercel & Deploy</Button>
      </>}
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
