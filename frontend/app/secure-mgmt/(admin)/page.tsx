"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { DashboardStats } from "@/lib/types";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Users, Banknote, ArrowUpFromLine, ListChecks, Clock } from "lucide-react";

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/admin/dashboard-stats").then((res) => setStats(res.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading || !stats) {
    return <div style={{ color: "rgba(245,242,234,0.5)" }}>Loading…</div>;
  }

  const cards = [
    { label: "Total users", value: stats.totalUsers, icon: Users },
    { label: "Total deposited", value: `₨${stats.totalDeposited.toFixed(2)}`, icon: Banknote },
    { label: "Total withdrawn", value: `₨${stats.totalWithdrawn.toFixed(2)}`, icon: ArrowUpFromLine },
    { label: "Active tasks", value: stats.activeTasks, icon: ListChecks },
  ];

  const pending = [
    { label: "Pending task submissions", value: stats.pendingTaskSubmissions, href: "/secure-mgmt/submissions" },
    { label: "Pending deposits", value: stats.pendingDeposits, href: "/secure-mgmt/deposits" },
    { label: "Pending withdrawals", value: stats.pendingWithdrawals, href: "/secure-mgmt/withdrawals" },
  ];

  return (
    <div>
      <AdminPageHeader title="Overview" subtitle="A snapshot of platform activity." />

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((c) => (
          <div key={c.label} className="p-5 rounded-2xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <c.icon size={20} style={{ color: "var(--color-accent)" }} className="mb-3" />
            <div className="font-mono-tabular text-2xl mb-1" style={{ color: "var(--color-surface)" }}>{c.value}</div>
            <div className="text-xs uppercase tracking-wide" style={{ color: "rgba(245,242,234,0.45)" }}>{c.label}</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <Clock size={16} style={{ color: "var(--color-alert)" }} />
          <span className="font-display text-lg" style={{ color: "var(--color-surface)" }}>Needs your attention</span>
        </div>
        {pending.map((p) => (
          <a key={p.label} href={p.href} className="flex items-center justify-between px-5 py-4 hover:bg-white/5 transition-colors" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
            <span className="text-sm" style={{ color: "rgba(245,242,234,0.7)" }}>{p.label}</span>
            <span className="font-mono-tabular text-sm px-2.5 py-1 rounded-full"
              style={{ background: p.value > 0 ? "rgba(232,99,58,0.14)" : "rgba(0,200,117,0.1)", color: p.value > 0 ? "var(--color-alert)" : "var(--color-accent)" }}>
              {p.value}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
