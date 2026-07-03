"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/lib/useRequireAuth";
import api from "@/lib/api";
import { Withdrawal } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import { ArrowLeft, CheckCircle2, AlertCircle, Wallet, Clock, XCircle, ArrowUpFromLine } from "lucide-react";

const METHODS = [
  { value: "EASYPAISA", label: "EasyPaisa" },
  { value: "JAZZCASH", label: "JazzCash" },
  { value: "BANK_TRANSFER", label: "Bank Transfer" },
];
const MIN = 500;
const INPUT = { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#F5F2EA" };

export default function WithdrawPage() {
  const router = useRouter();
  const { user, loading } = useRequireAuth();
  const { refreshUser } = useAuth();
  const [method, setMethod] = useState("EASYPAISA");
  const [amount, setAmount] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<Withdrawal[]>([]);

  const balance = parseFloat(user?.balance || "0");
  const canWithdraw = balance >= MIN;

  useEffect(() => {
    if (!user) return;
    api.get("/withdrawals/my").then((r) => setHistory(r.data)).catch(() => {});
  }, [user]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (amt > balance) { setError("Amount exceeds your wallet balance."); return; }
    if (amt < MIN) { setError(`Minimum withdrawal is ₨${MIN}.`); return; }
    setError("");
    setSubmitting(true);
    try {
      await api.post("/withdrawals", { method, amount: amt, accountName, accountNumber });
      setDone(true);
      api.get("/withdrawals/my").then((r) => setHistory(r.data)).catch(() => {});
      try { await refreshUser(); } catch {}
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Request failed. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !user) return null;

  return (
    <div className="min-h-screen w-full" style={{ background: "#0A1A12" }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-6 pb-4 sticky top-0 z-10" style={{ background: "#0A1A12", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <button onClick={() => router.back()} className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.07)" }}>
          <ArrowLeft size={18} style={{ color: "#F5F2EA" }} />
        </button>
        <h1 className="font-display text-xl" style={{ color: "#F5F2EA" }}>Withdraw</h1>
      </div>

      <div className="px-4 pb-10 max-w-2xl mx-auto">
        {/* Balance card */}
        <div className="mt-5 rounded-3xl p-5 flex items-center gap-4" style={{ background: "linear-gradient(135deg, #0d3d24, #0a2a18)", border: "1px solid rgba(0,200,117,0.2)" }}>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ background: "rgba(0,200,117,0.15)" }}>
            <Wallet size={22} style={{ color: "#00C875" }} />
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest font-medium mb-1" style={{ color: "rgba(245,242,234,0.5)" }}>Available Balance</div>
            <div className="font-mono-tabular text-3xl font-bold" style={{ color: "#00C875" }}>₨{balance.toFixed(2)}</div>
          </div>
        </div>

        {!canWithdraw && (
          <div className="mt-4 px-4 py-3 rounded-2xl text-sm flex items-center gap-2" style={{ background: "rgba(232,99,58,0.08)", border: "1px solid rgba(232,99,58,0.2)", color: "#E8633A" }}>
            <AlertCircle size={15} className="shrink-0" />
            Minimum balance of ₨{MIN} required to withdraw.
          </div>
        )}

        {done ? (
          /* ── Success ── */
          <div className="mt-6 rounded-3xl p-8 text-center" style={{ background: "rgba(0,200,117,0.07)", border: "1px solid rgba(0,200,117,0.2)" }}>
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5" style={{ background: "rgba(0,200,117,0.15)" }}>
              <CheckCircle2 size={32} style={{ color: "#00C875" }} />
            </div>
            <h2 className="font-display text-2xl mb-2" style={{ color: "#F5F2EA" }}>Request Submitted!</h2>
            <p className="text-sm mb-6" style={{ color: "rgba(245,242,234,0.55)" }}>Your withdrawal is being processed. We'll send the payment within 24 hours.</p>
            <div className="flex gap-3">
              <button onClick={() => { setDone(false); setAmount(""); setAccountName(""); setAccountNumber(""); }} className="flex-1 py-3 rounded-2xl text-sm font-semibold" style={{ background: "rgba(255,255,255,0.07)", color: "#F5F2EA" }}>
                New Request
              </button>
              <button onClick={() => router.push("/dashboard")} className="flex-1 py-3 rounded-2xl text-sm font-semibold" style={{ background: "#00C875", color: "#000" }}>
                Dashboard
              </button>
            </div>
          </div>
        ) : (
          /* ── Form ── */
          <div className="mt-4 rounded-3xl p-5" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <p className="text-xs uppercase tracking-widest font-medium mb-4" style={{ color: "rgba(245,242,234,0.4)" }}>Withdrawal details</p>

            {error && (
              <div className="flex items-center gap-2 text-sm mb-4 px-4 py-3 rounded-2xl" style={{ background: "rgba(232,99,58,0.1)", color: "#E8633A", border: "1px solid rgba(232,99,58,0.2)" }}>
                <AlertCircle size={15} className="shrink-0" /> {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {/* Method selector */}
              <div>
                <span className="text-xs font-medium uppercase tracking-wide mb-2 block" style={{ color: "rgba(245,242,234,0.5)" }}>Payment method</span>
                <div className="flex gap-2">
                  {METHODS.map((m) => (
                    <button key={m.value} type="button" onClick={() => setMethod(m.value)}
                      className="flex-1 py-2.5 rounded-2xl text-xs font-semibold transition-all"
                      style={{
                        background: method === m.value ? "rgba(0,200,117,0.12)" : "rgba(255,255,255,0.04)",
                        border: method === m.value ? "1.5px solid #00C875" : "1px solid rgba(255,255,255,0.08)",
                        color: method === m.value ? "#00C875" : "rgba(245,242,234,0.6)",
                      }}>
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium uppercase tracking-wide" style={{ color: "rgba(245,242,234,0.5)" }}>Amount (min ₨{MIN}) *</span>
                <input type="number" min={MIN} max={balance} step="0.01" required value={amount}
                  onChange={(e) => setAmount(e.target.value)} placeholder={`Min ₨${MIN}`}
                  className="px-4 py-3 rounded-2xl text-sm outline-none" style={INPUT} />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium uppercase tracking-wide" style={{ color: "rgba(245,242,234,0.5)" }}>Account holder name *</span>
                <input required value={accountName} onChange={(e) => setAccountName(e.target.value)}
                  placeholder="Full name on account" className="px-4 py-3 rounded-2xl text-sm outline-none" style={INPUT} />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium uppercase tracking-wide" style={{ color: "rgba(245,242,234,0.5)" }}>Account number *</span>
                <input required value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="03XX-XXXXXXX" className="px-4 py-3 rounded-2xl text-sm outline-none" style={INPUT} />
              </label>

              <button type="submit" disabled={submitting || !canWithdraw}
                className="w-full py-4 rounded-2xl text-sm font-bold disabled:opacity-40 mt-1 flex items-center justify-center gap-2"
                style={{ background: "#00C875", color: "#000" }}>
                <ArrowUpFromLine size={16} />
                {submitting ? "Submitting…" : "Request Withdrawal"}
              </button>
            </form>
          </div>
        )}

        {/* ── History ── */}
        {history.length > 0 && (
          <div className="mt-6">
            <p className="text-xs uppercase tracking-widest font-medium mb-3" style={{ color: "rgba(245,242,234,0.4)" }}>Recent withdrawals</p>
            <div className="flex flex-col gap-3">
              {history.slice(0, 5).map((w) => (
                <div key={w.id} className="rounded-2xl px-4 py-3.5 flex items-center justify-between" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <div>
                    <div className="text-sm font-semibold mb-0.5" style={{ color: "#F5F2EA" }}>₨{parseFloat(w.amount).toLocaleString()}</div>
                    <div className="text-xs" style={{ color: "rgba(245,242,234,0.4)" }}>
                      {w.method.replace("_", " ")} · {w.accountNumber} · {new Date(w.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <WStatusBadge status={w.status} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function WStatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; bg: string; icon: React.ReactNode }> = {
    PENDING: { color: "#F4C842", bg: "rgba(244,200,66,0.1)", icon: <Clock size={11} /> },
    APPROVED: { color: "#00C875", bg: "rgba(0,200,117,0.1)", icon: <CheckCircle2 size={11} /> },
    PAID: { color: "#00C875", bg: "rgba(0,200,117,0.1)", icon: <CheckCircle2 size={11} /> },
    REJECTED: { color: "#E8633A", bg: "rgba(232,99,58,0.1)", icon: <XCircle size={11} /> },
  };
  const s = map[status] || map.PENDING;
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold" style={{ background: s.bg, color: s.color }}>
      {s.icon} {status.charAt(0) + status.slice(1).toLowerCase()}
    </div>
  );
}
