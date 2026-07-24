"use client";

import { useEffect, useState } from "react";
import api from "@/lib/admin-api";
import { PaymentMethodConfig, PaymentMethodTier } from "@/lib/types";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Save, QrCode, X, Plus, Trash2 } from "lucide-react";

const METHODS = [
  { value: "EASYPAISA", label: "EasyPaisa" },
  { value: "JAZZCASH", label: "JazzCash" },
  { value: "BANK_TRANSFER", label: "Bank transfer" },
];

type DraftTier = Partial<PaymentMethodTier> & { tempId: string; isNew?: boolean };

let tempCounter = 0;
function newTempId() { return `new-${Date.now()}-${tempCounter++}`; }

export default function AdminSettingsPage() {
  const [configs, setConfigs] = useState<Record<string, Partial<PaymentMethodConfig>>>({});
  const [tiers, setTiers] = useState<Record<string, DraftTier[]>>({});
  const [loading, setLoading] = useState(true);
  const [savingMethod, setSavingMethod] = useState<string | null>(null);
  const [savedMethod, setSavedMethod] = useState<string | null>(null);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [savingTier, setSavingTier] = useState<string | null>(null);

  useEffect(() => {
    api.get("/deposits/admin/methods").then((res) => {
      const map: Record<string, Partial<PaymentMethodConfig>> = {};
      const tierMap: Record<string, DraftTier[]> = {};
      METHODS.forEach((m) => {
        map[m.value] = { method: m.value as PaymentMethodConfig["method"], isEnabled: true };
        tierMap[m.value] = [];
      });
      res.data.forEach((c: PaymentMethodConfig) => {
        map[c.method] = c;
        tierMap[c.method] = (c.tiers || []).map((t) => ({ ...t, tempId: t.id }));
      });
      setConfigs(map);
      setTiers(tierMap);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  function updateField(method: string, field: string, value: string | boolean | null) {
    setConfigs((prev) => ({ ...prev, [method]: { ...prev[method], [field]: value } }));
  }

  function updateTierField(method: string, tempId: string, field: string, value: string | null) {
    setTiers((prev) => ({
      ...prev,
      [method]: (prev[method] || []).map((t) => (t.tempId === tempId ? { ...t, [field]: value } : t)),
    }));
  }

  function addTier(method: string) {
    setTiers((prev) => ({
      ...prev,
      [method]: [...(prev[method] || []), { tempId: newTempId(), isNew: true, amount: "", accountName: "", accountNumber: "", qrCodeUrl: null }],
    }));
  }

  async function removeTier(method: string, tier: DraftTier) {
    if (!tier.isNew && tier.id) {
      if (!confirm("Delete this section?")) return;
      await api.delete(`/deposits/admin/tiers/${tier.id}`);
    }
    setTiers((prev) => ({ ...prev, [method]: (prev[method] || []).filter((t) => t.tempId !== tier.tempId) }));
  }

  async function uploadImage(key: string, file: File, onDone: (url: string) => void) {
    setUploadingKey(key);
    try {
      const fd = new FormData();
      fd.append("logo", file);
      const r = await api.post("/admin/upload/logo", fd, { headers: { "Content-Type": "multipart/form-data" } });
      onDone(r.data.url);
    } finally {
      setUploadingKey(null);
    }
  }

  async function save(method: string) {
    setSavingMethod(method);
    try {
      const c = configs[method];
      await api.post("/deposits/admin/methods", {
        method,
        isEnabled: c.isEnabled ?? true,
        accountName: c.accountName || "",
        accountNumber: c.accountNumber || "",
        instructions: c.instructions || "",
        qrCodeUrl: c.qrCodeUrl || null,
      });
      setSavedMethod(method);
      setTimeout(() => setSavedMethod(null), 2000);
    } finally {
      setSavingMethod(null);
    }
  }

  async function saveTier(method: string, tier: DraftTier) {
    if (!tier.amount || parseFloat(String(tier.amount)) <= 0) return;
    setSavingTier(tier.tempId);
    try {
      const payload = {
        amount: tier.amount,
        accountName: tier.accountName || "",
        accountNumber: tier.accountNumber || "",
        qrCodeUrl: tier.qrCodeUrl || null,
      };
      const r = tier.isNew
        ? await api.post(`/deposits/admin/methods/${method}/tiers`, payload)
        : await api.patch(`/deposits/admin/tiers/${tier.id}`, payload);
      setTiers((prev) => ({
        ...prev,
        [method]: (prev[method] || []).map((t) => (t.tempId === tier.tempId ? { ...r.data, tempId: r.data.id } : t)),
      }));
    } finally {
      setSavingTier(null);
    }
  }

  if (loading) return <div style={{ color: "rgba(245,242,234,0.5)" }}>Loading…</div>;

  return (
    <div>
      <AdminPageHeader title="Payment settings" subtitle="These account details are shown to users when they submit a manual deposit." />

      <div className="flex flex-col gap-5">
        {METHODS.map((m) => {
          const c = configs[m.value] || {};
          const methodTiers = tiers[m.value] || [];
          return (
            <div key={m.value} className="p-6 rounded-sm" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display text-lg" style={{ color: "var(--color-surface)" }}>{m.label}</h3>
                <label className="flex items-center gap-2 text-sm" style={{ color: "var(--color-surface)" }}>
                  <input type="checkbox" checked={c.isEnabled ?? true} onChange={(e) => updateField(m.value, "isEnabled", e.target.checked)} />
                  Enabled
                </label>
              </div>
              <div className="grid sm:grid-cols-2 gap-4 mb-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>Account name</span>
                  <input value={c.accountName || ""} onChange={(e) => updateField(m.value, "accountName", e.target.value)} className="px-3 py-2.5 rounded-sm text-sm outline-none border" style={{ borderColor: "rgba(255,255,255,0.12)", color: "var(--color-surface)" }} />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>Account number</span>
                  <input value={c.accountNumber || ""} onChange={(e) => updateField(m.value, "accountNumber", e.target.value)} className="px-3 py-2.5 rounded-sm text-sm font-mono-tabular outline-none border" style={{ borderColor: "rgba(255,255,255,0.12)", color: "var(--color-surface)" }} />
                </label>
              </div>
              <label className="flex flex-col gap-1.5 mb-4">
                <span className="text-xs uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>Instructions shown to user</span>
                <textarea rows={2} value={c.instructions || ""} onChange={(e) => updateField(m.value, "instructions", e.target.value)} className="px-3 py-2.5 rounded-sm text-sm outline-none border resize-none" style={{ borderColor: "rgba(255,255,255,0.12)", color: "var(--color-surface)" }} />
              </label>
              <div className="flex flex-col gap-1.5 mb-4">
                <span className="text-xs uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>Default QR code (optional)</span>
                <div className="flex items-center gap-4">
                  {c.qrCodeUrl ? (
                    <div className="relative shrink-0">
                      <img src={c.qrCodeUrl} alt="QR code" className="w-20 h-20 rounded-sm object-contain" style={{ background: "#fff", border: "1px solid rgba(255,255,255,0.12)" }} />
                      <button type="button" onClick={() => updateField(m.value, "qrCodeUrl", null)}
                        className="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center"
                        style={{ background: "#E8633A", color: "#fff" }}>
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <div className="w-20 h-20 rounded-sm flex items-center justify-center shrink-0" style={{ border: "1px dashed rgba(255,255,255,0.2)" }}>
                      <QrCode size={24} style={{ color: "var(--color-muted)" }} />
                    </div>
                  )}
                  <label className="text-sm font-medium px-4 py-2.5 rounded-sm cursor-pointer" style={{ background: "rgba(255,255,255,0.06)", color: "var(--color-surface)", border: "1px solid rgba(255,255,255,0.12)" }}>
                    {uploadingKey === m.value ? "Uploading…" : c.qrCodeUrl ? "Change image" : "Upload image"}
                    <input type="file" accept="image/*" className="hidden" disabled={uploadingKey === m.value}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(m.value, f, (url) => updateField(m.value, "qrCodeUrl", url)); e.target.value = ""; }} />
                  </label>
                </div>
              </div>
              <button
                onClick={() => save(m.value)}
                disabled={savingMethod === m.value}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-sm text-sm font-medium disabled:opacity-60"
                style={{ background: savedMethod === m.value ? "var(--color-accent-dim)" : "var(--color-accent)", color: "var(--color-bg)" }}
              >
                <Save size={14} /> {savedMethod === m.value ? "Saved" : savingMethod === m.value ? "Saving…" : "Save changes"}
              </button>

              {/* ── Amount-specific sections ── */}
              <div className="mt-6 pt-5" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div>
                    <h4 className="text-sm font-semibold" style={{ color: "var(--color-surface)" }}>Amount-specific sections</h4>
                    <p className="text-xs mt-0.5" style={{ color: "var(--color-muted)" }}>
                      Give a specific deposit amount (e.g. Rs 100, Rs 2000) its own account + QR code.
                      Shown to the user when their entered amount matches exactly; otherwise the default above is used.
                    </p>
                  </div>
                  <button onClick={() => addTier(m.value)}
                    className="flex items-center gap-1 text-xs font-medium px-3 py-2 rounded-sm shrink-0"
                    style={{ background: "rgba(255,255,255,0.06)", color: "var(--color-surface)", border: "1px solid rgba(255,255,255,0.12)" }}>
                    <Plus size={13} /> Add section
                  </button>
                </div>

                <div className="flex flex-col gap-3">
                  {methodTiers.map((t) => (
                    <div key={t.tempId} className="p-4 rounded-sm" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <div className="grid sm:grid-cols-3 gap-3 mb-3">
                        <label className="flex flex-col gap-1.5">
                          <span className="text-xs uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>Amount (Rs)</span>
                          <input type="number" min="1" step="0.01" value={t.amount ?? ""} onChange={(e) => updateTierField(m.value, t.tempId, "amount", e.target.value)}
                            className="px-3 py-2.5 rounded-sm text-sm font-mono-tabular outline-none border" style={{ borderColor: "rgba(255,255,255,0.12)", color: "var(--color-surface)" }} />
                        </label>
                        <label className="flex flex-col gap-1.5">
                          <span className="text-xs uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>Account name</span>
                          <input value={t.accountName || ""} onChange={(e) => updateTierField(m.value, t.tempId, "accountName", e.target.value)}
                            className="px-3 py-2.5 rounded-sm text-sm outline-none border" style={{ borderColor: "rgba(255,255,255,0.12)", color: "var(--color-surface)" }} />
                        </label>
                        <label className="flex flex-col gap-1.5">
                          <span className="text-xs uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>Account number</span>
                          <input value={t.accountNumber || ""} onChange={(e) => updateTierField(m.value, t.tempId, "accountNumber", e.target.value)}
                            className="px-3 py-2.5 rounded-sm text-sm font-mono-tabular outline-none border" style={{ borderColor: "rgba(255,255,255,0.12)", color: "var(--color-surface)" }} />
                        </label>
                      </div>
                      <div className="flex items-center gap-3">
                        {t.qrCodeUrl ? (
                          <div className="relative shrink-0">
                            <img src={t.qrCodeUrl} alt="QR code" className="w-16 h-16 rounded-sm object-contain" style={{ background: "#fff", border: "1px solid rgba(255,255,255,0.12)" }} />
                            <button type="button" onClick={() => updateTierField(m.value, t.tempId, "qrCodeUrl", null)}
                              className="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center"
                              style={{ background: "#E8633A", color: "#fff" }}>
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <div className="w-16 h-16 rounded-sm flex items-center justify-center shrink-0" style={{ border: "1px dashed rgba(255,255,255,0.2)" }}>
                            <QrCode size={20} style={{ color: "var(--color-muted)" }} />
                          </div>
                        )}
                        <label className="text-xs font-medium px-3 py-2 rounded-sm cursor-pointer" style={{ background: "rgba(255,255,255,0.06)", color: "var(--color-surface)", border: "1px solid rgba(255,255,255,0.12)" }}>
                          {uploadingKey === t.tempId ? "Uploading…" : t.qrCodeUrl ? "Change QR" : "Upload QR"}
                          <input type="file" accept="image/*" className="hidden" disabled={uploadingKey === t.tempId}
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(t.tempId, f, (url) => updateTierField(m.value, t.tempId, "qrCodeUrl", url)); e.target.value = ""; }} />
                        </label>
                        <div className="flex-1" />
                        <button onClick={() => saveTier(m.value, t)} disabled={savingTier === t.tempId}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-sm text-xs font-medium disabled:opacity-60"
                          style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}>
                          <Save size={12} /> {savingTier === t.tempId ? "Saving…" : t.isNew ? "Create" : "Save"}
                        </button>
                        <button onClick={() => removeTier(m.value, t)}
                          className="flex items-center justify-center w-8 h-8 rounded-sm shrink-0"
                          style={{ background: "rgba(232,99,58,0.1)", color: "#E8633A", border: "1px solid rgba(232,99,58,0.2)" }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {methodTiers.length === 0 && (
                    <p className="text-xs" style={{ color: "var(--color-muted)" }}>No amount-specific sections yet.</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
