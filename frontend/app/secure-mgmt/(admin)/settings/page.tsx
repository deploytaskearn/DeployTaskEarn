"use client";

import { useEffect, useState } from "react";
import api from "@/lib/admin-api";
import { PaymentMethodConfig } from "@/lib/types";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Save } from "lucide-react";

const METHODS = [
  { value: "EASYPAISA", label: "EasyPaisa" },
  { value: "JAZZCASH", label: "JazzCash" },
  { value: "BANK_TRANSFER", label: "Bank transfer" },
];

export default function AdminSettingsPage() {
  const [configs, setConfigs] = useState<Record<string, Partial<PaymentMethodConfig>>>({});
  const [loading, setLoading] = useState(true);
  const [savingMethod, setSavingMethod] = useState<string | null>(null);
  const [savedMethod, setSavedMethod] = useState<string | null>(null);

  useEffect(() => {
    api.get("/deposits/methods").then((res) => {
      const map: Record<string, Partial<PaymentMethodConfig>> = {};
      METHODS.forEach((m) => { map[m.value] = { method: m.value as PaymentMethodConfig["method"], isEnabled: true }; });
      res.data.forEach((c: PaymentMethodConfig) => { map[c.method] = c; });
      setConfigs(map);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  function updateField(method: string, field: string, value: string | boolean) {
    setConfigs((prev) => ({ ...prev, [method]: { ...prev[method], [field]: value } }));
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
      });
      setSavedMethod(method);
      setTimeout(() => setSavedMethod(null), 2000);
    } finally {
      setSavingMethod(null);
    }
  }

  if (loading) return <div style={{ color: "rgba(245,242,234,0.5)" }}>Loading…</div>;

  return (
    <div>
      <AdminPageHeader title="Payment settings" subtitle="These account details are shown to users when they submit a manual deposit." />

      <div className="flex flex-col gap-5">
        {METHODS.map((m) => {
          const c = configs[m.value] || {};
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
              <button
                onClick={() => save(m.value)}
                disabled={savingMethod === m.value}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-sm text-sm font-medium disabled:opacity-60"
                style={{ background: savedMethod === m.value ? "var(--color-accent-dim)" : "var(--color-accent)", color: "var(--color-bg)" }}
              >
                <Save size={14} /> {savedMethod === m.value ? "Saved" : savingMethod === m.value ? "Saving…" : "Save changes"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
