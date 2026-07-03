"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/lib/useRequireAuth";
import api from "@/lib/api";
import { PaymentMethodConfig, Deposit } from "@/lib/types";
import { ArrowLeft, CheckCircle2, AlertCircle, Upload, Copy, Check, Clock, XCircle } from "lucide-react";

const METHOD_LABELS: Record<string, string> = {
  EASYPAISA: "EasyPaisa",
  JAZZCASH: "JazzCash",
  BANK_TRANSFER: "Bank Transfer",
};
const METHOD_COLORS: Record<string, string> = {
  EASYPAISA: "#6BCB77",
  JAZZCASH: "#FF6B6B",
  BANK_TRANSFER: "#4ECDC4",
};

const INPUT = { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#F5F2EA" };

export default function DepositPage() {
  const router = useRouter();
  const { user, loading } = useRequireAuth();
  const [methods, setMethods] = useState<PaymentMethodConfig[]>([]);
  const [selected, setSelected] = useState("");
  const [amount, setAmount] = useState("");
  const [senderNo, setSenderNo] = useState("");
  const [txId, setTxId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<Deposit[]>([]);
  const [copied, setCopied] = useState("");

  useEffect(() => {
    if (!user) return;
    api.get("/deposits/methods").then((r) => {
      setMethods(r.data);
      if (r.data.length > 0) setSelected(r.data[0].method);
    }).catch(() => {});
    api.get("/deposits/my").then((r) => setHistory(r.data)).catch(() => {});
  }, [user]);

  const activeMethod = methods.find((m) => m.method === selected);

  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(""), 2000);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) { setError("Screenshot is required"); return; }
    setError("");
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("method", selected);
      fd.append("amount", amount);
      if (senderNo) fd.append("senderAccountNo", senderNo);
      if (txId) fd.append("transactionId", txId);
      fd.append("screenshot", file);
      await api.post("/deposits", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setDone(true);
      api.get("/deposits/my").then((r) => setHistory(r.data)).catch(() => {});
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Submission failed. Try again.");
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
        <h1 className="font-display text-xl" style={{ color: "#F5F2EA" }}>Deposit</h1>
      </div>

      <div className="px-4 pb-10 max-w-2xl mx-auto">
        {done ? (
          /* ── Success state ── */
          <div className="mt-10 rounded-3xl p-8 text-center" style={{ background: "rgba(0,200,117,0.07)", border: "1px solid rgba(0,200,117,0.2)" }}>
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5" style={{ background: "rgba(0,200,117,0.15)" }}>
              <CheckCircle2 size={32} style={{ color: "#00C875" }} />
            </div>
            <h2 className="font-display text-2xl mb-2" style={{ color: "#F5F2EA" }}>Deposit Submitted!</h2>
            <p className="text-sm mb-2" style={{ color: "rgba(245,242,234,0.55)" }}>Your deposit is under review. Wallet will be credited once approved.</p>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium mt-2 mb-6" style={{ background: "rgba(0,200,117,0.1)", color: "#00C875" }}>
              <Clock size={12} /> Approval within 30 minutes
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setDone(false); setAmount(""); setTxId(""); setSenderNo(""); setFile(null); }} className="flex-1 py-3 rounded-2xl text-sm font-semibold" style={{ background: "rgba(255,255,255,0.07)", color: "#F5F2EA" }}>
                New Deposit
              </button>
              <button onClick={() => router.push("/dashboard")} className="flex-1 py-3 rounded-2xl text-sm font-semibold" style={{ background: "#00C875", color: "#000" }}>
                Go to Dashboard
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* ── Payment methods ── */}
            <div className="mt-5">
              <p className="text-xs uppercase tracking-widest font-medium mb-3" style={{ color: "rgba(245,242,234,0.4)" }}>Select payment method</p>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {methods.map((m) => (
                  <button key={m.method} onClick={() => setSelected(m.method)}
                    className="shrink-0 px-5 py-3 rounded-2xl text-sm font-semibold transition-all"
                    style={{
                      background: selected === m.method ? "rgba(0,200,117,0.15)" : "rgba(255,255,255,0.04)",
                      border: selected === m.method ? "1.5px solid #00C875" : "1px solid rgba(255,255,255,0.08)",
                      color: selected === m.method ? "#00C875" : "rgba(245,242,234,0.7)",
                    }}>
                    {METHOD_LABELS[m.method] || m.method}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Account info ── */}
            {activeMethod && (
              <div className="mt-4 rounded-3xl p-5" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <p className="text-xs uppercase tracking-widest font-medium mb-4" style={{ color: "rgba(245,242,234,0.4)" }}>Send money to</p>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-xs mb-1" style={{ color: "rgba(245,242,234,0.45)" }}>Account Number</div>
                    <div className="font-mono-tabular text-lg font-bold" style={{ color: "#F5F2EA" }}>{activeMethod.accountNumber || "—"}</div>
                  </div>
                  {activeMethod.accountNumber && (
                    <button onClick={() => copyText(activeMethod.accountNumber!, "acc")} className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(0,200,117,0.12)", border: "1px solid rgba(0,200,117,0.2)" }}>
                      {copied === "acc" ? <Check size={15} style={{ color: "#00C875" }} /> : <Copy size={15} style={{ color: "#00C875" }} />}
                    </button>
                  )}
                </div>
                <div className="mb-3">
                  <div className="text-xs mb-1" style={{ color: "rgba(245,242,234,0.45)" }}>Account Name</div>
                  <div className="font-medium text-sm" style={{ color: "#F5F2EA" }}>{activeMethod.accountName || "—"}</div>
                </div>
                {activeMethod.instructions && (
                  <div className="mt-3 px-4 py-3 rounded-2xl text-xs leading-relaxed" style={{ background: "rgba(244,200,66,0.07)", border: "1px solid rgba(244,200,66,0.15)", color: "rgba(245,242,234,0.65)" }}>
                    ℹ️ {activeMethod.instructions}
                  </div>
                )}
              </div>
            )}

            {/* ── Form ── */}
            <div className="mt-4 rounded-3xl p-5" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <p className="text-xs uppercase tracking-widest font-medium mb-4" style={{ color: "rgba(245,242,234,0.4)" }}>Confirm your payment</p>

              {error && (
                <div className="flex items-center gap-2 text-sm mb-4 px-4 py-3 rounded-2xl" style={{ background: "rgba(232,99,58,0.1)", color: "#E8633A", border: "1px solid rgba(232,99,58,0.2)" }}>
                  <AlertCircle size={15} className="shrink-0" /> {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium uppercase tracking-wide" style={{ color: "rgba(245,242,234,0.5)" }}>Amount (PKR) *</span>
                  <input type="number" min="1" step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 1000" className="px-4 py-3 rounded-2xl text-sm outline-none" style={INPUT} />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium uppercase tracking-wide" style={{ color: "rgba(245,242,234,0.5)" }}>Your Account No. (sent from)</span>
                  <input value={senderNo} onChange={(e) => setSenderNo(e.target.value)} placeholder="03XX-XXXXXXX"
                    className="px-4 py-3 rounded-2xl text-sm outline-none" style={INPUT} />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium uppercase tracking-wide" style={{ color: "rgba(245,242,234,0.5)" }}>Transaction ID <span style={{ color: "rgba(245,242,234,0.3)" }}>(optional)</span></span>
                  <input value={txId} onChange={(e) => setTxId(e.target.value)} placeholder="e.g. TXN123456"
                    className="px-4 py-3 rounded-2xl text-sm outline-none" style={INPUT} />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium uppercase tracking-wide" style={{ color: "rgba(245,242,234,0.5)" }}>Payment Screenshot *</span>
                  <div className="relative">
                    <input type="file" accept="image/*,.pdf" onChange={(e) => setFile(e.target.files?.[0] || null)}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10" />
                    <div className="px-4 py-4 rounded-2xl flex flex-col items-center gap-2 text-sm text-center"
                      style={{ background: file ? "rgba(0,200,117,0.07)" : "rgba(255,255,255,0.03)", border: file ? "1.5px solid rgba(0,200,117,0.3)" : "1.5px dashed rgba(255,255,255,0.15)", color: file ? "#00C875" : "rgba(245,242,234,0.4)" }}>
                      <Upload size={20} />
                      <span>{file ? file.name : "Tap to upload screenshot"}</span>
                    </div>
                  </div>
                </label>
                <button type="submit" disabled={submitting || !selected}
                  className="w-full py-4 rounded-2xl text-sm font-bold disabled:opacity-50 mt-1"
                  style={{ background: "#00C875", color: "#000" }}>
                  {submitting ? "Submitting…" : "Submit Deposit"}
                </button>
              </form>
            </div>
          </>
        )}

        {/* ── History ── */}
        {history.length > 0 && (
          <div className="mt-6">
            <p className="text-xs uppercase tracking-widest font-medium mb-3" style={{ color: "rgba(245,242,234,0.4)" }}>Recent deposits</p>
            <div className="flex flex-col gap-3">
              {history.slice(0, 5).map((d) => (
                <div key={d.id} className="rounded-2xl px-4 py-3.5 flex items-center justify-between" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <div>
                    <div className="text-sm font-semibold mb-0.5" style={{ color: "#F5F2EA" }}>₨{parseFloat(d.amount).toLocaleString()}</div>
                    <div className="text-xs" style={{ color: "rgba(245,242,234,0.4)" }}>{METHOD_LABELS[d.method]} · {new Date(d.createdAt).toLocaleDateString()}</div>
                  </div>
                  <StatusBadge status={d.status} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; bg: string; icon: React.ReactNode }> = {
    PENDING: { color: "#F4C842", bg: "rgba(244,200,66,0.1)", icon: <Clock size={11} /> },
    APPROVED: { color: "#00C875", bg: "rgba(0,200,117,0.1)", icon: <CheckCircle2 size={11} /> },
    REJECTED: { color: "#E8633A", bg: "rgba(232,99,58,0.1)", icon: <XCircle size={11} /> },
  };
  const s = map[status] || map.PENDING;
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold" style={{ background: s.bg, color: s.color }}>
      {s.icon} {status.charAt(0) + status.slice(1).toLowerCase()}
    </div>
  );
}
