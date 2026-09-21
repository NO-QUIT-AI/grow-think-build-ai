import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Coins, Loader2, Pickaxe, Share2, Sparkles, Timer, Zap } from "lucide-react";
import { toast } from "sonner";

import { AdSlot } from "@/components/ads/AdSlot";
import { CommunityShell } from "@/components/community/CommunityShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { inviteLink } from "@/lib/referral";
import {
  COIN,
  claimMining,
  claimShareBonus,
  countdown,
  fetchInviteCount,
  fetchMiningState,
  fetchTransactions,
  fetchWallet,
  formatCoins,
  startMining,
  timeUntil,
  type MiningState,
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

const RULES = [
  { key: "rule_mining", valueKey: "rule_mining_v" },
  { key: "rule_share", value: "+1" },
  { key: "rule_referral", valueKey: "rule_referral_v" },
  { key: "rule_post", value: "+2" },
  { key: "rule_comment", value: "+1" },
] as const;

function Earn({ userId }: { userId: string }) {
  const [wallet, setWallet] = useState<NqaiWallet | null>(null);
  const [mining, setMining] = useState<MiningState | null>(null);
  const [txs, setTxs] = useState<NqaiTx[]>([]);
  const [invites, setInvites] = useState(0);
  const [busy, setBusy] = useState(false);
  const [, setTick] = useState(0);
  const skew = useRef(0);

  const load = useCallback(async () => {
    const [w, m, t, c] = await Promise.all([
      fetchWallet(userId),
      fetchMiningState(),
      fetchTransactions(userId),
      fetchInviteCount(userId),
    ]);
    setWallet(w);
    setMining(m);
    if (m.server_time) skew.current = new Date(m.server_time).getTime() - Date.now();
    setTxs(t);
    setInvites(c);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const id = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const now = Date.now() + skew.current;
  const sessionOver = mining?.ends_at ? new Date(mining.ends_at).getTime() <= now : false;
  const canClaim =
    !!mining?.is_mining &&
    (!mining.next_claim_at || new Date(mining.next_claim_at).getTime() <= now);

  async function onStart() {
    setBusy(true);
    try {
      const result = await startMining();
      if (result.ok === false && result.reason === "already_mining") toast.info("Mining pehle se chal rahi hai.");
      else toast.success(`Mining shuru! ${formatCoins(result.mining_rate)} ${COIN} har ghanta.`);
      await load();
    } catch {
      toast.error("Mining shuru nahi ho saki, dobara try karo.");
    } finally {
      setBusy(false);
    }
  }

  async function onClaim() {
    setBusy(true);
    try {
      const result = await claimMining();
      if (result.ok) {
        toast.success(`+${formatCoins(result.reward ?? 0)} ${COIN} claim ho gaye!`);
      } else if (result.reason === "cooldown") {
        toast.info(`Agla claim ${countdown(result.next_claim_at, skew.current)} baad.`);
      } else if (result.reason === "not_mining") {
        toast.info("Pehle mining start karo.");
      } else {
        toast.info("Abhi kuch mine nahi hua — thori dair baad claim karo.");
      }
      await load();
    } catch {
      toast.error("Claim nahi ho saka, thori dair baad try karo.");
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
    <CommunityShell userId={userId} title={t("earn_title")} subtitle={t("earn_subtitle")}>

      <section className="rounded-2xl border border-border bg-card p-5 text-center">
        <Coins className="mx-auto h-7 w-7 text-primary" />
        <p className="mt-2 text-4xl font-semibold tracking-tight">
          {wallet ? formatCoins(wallet.balance) : "—"}{" "}
          <span className="text-base text-muted-foreground">{COIN}</span>
        </p>
        <p className="mt-1 flex items-center justify-center gap-1 text-xs text-muted-foreground">
          <Zap className="h-3 w-3 text-primary" /> {t("earn_miningSpeed")}{" "}
          {formatCoins(mining?.mining_rate ?? 0.5)}
          {t("earn_perHour")} · {mining?.total_invites ?? invites} {t("earn_invites")}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{t("earn_inviteBonus")}</p>

        {mining?.is_mining && !sessionOver ? (
          <div className="mt-4 rounded-xl border border-border bg-background/50 p-4">
            <p className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
              <Timer className="h-3.5 w-3.5 text-primary" /> {t("earn_session")}
            </p>
            <p className="mt-1 font-mono text-2xl tabular-nums text-primary">
              {countdown(mining.ends_at, skew.current)} {t("earn_remaining")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("earn_mined")}{" "}
              <span className="font-medium text-foreground">{formatCoins(mining.pending)} {COIN}</span>
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">{t("earn_convertInfo")}</p>
          </div>
        ) : (
          <p className="mt-4 text-xs text-muted-foreground">
            {sessionOver ? t("earn_sessionOver") : t("earn_notMining")}
          </p>
        )}

        <p className="mt-3 inline-flex items-center gap-1 rounded-full border border-border bg-background/50 px-3 py-1 text-[11px] font-medium text-muted-foreground">
          {t("earn_phase")}
        </p>
        {mining?.is_mining ? (
          <Button
            className="btn-green btn-green-hover mt-3 w-full shadow-[0_0_20px_-4px_oklch(0.78_0.17_160)]"
            onClick={() => void onClaim()}
            disabled={busy || !canClaim}
          >
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Pickaxe className="mr-2 h-4 w-4" />}
            {canClaim
              ? t("earn_claimRestart")
              : `${t("earn_claimAfter")} ${countdown(mining.next_claim_at, skew.current)}`}
          </Button>
        ) : (
          <Button
            className="btn-green btn-green-hover mt-3 w-full shadow-[0_0_20px_-4px_oklch(0.78_0.17_160)]"
            onClick={() => void onStart()}
            disabled={busy}
          >
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Pickaxe className="mr-2 h-4 w-4" />}
            {t("earn_start")}
          </Button>
        )}

        <Button variant="outline" className="mt-2 w-full" onClick={() => void shareInvite()}>
          <Share2 className="mr-2 h-4 w-4" /> {t("earn_share")}
        </Button>
      </section>

      <section className="mt-4 rounded-2xl border border-border bg-card p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-primary" /> {t("earn_howTo")}
        </h2>
        <ul className="mt-2 space-y-1.5">
          {RULES.map((rule) => (
            <li key={rule.key} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{t(rule.key)}</span>
              <span className="font-medium">
                {"valueKey" in rule ? t(rule.valueKey) : rule.value}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-muted-foreground">{t("earn_serverNote")}</p>
      </section>

      <AdSlot name="footer" className="mt-4" />

      <section className="mt-2 rounded-2xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">{t("earn_recent")}</h2>
        {txs.length === 0 && (
          <p className="mt-2 text-xs text-muted-foreground">{t("earn_noEarnings")}</p>
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
