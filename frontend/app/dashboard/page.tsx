"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { TasksTab } from "@/components/dashboard/TasksTab";
import { SpinWheelModal } from "@/components/dashboard/SpinWheelModal";
import { MysteryBoxModal } from "@/components/dashboard/MysteryBoxModal";
import { Home, ListChecks, Users, Trophy, Menu, Banknote, ArrowUpFromLine, Copy, Check, Lock, Gift, ChevronRight, LogOut, CheckCircle2, History, Clock, ChevronLeft, UserCircle, Phone, Mail, Pencil, X as XIcon, Save, PlayCircle, ShieldCheck } from "lucide-react";
import { ReferralStats, UserPlan, Plan, TaskSubmission, Deposit, Withdrawal } from "@/lib/types";
import api from "@/lib/api";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useSiteSettings } from "@/lib/site-settings-context";

type Tab = "main" | "tasks" | "referral" | "plans" | "menu" | "history" | "profile";
type HistoryFilter = "pending" | "withdraw" | "deposit";

export default function DashboardPage() {
  const { user, loading } = useRequireAuth();
  const { logout, refreshUser } = useAuth();
  const siteSettings = useSiteSettings();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("main");
  const [referralStats, setReferralStats] = useState<ReferralStats | null>(null);
  const [myPlan, setMyPlan] = useState<UserPlan | null | undefined>(undefined);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [myPlanIds, setMyPlanIds] = useState<string[]>([]);
  const [purchasedPlanIds, setPurchasedPlanIds] = useState<string[]>([]);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [purchaseMsg, setPurchaseMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [showSpin, setShowSpin] = useState(false);
  const [showMystery, setShowMystery] = useState(false);
  const [redeemInput, setRedeemInput] = useState("");
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [redeemMsg, setRedeemMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // History
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("pending");
  const [histSubs, setHistSubs] = useState<TaskSubmission[]>([]);
  const [histDeposits, setHistDeposits] = useState<Deposit[]>([]);
  const [histWithdrawals, setHistWithdrawals] = useState<Withdrawal[]>([]);
  const [histLoading, setHistLoading] = useState(false);
  const [liveBalance, setLiveBalance] = useState<string | null>(null);
  const [referralDetails, setReferralDetails] = useState<{
    referredUsers: { id: string; name: string; joinedAt: string; plansBought: string }[];
    bonuses: { id: string; amount: string; createdAt: string; referredUserName: string; planName: string }[];
  } | null>(null);
  const [referralDetailsLoading, setReferralDetailsLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    // Reset all user-specific state so previous session data never bleeds through
    setMyPlan(null);
    setMyPlanIds([]);
    setPurchasedPlanIds([]);
    setHistSubs([]);
    setHistDeposits([]);
    setHistWithdrawals([]);
    api.get("/plans/referral-stats").then((r) => setReferralStats(r.data)).catch(() => {});
    setReferralDetailsLoading(true);
    api.get("/plans/referral-details")
      .then((r) => setReferralDetails(r.data))
      .catch(() => setReferralDetails({ referredUsers: [], bonuses: [] }))
      .finally(() => setReferralDetailsLoading(false));
    api.get("/plans/my").then((r) => setMyPlan(r.data)).catch(() => setMyPlan(null));
    api.get("/plans").then((r) => setPlans(r.data)).catch(() => {});
    api.get<string[]>("/plans/my-all").then((r) => setMyPlanIds(Array.isArray(r.data) ? r.data : [])).catch(() => setMyPlanIds([]));
    api.get<string[]>("/plans/my-purchased").then((r) => setPurchasedPlanIds(Array.isArray(r.data) ? r.data : [])).catch(() => setPurchasedPlanIds([]));
    // Fetch fresh wallet balance from server (auth context balance can be stale)
    api.get<{ balance: string }>("/auth/me").then((r) => setLiveBalance(r.data.balance ?? "0")).catch(() => {});
  }, [user]);

  function refreshBalance() {
    api.get<{ balance: string }>("/auth/me").then((r) => setLiveBalance(r.data.balance ?? "0")).catch(() => {});
    // Also sync the shared auth context so the balance stays fresh across
    // page navigations (e.g. coming back from Gold Spin / Premium Box),
    // which remount this page and would otherwise show a stale cached value.
    refreshUser();
  }

  function openHistory(filter: HistoryFilter) {
    setHistoryFilter(filter);
    setTab("history");
    if (histSubs.length === 0 && histDeposits.length === 0 && histWithdrawals.length === 0) {
      setHistLoading(true);
      Promise.all([
        api.get<TaskSubmission[]>("/tasks/my-submissions"),
        api.get<Deposit[]>("/deposits/my"),
        api.get<Withdrawal[]>("/withdrawals/my"),
      ]).then(([s, d, w]) => {
        setHistSubs(s.data);
        setHistDeposits(d.data);
        setHistWithdrawals(w.data);
      }).catch(() => {}).finally(() => setHistLoading(false));
    }
  }

  async function handlePurchase(planId: string) {
    setPurchasing(planId);
    setPurchaseMsg(null);
    try {
      await api.post("/plans/purchase", { planId });
      setPurchaseMsg({ type: "ok", text: "Plan activated! Tasks are now unlocked." });
      api.get("/plans/my").then((r) => setMyPlan(r.data)).catch(() => {});
      api.get("/plans").then((r) => setPlans(r.data)).catch(() => {});
      api.get<string[]>("/plans/my-all").then((r) => setMyPlanIds(r.data)).catch(() => {});
      refreshBalance();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Purchase failed";
      setPurchaseMsg({ type: "err", text: msg });
    } finally {
      setPurchasing(null);
    }
  }

  async function handleRedeem(e: React.FormEvent) {
    e.preventDefault();
    if (!redeemInput.trim() || redeemLoading) return;
    setRedeemLoading(true);
    setRedeemMsg(null);
    try {
      const r = await api.post<{ reward: number; message: string }>("/spin/redeem", { code: redeemInput.trim() });
      setRedeemMsg({ ok: true, text: r.data.message });
      setRedeemInput("");
      refreshBalance();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Invalid code.";
      setRedeemMsg({ ok: false, text: msg });
    } finally {
      setRedeemLoading(false);
    }
  }

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

  const balance = parseFloat(liveBalance ?? user.balance ?? "0").toFixed(2);
  const referralCode = referralStats?.referralCode || user.referralCode;
  const referralLink = `${typeof window !== "undefined" ? window.location.origin : ""}/register?ref=${referralCode}`;

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#0A1A12", overflow: "hidden" }}>

      {/* ── Top bar ── */}
      <div style={{ flexShrink: 0 }} className="flex items-center justify-between px-5 pt-5 pb-2 w-full max-w-2xl mx-auto">
        <div className="flex items-center gap-2">
          <img src="/taskearn-mark.svg" alt="" style={{ width: 28, height: 28 }} />
          <span className="font-display text-lg" style={{ color: "#F5F2EA" }}>Task<span style={{ color: "#00C875" }}>Earn</span></span>
        </div>
        <div className="flex items-center gap-2">
          {/* Coin badge */}
          <div style={{
            display: "flex", alignItems: "center", gap: 5,
            background: "rgba(244,200,66,0.12)",
            border: "1px solid rgba(244,200,66,0.28)",
            borderRadius: 99,
            padding: "5px 11px",
          }}>
            <span style={{ fontSize: 15, lineHeight: 1 }}>🪙</span>
            <span style={{ fontSize: 12, fontWeight: 800, color: "#F4C842", letterSpacing: 0.3 }}>
              {user.coins ?? 0}
            </span>
            <span style={{ fontSize: 10, color: "rgba(244,200,66,0.6)", fontWeight: 600 }}>Coins</span>
          </div>
          <Link href="/" className="text-xs font-semibold px-4 py-2 rounded-xl" style={{ background: "rgba(0,200,117,0.15)", color: "#00C875", border: "1px solid rgba(0,200,117,0.25)" }}>
            Home
          </Link>
        </div>
      </div>

      {/* ── Scrollable content area ── */}
      <div style={{ flex: 1, overflowY: "auto", overscrollBehavior: "contain" }}>

      {/* ── Main tab ── */}
      {tab === "main" && (
        <div className="px-4 pb-6 w-full max-w-2xl mx-auto">

          {/* Wallet card */}
          <div className="mt-4 rounded-3xl p-6" style={{ background: "linear-gradient(135deg, #0d3d24 0%, #0a2a18 100%)", border: "1px solid rgba(0,200,117,0.2)" }}>
            <div className="text-xs uppercase tracking-widest font-medium mb-3" style={{ color: "rgba(245,242,234,0.5)" }}>Wallet Balance</div>
            <div className="font-mono-tabular text-5xl font-bold mb-1" style={{ color: "#00C875" }}>
              Rs{balance}
            </div>
            <div className="text-xs mt-3" style={{ color: "rgba(245,242,234,0.45)" }}>
              Referral code: <span className="font-mono font-bold" style={{ color: "#00C875" }}>{referralCode}</span>
            </div>
          </div>

          {/* FBR registration badge */}
          {siteSettings.fbr_certificate_url && (
            <a href={siteSettings.fbr_certificate_url} target="_blank" rel="noopener noreferrer"
              className="mt-4 rounded-3xl p-4 flex items-center gap-4"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={siteSettings.fbr_certificate_url} alt="FBR registration certificate"
                className="rounded-xl object-cover shrink-0" style={{ width: 56, height: 56, border: "1px solid rgba(255,255,255,0.1)" }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck size={14} style={{ color: "#00C875" }} />
                  <span className="text-sm font-semibold" style={{ color: "#F5F2EA" }}>FBR Registered</span>
                </div>
                <div className="text-xs mt-0.5" style={{ color: "rgba(245,242,234,0.45)" }}>Tap to view certificate</div>
              </div>
            </a>
          )}

          {/* Active plans card */}
          {myPlanIds.length > 0 ? (
            <div className="mt-4 rounded-3xl p-5"
              style={{ background: "linear-gradient(135deg, #1a1500 0%, #0a1a10 100%)", border: "1.5px solid rgba(244,200,66,0.32)" }}>
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                  style={{ background: "rgba(244,200,66,0.12)", border: "1.5px solid rgba(244,200,66,0.28)" }}>
                  <Trophy size={22} style={{ color: "#F4C842" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <div className="text-xs uppercase tracking-wide font-medium" style={{ color: "rgba(244,200,66,0.6)" }}>Active Plans</div>
                    <div className="text-xs px-2 py-0.5 rounded-full font-bold"
                      style={{ background: "rgba(244,200,66,0.15)", color: "#F4C842", border: "1px solid rgba(244,200,66,0.3)" }}>
                      {myPlanIds.length} PLAN{myPlanIds.length > 1 ? "S" : ""}
                    </div>
                  </div>
                  <div className="text-sm font-bold" style={{ color: "#F5F2EA" }}>
                    {plans.filter(p => myPlanIds.includes(p.id)).map(p => p.name).join(", ") || "Loading…"}
                  </div>
                </div>
                <button onClick={() => setTab("plans")} className="text-xs font-semibold px-3 py-2 rounded-xl shrink-0"
                  style={{ background: "rgba(244,200,66,0.13)", color: "#F4C842", border: "1px solid rgba(244,200,66,0.22)" }}>
                  Plans ›
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-3xl p-5 flex items-center justify-between"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <Trophy size={20} style={{ color: "rgba(245,242,234,0.3)" }} />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide font-medium mb-0.5" style={{ color: "rgba(245,242,234,0.4)" }}>Active Plan</div>
                  <div className="text-sm font-semibold" style={{ color: "#F5F2EA" }}>No active plan</div>
                  <div className="text-xs" style={{ color: "rgba(245,242,234,0.4)" }}>You don&apos;t have any active plan.</div>
                </div>
              </div>
              <button onClick={() => setTab("plans")} className="flex items-center gap-1 text-xs font-semibold px-4 py-2.5 rounded-xl shrink-0"
                style={{ background: "rgba(255,255,255,0.07)", color: "#F5F2EA" }}>
                View plans ›
              </button>
            </div>
          )}

          {/* Quick actions: Deposit, Withdraw, History */}
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              { icon: Banknote, label: "Deposit", sub: "Add funds\nto wallet", action: () => router.push("/dashboard/deposit") },
              { icon: ArrowUpFromLine, label: "Withdraw", sub: "Withdraw your\nearnings", action: () => router.push("/dashboard/withdraw") },
              { icon: History, label: "History", sub: "View your\nactivity", action: () => openHistory("pending") },
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

          {/* Lucky Wheel card */}
          <div className="mt-4 rounded-3xl p-5 flex items-center gap-4"
            style={{ background: "linear-gradient(135deg, #0d1f14 0%, #071b10 100%)", border: "1.5px solid rgba(0,200,117,0.2)", cursor: "pointer" }}
            onClick={() => setShowSpin(true)}
          >
            <div style={{ width: 52, height: 52, borderRadius: 16, background: "rgba(0,200,117,0.12)", border: "1.5px solid rgba(0,200,117,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 24 }}>
              🎡
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#F5F2EA", marginBottom: 2 }}>Lucky Wheel</div>
              <div style={{ fontSize: 12, color: "rgba(245,242,234,0.5)" }}>Spin daily to win up to Rs 5,000!</div>
            </div>
            <div style={{ padding: "8px 14px", borderRadius: 12, background: "#00C875", color: "#000", fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
              Spin!
            </div>
          </div>

          {/* Mystery Box card */}
          <div className="mt-4 rounded-3xl p-5 flex items-center gap-4"
            style={{ background: "linear-gradient(135deg, #0d0a1f 0%, #130820 100%)", border: "1.5px solid rgba(168,85,247,0.25)", cursor: "pointer" }}
            onClick={() => setShowMystery(true)}
          >
            <div style={{ width: 52, height: 52, borderRadius: 16, background: "rgba(168,85,247,0.12)", border: "1.5px solid rgba(168,85,247,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 24 }}>
              🎁
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#F5F2EA", marginBottom: 2 }}>Mystery Box</div>
              <div style={{ fontSize: 12, color: "rgba(245,242,234,0.5)" }}>Open boxes daily — win up to Rs 200!</div>
            </div>
            <div style={{ padding: "8px 14px", borderRadius: 12, background: "#a855f7", color: "#fff", fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
              Open!
            </div>
          </div>

          {/* Redeem code card */}
          <div className="mt-4 rounded-3xl p-5" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="flex items-center gap-2 mb-3">
              <Gift size={15} style={{ color: "#F4C842" }} />
              <span className="text-xs uppercase tracking-widest font-semibold" style={{ color: "rgba(245,242,234,0.5)" }}>Redeem Code</span>
            </div>
            {redeemMsg && (
              <div className="mb-3 px-3 py-2 rounded-xl text-xs" style={{ background: redeemMsg.ok ? "rgba(0,200,117,0.1)" : "rgba(232,99,58,0.1)", color: redeemMsg.ok ? "#00C875" : "#E8633A", border: `1px solid ${redeemMsg.ok ? "rgba(0,200,117,0.25)" : "rgba(232,99,58,0.25)"}` }}>
                {redeemMsg.text}
              </div>
            )}
            <form onSubmit={handleRedeem} className="flex gap-2">
              <input
                value={redeemInput}
                onChange={e => { setRedeemInput(e.target.value.toUpperCase()); setRedeemMsg(null); }}
                placeholder="Enter promo code…"
                style={{ flex: 1, padding: "10px 14px", borderRadius: 12, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#F5F2EA", fontSize: 12, fontFamily: "var(--font-mono, monospace)", letterSpacing: 1, outline: "none" }}
              />
              <button type="submit" disabled={redeemLoading || !redeemInput.trim()}
                style={{ padding: "10px 16px", borderRadius: 12, background: "#F4C842", color: "#000", fontSize: 12, fontWeight: 800, border: "none", cursor: "pointer", opacity: redeemLoading || !redeemInput.trim() ? 0.5 : 1, flexShrink: 0 }}>
                {redeemLoading ? "…" : "Claim"}
              </button>
            </form>
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

          {/* History card */}
          <div className="mt-4 rounded-3xl p-5" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="flex items-center gap-2 mb-3">
              <History size={15} style={{ color: "#00C875" }} />
              <span className="text-xs uppercase tracking-widest font-semibold" style={{ color: "rgba(245,242,234,0.5)" }}>History</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {([
                { label: "Pending", filter: "pending" as HistoryFilter, icon: Clock, color: "#F4C842" },
                { label: "Withdraw", filter: "withdraw" as HistoryFilter, icon: ArrowUpFromLine, color: "#00C875" },
                { label: "Deposit", filter: "deposit" as HistoryFilter, icon: Banknote, color: "#00C875" },
              ]).map((item) => (
                <button key={item.filter} onClick={() => openHistory(item.filter)}
                  className="flex flex-col items-center gap-2 py-3 rounded-2xl transition-all active:scale-95"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <item.icon size={18} style={{ color: item.color }} />
                  <span className="text-xs font-medium" style={{ color: "rgba(245,242,234,0.7)" }}>{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Tasks tab ── */}
      {tab === "tasks" && (
        <div className="px-4 pt-4 pb-6 w-full max-w-2xl mx-auto">
          <h2 className="font-display text-xl mb-5" style={{ color: "#F5F2EA" }}>Tasks</h2>
          <TasksTab onRewardEarned={refreshBalance} />
        </div>
      )}

      {/* ── Referral tab ── */}
      {tab === "referral" && (
        <div className="px-4 pt-4 pb-6 w-full max-w-2xl mx-auto">
          <h2 className="font-display text-xl mb-4" style={{ color: "#F5F2EA" }}>Referral</h2>

          {/* Link + code */}
          <div className="rounded-3xl p-5 mb-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="text-sm font-semibold mb-1" style={{ color: "#F5F2EA" }}>Your referral link</div>
            <div className="text-xs mb-3" style={{ color: "rgba(245,242,234,0.45)" }}>Share and earn {referralStats?.bonusRate ?? 5}% when friends buy a plan.</div>
            <div className="min-w-0 flex gap-2 mb-3">
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

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="rounded-2xl p-3 text-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="font-mono-tabular text-xl font-bold mb-0.5 gradient-text">{referralStats?.totalReferrals ?? "0"}</div>
              <div className="text-xs" style={{ color: "rgba(245,242,234,0.45)" }}>Referrals</div>
            </div>
            <div className="rounded-2xl p-3 text-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="font-mono-tabular text-xl font-bold mb-0.5 gradient-text">₨{referralStats ? referralStats.totalBonusEarned.toFixed(0) : "0"}</div>
              <div className="text-xs" style={{ color: "rgba(245,242,234,0.45)" }}>Earned</div>
            </div>
            <div className="rounded-2xl p-3 text-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="font-mono-tabular text-xl font-bold mb-0.5 gradient-text">{referralStats?.bonusRate ?? 5}%</div>
              <div className="text-xs" style={{ color: "rgba(245,242,234,0.45)" }}>Your rate</div>
            </div>
          </div>

          {/* Referred users list */}
          <div className="rounded-3xl p-4 mb-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="text-xs uppercase tracking-widest font-semibold mb-3" style={{ color: "rgba(245,242,234,0.4)" }}>
              People you referred ({referralDetailsLoading ? "…" : (referralDetails?.referredUsers.length ?? 0)})
            </div>
            {referralDetailsLoading ? (
              <div className="text-xs text-center py-4" style={{ color: "rgba(245,242,234,0.3)" }}>Loading…</div>
            ) : (referralDetails?.referredUsers ?? []).length === 0 ? (
              <div className="text-xs text-center py-4" style={{ color: "rgba(245,242,234,0.3)" }}>No referrals yet. Share your link to earn!</div>
            ) : (
              <div className="flex flex-col gap-2">
                {referralDetails!.referredUsers.map((u) => (
                  <div key={u.id} className="flex items-center justify-between px-3 py-2.5 rounded-2xl" style={{ background: "rgba(255,255,255,0.04)" }}>
                    <div>
                      <div className="text-sm font-semibold" style={{ color: "#F5F2EA" }}>{u.name}</div>
                      <div className="text-xs" style={{ color: "rgba(245,242,234,0.4)" }}>Joined {new Date(u.joinedAt).toLocaleDateString()}</div>
                    </div>
                    <div className="text-right">
                      {parseInt(u.plansBought) > 0 ? (
                        <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ background: "rgba(0,200,117,0.15)", color: "#00C875" }}>
                          {u.plansBought} plan{parseInt(u.plansBought) > 1 ? "s" : ""} bought
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(245,242,234,0.35)" }}>
                          No plan yet
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bonus earnings history */}
          <div className="rounded-3xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="text-xs uppercase tracking-widest font-semibold mb-3" style={{ color: "rgba(245,242,234,0.4)" }}>
              Referral bonus history ({referralDetailsLoading ? "…" : (referralDetails?.bonuses.length ?? 0)})
            </div>
            {referralDetailsLoading ? (
              <div className="text-xs text-center py-4" style={{ color: "rgba(245,242,234,0.3)" }}>Loading…</div>
            ) : (referralDetails?.bonuses ?? []).length === 0 ? (
              <div className="text-xs text-center py-4" style={{ color: "rgba(245,242,234,0.3)" }}>No bonus earnings yet.</div>
            ) : (
              <div className="flex flex-col gap-2">
                {referralDetails!.bonuses.map((b) => (
                  <div key={b.id} className="flex items-center justify-between px-3 py-2.5 rounded-2xl" style={{ background: "rgba(0,200,117,0.05)", border: "1px solid rgba(0,200,117,0.1)" }}>
                    <div>
                      <div className="text-sm font-semibold" style={{ color: "#F5F2EA" }}>{b.referredUserName}</div>
                      <div className="text-xs" style={{ color: "rgba(245,242,234,0.4)" }}>{b.planName} · {new Date(b.createdAt).toLocaleDateString()}</div>
                    </div>
                    <div className="font-mono-tabular font-bold text-sm" style={{ color: "#00C875" }}>+₨{parseFloat(b.amount).toFixed(0)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Plans tab ── */}
      {tab === "plans" && (
        <div className="px-4 pt-4 pb-6 w-full max-w-2xl mx-auto">
          <h2 className="font-display text-xl mb-4" style={{ color: "#F5F2EA" }}>Plans</h2>

          {/* Active plans banner — show all active plans */}
          {myPlanIds.length > 0 && (
            <div className="flex flex-col gap-2 mb-4">
              {plans.filter(p => myPlanIds.includes(p.id)).map(p => (
                <div key={p.id} className="rounded-2xl px-4 py-3 flex items-center gap-3" style={{ background: "#0a2a18", border: "1px solid #1a4a2e" }}>
                  <Trophy size={16} style={{ color: "#00C875" }} />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold" style={{ color: "#00C875" }}>Active: {p.name}</div>
                  </div>
                  <span className="text-xs font-bold px-2 py-1 rounded-full shrink-0" style={{ background: "rgba(0,200,117,0.15)", color: "#00C875" }}>ACTIVE</span>
                </div>
              ))}
            </div>
          )}

          {/* Purchase message */}
          {purchaseMsg && (
            <div className="rounded-2xl px-4 py-3 mb-4 text-sm" style={{ background: purchaseMsg.type === "ok" ? "#0a2a18" : "#2a0a0a", color: purchaseMsg.type === "ok" ? "#00C875" : "#E8633A", border: `1px solid ${purchaseMsg.type === "ok" ? "#1a4a2e" : "#4a1a1a"}` }}>
              {purchaseMsg.text}
            </div>
          )}

          {/* Plans list */}
          {plans.length === 0 ? (
            <div className="text-center py-16 text-sm" style={{ color: "rgba(245,242,234,0.4)" }}>No plans available yet.</div>
          ) : (
            <div>
              {plans.map((plan, idx) => {
                const price = parseFloat(plan.price as unknown as string);
                const daily = plan.dailyEarning ? parseFloat(plan.dailyEarning as unknown as string) : null;
                const maxU = plan.maxUsers ?? null;
                const curU = plan.currentUsers ?? 0;
                const isSoldOut = maxU ? curU >= maxU : false;

                return (
                  <div key={plan.id} style={{
                    background: "#0d2a1a",
                    border: "1px solid #1a4a2e",
                    borderRadius: 24,
                    padding: 20,
                    marginBottom: idx < plans.length - 1 ? 16 : 0,
                  }}>
                    {/* Top row: logo + name */}
                    <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
                      <div style={{ width: 64, height: 64, borderRadius: 16, background: "#0a1f14", border: "1px solid #1a4a2e", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
                        {plan.logoUrl ? <img src={plan.logoUrl} alt={plan.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Trophy size={28} color="#00C875" />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" as const, marginBottom: 2 }}>
                          <span style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, color: "#F5F2EA" }}>{plan.name}</span>
                          {plan.isPopular && <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 99, background: "#00C875", color: "#000" }}>POPULAR</span>}
                        </div>
                        <span style={{ fontSize: 12, color: "#5a8a6a" }}>{plan.durationDays} days</span>
                      </div>
                    </div>

                    {/* Price */}
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 30, fontWeight: 700, color: "#00C875", marginBottom: 4 }}>Rs{price.toLocaleString()}</div>
                    {daily && <div style={{ fontSize: 12, color: "#5a8a6a", marginBottom: 16 }}>Rs{daily.toLocaleString()}/day · Total: Rs{(daily * plan.durationDays).toLocaleString()}</div>}

                    {/* Stats row — no rgba, no grid */}
                    <div style={{ display: "flex", borderTop: "1px solid #1a4a2e", paddingTop: 16, marginBottom: 20 }}>
                      <div style={{ flex: 1, textAlign: "center" as const }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#F5F2EA", marginBottom: 2 }}>{maxU ? (isSoldOut ? "Sold out" : `${curU}/${maxU}`) : "∞"}</div>
                        <div style={{ fontSize: 11, color: "#5a8a6a" }}>{maxU ? "Slots" : "Unlimited"}</div>
                      </div>
                      <div style={{ flex: 1, textAlign: "center" as const, borderLeft: "1px solid #1a4a2e", borderRight: "1px solid #1a4a2e" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#F5F2EA", marginBottom: 2 }}>{referralStats?.bonusRate ?? 5}%</div>
                        <div style={{ fontSize: 11, color: "#5a8a6a" }}>Referral</div>
                      </div>
                      <div style={{ flex: 1, textAlign: "center" as const }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#F5F2EA", marginBottom: 2 }}>100%</div>
                        <div style={{ fontSize: 11, color: "#5a8a6a" }}>Secure</div>
                      </div>
                    </div>

                    {/* CTA */}
                    {myPlanIds.includes(plan.id) ? (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px 0", borderRadius: 16, background: "#0a2a18", border: "1px solid #1a4a2e", fontSize: 14, fontWeight: 700, color: "#00C875" }}>
                        <CheckCircle2 size={16} color="#00C875" /> Plan Active
                      </div>
                    ) : purchasedPlanIds.includes(plan.id) ? (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px 0", borderRadius: 16, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", fontSize: 13, color: "rgba(245,242,234,0.35)" }}>
                        <Lock size={13} /> Already Purchased
                      </div>
                    ) : isSoldOut ? (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px 0", borderRadius: 16, background: "#111", fontSize: 14, color: "#444" }}>
                        <Lock size={13} /> Sold out
                      </div>
                    ) : (
                      <button onClick={() => handlePurchase(plan.id)} disabled={purchasing === plan.id}
                        style={{ width: "100%", padding: "14px 0", borderRadius: 16, background: "#00C875", color: "#000", fontSize: 14, fontWeight: 700, border: "none", cursor: "pointer", opacity: purchasing === plan.id ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                        {purchasing === plan.id ? "Activating…" : <><span>Activate Plan</span><ChevronRight size={16} /></>}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Menu tab ── */}
      {tab === "menu" && (
        <div className="px-4 pt-4 pb-6 w-full max-w-2xl mx-auto">
          <h2 className="font-display text-xl mb-5" style={{ color: "#F5F2EA" }}>Menu</h2>
          <div className="flex flex-col gap-3">
            <button onClick={() => setTab("profile")} className="flex items-center gap-3 px-5 py-4 rounded-2xl text-left" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F2EA" }}>
              <UserCircle size={18} style={{ color: "#00C875" }} />
              <div>
                <div className="text-sm font-medium">Profile</div>
                <div className="text-xs" style={{ color: "rgba(245,242,234,0.4)" }}>{user?.name} · {user?.email}</div>
              </div>
            </button>
            <button onClick={() => router.push("/dashboard/deposit")} className="flex items-center gap-3 px-5 py-4 rounded-2xl text-left" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F2EA" }}>
              <Banknote size={18} style={{ color: "#00C875" }} />
              <span className="text-sm font-medium">Deposit funds</span>
            </button>
            <button onClick={() => router.push("/dashboard/withdraw")} className="flex items-center gap-3 px-5 py-4 rounded-2xl text-left" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F2EA" }}>
              <ArrowUpFromLine size={18} style={{ color: "#00C875" }} />
              <span className="text-sm font-medium">Withdraw earnings</span>
            </button>
            <button onClick={() => router.push("/dashboard/help")} className="flex items-center gap-3 px-5 py-4 rounded-2xl text-left" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F2EA" }}>
              <PlayCircle size={18} style={{ color: "#00C875" }} />
              <span className="text-sm font-medium">Help & Tutorials</span>
            </button>
            <Link href="/" className="flex items-center gap-3 px-5 py-4 rounded-2xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F2EA" }}>
              <Home size={18} style={{ color: "#00C875" }} />
              <span className="text-sm font-medium">Go to main site</span>
            </Link>
            <button onClick={() => logout()} className="flex items-center gap-3 px-5 py-4 rounded-2xl text-left w-full" style={{ background: "rgba(232,99,58,0.06)", border: "1px solid rgba(232,99,58,0.15)", color: "#E8633A" }}>
              <LogOut size={18} style={{ color: "#E8633A" }} />
              <span className="text-sm font-medium">Sign out</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Profile tab ── */}
      {tab === "profile" && <ProfileTab user={user} onBack={() => setTab("menu")} />}

      {/* ── History tab ── */}
      {tab === "history" && (
        <div className="px-4 pt-4 pb-6 w-full max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-3 mb-5">
            <button onClick={() => setTab("main")} className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "rgba(255,255,255,0.07)" }}>
              <ChevronLeft size={18} style={{ color: "#F5F2EA" }} />
            </button>
            <h2 className="font-display text-xl" style={{ color: "#F5F2EA" }}>History</h2>
          </div>

          {/* Filter pills */}
          <div className="flex gap-2 mb-5">
            {([
              { label: "Pending Tasks", filter: "pending" as HistoryFilter },
              { label: "Withdrawals", filter: "withdraw" as HistoryFilter },
              { label: "Deposits", filter: "deposit" as HistoryFilter },
            ]).map((item) => (
              <button key={item.filter} onClick={() => setHistoryFilter(item.filter)}
                className="px-4 py-2 rounded-xl text-xs font-semibold transition-all"
                style={{
                  background: historyFilter === item.filter ? "#00C875" : "rgba(255,255,255,0.06)",
                  color: historyFilter === item.filter ? "#000" : "rgba(245,242,234,0.55)",
                  border: historyFilter === item.filter ? "none" : "1px solid rgba(255,255,255,0.08)",
                }}>
                {item.label}
              </button>
            ))}
          </div>

          {/* Loading */}
          {histLoading ? (
            <div className="text-center py-16 text-sm" style={{ color: "rgba(245,242,234,0.4)" }}>Loading…</div>
          ) : (
            <>
              {/* ─ Pending Tasks ─ */}
              {historyFilter === "pending" && (
                histSubs.length === 0 ? (
                  <div className="text-center py-16 text-sm" style={{ color: "rgba(245,242,234,0.4)" }}>No task submissions yet.</div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {histSubs.map((s) => (
                      <div key={s.id} className="rounded-2xl px-4 py-3.5" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold truncate mb-0.5" style={{ color: "#F5F2EA" }}>{s.title || s.taskTitle || "Task"}</div>
                            <div className="text-xs" style={{ color: "rgba(245,242,234,0.4)" }}>{new Date(s.createdAt).toLocaleDateString()}</div>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                              style={{
                                background: s.status === "APPROVED" ? "rgba(0,200,117,0.15)" : s.status === "REJECTED" ? "rgba(232,99,58,0.15)" : "rgba(244,200,66,0.15)",
                                color: s.status === "APPROVED" ? "#00C875" : s.status === "REJECTED" ? "#E8633A" : "#F4C842",
                              }}>
                              {s.status}
                            </span>
                            {s.rewardAmount && (
                              <span className="text-xs font-semibold" style={{ color: "#00C875" }}>Rs{parseFloat(s.rewardAmount).toFixed(0)}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}

              {/* ─ Withdrawals ─ */}
              {historyFilter === "withdraw" && (
                histWithdrawals.length === 0 ? (
                  <div className="text-center py-16 text-sm" style={{ color: "rgba(245,242,234,0.4)" }}>No withdrawals yet.</div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {histWithdrawals.map((w) => (
                      <div key={w.id} className="rounded-2xl px-4 py-3.5" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold mb-0.5" style={{ color: "#F5F2EA" }}>
                              Rs{parseFloat(w.amount).toLocaleString()}
                            </div>
                            <div className="text-xs" style={{ color: "rgba(245,242,234,0.4)" }}>
                              {w.method.replace("_", " ")} · {new Date(w.createdAt).toLocaleDateString()}
                            </div>
                            <div className="text-xs mt-0.5" style={{ color: "rgba(245,242,234,0.35)" }}>{w.accountNumber}</div>
                          </div>
                          <span className="text-xs font-bold px-2.5 py-1 rounded-full shrink-0"
                            style={{
                              background: w.status === "PAID" || w.status === "APPROVED" ? "rgba(0,200,117,0.15)" : w.status === "REJECTED" ? "rgba(232,99,58,0.15)" : "rgba(244,200,66,0.15)",
                              color: w.status === "PAID" || w.status === "APPROVED" ? "#00C875" : w.status === "REJECTED" ? "#E8633A" : "#F4C842",
                            }}>
                            {w.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}

              {/* ─ Deposits ─ */}
              {historyFilter === "deposit" && (
                histDeposits.length === 0 ? (
                  <div className="text-center py-16 text-sm" style={{ color: "rgba(245,242,234,0.4)" }}>No deposits yet.</div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {histDeposits.map((d) => (
                      <div key={d.id} className="rounded-2xl px-4 py-3.5" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold mb-0.5" style={{ color: "#F5F2EA" }}>
                              Rs{parseFloat(d.amount).toLocaleString()}
                            </div>
                            <div className="text-xs" style={{ color: "rgba(245,242,234,0.4)" }}>
                              {d.method.replace("_", " ")} · {new Date(d.createdAt).toLocaleDateString()}
                            </div>
                            {d.transactionId && (
                              <div className="text-xs mt-0.5 font-mono" style={{ color: "rgba(245,242,234,0.3)" }}>{d.transactionId}</div>
                            )}
                          </div>
                          <span className="text-xs font-bold px-2.5 py-1 rounded-full shrink-0"
                            style={{
                              background: d.status === "APPROVED" ? "rgba(0,200,117,0.15)" : d.status === "REJECTED" ? "rgba(232,99,58,0.15)" : "rgba(244,200,66,0.15)",
                              color: d.status === "APPROVED" ? "#00C875" : d.status === "REJECTED" ? "#E8633A" : "#F4C842",
                            }}>
                            {d.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </>
          )}
        </div>
      )}

      </div>{/* end scrollable content */}

      {/* Floating game buttons */}
      {!showSpin && !showMystery && (
        <div style={{ position: "fixed", right: 0, top: "50%", transform: "translateY(-50%)", zIndex: 40, display: "flex", flexDirection: "column", gap: 6 }}>
          <button
            onClick={() => setShowSpin(true)}
            title="Lucky Wheel"
            style={{
              width: 50, height: 50, borderRadius: "14px 0 0 14px",
              background: "linear-gradient(135deg, #0d3a1a 0%, #00C875 100%)",
              border: "none", borderRight: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22,
              boxShadow: "-3px 0 16px rgba(0,200,117,0.35)",
            }}
          >🎡</button>
          <button
            onClick={() => setShowMystery(true)}
            title="Mystery Box"
            style={{
              width: 50, height: 50, borderRadius: "14px 0 0 14px",
              background: "linear-gradient(135deg, #1a0535 0%, #a855f7 100%)",
              border: "none", borderRight: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22,
              boxShadow: "-3px 0 16px rgba(168,85,247,0.35)",
            }}
          >🎁</button>
        </div>
      )}

      {/* Lucky Wheel Modal */}
      {showSpin && (
        <SpinWheelModal
          onClose={() => { setShowSpin(false); refreshBalance(); }}
          onWin={() => { refreshBalance(); }}
        />
      )}

      {/* Mystery Box Modal */}
      {showMystery && (
        <MysteryBoxModal
          onClose={() => { setShowMystery(false); refreshBalance(); }}
          onWin={() => { refreshBalance(); }}
        />
      )}

      {/* ── Bottom navigation ── */}
      <div style={{ flexShrink: 0, background: "#0A1A12", paddingBottom: "env(safe-area-inset-bottom, 0px)", display: tab === "profile" ? "none" : undefined }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around", background: "#0f2018", borderTop: "1px solid #1a2e22", paddingTop: 8, paddingBottom: 10, maxWidth: 640, margin: "0 auto" }}>
          {[
            { id: "main" as Tab, icon: Home, label: "Main" },
            { id: "tasks" as Tab, icon: ListChecks, label: "Tasks" },
            { id: "referral" as Tab, icon: Users, label: "Referral" },
            { id: "plans" as Tab, icon: Trophy, label: "Plans" },
            { id: "menu" as Tab, icon: Menu, label: "Menu" },
          ].map((item) => {
            const active = tab === item.id;
            const Icon = item.icon;
            const isCenter = item.id === "referral";
            return (
              <button key={item.id} onClick={() => setTab(item.id)}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "4px 12px", background: "none", border: "none", cursor: "pointer" }}>
                <div style={{ width: isCenter ? 44 : 28, height: isCenter ? 44 : 28, borderRadius: isCenter ? 22 : 8, background: isCenter ? (active ? "#00C875" : "#0d2a1a") : "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon size={isCenter ? 22 : 20} style={{ color: active ? "#00C875" : "#4a6a5a" }} />
                </div>
                <span style={{ fontSize: 10, fontWeight: 500, color: active ? "#00C875" : "#4a6a5a" }}>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Profile Tab component
// ─────────────────────────────────────────────
import { User } from "@/lib/types";

function ProfileTab({ user, onBack }: { user: User; onBack: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.name ?? "");
  const [phone, setPhone] = useState(user.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    setMsg(null);
    try {
      await api.patch("/auth/profile", { name: name.trim(), phone: phone.trim() || null });
      setMsg({ ok: true, text: "Profile updated!" });
      setEditing(false);
    } catch (err: unknown) {
      const text = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Update failed.";
      setMsg({ ok: false, text });
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setName(user.name ?? "");
    setPhone(user.phone ?? "");
    setEditing(false);
    setMsg(null);
  }

  return (
    <div className="px-4 pt-4 pb-20 w-full max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "rgba(255,255,255,0.07)" }}>
          <ChevronLeft size={18} style={{ color: "#F5F2EA" }} />
        </button>
        <h2 className="font-display text-xl" style={{ color: "#F5F2EA" }}>My Profile</h2>
        {!editing && (
          <button onClick={() => setEditing(true)} className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold"
            style={{ background: "rgba(0,200,117,0.12)", color: "#00C875", border: "1px solid rgba(0,200,117,0.2)" }}>
            <Pencil size={12} /> Edit
          </button>
        )}
      </div>

      {/* Avatar circle */}
      <div className="flex flex-col items-center mb-6">
        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-3"
          style={{ background: "linear-gradient(135deg,#0d3a1a,#00C875)", border: "3px solid rgba(0,200,117,0.3)" }}>
          <span className="font-display text-3xl font-bold" style={{ color: "#fff" }}>
            {(user.name ?? "?")[0].toUpperCase()}
          </span>
        </div>
        <div className="text-base font-bold" style={{ color: "#F5F2EA" }}>{user.name}</div>
        <div className="text-xs mt-1" style={{ color: "rgba(245,242,234,0.4)" }}>Member since {new Date(user.createdAt).toLocaleDateString()}</div>
      </div>

      {/* Status message */}
      {msg && (
        <div className="mb-4 px-4 py-3 rounded-2xl text-sm text-center"
          style={{ background: msg.ok ? "rgba(0,200,117,0.1)" : "rgba(232,99,58,0.1)", color: msg.ok ? "#00C875" : "#E8633A", border: `1px solid ${msg.ok ? "rgba(0,200,117,0.2)" : "rgba(232,99,58,0.2)"}` }}>
          {msg.text}
        </div>
      )}

      {/* Fields */}
      <div className="rounded-3xl overflow-hidden" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
        {/* Name */}
        <div className="px-5 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-2 mb-1">
            <UserCircle size={14} style={{ color: "#00C875" }} />
            <span className="text-xs uppercase tracking-wide font-medium" style={{ color: "rgba(245,242,234,0.4)" }}>Full Name</span>
          </div>
          {editing ? (
            <input value={name} onChange={e => setName(e.target.value)} className="w-full mt-1 px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(0,200,117,0.3)", color: "#F5F2EA" }} />
          ) : (
            <div className="text-sm font-semibold mt-1" style={{ color: "#F5F2EA" }}>{user.name || "—"}</div>
          )}
        </div>

        {/* Email */}
        <div className="px-5 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-2 mb-1">
            <Mail size={14} style={{ color: "#00C875" }} />
            <span className="text-xs uppercase tracking-wide font-medium" style={{ color: "rgba(245,242,234,0.4)" }}>Email</span>
          </div>
          <div className="text-sm font-semibold mt-1" style={{ color: "#F5F2EA" }}>{user.email}</div>
          <div className="text-xs mt-0.5" style={{ color: "rgba(245,242,234,0.3)" }}>Email cannot be changed</div>
        </div>

        {/* Phone */}
        <div className="px-5 py-4">
          <div className="flex items-center gap-2 mb-1">
            <Phone size={14} style={{ color: "#00C875" }} />
            <span className="text-xs uppercase tracking-wide font-medium" style={{ color: "rgba(245,242,234,0.4)" }}>Phone Number</span>
          </div>
          {editing ? (
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="03XX-XXXXXXX" className="w-full mt-1 px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(0,200,117,0.3)", color: "#F5F2EA" }} />
          ) : (
            <div className="text-sm font-semibold mt-1" style={{ color: user.phone ? "#F5F2EA" : "rgba(245,242,234,0.3)" }}>
              {user.phone || "Not set"}
            </div>
          )}
        </div>
      </div>

      {/* Save / Cancel */}
      {editing && (
        <div className="flex gap-3 mt-4">
          <button onClick={handleCancel} className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-semibold"
            style={{ background: "rgba(255,255,255,0.06)", color: "rgba(245,242,234,0.6)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <XIcon size={15} /> Cancel
          </button>
          <button onClick={handleSave} disabled={saving || !name.trim()} className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-bold disabled:opacity-50"
            style={{ background: "#00C875", color: "#000" }}>
            <Save size={15} /> {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      )}
    </div>
  );
}
