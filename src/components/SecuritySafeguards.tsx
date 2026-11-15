import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/useAuth";
import { runSecurityBackup } from "@/lib/security-backup.functions";
import { linkWarnings } from "@/lib/security-safety";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export function SecuritySafeguards() {
  const { user } = useAuth();
  const backup = useServerFn(runSecurityBackup);
  const [link, setLink] = useState<{ url: string; warnings: string[] } | null>(null);
  useEffect(() => {
    const check = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(target instanceof HTMLAnchorElement) || target.hasAttribute("download")) return;
      const url = new URL(target.href, window.location.href);
      if (url.origin === window.location.origin) return;
      const warnings = linkWarnings(url.href);
      if (!warnings.length) return;
      event.preventDefault(); event.stopPropagation();
      setLink({ url: url.href, warnings });
    };
    document.addEventListener("click", check, true);
    return () => document.removeEventListener("click", check, true);
  }, []);
  useEffect(() => {
    if (!user) return;
    let busy = false;
    const run = async () => {
      if (busy || document.visibilityState !== "visible" || !navigator.onLine) return;
      busy = true;
      try { await backup({ data: { automatic: true } }); } catch { /* Manual center shows errors; automatic failures never block the app. */ }
      finally { busy = false; }
    };
    void run();
    const timer = window.setInterval(() => void run(), 5 * 60 * 1000);
    window.addEventListener("online", run);
    document.addEventListener("visibilitychange", run);
    return () => { clearInterval(timer); window.removeEventListener("online", run); document.removeEventListener("visibilitychange", run); };
  }, [user?.id, backup]);
  return <Dialog open={!!link} onOpenChange={open => { if (!open) setLink(null); }}><DialogContent className="max-w-sm"><DialogHeader><DialogTitle>Suspicious link — ehtiyat karein</DialogTitle><DialogDescription>Ye warning hai, virus scan nahi. Password, OTP ya payment details share na karein.</DialogDescription></DialogHeader><p className="break-all text-sm text-muted-foreground">{link?.url}</p><ul className="list-inside list-disc text-sm">{link?.warnings.map(w => <li key={w}>{w}</li>)}</ul><Button onClick={() => setLink(null)}>Go back / Wapas</Button>{link && /^https?:/.test(link.url) && <Button variant="outline" onClick={() => { window.open(link.url, "_blank", "noopener,noreferrer"); setLink(null); }}>Open anyway / Phir bhi kholein</Button>}</DialogContent></Dialog>;
}