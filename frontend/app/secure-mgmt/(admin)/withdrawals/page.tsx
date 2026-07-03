"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Withdrawal } from "@/lib/types";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Check, X, Send } from "lucide-react";

const STATUS_FILTERS = ["PENDING", "APPROVED", "PAID", "REJECTED", "ALL"] as const;

export default function AdminWithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [filter, setFilter] = useState<typeof STATUS_FILTERS[number]>("PENDING");
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    const params = filter === "ALL" ? {} : { status: filter };
    api.get("/withdrawals/admin/all", { params }).then((res) => setWithdrawals(res.data)).catch(() => {}).finally(() => setLoading(false));
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetching the list when the filter changes is the correct pattern here
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function review(id: string, action: "APPROVE" | "REJECT" | "PAID") {
    setProcessingId(id);
    try {
      await api.post(`/withdrawals/admin/${id}/review`, { action });
      load();
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <div>
      <AdminPageHeader
        title="Withdrawals"
        subtitle="Approve payout requests, then send the money manually via EasyPaisa/JazzCash/bank and mark as paid."
      />

      <div className="flex gap-2 mb-6 flex-wrap">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-3.5 py-1.5 rounded-sm text-xs font-medium uppercase tracking-wide"
            style={{
              background: filter === f ? "var(--color-accent)" : "transparent",
              color: filter === f ? "var(--color-bg)" : "rgba(245,242,234,0.6)",
              border: filter === f ? "none" : "1px solid rgba(245,242,234,0.15)",
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: "rgba(245,242,234,0.5)" }}>Loading…</div>
      ) : withdrawals.length === 0 ? (
        <div className="p-10 text-center rounded-sm" style={{ background: "rgba(255,255,255,0.04)", color: "var(--color-muted)" }}>
          No {filter !== "ALL" ? filter.toLowerCase() : ""} withdrawals.
        </div>
      ) : (
        <div className="rounded-sm overflow-hidden" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          {withdrawals.map((w) => (
            <div key={w.id} className="ledger-row flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono-tabular text-base" style={{ color: "var(--color-surface)" }}>₨{parseFloat(w.amount).toFixed(2)}</span>
                  <span className="text-xs uppercase px-2 py-0.5 rounded-full" style={{ background: "rgba(20,36,29,0.08)", color: "var(--color-muted)" }}>
                    {w.method.replace("_", " ")}
                  </span>
                </div>
                <div className="text-sm" style={{ color: "var(--color-surface)" }}>{w.userName} · {w.userEmail}</div>
                <div className="text-xs mt-1" style={{ color: "var(--color-muted)" }}>
                  Pay to: {w.accountName} — <span className="font-mono-tabular">{w.accountNumber}</span>
                  {" · "}{new Date(w.createdAt).toLocaleString()}
                </div>
              </div>

              <div className="flex gap-2 shrink-0">
                {w.status === "PENDING" && (
                  <>
                    <button
                      disabled={processingId === w.id}
                      onClick={() => review(w.id, "APPROVE")}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-sm text-xs font-medium disabled:opacity-50"
                      style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
                    >
                      <Check size={14} /> Approve
                    </button>
                    <button
                      disabled={processingId === w.id}
                      onClick={() => review(w.id, "REJECT")}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-sm text-xs font-medium border disabled:opacity-50"
                      style={{ borderColor: "var(--color-alert)", color: "var(--color-alert)" }}
                    >
                      <X size={14} /> Reject
                    </button>
                  </>
                )}
                {w.status === "APPROVED" && (
                  <button
                    disabled={processingId === w.id}
                    onClick={() => review(w.id, "PAID")}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-sm text-xs font-medium disabled:opacity-50"
                    style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
                  >
                    <Send size={14} /> Mark sent
                  </button>
                )}
                {(w.status === "PAID" || w.status === "REJECTED") && (
                  <span
                    className="text-xs font-medium px-3 py-1.5 rounded-full"
                    style={{
                      background: w.status === "PAID" ? "rgba(63,168,118,0.1)" : "rgba(232,99,58,0.1)",
                      color: w.status === "PAID" ? "var(--color-accent-dim)" : "var(--color-alert)",
                    }}
                  >
                    {w.status}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
