"use client";

import { useState } from "react";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { useToast } from "@/components/ToastProvider";

const METHODS = [
  { value: "EASYPAISA", label: "EasyPaisa" },
  { value: "JAZZCASH", label: "JazzCash" },
  { value: "BANK_TRANSFER", label: "Bank transfer" },
];

const MIN_WITHDRAWAL = 500;
const CARD = { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" };
const INPUT_STYLE = { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "var(--color-surface)" };

export function WithdrawTab() {
  const toast = useToast();
  const { user, refreshUser } = useAuth();
  const [method, setMethod] = useState("EASYPAISA");
  const [amount, setAmount] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<"idle" | "sent">("idle");
  const [error, setError] = useState("");

  const balance = parseFloat(user?.balance || "0");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await api.post("/withdrawals", { method, amount: parseFloat(amount), accountName, accountNumber });
      setResult("sent");
      toast("Withdrawal request submitted! We'll process it within 24 hours.", "success");
      setAmount(""); setAccountName(""); setAccountNumber("");
      await refreshUser();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Withdrawal request failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (result === "sent") {
    return (
      <div className="p-10 rounded-2xl text-center" style={CARD}>
        <CheckCircle2 size={36} style={{ color: "var(--color-accent)" }} className="mx-auto mb-4" />
        <h3 className="font-display text-xl mb-2" style={{ color: "var(--color-surface)" }}>Withdrawal requested</h3>
        <p className="text-sm mb-6" style={{ color: "rgba(245,242,234,0.55)" }}>
          The amount has been reserved from your wallet. Once approved, we&apos;ll send the payment to your account.
        </p>
        <button onClick={() => setResult("idle")} className="text-sm font-medium" style={{ color: "var(--color-accent)" }}>
          Request another withdrawal
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md p-6 rounded-2xl" style={CARD}>
      <div className="flex justify-between items-baseline mb-5">
        <h3 className="font-display text-lg" style={{ color: "var(--color-surface)" }}>Request a withdrawal</h3>
        <span className="font-mono-tabular text-sm" style={{ color: "rgba(245,242,234,0.5)" }}>
          Available: ₨{balance.toFixed(2)}
        </span>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-sm mb-4 p-3 rounded-lg" style={{ background: "rgba(232,99,58,0.12)", color: "var(--color-alert)" }}>
          <AlertCircle size={15} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-wide" style={{ color: "rgba(245,242,234,0.45)" }}>Method</span>
          <select value={method} onChange={(e) => setMethod(e.target.value)}
            className="px-3 py-2.5 rounded-lg text-sm outline-none" style={INPUT_STYLE}>
            {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-wide" style={{ color: "rgba(245,242,234,0.45)" }}>Amount (min ₨{MIN_WITHDRAWAL})</span>
          <input type="number" min={MIN_WITHDRAWAL} max={balance} step="0.01" required value={amount}
            onChange={(e) => setAmount(e.target.value)} className="px-3 py-2.5 rounded-lg text-sm outline-none" style={INPUT_STYLE} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-wide" style={{ color: "rgba(245,242,234,0.45)" }}>Account holder name</span>
          <input required value={accountName} onChange={(e) => setAccountName(e.target.value)}
            className="px-3 py-2.5 rounded-lg text-sm outline-none" style={INPUT_STYLE} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-wide" style={{ color: "rgba(245,242,234,0.45)" }}>Account number</span>
          <input required value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)}
            className="px-3 py-2.5 rounded-lg text-sm outline-none" style={INPUT_STYLE} />
        </label>
        <button type="submit" disabled={submitting || balance < MIN_WITHDRAWAL}
          className="mt-1 px-4 py-3 rounded-lg text-sm font-medium disabled:opacity-60"
          style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}>
          {submitting ? "Submitting…" : "Request withdrawal"}
        </button>
        {balance < MIN_WITHDRAWAL && (
          <p className="text-xs" style={{ color: "rgba(245,242,234,0.45)" }}>
            You need at least ₨{MIN_WITHDRAWAL} to request a withdrawal.
          </p>
        )}
      </form>
    </div>
  );
}
