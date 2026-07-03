"use client";

import { useEffect, useState } from "react";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { TasksTab } from "@/components/dashboard/TasksTab";
import { DepositTab } from "@/components/dashboard/DepositTab";
import { WithdrawTab } from "@/components/dashboard/WithdrawTab";
import { Home, ListChecks, Users, Trophy, Menu, Banknote, ArrowUpFromLine, Copy, Check, Wallet, X } from "lucide-react";
import { ReferralStats, UserPlan } from "@/lib/types";
import api from "@/lib/api";
import Link from "next/link";

type Tab = "main" | "tasks" | "referral" | "plans" | "menu";

export default function DashboardPage() {
  const { user, loading } = useRequireAuth();
  const [tab, setTab] = useState<Tab>("main");
  const [referralStats, setReferralStats] = useState<ReferralStats | null>(null);
  const [myPlan, setMyPlan] = useState<UserPlan | null | undefined>(undefined);
  const [copied, setCopied] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    api.get("/plans/referral-stats").then((r) => setReferralStats(r.data)).catch(() => {});
    api.get("/plans/my").then((r) => setMyPlan(r.data)).catch(() => setMyPlan(null));
  }, [user]);

  function copyReferral() {
    if (!referralStats && !user) return;
    const code = referralStats?.referralCode || user?.referralCode;
    const link = `${window.location.origin}/register?ref=${code}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0A1A12" }}>
        <div className="text-sm" style={{ color: "rgba(245,242,234,0.4)" }}>Loading…</div>
      </div>
    );
  }

  const balance = parseFloat(user.balance || "0").toFixed(2);
  const referralCode = referralStats?.referralCode || user.referralCode;
  const referralLink = `${typeof window !== "undefined" ? window.location.origin : ""}/register?ref=${referralCode}`;

  return (
    <div className="min-h-screen flex flex-col w-full" style={{ background: "#0A1A12" }}>

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-5 pt-6 pb-2 w-full max-w-2xl mx-auto">
        <div className="flex items-center gap-2">
          <img src="/taskearn-mark.svg" alt="" style={{ width: 28, height: 28 }} />
          <span className="font-display text-lg" style={{ color: "#F5F2EA" }}>Task<span style={{ color: "#00C875" }}>Earn</span></span>
        </div>
        <Link href="/" className="text-xs font-semibold px-4 py-2 rounded-xl" style={{ background: "rgba(0,200,117,0.15)", color: "#00C875", border: "1px solid rgba(0,200,117,0.25)" }}>
          Home
        </Link>
      </div>

      {/* ── Main tab ── */}
      {tab === "main" && (
        <div className="flex-1 px-4 pb-28 overflow-y-auto w-full max-w-2xl mx-auto">

          {/* Wallet card */}
          <div className="mt-4 rounded-3xl p-6 relative overflow-hidden" style={{ background: "linear-gradient(135deg, #0d3d24 0%, #0a2a18 100%)", border: "1px solid rgba(0,200,117,0.2)" }}>
            <div className="orb w-40 h-40 -top-10 -right-10 opacity-20" style={{ background: "#00C875" }} />
            <div className="text-xs uppercase tracking-widest font-medium mb-3" style={{ color: "rgba(245,242,234,0.5)" }}>Wallet Balance</div>
            <div className="font-mono-tabular text-5xl font-bold mb-1" style={{ color: "#00C875" }}>
              Rs{balance}
            </div>
            <div className="text-xs mt-3" style={{ color: "rgba(245,242,234,0.45)" }}>
              Referral code: <span className="font-mono font-bold" style={{ color: "#00C875" }}>{referralCode}</span>
            </div>
            {/* Wallet icon */}
            <div className="absolute bottom-4 right-5">
              <Wallet size={52} style={{ color: "rgba(0,200,117,0.2)" }} />
            </div>
          </div>

          {/* Active plan card */}
          <div className="mt-4 rounded-3xl p-5 flex items-center justify-between" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: myPlan ? "rgba(0,200,117,0.15)" : "rgba(255,255,255,0.06)" }}>
                <Trophy size={20} style={{ color: myPlan ? "#00C875" : "rgba(245,242,234,0.3)" }} />
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide font-medium mb-0.5" style={{ color: "rgba(245,242,234,0.4)" }}>Active Plan</div>
                <div className="text-sm font-semibold" style={{ color: "#F5F2EA" }}>
                  {myPlan ? myPlan.planName : "No active plan"}
                </div>
                <div className="text-xs" style={{ color: "rgba(245,242,234,0.4)" }}>
                  {myPlan ? `Until ${new Date(myPlan.endDate || "").toLocaleDateString()}` : "You don't have any active plan."}
                </div>
              </div>
            </div>
            <button onClick={() => setTab("plans")} className="flex items-center gap-1 text-xs font-semibold px-4 py-2.5 rounded-xl shrink-0" style={{ background: "rgba(255,255,255,0.07)", color: "#F5F2EA" }}>
              View plans ›
            </button>
          </div>

          {/* Quick actions: Deposit, Withdraw, Tasks */}
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              { icon: Banknote, label: "Deposit", sub: "Add funds\nto wallet", action: () => setDepositOpen(true) },
              { icon: ArrowUpFromLine, label: "Withdraw", sub: "Withdraw your\nearnings", action: () => setWithdrawOpen(true) },
              { icon: ListChecks, label: "Tasks", sub: "Complete tasks\n& earn", action: () => setTab("tasks") },
            ].map((item) => (
              <button key={item.label} onClick={item.action} className="rounded-3xl p-4 flex flex-col items-center text-center transition-all active:scale-95" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ background: "rgba(0,200,117,0.12)", border: "1px solid rgba(0,200,117,0.2)" }}>
                  <item.icon size={22} style={{ color: "#00C875" }} />
                </div>
                <div className="text-sm font-semibold mb-1" style={{ color: "#F5F2EA" }}>{item.label}</div>
                <div className="text-xs whitespace-pre-line leading-snug" style={{ color: "rgba(245,242,234,0.45)" }}>{item.sub}</div>
              </button>
            ))}
          </div>

          {/* Referral card */}
          <div className="mt-4 rounded-3xl p-5" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="flex items-center gap-2 mb-3">
              <Users size={15} style={{ color: "#00C875" }} />
              <span className="text-xs uppercase tracking-widest font-semibold" style={{ color: "rgba(245,242,234,0.5)" }}>Referral Program</span>
            </div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-base font-bold mb-0.5" style={{ color: "#F5F2EA" }}>Invite your friends</div>
                <div className="text-xs" style={{ color: "rgba(245,242,234,0.45)" }}>Earn rewards by inviting your friends.</div>
              </div>
              <button onClick={copyReferral} className="text-xs font-bold px-4 py-2.5 rounded-xl shrink-0" style={{ background: "#00C875", color: "#000" }}>
                {copied ? "Copied!" : "Copy Code"}
              </button>
            </div>
            <div className="flex items-center justify-between px-4 py-3 rounded-2xl" style={{ background: "rgba(0,200,117,0.07)", border: "1px dashed rgba(0,200,117,0.25)" }}>
              <span className="text-xs" style={{ color: "rgba(245,242,234,0.55)" }}>Your Referral Code:</span>
              <span className="font-mono font-bold text-sm" style={{ color: "#00C875" }}>{referralCode}</span>
              <button onClick={copyReferral} className="ml-2 p-1" style={{ color: "rgba(245,242,234,0.4)" }}>
                {copied ? <Check size={14} style={{ color: "#00C875" }} /> : <Copy size={14} />}
              </button>
            </div>
            {referralStats && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="rounded-2xl px-4 py-3 text-center" style={{ background: "rgba(255,255,255,0.03)" }}>
                  <div className="font-mono-tabular text-xl font-bold" style={{ color: "#00C875" }}>{referralStats.totalReferrals}</div>
                  <div className="text-xs" style={{ color: "rgba(245,242,234,0.4)" }}>Total referrals</div>
                </div>
                <div className="rounded-2xl px-4 py-3 text-center" style={{ background: "rgba(255,255,255,0.03)" }}>
                  <div className="font-mono-tabular text-xl font-bold" style={{ color: "#00C875" }}>₨{referralStats.totalBonusEarned.toFixed(0)}</div>
                  <div className="text-xs" style={{ color: "rgba(245,242,234,0.4)" }}>Bonus earned</div>
                </div>
              </div>
            )}
          </div>

          {/* Plans teaser */}
          <div className="mt-4 rounded-3xl p-5 flex items-center justify-between" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Trophy size={14} style={{ color: "#F4C842" }} />
                <span className="text-xs uppercase tracking-widest font-semibold" style={{ color: "rgba(245,242,234,0.4)" }}>Plans</span>
              </div>
              <div className="text-sm font-semibold" style={{ color: "#F5F2EA" }}>Choose the best plan</div>
              <div className="text-xs" style={{ color: "rgba(245,242,234,0.4)" }}>for you to start earning.</div>
            </div>
            <button onClick={() => setTab("plans")} className="text-xs font-semibold px-4 py-2.5 rounded-xl shrink-0" style={{ background: "rgba(255,255,255,0.07)", color: "#F5F2EA" }}>
              View plans ›
            </button>
          </div>
        </div>
      )}

      {/* ── Tasks tab ── */}
      {tab === "tasks" && (
        <div className="flex-1 px-4 pt-4 pb-28 overflow-y-auto w-full max-w-2xl mx-auto">
          <h2 className="font-display text-xl mb-5" style={{ color: "#F5F2EA" }}>Tasks</h2>
          <TasksTab />
        </div>
      )}

      {/* ── Referral tab ── */}
      {tab === "referral" && (
        <div className="flex-1 px-4 pt-4 pb-28 overflow-y-auto w-full max-w-2xl mx-auto">
          <h2 className="font-display text-xl mb-5" style={{ color: "#F5F2EA" }}>Referral</h2>
          <div className="rounded-3xl p-5 mb-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="text-sm font-semibold mb-1" style={{ color: "#F5F2EA" }}>Your referral link</div>
            <div className="text-xs mb-4" style={{ color: "rgba(245,242,234,0.45)" }}>Share and earn 5% when friends buy a plan.</div>
            <div className="min-w-0 flex gap-2 mb-4">
              <div className="min-w-0 flex-1 px-3 py-2.5 rounded-xl text-xs font-mono overflow-hidden text-ellipsis whitespace-nowrap" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(245,242,234,0.6)", border: "1px solid rgba(255,255,255,0.08)" }}>
                {referralLink}
              </div>
              <button onClick={copyReferral} className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold" style={{ background: copied ? "rgba(0,200,117,0.15)" : "#00C875", color: copied ? "#00C875" : "#000" }}>
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <div className="flex items-center justify-between px-4 py-3 rounded-2xl" style={{ background: "rgba(0,200,117,0.07)", border: "1px dashed rgba(0,200,117,0.25)" }}>
              <span className="text-xs" style={{ color: "rgba(245,242,234,0.55)" }}>Referral code</span>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-sm" style={{ color: "#00C875" }}>{referralCode}</span>
                <button onClick={copyReferral}>{copied ? <Check size={14} style={{ color: "#00C875" }} /> : <Copy size={14} style={{ color: "rgba(245,242,234,0.4)" }} />}</button>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="rounded-2xl p-4 text-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="font-mono-tabular text-2xl font-bold mb-1 gradient-text">{referralStats?.totalReferrals ?? "0"}</div>
              <div className="text-xs" style={{ color: "rgba(245,242,234,0.45)" }}>Total referrals</div>
            </div>
            <div className="rounded-2xl p-4 text-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="font-mono-tabular text-2xl font-bold mb-1 gradient-text">₨{referralStats ? referralStats.totalBonusEarned.toFixed(0) : "0"}</div>
              <div className="text-xs" style={{ color: "rgba(245,242,234,0.45)" }}>Bonus earned</div>
            </div>
          </div>
          <div className="rounded-2xl px-5 py-3 flex items-center justify-between" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <span className="text-xs" style={{ color: "rgba(245,242,234,0.45)" }}>Bonus rate per plan purchase</span>
            <span className="font-mono-tabular text-base font-bold gradient-text">5%</span>
          </div>
        </div>
      )}

      {/* ── Plans tab ── */}
      {tab === "plans" && (
        <div className="flex-1 px-4 pt-4 pb-28 overflow-y-auto w-full max-w-2xl mx-auto">
          <h2 className="font-display text-xl mb-5" style={{ color: "#F5F2EA" }}>Plans</h2>
          <Link href="/plans" className="block text-center py-3 rounded-2xl text-sm font-semibold mb-4" style={{ background: "#00C875", color: "#000" }}>
            View all plans
          </Link>
          {myPlan && (
            <div className="rounded-3xl p-5" style={{ background: "rgba(0,200,117,0.08)", border: "1px solid rgba(0,200,117,0.2)" }}>
              <div className="text-xs uppercase tracking-wide mb-1" style={{ color: "rgba(245,242,234,0.4)" }}>Your Active Plan</div>
              <div className="font-semibold" style={{ color: "#F5F2EA" }}>{myPlan.planName}</div>
              <div className="text-xs mt-1" style={{ color: "#00C875" }}>Active until {new Date(myPlan.endDate || "").toLocaleDateString()}</div>
            </div>
          )}
        </div>
      )}

      {/* ── Menu tab ── */}
      {tab === "menu" && (
        <div className="flex-1 px-4 pt-4 pb-28 overflow-y-auto w-full max-w-2xl mx-auto">
          <h2 className="font-display text-xl mb-5" style={{ color: "#F5F2EA" }}>Menu</h2>
          <div className="flex flex-col gap-3">
            <button onClick={() => setWithdrawOpen(true)} className="flex items-center gap-3 px-5 py-4 rounded-2xl text-left" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F2EA" }}>
              <ArrowUpFromLine size={18} style={{ color: "#00C875" }} />
              <span className="text-sm font-medium">Withdraw earnings</span>
            </button>
            <button onClick={() => setDepositOpen(true)} className="flex items-center gap-3 px-5 py-4 rounded-2xl text-left" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F2EA" }}>
              <Banknote size={18} style={{ color: "#00C875" }} />
              <span className="text-sm font-medium">Deposit funds</span>
            </button>
            <Link href="/plans" className="flex items-center gap-3 px-5 py-4 rounded-2xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F2EA" }}>
              <Trophy size={18} style={{ color: "#00C875" }} />
              <span className="text-sm font-medium">View plans</span>
            </Link>
            <Link href="/" className="flex items-center gap-3 px-5 py-4 rounded-2xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F2EA" }}>
              <Home size={18} style={{ color: "#00C875" }} />
              <span className="text-sm font-medium">Go to main site</span>
            </Link>
          </div>
        </div>
      )}

      {/* ── Deposit/Withdraw modals ── */}
      {depositOpen && (
        <div className="fixed inset-0 z-50 flex items-end" style={{ background: "rgba(0,0,0,0.7)" }} onClick={() => setDepositOpen(false)}>
          <div className="w-full max-h-[85vh] overflow-y-auto rounded-t-3xl p-5" style={{ background: "#0f2018", maxWidth: 480, margin: "0 auto" }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg" style={{ color: "#F5F2EA" }}>Deposit</h3>
              <button onClick={() => setDepositOpen(false)}><X size={20} style={{ color: "rgba(245,242,234,0.5)" }} /></button>
            </div>
            <DepositTab />
          </div>
        </div>
      )}
      {withdrawOpen && (
        <div className="fixed inset-0 z-50 flex items-end" style={{ background: "rgba(0,0,0,0.7)" }} onClick={() => setWithdrawOpen(false)}>
          <div className="w-full max-h-[85vh] overflow-y-auto rounded-t-3xl p-5" style={{ background: "#0f2018", maxWidth: 480, margin: "0 auto" }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg" style={{ color: "#F5F2EA" }}>Withdraw</h3>
              <button onClick={() => setWithdrawOpen(false)}><X size={20} style={{ color: "rgba(245,242,234,0.5)" }} /></button>
            </div>
            <WithdrawTab />
          </div>
        </div>
      )}

      {/* ── Bottom navigation ── */}
      <div className="fixed bottom-0 left-0 right-0 px-3 pb-4 pt-2 z-40" style={{ background: "linear-gradient(to top, #0A1A12 85%, transparent)" }}>
        <div className="flex items-end justify-around rounded-3xl px-2 py-3 max-w-2xl mx-auto" style={{ background: "rgba(15,32,24,0.95)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(20px)" }}>
          {[
            { id: "main" as Tab, icon: Home, label: "Main" },
            { id: "tasks" as Tab, icon: ListChecks, label: "Tasks" },
            { id: "referral" as Tab, icon: Users, label: "Referral", center: true },
            { id: "plans" as Tab, icon: Trophy, label: "Plans" },
            { id: "menu" as Tab, icon: Menu, label: "Menu" },
          ].map((item) => {
            const active = tab === item.id;
            const Icon = item.icon;
            if (item.center) {
              return (
                <button key={item.id} onClick={() => setTab(item.id)} className="flex flex-col items-center -mt-6">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg" style={{ background: active ? "#00C875" : "rgba(0,200,117,0.2)", border: "3px solid #0A1A12" }}>
                    <Icon size={24} style={{ color: active ? "#000" : "#00C875" }} />
                  </div>
                  <span className="text-xs mt-1.5 font-medium" style={{ color: active ? "#00C875" : "rgba(245,242,234,0.45)" }}>{item.label}</span>
                </button>
              );
            }
            return (
              <button key={item.id} onClick={() => setTab(item.id)} className="flex flex-col items-center gap-1 px-3 py-1">
                <Icon size={20} style={{ color: active ? "#00C875" : "rgba(245,242,234,0.35)" }} />
                <span className="text-xs font-medium" style={{ color: active ? "#00C875" : "rgba(245,242,234,0.35)" }}>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
