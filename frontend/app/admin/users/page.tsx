"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { User } from "@/lib/types";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Ban, CheckCircle2, PauseCircle } from "lucide-react";

interface AdminUserRow extends User {
  status: "ACTIVE" | "SUSPENDED" | "BANNED";
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    api.get("/admin/users").then((res) => setUsers(res.data)).catch(() => {}).finally(() => setLoading(false));
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetching the list on mount is the correct pattern here
    load();
  }, []);

  async function updateStatus(id: string, status: "ACTIVE" | "SUSPENDED" | "BANNED") {
    setProcessingId(id);
    try {
      await api.patch(`/admin/users/${id}/status`, { status });
      load();
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <div>
      <AdminPageHeader title="Users" subtitle="Manage accounts and account status." />

      {loading ? (
        <div style={{ color: "rgba(245,242,234,0.5)" }}>Loading…</div>
      ) : (
        <div className="rounded-sm overflow-hidden" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          {users.map((u) => (
            <div key={u.id} className="ledger-row flex items-center justify-between gap-3 px-5 py-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium" style={{ color: "var(--color-surface)" }}>{u.name}</span>
                  {u.role === "ADMIN" && (
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(63,168,118,0.12)", color: "var(--color-accent-dim)" }}>ADMIN</span>
                  )}
                </div>
                <div className="text-xs" style={{ color: "var(--color-muted)" }}>{u.email}</div>
              </div>
              <span className="font-mono-tabular text-sm shrink-0" style={{ color: "var(--color-surface)" }}>
                ₨{parseFloat(u.balance || "0").toFixed(2)}
              </span>
              <span
                className="text-xs font-medium px-2.5 py-1 rounded-full shrink-0"
                style={{
                  background: u.status === "ACTIVE" ? "rgba(63,168,118,0.1)" : "rgba(232,99,58,0.1)",
                  color: u.status === "ACTIVE" ? "var(--color-accent-dim)" : "var(--color-alert)",
                }}
              >
                {u.status}
              </span>

              {u.role !== "ADMIN" && (
                <div className="flex gap-1.5 shrink-0">
                  {u.status !== "ACTIVE" && (
                    <button disabled={processingId === u.id} onClick={() => updateStatus(u.id, "ACTIVE")} title="Activate" className="p-2 rounded-sm" style={{ color: "var(--color-accent-dim)" }}>
                      <CheckCircle2 size={16} />
                    </button>
                  )}
                  {u.status !== "SUSPENDED" && (
                    <button disabled={processingId === u.id} onClick={() => updateStatus(u.id, "SUSPENDED")} title="Suspend" className="p-2 rounded-sm" style={{ color: "var(--color-alert)" }}>
                      <PauseCircle size={16} />
                    </button>
                  )}
                  {u.status !== "BANNED" && (
                    <button disabled={processingId === u.id} onClick={() => updateStatus(u.id, "BANNED")} title="Ban" className="p-2 rounded-sm" style={{ color: "var(--color-alert)" }}>
                      <Ban size={16} />
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
