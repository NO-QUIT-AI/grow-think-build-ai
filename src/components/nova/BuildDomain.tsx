import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink, Globe, Loader2, Pencil, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

/**
 * Flip to true once *.noquitai.com wildcard DNS + hosting actually serves
 * subdomains. Until then, shared links use the path URL so they never 404.
 */
export const SUBDOMAINS_LIVE = false;

export function liveUrls(sub: string) {
  const pretty = `https://${sub}.noquitai.com`;
  const working = `https://noquitai.com/s/${sub}`;
  return { pretty, working, share: SUBDOMAINS_LIVE ? pretty : working };
}

export async function checkSubdomainAvailability(sub: string): Promise<boolean> {
  const { data } = await supabase.rpc("check_subdomain_availability", { _subdomain: sub });
  return data === true;
}

export function BuildDomain({
  buildId,
  subdomain,
  edits,
  onChange,
}: {
  buildId: string;
  subdomain: string | null;
  edits: number;
  onChange: (sub: string, edits: number) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [avail, setAvail] = useState<null | boolean | "checking">(null);

  useEffect(() => {
    if (!editing) return;
    const v = value.trim().toLowerCase();
    if (v.length < 3) { setAvail(null); return; }
    setAvail("checking");
    const t = setTimeout(() => void checkSubdomainAvailability(v).then(setAvail), 350);
    return () => clearTimeout(t);
  }, [value, editing]);

  async function publish() {
    setBusy(true);
    const { data, error } = await supabase.rpc("publish_build", { _build_id: buildId });
    setBusy(false);
    if (error || !data) { toast.error("Publish nahi ho saka"); return; }
    onChange(data, edits);
    toast.success(`Live: ${data}.noquitai.com`);
  }

  async function rename() {
    setBusy(true);
    const { data, error } = await supabase.rpc("rename_build_subdomain", { _build_id: buildId, _subdomain: value.trim().toLowerCase() });
    setBusy(false);
    if (error || !data) { toast.error(error?.message ?? "Rename fail"); return; }
    onChange(data, edits + 1);
    setEditing(false);
    toast.success("Subdomain update ho gaya");
  }

  if (!subdomain) {
    return (
      <Button size="sm" className="h-7 gap-1 text-xs" disabled={busy} onClick={() => void publish()}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Globe className="h-3.5 w-3.5" />} Publish App
      </Button>
    );
  }

  const urls = liveUrls(subdomain);
  return (
    <div className="mt-3 w-full rounded-xl border border-primary/30 bg-primary/5 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Globe className="h-4 w-4 text-primary" />
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-primary">{urls.pretty}</span>
        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => { void navigator.clipboard.writeText(urls.pretty); toast.success("Copied"); }}>
          <Copy className="h-3.5 w-3.5" /> Copy
        </Button>
        <Button variant="secondary" size="sm" className="h-7 gap-1 text-xs" onClick={() => window.open(urls.working, "_blank", "noopener")}>
          <ExternalLink className="h-3.5 w-3.5" /> Visit
        </Button>
        {edits < 1 && !editing && (
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => { setValue(subdomain); setEditing(true); }}>
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Button>
        )}
      </div>
      {editing && (
        <div className="mt-2 flex items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center rounded-lg border border-border bg-background px-2">
            <input
              value={value}
              onChange={(e) => setValue(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              maxLength={40}
              className="min-w-0 flex-1 bg-transparent py-1.5 font-mono text-xs outline-none"
              aria-label="Subdomain"
            />
            <span className="text-xs text-muted-foreground">.noquitai.com</span>
            <span className="ml-2 w-4">
              {avail === "checking" && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
              {avail === true && <Check className="h-4 w-4 text-primary" />}
              {avail === false && <X className="h-4 w-4 text-destructive" />}
            </span>
          </div>
          <Button size="sm" className="h-7 text-xs" disabled={busy || avail !== true} onClick={() => void rename()}>Save</Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditing(false)}>Cancel</Button>
        </div>
      )}
      {editing && <p className="mt-1 text-[10px] text-muted-foreground">Sirf ek baar change ho sakta hai.</p>}
    </div>
  );
}
