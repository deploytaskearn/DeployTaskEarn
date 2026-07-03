"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { PaymentMethodConfig } from "@/lib/types";
import { CheckCircle2, AlertCircle, Upload } from "lucide-react";
import { useToast } from "@/components/ToastProvider";

const METHOD_LABELS: Record<string, string> = {
  EASYPAISA: "EasyPaisa",
  JAZZCASH: "JazzCash",
  BANK_TRANSFER: "Bank transfer",
};

const CARD = { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" };
const INPUT_STYLE = { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "var(--color-surface)" };

export function DepositTab() {
  const toast = useToast();
  const [methods, setMethods] = useState<PaymentMethodConfig[]>([]);
  const [selectedMethod, setSelectedMethod] = useState("");
  const [amount, setAmount] = useState("");
  const [senderAccountNo, setSenderAccountNo] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<"idle" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/deposits/methods").then((res) => {
      setMethods(res.data);
      if (res.data.length > 0) setSelectedMethod(res.data[0].method);
    }).catch(() => {});
  }, []);

  const activeMethod = methods.find((m) => m.method === selectedMethod);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!screenshot) { setError("Screenshot is required"); return; }
    setError("");
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("method", selectedMethod);
      formData.append("amount", amount);
      if (transactionId) formData.append("transactionId", transactionId);
      if (senderAccountNo) formData.append("senderAccountNo", senderAccountNo);
      formData.append("screenshot", screenshot);
      await api.post("/deposits", formData, { headers: { "Content-Type": "multipart/form-data" } });
      setResult("sent");
      toast("Deposit submitted! We'll verify within 30 minutes.", "success");
      setAmount(""); setTransactionId(""); setSenderAccountNo(""); setScreenshot(null);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Submission failed");
      setResult("error");
    } finally {
      setSubmitting(false);
    }
  }

  if (result === "sent") {
    return (
      <div className="p-10 rounded-2xl text-center" style={CARD}>
        <CheckCircle2 size={36} style={{ color: "var(--color-accent)" }} className="mx-auto mb-4" />
        <h3 className="font-display text-xl mb-2" style={{ color: "var(--color-surface)" }}>Deposit submitted!</h3>
        <p className="text-sm mb-2" style={{ color: "rgba(245,242,234,0.55)" }}>
          Your wallet will be credited once our team verifies the transaction.
        </p>
        <p className="text-xs mb-6 px-4 py-2 rounded-lg inline-block" style={{ background: "rgba(0,200,117,0.1)", color: "var(--color-accent)" }}>
          ⏱ Approval within 30 minutes
        </p>
        <br />
        <button onClick={() => setResult("idle")} className="text-sm font-medium" style={{ color: "var(--color-accent)" }}>
          Submit another deposit
        </button>
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="p-6 rounded-2xl" style={CARD}>
        <h3 className="font-display text-lg mb-4" style={{ color: "var(--color-surface)" }}>Choose a payment method</h3>
        <div className="flex flex-col gap-2 mb-5">
          {methods.map((m) => (
            <button key={m.method} onClick={() => setSelectedMethod(m.method)}
              className="text-left px-4 py-3 rounded-xl text-sm transition-colors"
              style={{
                border: selectedMethod === m.method ? "1px solid var(--color-accent)" : "1px solid rgba(255,255,255,0.1)",
                background: selectedMethod === m.method ? "rgba(0,200,117,0.1)" : "rgba(255,255,255,0.03)",
                color: "var(--color-surface)",
              }}>
              {METHOD_LABELS[m.method] || m.method}
            </button>
          ))}
        </div>

        {activeMethod && (
          <div className="text-sm p-4 rounded-xl" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(245,242,234,0.7)" }}>
            <div className="pb-2 mb-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="text-xs uppercase tracking-wide mb-1" style={{ color: "rgba(245,242,234,0.4)" }}>Send payment to</div>
              <div className="font-mono-tabular font-semibold" style={{ color: "var(--color-surface)" }}>{activeMethod.accountNumber}</div>
              <div style={{ color: "var(--color-surface)" }}>{activeMethod.accountName}</div>
            </div>
            {activeMethod.instructions && (
              <p className="text-xs leading-relaxed" style={{ color: "rgba(245,242,234,0.5)" }}>{activeMethod.instructions}</p>
            )}
          </div>
        )}

        <div className="mt-4 px-3 py-2.5 rounded-lg text-xs" style={{ background: "rgba(244,200,66,0.08)", border: "1px solid rgba(244,200,66,0.2)", color: "var(--color-gold)" }}>
          ⏱ Deposits approved within 30 minutes
        </div>
      </div>

      <div className="p-6 rounded-2xl" style={CARD}>
        <h3 className="font-display text-lg mb-4" style={{ color: "var(--color-surface)" }}>Confirm your transaction</h3>

        {error && (
          <div className="flex items-start gap-2 text-sm mb-4 p-3 rounded-lg" style={{ background: "rgba(232,99,58,0.12)", color: "var(--color-alert)" }}>
            <AlertCircle size={15} className="mt-0.5 shrink-0" /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-wide" style={{ color: "rgba(245,242,234,0.45)" }}>Amount (PKR)</span>
            <input type="number" min="1" step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)}
              className="px-3 py-2.5 rounded-lg text-sm outline-none" style={INPUT_STYLE} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-wide" style={{ color: "rgba(245,242,234,0.45)" }}>Your account number (sent from)</span>
            <input value={senderAccountNo} onChange={(e) => setSenderAccountNo(e.target.value)}
              className="px-3 py-2.5 rounded-lg text-sm outline-none" style={INPUT_STYLE} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-wide" style={{ color: "rgba(245,242,234,0.45)" }}>
              Transaction ID <span style={{ color: "rgba(245,242,234,0.3)" }}>(optional)</span>
            </span>
            <input value={transactionId} onChange={(e) => setTransactionId(e.target.value)}
              className="px-3 py-2.5 rounded-lg text-sm outline-none" style={INPUT_STYLE} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-wide flex items-center gap-1" style={{ color: "rgba(245,242,234,0.45)" }}>
              <Upload size={11} /> Screenshot <span style={{ color: "var(--color-alert)" }}>*required</span>
            </span>
            <div className="relative">
              <input type="file" accept="image/*,.pdf" required onChange={(e) => setScreenshot(e.target.files?.[0] || null)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10" />
              <div className="px-3 py-3 rounded-lg text-sm flex items-center gap-2" style={{ background: screenshot ? "rgba(0,200,117,0.08)" : "rgba(255,255,255,0.06)", border: screenshot ? "1px solid rgba(0,200,117,0.3)" : "1px dashed rgba(255,255,255,0.2)", color: screenshot ? "var(--color-accent)" : "rgba(245,242,234,0.4)" }}>
                <Upload size={14} />
                {screenshot ? screenshot.name : "Click to upload screenshot"}
              </div>
            </div>
          </label>
          <button type="submit" disabled={submitting || !selectedMethod}
            className="mt-1 px-4 py-3 rounded-lg text-sm font-semibold disabled:opacity-60"
            style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}>
            {submitting ? "Submitting…" : "Submit deposit"}
          </button>
        </form>
      </div>
    </div>
  );
}
