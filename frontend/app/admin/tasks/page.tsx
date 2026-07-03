"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Task, TaskCategory, Plan } from "@/lib/types";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Plus, Trash2, X } from "lucide-react";

export default function AdminTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<TaskCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  function load() {
    setLoading(true);
    Promise.all([api.get("/admin/tasks"), api.get("/cms/categories")])
      .then(([t, c]) => {
        setTasks(t.data);
        setCategories(c.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetching the list on mount is the correct pattern here
    load();
  }, []);

  async function deleteTask(id: string) {
    if (!confirm("Delete this task? This cannot be undone.")) return;
    await api.delete(`/admin/tasks/${id}`);
    load();
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-8">
        <AdminPageHeader title="Tasks" subtitle="Create manual tasks or register CPA network offers." />
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-sm text-sm font-medium shrink-0"
          style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
        >
          <Plus size={15} /> New task
        </button>
      </div>

      {loading ? (
        <div style={{ color: "rgba(245,242,234,0.5)" }}>Loading…</div>
      ) : (
        <div className="rounded-sm overflow-hidden" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          {tasks.length === 0 ? (
            <div className="p-10 text-center" style={{ color: "var(--color-muted)" }}>No tasks yet.</div>
          ) : (
            tasks.map((t) => (
              <div key={t.id} className="ledger-row flex items-center justify-between gap-3 px-5 py-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium" style={{ color: "var(--color-surface)" }}>{t.title}</span>
                    <span className="text-xs uppercase px-2 py-0.5 rounded-full" style={{ background: "rgba(20,36,29,0.08)", color: "var(--color-muted)" }}>
                      {t.source.replace("_", " ")}
                    </span>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{
                        background: t.status === "ACTIVE" ? "rgba(63,168,118,0.1)" : "rgba(232,99,58,0.1)",
                        color: t.status === "ACTIVE" ? "var(--color-accent-dim)" : "var(--color-alert)",
                      }}
                    >
                      {t.status}
                    </span>
                  </div>
                  <div className="text-xs" style={{ color: "var(--color-muted)" }}>
                    ₨{parseFloat(t.rewardAmount).toFixed(2)} · {t.completedCount} completed
                    {t.categoryName && <> · {t.categoryName}</>}
                  </div>
                </div>
                <button onClick={() => deleteTask(t.id)} className="p-2 rounded-sm shrink-0" style={{ color: "var(--color-alert)" }}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {showForm && (
        <CreateTaskModal
          categories={categories}
          onClose={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function CreateTaskModal({
  categories,
  onClose,
  onCreated,
}: {
  categories: TaskCategory[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [form, setForm] = useState({
    title: "",
    description: "",
    instructions: "",
    categoryName: "",
    source: "MANUAL" as "MANUAL" | "CPA_NETWORK",
    cpaNetworkName: "",
    cpaOfferId: "",
    externalUrl: "",
    rewardAmount: "",
    requiresProof: true,
    planTier: 0,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/plans/admin").then((r) => setPlans(r.data)).catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await api.post("/admin/tasks", {
        ...form,
        rewardAmount: parseFloat(form.rewardAmount),
        categoryName: form.categoryName || undefined,
        cpaNetworkName: form.source === "CPA_NETWORK" ? form.cpaNetworkName : undefined,
        cpaOfferId: form.source === "CPA_NETWORK" ? form.cpaOfferId : undefined,
        externalUrl: form.externalUrl || undefined,
      });
      onCreated();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to create task");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5" style={{ background: "rgba(15,28,23,0.85)" }} onClick={onClose}>
      <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto p-6 rounded-sm" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-5">
          <h3 className="font-display text-xl" style={{ color: "var(--color-surface)" }}>New task</h3>
          <button onClick={onClose}><X size={18} style={{ color: "var(--color-muted)" }} /></button>
        </div>

        {error && <div className="text-sm mb-4 p-3 rounded-sm" style={{ background: "rgba(232,99,58,0.12)", color: "var(--color-alert)" }}>{error}</div>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex gap-2">
            {(["MANUAL", "CPA_NETWORK"] as const).map((s) => (
              <button
                type="button"
                key={s}
                onClick={() => setForm({ ...form, source: s })}
                className="flex-1 px-3 py-2 rounded-sm text-xs font-medium uppercase"
                style={{
                  background: form.source === s ? "var(--color-accent)" : "transparent",
                  color: form.source === s ? "var(--color-bg)" : "var(--color-muted)",
                  border: form.source === s ? "none" : "1px solid rgba(20,36,29,0.15)",
                }}
              >
                {s.replace("_", " ")}
              </button>
            ))}
          </div>

          <Field label="Title">
            <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="px-3 py-2.5 rounded-sm text-sm outline-none border" style={{ borderColor: "rgba(255,255,255,0.12)", color: "var(--color-surface)" }} />
          </Field>
          <Field label="Description">
            <textarea required rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="px-3 py-2.5 rounded-sm text-sm outline-none border resize-none" style={{ borderColor: "rgba(255,255,255,0.12)", color: "var(--color-surface)" }} />
          </Field>
          <Field label="Instructions (shown to user)">
            <textarea rows={2} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} className="px-3 py-2.5 rounded-sm text-sm outline-none border resize-none" style={{ borderColor: "rgba(255,255,255,0.12)", color: "var(--color-surface)" }} />
          </Field>
          <Field label="Category (type manually)">
            <input
              placeholder="e.g. Social Media, Surveys, App Install"
              value={form.categoryName}
              onChange={(e) => setForm({ ...form, categoryName: e.target.value })}
              className="px-3 py-2.5 rounded-sm text-sm outline-none border"
              style={{ background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.12)", color: "var(--color-surface)" }}
            />
          </Field>
          <Field label="Reward amount (PKR)">
            <input type="number" min="1" step="0.01" required value={form.rewardAmount} onChange={(e) => setForm({ ...form, rewardAmount: e.target.value })} className="px-3 py-2.5 rounded-sm text-sm outline-none border" style={{ background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.12)", color: "var(--color-surface)" }} />
          </Field>
          <Field label="Visible to">
            <select value={form.planTier} onChange={(e) => setForm({ ...form, planTier: parseInt(e.target.value) })} className="px-3 py-2.5 rounded-sm text-sm outline-none" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "var(--color-surface)" }}>
              <option value={0}>Everyone (free users too)</option>
              {plans.map((p) => (
                <option key={p.id} value={p.sortOrder ?? 1}>{p.name} plan holders</option>
              ))}
            </select>
          </Field>

          {form.source === "CPA_NETWORK" ? (
            <>
              <Field label="CPA network name">
                <input required value={form.cpaNetworkName} onChange={(e) => setForm({ ...form, cpaNetworkName: e.target.value })} placeholder="e.g. OGAds" className="px-3 py-2.5 rounded-sm text-sm outline-none border" style={{ borderColor: "rgba(255,255,255,0.12)", color: "var(--color-surface)" }} />
              </Field>
              <Field label="Network offer ID">
                <input required value={form.cpaOfferId} onChange={(e) => setForm({ ...form, cpaOfferId: e.target.value })} placeholder="Used to match postback" className="px-3 py-2.5 rounded-sm text-sm outline-none border" style={{ borderColor: "rgba(255,255,255,0.12)", color: "var(--color-surface)" }} />
              </Field>
              <Field label="Offer URL">
                <input type="url" required value={form.externalUrl} onChange={(e) => setForm({ ...form, externalUrl: e.target.value })} className="px-3 py-2.5 rounded-sm text-sm outline-none border" style={{ borderColor: "rgba(255,255,255,0.12)", color: "var(--color-surface)" }} />
              </Field>
            </>
          ) : (
            <label className="flex items-center gap-2 text-sm" style={{ color: "var(--color-surface)" }}>
              <input type="checkbox" checked={form.requiresProof} onChange={(e) => setForm({ ...form, requiresProof: e.target.checked })} />
              Require proof submission
            </label>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-1 px-4 py-3 rounded-sm text-sm font-medium disabled:opacity-60"
            style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
          >
            {submitting ? "Creating…" : "Create task"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>{label}</span>
      {children}
    </label>
  );
}
