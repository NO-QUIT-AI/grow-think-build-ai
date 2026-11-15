import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ShieldCheck, LockKeyhole, CloudUpload, Download, Link2, Settings, RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { deviceSafetyScore, linkWarnings, type SafetyAnswer } from "@/lib/security-safety";
import { hasNativeSafety, nativeSecurity } from "@/lib/native-security";
import { getSecurityBackup, setSecurityBackup, runSecurityBackup, downloadSecurityBackup } from "@/lib/security-backup.functions";

export const Route = createFileRoute("/security-center")({
  head: () => ({ meta: [
    { title: "Security Center — NO QUIT AI" },
    { name: "description", content: "Review device safety, check suspicious links and back up saved NO QUIT AI chats, builds and domain settings." },
    { property: "og:title", content: "Security Center — NO QUIT AI" },
    { property: "og:description", content: "Simple Urdu and English safety guidance and encrypted backups for your saved work." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: SecurityCenter,
});

function SecurityCenter() {
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();
  const statusFn = useServerFn(getSecurityBackup);
  const settingFn = useServerFn(setSecurityBackup);
  const backupFn = useServerFn(runSecurityBackup);
  const downloadFn = useServerFn(downloadSecurityBackup);
  const status = useQuery({ queryKey: ["security-backup", user?.id], queryFn: () => statusFn(), enabled: !!user });
  const [lock, setLock] = useState<SafetyAnswer>(null);
  const [reviewed, setReviewed] = useState<SafetyAnswer>(null);
  const [native, setNative] = useState(false);
  const [nativeNotice, setNativeNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [url, setUrl] = useState("");
  const [warnings, setWarnings] = useState<string[] | null>(null);
  const score = deviceSafetyScore(lock, reviewed, !!status.data?.last_backup_at);

  async function checkDevice() {
    setNative(hasNativeSafety());
    if (!hasNativeSafety()) return;
    try {
      const result = await nativeSecurity.check();
      setLock(result.screenLock);
      setNativeNotice(`Enabled accessibility services: ${result.accessibilityServices}. NO QUIT AI overlay: ${result.overlay ? "ON" : "OFF"}; install unknown apps: ${result.unknownSources ? "ON" : "OFF"}. Accessibility useful bhi ho sakti hai — sirf trusted services rakhein.`);
    } catch { setNativeNotice("Phone check unavailable — neeche manual review karein."); }
  }
  useEffect(() => { void checkDevice(); }, []);

  async function action(task: () => Promise<unknown>, success: string) {
    setBusy(true); setError(""); setNotice("");
    try { await task(); await queryClient.invalidateQueries({ queryKey: ["security-backup", user?.id] }); setNotice(success); }
    catch (e) { setError(e instanceof Error ? e.message : "Kaam complete nahi hua, dobara try karein."); }
    finally { setBusy(false); }
  }
  async function settings(section: "security" | "permissions" | "apps") {
    if (native) { try { await nativeSecurity.openSettings({ section }); } catch { setError("Phone Settings khud open karein."); } }
    else setNotice(section === "security" ? "Phone Settings → Security → Screen lock → PIN/password set karein." : section === "apps" ? "Phone Settings → Apps → risky app choose karein → Uninstall. Pehle zaroori data save karein." : "Phone Settings → Apps → Special app access; Accessibility, Display over other apps aur Install unknown apps review karein.");
  }
  const answers = (value: SafetyAnswer, update: (v: SafetyAnswer) => void, disabled = false) => <div className="mt-3 flex gap-2"><Button size="sm" disabled={disabled} variant={value === true ? "default" : "outline"} onClick={() => update(true)}>Yes / Haan</Button><Button size="sm" disabled={disabled} variant={value === false ? "default" : "outline"} onClick={() => update(false)}>No / Nahi</Button><Button size="sm" disabled={disabled} variant={value === null ? "secondary" : "ghost"} onClick={() => update(null)}>Not sure</Button></div>;

  return <main className="mx-auto w-full max-w-4xl px-4 py-6 text-foreground">
    <header className="flex items-center gap-3 border-b border-border pb-5"><Button asChild size="icon" variant="ghost"><Link to="/" aria-label="Back to home"><ArrowLeft className="h-5 w-5" /></Link></Button><ShieldCheck className="h-8 w-8 text-primary" /><div><h1 className="font-display text-2xl font-bold">Security Center</h1><p className="text-sm text-muted-foreground">Apna phone aur saved work sambhalein</p></div></header>
    <section className="flex flex-wrap items-center gap-6 border-b border-border py-6">
      <div className="flex h-32 w-32 shrink-0 flex-col items-center justify-center rounded-full border-4 border-primary" aria-label={`Device Safety Score ${score} out of 100`}><strong className="text-4xl text-primary">{score}</strong><span className="text-sm text-muted-foreground">/ 100</span></div>
      <div className="max-w-xl"><h2 className="text-xl font-semibold">Device Safety Score</h2><p className="mt-2 text-sm text-muted-foreground">Checklist estimate, virus scan nahi. Screen lock 40 + permission review 40 + successful backup 20 points. Unknown checks ko points nahi milte.</p><p className="mt-2 text-sm text-accent">Hum virus/hack remove nahi karte, aur ye score safety ki guarantee nahi hai.</p></div>
    </section>
    <div className="grid gap-x-8 md:grid-cols-2">
      <section className="border-b border-border py-6"><h2 className="flex items-center gap-2 text-lg font-semibold"><LockKeyhole className="h-5 w-5 text-primary" />Screen lock</h2><p className="mt-2 text-sm text-muted-foreground">{native ? `Phone check: ${lock === true ? "Screen lock ON" : lock === false ? "Screen lock OFF" : "Not checked"}` : "Browser phone ka lock nahi dekh sakta. Kya PIN, password ya pattern ON hai? (Self-reported)"}</p>{answers(lock, setLock, native)}{lock === false && <p className="mt-3 text-sm text-accent">Lock OFF — PIN/password enable karein.</p>}<Button className="mt-4" size="sm" variant="outline" onClick={() => void settings("security")}><Settings className="h-4 w-4" />Lock settings / Guide</Button></section>
      <section className="border-b border-border py-6"><h2 className="flex items-center gap-2 text-lg font-semibold"><TriangleAlert className="h-5 w-5 text-accent" />Risky permissions</h2><p className="mt-2 text-sm text-muted-foreground">{nativeNotice || "Browser aur purani Android app doosri apps ki permissions scan nahi kar sakte."}</p><p className="mt-2 text-sm">Accessibility, screen overlay, unknown app install aur mic/camera access review karein. Sirf trusted apps ko zaroori access dein.</p><p className="mt-3 text-sm font-medium">Review kiya aur untrusted access OFF hai?</p>{answers(reviewed, setReviewed)}<div className="mt-4 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => void settings("permissions")}><Settings className="h-4 w-4" />Permissions guide</Button><Button size="sm" variant="ghost" onClick={() => void settings("apps")}>Risky app delete guide</Button>{native && <Button size="sm" variant="ghost" onClick={() => void checkDevice()}><RefreshCw className="h-4 w-4" />Recheck</Button>}</div></section>
    </div>
    <section className="border-b border-border py-6"><h2 className="flex items-center gap-2 text-xl font-semibold"><CloudUpload className="h-5 w-5 text-primary" />Encrypted cloud backup</h2><p className="mt-2 text-sm text-muted-foreground">Saved chats (Scott/Scout aur friend chats bhi), build code, memories aur domain settings AES-256-GCM encryption ke saath save honge. Key server par private rehti hai; ye end-to-end encryption nahi. Uploaded files/media, passwords, API keys aur unsynced local chats included nahi hain.</p>
      {!user ? <div className="mt-4"><Button asChild disabled={loading}><Link to="/auth">Sign in / Login karein</Link></Button></div> : <>
        <div className="mt-5 flex items-center justify-between gap-3"><div><label htmlFor="auto-security-backup" className="font-medium">Auto Backup</label><p className="text-sm text-muted-foreground">App khuli aur online ho to har 24 ghante; closed app mein nahi.</p></div><Switch id="auto-security-backup" checked={status.data?.auto_enabled ?? false} disabled={busy || status.isPending || status.isError} onCheckedChange={enabled => void action(async () => { await settingFn({ data: { enabled } }); if (enabled) await backupFn({ data: { automatic: true } }); }, enabled ? "Auto Backup ON — encrypted copy updated." : "Auto Backup OFF.")} /></div>
        <p className="mt-4 text-sm">Last successful backup: {status.data?.last_backup_at ? new Date(status.data.last_backup_at).toLocaleString() : "Abhi nahi bana"} {status.data?.last_backup_at && ` • ${status.data.row_count} records`}</p>
        <div className="mt-4 flex flex-wrap gap-3"><Button disabled={busy || status.isPending} onClick={() => void action(() => backupFn({ data: { automatic: false } }), "Backup saved — encrypted cloud copy tayyar hai.")}><CloudUpload className="h-4 w-4" />{busy ? "Please wait…" : "Backup Now"}</Button><Button variant="outline" disabled={busy || !status.data?.last_backup_at} onClick={() => void action(async () => { const { text } = await downloadFn(); const object = URL.createObjectURL(new Blob([text], { type: "application/json" })); const a = document.createElement("a"); a.href = object; a.download = "NO-QUIT-AI-backup.json"; a.click(); setTimeout(() => URL.revokeObjectURL(object), 1000); }, "Download ready — ye file decrypted hai, private jagah rakhein.")}><Download className="h-4 w-4" />Download copy</Button></div><p className="mt-3 text-xs text-muted-foreground">Latest successful snapshot rakha jata hai; live data ko overwrite nahi karta. Downloaded JSON private rakhein.</p>
      </>}
    </section>
    {(error || status.isError) && <p role="alert" className="mt-4 break-words text-sm text-destructive">{error || "Backup status nahi mila. Page refresh karein."}</p>}
    {notice && <p role="status" className="mt-4 break-words text-sm text-primary">{notice}</p>}
    <section className="py-6"><h2 className="flex items-center gap-2 text-xl font-semibold"><Link2 className="h-5 w-5 text-primary" />Check a link / Link check karein</h2><p className="mt-2 text-sm text-muted-foreground">Address-only checks: insecure, shortened aur look-alike links. Live malware database nahi; koi bhi link 100% safe declare nahi hota.</p><form className="mt-4 flex flex-wrap gap-2" onSubmit={e => { e.preventDefault(); setWarnings(linkWarnings(url)); }}><Input aria-label="Link to check" type="text" value={url} onChange={e => { setUrl(e.target.value); setWarnings(null); }} placeholder="https://example.com" className="min-w-0 flex-1" /><Button type="submit">Check link</Button></form>{warnings && <div role="status" className="mt-4 rounded-lg border border-border p-4 text-sm">{warnings.length ? <ul className="list-inside list-disc text-accent">{warnings.map(w => <li key={w}>{w}</li>)}</ul> : <p>No obvious address warning — phir bhi sender aur website verify karein; safe hone ki guarantee nahi.</p>}<p className="mt-2 text-muted-foreground">OTP/password na dein; shak ho to link na kholein.</p></div>}</section>
  </main>;
}