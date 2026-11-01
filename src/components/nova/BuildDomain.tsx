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
    const link = liveUrls(data).share;
    toast.success("App live ho gayi 🎉", {
      description: link,
      action: { label: "Copy", onClick: () => void navigator.clipboard.writeText(link) },
    });
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
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-primary">{urls.share}</span>
        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => { void navigator.clipboard.writeText(urls.share); toast.success("Link copy ho gaya"); }}>
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
      <p className="mt-2 text-[10px] text-muted-foreground">✅ Public hai — link wala koi bhi dekh sakta hai.</p>
      <CustomDomainHelp target={urls.working} />
    </div>
  );
}

function CustomDomainHelp({ target }: { target: string }) {
  const [open, setOpen] = useState<null | "buy" | "own">(null);
  const [name, setName] = useState("");
  const clean = name.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/[^a-z0-9.-]/g, "");
  const q = encodeURIComponent(clean);
  const shops = [
    { label: "Namecheap", url: `https://www.namecheap.com/domains/registration/results/?domain=${q}` },
    { label: "Porkbun", url: `https://porkbun.com/checkout/search?q=${q}` },
    { label: "GoDaddy", url: `https://www.godaddy.com/domainsearch/find?domainToCheck=${q}` },
  ];
  return (
    <div className="mt-3 border-t border-primary/20 pt-2">
      <div className="flex flex-wrap gap-2">
        <Button variant={open === "buy" ? "default" : "outline"} size="sm" className="h-7 text-xs" onClick={() => setOpen(open === "buy" ? null : "buy")}>Domain kharido</Button>
        <Button variant={open === "own" ? "default" : "outline"} size="sm" className="h-7 text-xs" onClick={() => setOpen(open === "own" ? null : "own")}>Apna domain lagao</Button>
      </div>
      {open && (
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="myshop.com"
          aria-label="Domain name"
          className="mt-2 w-full rounded-lg border border-border bg-background px-2 py-1.5 font-mono text-xs outline-none"
        />
      )}
      {open === "buy" && (
        <div className="mt-2 flex flex-wrap gap-2">
          {shops.map((s) => (
            <Button key={s.label} variant="secondary" size="sm" className="h-7 gap-1 text-xs" disabled={clean.length < 3} onClick={() => window.open(s.url, "_blank", "noopener")}>
              <ExternalLink className="h-3.5 w-3.5" /> {s.label}
            </Button>
          ))}
          <p className="w-full text-[10px] text-muted-foreground">Kharidne ke baad "Apna domain lagao" se usay is app par laga do.</p>
        </div>
      )}
      {open === "own" && (
        <ol className="mt-2 list-decimal space-y-1 pl-4 text-[11px] text-muted-foreground">
          <li>Apne domain provider (Namecheap, GoDaddy, waghera) mein login karo{clean ? <> aur <b className="text-foreground">{clean}</b> kholo</> : null}.</li>
          <li><b className="text-foreground">Domain / URL Forwarding</b> (Redirect) setting kholo.</li>
          <li>
            Forward to yeh link do:{" "}
            <button type="button" className="font-mono text-primary underline" onClick={() => { void navigator.clipboard.writeText(target); toast.success("Link copy ho gaya"); }}>{target}</button>
          </li>
          <li>Type "Permanent (301)" chuno, save karo. 10 min – 24 ghante mein domain chal jayega.</li>
        </ol>
      )}
    </div>
  );
}
