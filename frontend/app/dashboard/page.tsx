"use client";

import { useEffect, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { TasksTab } from "@/components/dashboard/TasksTab";
import { DepositTab } from "@/components/dashboard/DepositTab";
import { WithdrawTab } from "@/components/dashboard/WithdrawTab";
import { HistoryTab } from "@/components/dashboard/HistoryTab";
import { ListChecks, Banknote, ArrowUpFromLine, History, Users, Copy, Trophy, Check } from "lucide-react";
import { ReferralStats, UserPlan } from "@/lib/types";
import api from "@/lib/api";
import Link from "next/link";

type Tab = "tasks" | "deposit" | "withdraw" | "history" | "referral";

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: "tasks", label: "Tasks", icon: ListChecks },
  { id: "deposit", label: "Deposit", icon: Banknote },
  { id: "withdraw", label: "Withdraw", icon: ArrowUpFromLine },
  { id: "history", label: "History", icon: History },
  { id: "referral", label: "Referral", icon: Users },
];

export default function DashboardPage() {
  const { user, loading } = useRequireAuth();
  const [tab, setTab] = useState<Tab>("tasks");
  const [referralStats, setReferralStats] = useState<ReferralStats | null>(null);
  const [myPlan, setMyPlan] = useState<UserPlan | null | undefined>(undefined);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) return;
    api.get("/plans/referral-stats").then((r) => setReferralStats(r.data)).catch(() => {});
    api.get("/plans/my").then((r) => setMyPlan(r.data)).catch(() => setMyPlan(null));
  }, [user]);

  function copyReferral() {
    if (!referralStats) return;
    const link = `${window.location.origin}/register?ref=${referralStats.referralCode}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading || !user) {
    return <PageShell><div className="py-32 text-center" style={{ color: "rgba(245,242,234,0.5)" }}>Loading…</div></PageShell>;
  }

  return (
    <PageShell>
      <section className="py-12 md:py-16">
        <div className="max-w-5xl mx-auto px-5">
          {/* Wallet + Plan row */}
          <div className="grid md:grid-cols-3 gap-4 mb-8">
            {/* Wallet */}
            <div className="md:col-span-2 rounded-2xl p-7" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="text-xs uppercase tracking-wide mb-2 font-medium" style={{ color: "var(--color-muted)" }}>Wallet balance</div>
              <div className="font-mono-tabular text-4xl md:text-5xl font-bold mb-3 gradient-text">
                ₨{parseFloat(user.balance || "0").toFixed(2)}
              </div>
              <div className="text-xs" style={{ color: "rgba(245,242,234,0.4)" }}>
                Referral code: <span className="font-mono font-medium" style={{ color: "var(--color-accent)" }}>{user.referralCode}</span>
              </div>
            </div>
            {/* Active plan or CTA */}
            <div className="rounded-2xl p-5 flex flex-col justify-between" style={{ background: myPlan ? "rgba(0,200,117,0.07)" : "rgba(255,255,255,0.03)", border: myPlan ? "1px solid rgba(0,200,117,0.2)" : "1px solid rgba(255,255,255,0.07)" }}>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Trophy size={15} style={{ color: myPlan ? "var(--color-accent)" : "rgba(245,242,234,0.35)" }} />
                  <span className="text-xs font-medium uppercase tracking-wide" style={{ color: "rgba(245,242,234,0.45)" }}>Active plan</span>
                </div>
                {myPlan ? (
                  <>
                    <div className="font-semibold text-sm mb-1" style={{ color: "var(--color-surface)" }}>{myPlan.planName}</div>
                    <div className="text-xs" style={{ color: "var(--color-accent)" }}>Active until {new Date(myPlan.endDate || "").toLocaleDateString()}</div>
                  </>
                ) : (
                  <div className="text-sm" style={{ color: "rgba(245,242,234,0.45)" }}>No active plan</div>
                )}
              </div>
              <Link href="/plans" className="mt-3 text-xs font-semibold px-3 py-2 rounded-lg text-center" style={{ background: "rgba(255,255,255,0.07)", color: "var(--color-surface)" }}>
                {myPlan ? "Upgrade plan" : "View plans"}
              </Link>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1.5 mb-8 overflow-x-auto pb-1">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all"
                  style={{
                    background: active ? "var(--color-accent)" : "rgba(255,255,255,0.05)",
                    color: active ? "#000" : "rgba(245,242,234,0.65)",
                    border: active ? "none" : "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <Icon size={15} />
                  {t.label}
                </button>
              );
            })}
          </div>

          {tab === "tasks" && <TasksTab />}
          {tab === "deposit" && <DepositTab />}
          {tab === "withdraw" && <WithdrawTab />}
          {tab === "history" && <HistoryTab />}
          {tab === "referral" && (
            <div className="flex flex-col gap-5">
              {/* Referral link */}
              <div className="rounded-2xl p-6" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="text-sm font-semibold mb-1" style={{ color: "var(--color-surface)" }}>Your referral link</div>
                <div className="text-xs mb-4" style={{ color: "rgba(245,242,234,0.45)" }}>Share this link. When someone registers & buys a plan, you earn 5% instantly.</div>
                <div className="flex gap-2">
                  <div className="flex-1 px-3 py-2.5 rounded-xl text-xs font-mono truncate" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(245,242,234,0.6)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    {typeof window !== "undefined" ? `${window.location.origin}/register?ref=${referralStats?.referralCode || user.referralCode}` : `...?ref=${referralStats?.referralCode || user.referralCode}`}
                  </div>
                  <button onClick={copyReferral} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap" style={{ background: copied ? "rgba(0,200,117,0.15)" : "var(--color-accent)", color: copied ? "var(--color-accent)" : "#000" }}>
                    {copied ? <><Check size={13} /> Copied!</> : <><Copy size={13} /> Copy link</>}
                  </button>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "Total referrals", value: referralStats?.totalReferrals ?? "—" },
                  { label: "Bonus earned (₨)", value: referralStats ? `₨${referralStats.totalBonusEarned.toFixed(2)}` : "—" },
                  { label: "Bonus rate", value: "5%" },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl p-5 text-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <div className="font-mono-tabular text-2xl font-bold mb-1 gradient-text">{s.value}</div>
                    <div className="text-xs" style={{ color: "rgba(245,242,234,0.45)" }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* How it works */}
              <div className="rounded-2xl p-6" style={{ background: "rgba(244,200,66,0.05)", border: "1px solid rgba(244,200,66,0.15)" }}>
                <div className="text-sm font-semibold mb-3" style={{ color: "var(--color-gold)" }}>How the referral system works</div>
                <ol className="flex flex-col gap-2">
                  {["Share your referral link with friends.", "Friend registers using your link.", "When they purchase any plan, you instantly receive 5% of the plan price in your wallet.", "No limits — refer as many friends as you want!"].map((s, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm" style={{ color: "rgba(245,242,234,0.65)" }}>
                      <span className="font-mono font-bold text-xs mt-0.5 w-5 shrink-0" style={{ color: "var(--color-gold)" }}>{i + 1}.</span>
                      {s}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}
        </div>
      </section>
    </PageShell>
  );
}
