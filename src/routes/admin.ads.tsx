import { useCallback, useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BadgeDollarSign, CheckCircle2, ExternalLink, Loader2, XCircle } from "lucide-react";

import { CommunityShell } from "@/components/community/CommunityShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { ADSENSE_CLIENT, AD_SLOTS, adsEnabled } from "@/lib/adsense";
import { OWNER_EMAIL, estimateEarnings, fetchAdStats, type AdStats } from "@/lib/ads-stats";

export const Route = createFileRoute("/admin/ads")({
  head: () => ({
    meta: [
      { title: "Ad Earnings — NO QUIT AI" },
      {
        name: "description",
        content:
          "NO QUIT AI ad earnings dashboard: ad views, estimated revenue aur AdSense payout setup checklist.",
      },
      { property: "og:title", content: "Ad Earnings — NO QUIT AI" },
      {
        property: "og:description",
        content: "Track ad views and AdSense payout setup for NO QUIT AI.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminAdsPage,
});

const RPM_KEY = "noquit_ad_rpm";

function AdminAdsPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </main>
    );
  }

  const email = (user.email ?? "").toLowerCase();
  if (OWNER_EMAIL && email !== OWNER_EMAIL) {
    return (
      <CommunityShell userId={user.id} title="Ad Earnings" subtitle="Sirf owner ke liye">
        <section className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
          Yeh page sirf app ke owner ke liye hai.
        </section>
      </CommunityShell>
    );
  }

  return <AdsDashboard userId={user.id} />;
}

function AdsDashboard({ userId }: { userId: string }) {
  const [stats, setStats] = useState<AdStats | null>(null);
  const [rpm, setRpm] = useState(1);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem(RPM_KEY) : null;
    if (saved) setRpm(Number(saved) || 1);
  }, []);

  const load = useCallback(async () => {
    setStats(await fetchAdStats());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function updateRpm(value: number) {
    setRpm(value);
    if (typeof window !== "undefined") window.localStorage.setItem(RPM_KEY, String(value));
  }

  const cards = [
    { label: "Aaj ke ad views", value: stats?.today ?? 0 },
    { label: "Pichle 7 din", value: stats?.last7 ?? 0 },
    { label: "Pichle 30 din", value: stats?.last30 ?? 0 },
    { label: "Total views", value: stats?.total ?? 0 },
  ];

  const checks = [
    {
      ok: /^ca-pub-\d{10,}$/.test(ADSENSE_CLIENT),
      label: "Publisher ID (VITE_ADSENSE_CLIENT) set hai",
    },
    { ok: AD_SLOTS.feed.length > 0, label: "Feed ad unit ID set hai" },
    { ok: AD_SLOTS.footer.length > 0, label: "Footer ad unit ID set hai" },
    { ok: adsEnabled, label: "Live site par asli ads chal rahe hain" },
  ];

  return (
    <CommunityShell userId={userId} title="Ad Earnings" subtitle="Ad views aur payout setup">
      <section className="grid grid-cols-2 gap-3">
        {cards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className="mt-1 text-2xl font-semibold">{card.value.toLocaleString()}</p>
          </div>
        ))}
      </section>

      <section className="mt-4 rounded-2xl border border-border bg-card p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <BadgeDollarSign className="h-4 w-4 text-primary" /> Andazan kamai (30 din)
        </h2>
        <p className="mt-2 text-3xl font-semibold text-primary">
          ${estimateEarnings(stats?.last30 ?? 0, rpm).toFixed(2)}
        </p>
        <label className="mt-3 block text-xs text-muted-foreground">
          RPM (1000 views par kitne dollar — AdSense report se dekh kar likhein)
          <input
            type="number"
            min={0}
            step={0.1}
            value={rpm}
            onChange={(event) => updateRpm(Number(event.target.value))}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
        </label>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Yeh sirf andaza hai. Asli paisa Google aap ke AdSense account me jama karta hai — yahan
          sirf ginti rakhi ja rahi hai.
        </p>
      </section>

      <section className="mt-4 rounded-2xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">Setup status</h2>
        <ul className="mt-2 space-y-1.5">
          {checks.map((check) => (
            <li key={check.label} className="flex items-center gap-2 text-xs">
              {check.ok ? (
                <CheckCircle2 className="h-4 w-4 text-primary" />
              ) : (
                <XCircle className="h-4 w-4 text-destructive" />
              )}
              <span className={check.ok ? "" : "text-muted-foreground"}>{check.label}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-4 rounded-2xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">Paisa account me kaise aata hai</h2>
        <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-xs text-muted-foreground">
          <li>AdSense account apne naam se banayein aur site add karein.</li>
          <li>Site approve hone ke baad ad units banayein aur un ke ID yahan app me save karein.</li>
          <li>User ad dekhta hai → Google us view/click ka paisa aap ke AdSense balance me jama karta hai.</li>
          <li>AdSense me address verify karein (PIN letter) aur bank / payoneer detail dalein.</li>
          <li>Balance $100 hote hi Google har mahine 21-26 tareekh ko bank me bhej deta hai.</li>
        </ol>
        <Button asChild variant="outline" className="mt-3 w-full">
          <a href="https://www.google.com/adsense" target="_blank" rel="noopener noreferrer">
            AdSense dashboard kholein <ExternalLink className="ml-2 h-4 w-4" />
          </a>
        </Button>
      </section>
    </CommunityShell>
  );
}
