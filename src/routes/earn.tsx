import { useCallback, useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Coins, Loader2, Pickaxe, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { AdSlot } from "@/components/ads/AdSlot";
import { CommunityShell } from "@/components/community/CommunityShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import {
  COIN,
  fetchTransactions,
  fetchWallet,
  formatCoins,
  mine,
  timeUntil,
  type NqaiTx,
  type NqaiWallet,
} from "@/lib/nqai";

export const Route = createFileRoute("/earn")({
  head: () => ({
    meta: [
      { title: "Earn NQAI Coins — NO QUIT AI" },
      {
        name: "description",
        content:
          "NO QUIT AI par roz mining kar ke NQAI coins kamao, community me post aur comment kar ke points barhao aur dosto ko invite kar ke bonus lo.",
      },
      { property: "og:title", content: "Earn NQAI Coins — NO QUIT AI" },
      {
        property: "og:description",
        content: "Daily mining, community activity and invites all earn NQAI coins.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EarnPage,
});

function EarnPage() {
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
  return <Earn userId={user.id} />;
}

const RULES = [
  { label: "Daily mining (24 ghante baad)", value: "+5 se +15" },
  { label: "Community post", value: "+2" },
  { label: "Comment / madad", value: "+1" },
  { label: "Dost invite join kare", value: "+20" },
  { label: "Invite se join karna", value: "+10" },
];

function Earn({ userId }: { userId: string }) {
  const [wallet, setWallet] = useState<NqaiWallet | null>(null);
  const [txs, setTxs] = useState<NqaiTx[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [w, t] = await Promise.all([fetchWallet(userId), fetchTransactions(userId)]);
    setWallet(w);
    setTxs(t);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const nextAt = wallet?.last_mined_at
    ? new Date(new Date(wallet.last_mined_at).getTime() + 24 * 3600 * 1000).toISOString()
    : null;
  const ready = !nextAt || new Date(nextAt).getTime() <= Date.now();

  async function onMine() {
    setBusy(true);
    try {
      const result = await mine();
      if (result.ok) {
        toast.success(`+${formatCoins(result.reward ?? 0)} ${COIN} mil gaye!`);
      } else {
        toast.info(`Agli mining ${timeUntil(result.next_at)} baad.`);
      }
      await load();
    } catch {
      toast.error("Mining abhi nahi ho saki, thori dair baad try karo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <CommunityShell userId={userId} title={`${COIN} Coins`} subtitle="Roz mining karo, points kamao">
      <section className="rounded-2xl border border-border bg-card p-5 text-center">
        <Coins className="mx-auto h-7 w-7 text-primary" />
        <p className="mt-2 text-3xl font-semibold">
          {wallet ? formatCoins(wallet.balance) : "—"}{" "}
          <span className="text-base text-muted-foreground">{COIN}</span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Streak: {wallet?.streak ?? 0} din · streak jitni lambi, reward utna zyada
        </p>
        <Button className="mt-4 w-full" onClick={() => void onMine()} disabled={busy || !ready}>
          {busy ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Pickaxe className="mr-2 h-4 w-4" />
          )}
          {ready ? "Aaj ki mining karo" : `Agli mining ${timeUntil(nextAt)} baad`}
        </Button>
      </section>

      <section className="mt-4 rounded-2xl border border-border bg-card p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-primary" /> Kaise kamao
        </h2>
        <ul className="mt-2 space-y-1.5">
          {RULES.map((rule) => (
            <li key={rule.label} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{rule.label}</span>
              <span className="font-medium">{rule.value}</span>
            </li>
          ))}
        </ul>
      </section>

      <AdSlot name="footer" className="mt-4" />

      <section className="mt-2 rounded-2xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">Recent earnings</h2>
        {txs.length === 0 && (
          <p className="mt-2 text-xs text-muted-foreground">Abhi koi earning nahi — mining se shuru karo.</p>
        )}
        <ul className="mt-2 space-y-1.5">
          {txs.map((tx) => (
            <li key={tx.id} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{tx.reason}</span>
              <span className="font-medium text-primary">+{formatCoins(tx.amount)}</span>
            </li>
          ))}
        </ul>
      </section>
    </CommunityShell>
  );
}
