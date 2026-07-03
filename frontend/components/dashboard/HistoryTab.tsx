"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { TaskSubmission, Deposit, Withdrawal } from "@/lib/types";

type HistoryItem = {
  id: string;
  type: "Task" | "Deposit" | "Withdrawal";
  label: string;
  amount: string;
  status: string;
  createdAt: string;
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "var(--color-alert)",
  APPROVED: "var(--color-accent)",
  REJECTED: "var(--color-alert)",
  PAID: "var(--color-accent)",
};

export function HistoryTab() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<TaskSubmission[]>("/tasks/my-submissions"),
      api.get<Deposit[]>("/deposits/my"),
      api.get<Withdrawal[]>("/withdrawals/my"),
    ]).then(([tasksRes, depositsRes, withdrawalsRes]) => {
      const taskItems: HistoryItem[] = tasksRes.data.map((s) => ({
        id: s.id, type: "Task",
        label: s.taskTitle || "Task submission",
        amount: s.rewardPaid ? `+₨${parseFloat(s.rewardPaid).toFixed(2)}` : `₨${parseFloat(s.rewardAmount || "0").toFixed(2)}`,
        status: s.status, createdAt: s.createdAt,
      }));
      const depositItems: HistoryItem[] = depositsRes.data.map((d) => ({
        id: d.id, type: "Deposit",
        label: `${d.method.replace("_", " ")} deposit`,
        amount: `+₨${parseFloat(d.amount).toFixed(2)}`,
        status: d.status, createdAt: d.createdAt,
      }));
      const withdrawalItems: HistoryItem[] = withdrawalsRes.data.map((w) => ({
        id: w.id, type: "Withdrawal",
        label: `${w.method.replace("_", " ")} withdrawal`,
        amount: `-₨${parseFloat(w.amount).toFixed(2)}`,
        status: w.status, createdAt: w.createdAt,
      }));
      const all = [...taskItems, ...depositItems, ...withdrawalItems].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setItems(all);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="py-12 text-center" style={{ color: "rgba(245,242,234,0.5)" }}>Loading history…</div>;
  }

  if (items.length === 0) {
    return (
      <div className="py-16 text-center rounded-2xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(245,242,234,0.5)" }}>
        No activity yet. Complete a task or make a deposit to get started.
      </div>
    );
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
      {items.map((item, i) => (
        <div key={`${item.type}-${item.id}`}
          className="flex items-center justify-between gap-4 px-5 py-4"
          style={{ borderTop: i > 0 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
          <div className="flex flex-col">
            <span className="text-sm font-medium" style={{ color: "var(--color-surface)" }}>{item.label}</span>
            <span className="text-xs" style={{ color: "rgba(245,242,234,0.4)" }}>
              {item.type} · {new Date(item.createdAt).toLocaleDateString()}
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="font-mono-tabular text-sm" style={{ color: "var(--color-surface)" }}>{item.amount}</span>
            <span className="text-xs font-medium" style={{ color: STATUS_COLORS[item.status] || "rgba(245,242,234,0.45)" }}>
              {item.status}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
