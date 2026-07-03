"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Star, Check, X } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Plan } from "@/lib/types";
import api from "@/lib/api";

interface PlanForm {
  name: string; description: string; price: string; durationDays: number;
  maxEarnings: string; dailyEarning: string; maxUsers: string;
  features: string[]; isPopular: boolean; isActive: boolean; sortOrder: number;
}

const EMPTY: PlanForm = {
  name: "", description: "", price: "", durationDays: 30, maxEarnings: "",
  dailyEarning: "", maxUsers: "", features: [], isPopular: false, isActive: true, sortOrder: 0,
};

export default function AdminPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<PlanForm>({ ...EMPTY });
  const [featInput, setFeatInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const r = await api.get("/plans/admin");
      setPlans(r.data);
    } catch {}
  }

  function startCreate() {
    setEditing(null);
    setForm({ ...EMPTY, features: [] });
    setFeatInput("");
    setShowForm(true);
  }

  function startEdit(p: Plan) {
    setEditing(p.id);
    setForm({ name: p.name, description: p.description || "", price: p.price, durationDays: p.durationDays, maxEarnings: p.maxEarnings || "", dailyEarning: p.dailyEarning ? String(p.dailyEarning) : "", maxUsers: p.maxUsers ? String(p.maxUsers) : "", features: [...p.features], isPopular: p.isPopular, isActive: p.isActive, sortOrder: p.sortOrder });
    setFeatInput("");
    setShowForm(true);
  }

  function addFeature() {
    const f = featInput.trim();
    if (!f) return;
    setForm((prev) => ({ ...prev, features: [...prev.features, f] }));
    setFeatInput("");
  }

  function removeFeature(i: number) {
    setForm((prev) => ({ ...prev, features: prev.features.filter((_, idx) => idx !== i) }));
  }

  async function save() {
    setSaving(true);
    try {
      const payload = {
        ...form,
        price: parseFloat(String(form.price)),
        maxEarnings: form.maxEarnings ? parseFloat(String(form.maxEarnings)) : null,
        dailyEarning: form.dailyEarning ? parseFloat(form.dailyEarning) : null,
        maxUsers: form.maxUsers ? parseInt(form.maxUsers) : null,
        durationDays: Number(form.durationDays),
        sortOrder: Number(form.sortOrder),
      };
      if (editing) await api.patch(`/plans/admin/${editing}`, payload);
      else await api.post("/plans/admin", payload);
      setShowForm(false);
      await load();
    } catch {
      alert("Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this plan?")) return;
    await api.delete(`/plans/admin/${id}`);
    await load();
  }

  return (
    <div>
      <AdminPageHeader title="Plans" subtitle="Manage earning plans shown to users." />

      <div className="flex justify-end mb-6">
        <button onClick={startCreate} className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold" style={{ background: "var(--color-accent)", color: "#000" }}>
          <Plus size={16} /> New plan
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="mb-8 rounded-2xl p-7" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <h3 className="font-display text-lg mb-6" style={{ color: "var(--color-surface)" }}>{editing ? "Edit plan" : "New plan"}</h3>
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            {[
              { label: "Plan name", key: "name", type: "text" },
              { label: "Price (₨)", key: "price", type: "number" },
              { label: "Duration (days)", key: "durationDays", type: "number" },
              { label: "Daily earning (₨/day)", key: "dailyEarning", type: "number" },
              { label: "Max earnings (₨, optional)", key: "maxEarnings", type: "number" },
              { label: "Max users (limited offer, optional)", key: "maxUsers", type: "number" },
              { label: "Sort order", key: "sortOrder", type: "number" },
            ].map((f) => (
              <div key={f.key}>
                <label className="block text-xs mb-1.5 font-medium" style={{ color: "rgba(245,242,234,0.55)" }}>{f.label}</label>
                <input
                  type={f.type}
                  value={String(form[f.key as keyof typeof form] ?? "")}
                  onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--color-surface)" }}
                />
              </div>
            ))}
          </div>
          <div className="mb-4">
            <label className="block text-xs mb-1.5 font-medium" style={{ color: "rgba(245,242,234,0.55)" }}>Description (optional)</label>
            <textarea rows={2} value={form.description || ""} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--color-surface)" }} />
          </div>
          <div className="mb-4">
            <label className="block text-xs mb-1.5 font-medium" style={{ color: "rgba(245,242,234,0.55)" }}>Features</label>
            <div className="flex gap-2 mb-2">
              <input value={featInput} onChange={(e) => setFeatInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addFeature())} placeholder="Type feature, press Enter" className="flex-1 px-3 py-2.5 rounded-lg text-sm outline-none" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--color-surface)" }} />
              <button onClick={addFeature} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "rgba(0,200,117,0.15)", color: "var(--color-accent)" }}>Add</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {form.features.map((f, i) => (
                <span key={i} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg" style={{ background: "rgba(255,255,255,0.07)", color: "rgba(245,242,234,0.8)" }}>
                  {f} <button onClick={() => removeFeature(i)}><X size={12} /></button>
                </span>
              ))}
            </div>
          </div>
          <div className="flex gap-6 mb-6">
            <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: "rgba(245,242,234,0.75)" }}>
              <input type="checkbox" checked={form.isPopular} onChange={(e) => setForm((p) => ({ ...p, isPopular: e.target.checked }))} className="accent-green-500" />
              Mark as Popular
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: "rgba(245,242,234,0.75)" }}>
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))} className="accent-green-500" />
              Active
            </label>
          </div>
          <div className="flex gap-3">
            <button onClick={save} disabled={saving} className="px-6 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50" style={{ background: "var(--color-accent)", color: "#000" }}>
              {saving ? "Saving…" : "Save plan"}
            </button>
            <button onClick={() => setShowForm(false)} className="px-6 py-2.5 rounded-lg text-sm" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(245,242,234,0.7)" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Plans list */}
      <div className="flex flex-col gap-4">
        {plans.length === 0 && <div className="text-center py-16 text-sm" style={{ color: "rgba(245,242,234,0.4)" }}>No plans yet. Create one above.</div>}
        {plans.map((p) => (
          <div key={p.id} className="rounded-xl p-5 flex flex-wrap items-center gap-4 justify-between" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="flex items-center gap-4 min-w-0">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-semibold text-sm" style={{ color: "var(--color-surface)" }}>{p.name}</span>
                  {p.isPopular && <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(0,200,117,0.15)", color: "var(--color-accent)" }}><Star size={10} />Popular</span>}
                  {!p.isActive && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(232,99,58,0.15)", color: "var(--color-alert)" }}>Inactive</span>}
                </div>
                <div className="text-xs" style={{ color: "rgba(245,242,234,0.45)" }}>₨{parseFloat(p.price).toLocaleString()} · {p.durationDays} days · {p.features.length} features</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => startEdit(p)} className="p-2 rounded-lg" style={{ background: "rgba(255,255,255,0.06)" }}><Pencil size={15} style={{ color: "rgba(245,242,234,0.7)" }} /></button>
              <button onClick={() => remove(p.id)} className="p-2 rounded-lg" style={{ background: "rgba(232,99,58,0.1)" }}><Trash2 size={15} style={{ color: "var(--color-alert)" }} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
