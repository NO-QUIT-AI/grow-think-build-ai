import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Coins, Loader2, Pickaxe, Share2, Sparkles, Zap } from "lucide-react";
import { toast } from "sonner";

import { AdSlot } from "@/components/ads/AdSlot";
import { CommunityShell } from "@/components/community/CommunityShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { inviteLink } from "@/lib/referral";
import {
  COIN,
  claimShareBonus,
  fetchInviteCount,
  fetchTransactions,
  fetchWallet,
  formatCoins,
  mineWithAd,
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
          "NO QUIT AI par ad dekh kar roz NQAI coins mine karo, invite link share kar ke daily bonus lo aur dost invite kar ke mining speed barhao.",
      },
      { property: "og:title", content: "Earn NQAI Coins — NO QUIT AI" },
      {
        property: "og:description",
        content: "Watch an ad to mine daily NQAI coins and boost your speed by inviting friends.",
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

const AD_SECONDS = 15;

const RULES = [
  { label: "Ad dekh kar daily mining", value: "+1 x speed" },
  { label: "Invite link daily share", value: "+1" },
  { label: "Har invite se mining speed", value: "+1x (max 10x)" },
  { label: "Community post", value: "+2" },
  { label: "Comment / madad", value: "+1" },
  { label: "Dost invite join kare", value: "+20" },
];

function Earn({ userId }: { userId: string }) {
  const [wallet, setWallet] = useState<NqaiWallet | null>(null);
  const [txs, setTxs] = useState<NqaiTx[]>([]);
  const [invites, setInvites] = useState(0);
  const [busy, setBusy] = useState(false);
  const [watching, setWatching] = useState(false);
  const [left, setLeft] = useState(AD_SECONDS);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const multiplier = Math.min(1 + invites, 10);

  const load = useCallback(async () => {
    const [w, t, c] = await Promise.all([
      fetchWallet(userId),
      fetchTransactions(userId),
      fetchInviteCount(userId),
    ]);
    setWallet(w);
    setTxs(t);
    setInvites(c);
  }, [userId]);

  useEffect(() => {
    void load();
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [load]);

  const nextAt = wallet?.last_mined_at
    ? new Date(new Date(wallet.last_mined_at).getTime() + 24 * 3600 * 1000).toISOString()
    : null;
  const ready = !nextAt || new Date(nextAt).getTime() <= Date.now();

  function startAd() {
    if (watching || !ready) return;
    setWatching(true);
    setLeft(AD_SECONDS);
    timer.current = setInterval(() => {
      setLeft((value) => {
        if (value <= 1) {
          if (timer.current) clearInterval(timer.current);
          timer.current = null;
          setWatching(false);
          void finishMining();
          return 0;
        }
        return value - 1;
      });
    }, 1000);
  }

  async function finishMining() {
    setBusy(true);
    try {
      const result = await mineWithAd(true);
      if (result.ok) {
        toast.success(`+${formatCoins(result.reward ?? 0)} ${COIN} mil gaye! (speed ${result.multiplier}x)`);
      } else if (result.reason === "cooldown") {
        toast.info(`Agli mining ${timeUntil(result.next_at)} baad.`);
      } else {
        toast.info("Pehle ad poora dekhna zaroori hai.");
      }
      await load();
    } catch {
      toast.error("Mining abhi nahi ho saki, thori dair baad try karo.");
    } finally {
      setBusy(false);
    }
  }

  async function shareInvite() {
    const link = inviteLink(userId);
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: "NO QUIT AI", text: "Join NO QUIT AI", url: link });
      } else {
        await navigator.clipboard.writeText(link);
        toast.success("Invite link copy ho gaya");
      }
    } catch {
      /* share cancel */
    }
    try {
      const result = await claimShareBonus();
      if (result.ok) toast.success(`+1 ${COIN} share bonus mil gaya!`);
      else toast.info(`Agla share bonus ${timeUntil(result.next_at)} baad.`);
      await load();
    } catch {
      /* ignore */
    }
  }

  return (
    <CommunityShell userId={userId} title={`${COIN} Coins`} subtitle="Ad dekho, mine karo, speed barhao">
      <section className="rounded-2xl border border-border bg-card p-5 text-center">
        <Coins className="mx-auto h-7 w-7 text-primary" />
        <p className="mt-2 text-3xl font-semibold">
          {wallet ? formatCoins(wallet.balance) : "—"}{" "}
          <span className="text-base text-muted-foreground">{COIN}</span>
        </p>
        <p className="mt-1 flex items-center justify-center gap-1 text-xs text-muted-foreground">
          <Zap className="h-3 w-3 text-primary" /> Mining speed {multiplier}x · {invites} invite ·
          streak {wallet?.streak ?? 0} din
        </p>

        {watching ? (
          <div className="mt-4">
            <AdSlot name="feed" label="Ad — mining chal rahi hai" />
            <p className="text-xs text-muted-foreground">
              Ad dekhte raho… {left}s baad {formatCoins(multiplier)} {COIN} mil jayenge
            </p>
          </div>
        ) : (
          <Button className="mt-4 w-full" onClick={startAd} disabled={busy || !ready}>
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Pickaxe className="mr-2 h-4 w-4" />
            )}
            {ready ? `Ad dekh kar mine karo (+${formatCoins(multiplier)})` : `Agli mining ${timeUntil(nextAt)} baad`}
          </Button>
        )}

        <Button variant="outline" className="mt-2 w-full" onClick={() => void shareInvite()}>
          <Share2 className="mr-2 h-4 w-4" /> Invite link share karo (+1 daily)
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
        <p className="mt-2 text-[11px] text-muted-foreground">
          Jitne zyada dost invite honge, mining speed utni zyada — 1 invite = 2x, 2 invite = 3x (max 10x).
        </p>
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
