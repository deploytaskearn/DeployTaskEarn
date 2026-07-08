"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { User } from "@/lib/types";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Ban, CheckCircle2, PauseCircle, Percent, X, Check, Trash2 } from "lucide-react";

interface AdminUserRow extends User {
  status: "ACTIVE" | "SUSPENDED" | "BANNED";
  referralBonusRate?: number | null;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  // referral rate modal
  const [rateModal, setRateModal] = useState<AdminUserRow | null>(null);
  const [rateInput, setRateInput] = useState("");
  const [rateSaving, setRateSaving] = useState(false);
  const [rateError, setRateError] = useState("");

  function load() {
    setLoading(true);
    setFetchError("");
    api.get("/admin/users")
      .then((res) => setUsers(res.data))
      .catch((err) => setFetchError(err?.response?.data?.error || "Failed to load users. Try refreshing."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  function openRateModal(u: AdminUserRow) {
    setRateModal(u);
    setRateInput(u.referralBonusRate != null ? String(u.referralBonusRate) : "");
    setRateError("");
  }

  async function deleteUser(id: string) {
    setDeleting(true);
    try {
      await api.delete(`/admin/users/${id}`);
      setConfirmDeleteId(null);
      load();
    } catch (err: unknown) {
      alert((err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  async function saveRate() {
    if (!rateModal) return;
    setRateError("");
    const val = rateInput.trim();
    const rate = val === "" ? null : parseFloat(val);
    if (rate !== null && (isNaN(rate) || rate < 0 || rate > 100)) {
      setRateError("Enter a number between 0 and 100, or leave empty to reset to default (5%).");
      return;
    }
    setRateSaving(true);
    try {
      await api.patch(`/admin/users/${rateModal.id}/referral-rate`, { rate });
      setRateModal(null);
      load();
    } catch (err: unknown) {
      setRateError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to save.");
    } finally {
      setRateSaving(false);
    }
  }

  return (
    <div>
      <AdminPageHeader title="Users" subtitle="Manage accounts, status, and referral bonus rates." />

      {loading ? (
        <div style={{ color: "rgba(245,242,234,0.5)" }}>Loading…</div>
      ) : fetchError ? (
        <div className="p-6 rounded-sm text-sm" style={{ background: "rgba(232,99,58,0.1)", color: "var(--color-alert)" }}>{fetchError}</div>
      ) : (
        <div className="rounded-sm overflow-hidden" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          {users.length === 0 ? (
            <div className="p-10 text-center text-sm" style={{ color: "var(--color-muted)" }}>No users registered yet.</div>
          ) : users.map((u) => (
            <div key={u.id} className="ledger-row flex items-center justify-between gap-3 px-5 py-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium" style={{ color: "var(--color-surface)" }}>{u.name}</span>
                  {u.role === "ADMIN" && (
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(63,168,118,0.12)", color: "var(--color-accent-dim)" }}>ADMIN</span>
                  )}
                  {u.referralBonusRate != null && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: "rgba(244,200,66,0.12)", color: "#F4C842" }}>
                      {u.referralBonusRate}% ref
                    </span>
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
                <div className="flex gap-1.5 shrink-0 items-center">
                  <button
                    disabled={processingId === u.id}
                    onClick={() => openRateModal(u)}
                    title="Set referral bonus rate"
                    className="p-2 rounded-sm"
                    style={{ color: "#F4C842" }}
                  >
                    <Percent size={16} />
                  </button>
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
                  {/* Delete with inline confirm */}
                  {confirmDeleteId === u.id ? (
                    <div className="flex items-center gap-1 ml-1">
                      <button onClick={() => deleteUser(u.id)} disabled={deleting}
                        className="flex items-center gap-1 text-xs px-2 py-1 rounded font-semibold"
                        style={{ background: "rgba(232,99,58,0.2)", color: "#E8633A", border: "1px solid rgba(232,99,58,0.3)" }}>
                        {deleting ? "…" : <><Check size={11} /> Yes</>}
                      </button>
                      <button onClick={() => setConfirmDeleteId(null)} className="p-1 rounded" style={{ color: "rgba(245,242,234,0.4)" }}>
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDeleteId(u.id)} title="Delete user and all data"
                      className="p-2 rounded-sm ml-1" style={{ color: "rgba(232,99,58,0.6)" }}>
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Referral Rate Modal ── */}
      {rateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }} onClick={() => setRateModal(null)}>
          <div className="w-full max-w-sm rounded-2xl p-6" style={{ background: "#0d1f16", border: "1px solid rgba(255,255,255,0.1)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <div className="font-semibold text-base" style={{ color: "#F5F2EA" }}>Referral Bonus Rate</div>
                <div className="text-xs mt-0.5" style={{ color: "rgba(245,242,234,0.45)" }}>{rateModal.name} · {rateModal.email}</div>
              </div>
              <button onClick={() => setRateModal(null)} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(255,255,255,0.06)" }}>
                <X size={15} style={{ color: "#F5F2EA" }} />
              </button>
            </div>

            <div className="mb-2 text-xs" style={{ color: "rgba(245,242,234,0.5)" }}>
              Default rate is <strong style={{ color: "#F5F2EA" }}>5%</strong>. Set a custom rate for this user (0–100). Leave empty to reset to default.
            </div>

            <div className="flex items-center gap-3 mt-4">
              <div className="relative flex-1">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  placeholder="e.g. 10"
                  value={rateInput}
                  onChange={(e) => setRateInput(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-lg font-bold outline-none pr-10"
                  style={{ background: "rgba(244,200,66,0.08)", border: "1.5px solid rgba(244,200,66,0.3)", color: "#F4C842", caretColor: "#F4C842" }}
                  autoFocus
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-base font-bold" style={{ color: "#F4C842" }}>%</span>
              </div>
              <button
                onClick={saveRate}
                disabled={rateSaving}
                className="flex items-center gap-1.5 px-5 py-3 rounded-xl text-sm font-bold disabled:opacity-50"
                style={{ background: "#F4C842", color: "#000" }}
              >
                <Check size={15} /> Save
              </button>
            </div>

            {rateError && (
              <div className="mt-3 text-xs px-3 py-2 rounded-lg" style={{ background: "rgba(232,99,58,0.1)", color: "#E8633A", border: "1px solid rgba(232,99,58,0.2)" }}>
                {rateError}
              </div>
            )}

            {rateInput === "" && rateModal.referralBonusRate != null && (
              <div className="mt-3 text-xs" style={{ color: "rgba(245,242,234,0.4)" }}>
                Saving empty will remove the custom rate and revert to 5%.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
