"use client";

import { useEffect, useState } from "react";
import api from "@/lib/admin-api";
import { Withdrawal } from "@/lib/types";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Check, X, Send, Copy } from "lucide-react";

const STATUS_FILTERS = ["PENDING", "APPROVED", "PAID", "REJECTED", "ALL"] as const;

export default function AdminWithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [filter, setFilter] = useState<typeof STATUS_FILTERS[number]>("PENDING");
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [note, setNote] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<string | null>(null);

  function load() {
    setLoading(true);
    const params = filter === "ALL" ? {} : { status: filter };
    api.get("/withdrawals/admin/all", { params }).then((res) => setWithdrawals(res.data)).catch(() => {}).finally(() => setLoading(false));
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function review(id: string, action: "APPROVE" | "REJECT" | "PAID") {
    setProcessingId(id);
    try {
      await api.post(`/withdrawals/admin/${id}/review`, { action, note: note[id] || undefined });
      load();
    } finally {
      setProcessingId(null);
    }
  }

  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div>
      <AdminPageHeader
        title="Withdrawals"
        subtitle="Approve payout requests, send the money manually, then mark as paid."
      />

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide transition-colors"
            style={{
              background: filter === f ? "var(--color-accent)" : "rgba(255,255,255,0.06)",
              color: filter === f ? "#000" : "rgba(245,242,234,0.6)",
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-10 text-center text-sm" style={{ color: "rgba(245,242,234,0.4)" }}>Loading…</div>
      ) : withdrawals.length === 0 ? (
        <div className="p-12 text-center rounded-2xl text-sm" style={{ background: "rgba(255,255,255,0.03)", color: "var(--color-muted)", border: "1px solid rgba(255,255,255,0.07)" }}>
          No {filter !== "ALL" ? filter.toLowerCase() : ""} withdrawals.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {withdrawals.map((w) => (
            <div key={w.id} className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>

              {/* Top row: amount + status */}
              <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono-tabular text-2xl font-bold" style={{ color: "var(--color-accent)" }}>
                      ₨{parseFloat(w.amount).toLocaleString()}
                    </span>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full uppercase" style={{ background: "rgba(255,255,255,0.07)", color: "rgba(245,242,234,0.6)" }}>
                      {w.method.replace("_", " ")}
                    </span>
                    {w.status !== "PENDING" && (
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full uppercase" style={{
                        background: w.status === "PAID" ? "rgba(0,200,117,0.12)" : w.status === "APPROVED" ? "rgba(244,200,66,0.12)" : "rgba(232,99,58,0.12)",
                        color: w.status === "PAID" ? "var(--color-accent)" : w.status === "APPROVED" ? "#F4C842" : "var(--color-alert)",
                      }}>
                        {w.status}
                      </span>
                    )}
                  </div>
                  <div className="text-sm font-semibold mb-0.5" style={{ color: "var(--color-surface)" }}>{w.userName}</div>
                  <div className="text-xs" style={{ color: "rgba(245,242,234,0.5)" }}>{w.userEmail}</div>
                </div>
                <div className="text-xs" style={{ color: "rgba(245,242,234,0.35)" }}>
                  {new Date(w.createdAt).toLocaleString()}
                </div>
              </div>

              {/* Account number highlight card */}
              <div className="rounded-2xl px-4 py-3 mb-4 flex items-center justify-between gap-3" style={{ background: "rgba(0,200,117,0.07)", border: "1.5px solid rgba(0,200,117,0.2)" }}>
                <div className="min-w-0">
                  <div className="text-xs mb-1" style={{ color: "rgba(0,200,117,0.6)" }}>Pay to — {w.accountName}</div>
                  <div className="font-mono text-xl font-bold tracking-wider truncate" style={{ color: "#00C875" }}>
                    {w.accountNumber}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => copyText(w.accountNumber, w.id)}
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all"
                  style={{
                    background: copied === w.id ? "rgba(0,200,117,0.25)" : "rgba(0,200,117,0.12)",
                    border: "1px solid rgba(0,200,117,0.3)",
                  }}
                >
                  {copied === w.id
                    ? <Check size={16} style={{ color: "#00C875" }} />
                    : <Copy size={16} style={{ color: "#00C875" }} />}
                </button>
              </div>

              {/* Actions */}
              {w.status === "PENDING" && (
                <div className="flex flex-col gap-2">
                  <input
                    placeholder="Note (optional — shown to user on reject)"
                    value={note[w.id] || ""}
                    onChange={(e) => setNote((p) => ({ ...p, [w.id]: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-xs outline-none"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--color-surface)" }}
                  />
                  <div className="flex gap-2">
                    <button
                      disabled={processingId === w.id}
                      onClick={() => review(w.id, "APPROVE")}
                      className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50"
                      style={{ background: "var(--color-accent)", color: "#000" }}
                    >
                      <Check size={15} /> Approve
                    </button>
                    <button
                      disabled={processingId === w.id}
                      onClick={() => review(w.id, "REJECT")}
                      className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
                      style={{ background: "rgba(232,99,58,0.12)", color: "var(--color-alert)", border: "1px solid rgba(232,99,58,0.3)" }}
                    >
                      <X size={15} /> Reject
                    </button>
                  </div>
                </div>
              )}

              {w.status === "APPROVED" && (
                <button
                  disabled={processingId === w.id}
                  onClick={() => review(w.id, "PAID")}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50"
                  style={{ background: "var(--color-accent)", color: "#000" }}
                >
                  <Send size={15} /> Mark as Sent
                </button>
              )}

              {w.status !== "PENDING" && w.reviewNote && (
                <div className="text-xs px-3 py-2 rounded-lg mt-2" style={{ background: "rgba(255,255,255,0.04)", color: "rgba(245,242,234,0.5)" }}>
                  Note: {w.reviewNote}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
