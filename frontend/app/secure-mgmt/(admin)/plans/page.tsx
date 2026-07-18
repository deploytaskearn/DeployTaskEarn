"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Pencil, Trash2, Star, Check, X, ImagePlus, ListChecks, ChevronDown, ChevronUp, Search, Minus } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Plan, Task } from "@/lib/types";
import api, { uploadUrl } from "@/lib/admin-api";

interface PlanForm {
  name: string; description: string; price: string; durationDays: number;
  maxEarnings: string; dailyEarning: string; maxUsers: string;
  features: string[]; isPopular: boolean; isActive: boolean; sortOrder: number;
  logoUrl: string; dailyTaskLimit: string;
}

interface PlanTask {
  id: string; title: string; rewardAmount: string; planTier: number; categoryName?: string | null;
}

const EMPTY: PlanForm = {
  name: "", description: "", price: "", durationDays: 30, maxEarnings: "",
  dailyEarning: "", maxUsers: "", features: [], isPopular: false, isActive: true, sortOrder: 0,
  logoUrl: "", dailyTaskLimit: "",
};

export default function AdminPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<PlanForm>({ ...EMPTY });
  const [featInput, setFeatInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Delete confirmation state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Task management state
  const [openTaskPlanId, setOpenTaskPlanId] = useState<string | null>(null);
  const [planTasksMap, setPlanTasksMap] = useState<Record<string, PlanTask[]>>({});
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [taskSearch, setTaskSearch] = useState("");
  const [taskLoading, setTaskLoading] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const r = await api.get("/plans/admin");
      setPlans(r.data);
    } catch {}
  }

  async function loadAllTasks() {
    try {
      const r = await api.get("/admin/tasks");
      setAllTasks(r.data);
    } catch {}
  }

  async function openTaskPanel(planId: string) {
    if (openTaskPlanId === planId) { setOpenTaskPlanId(null); return; }
    setOpenTaskPlanId(planId);
    setTaskSearch("");
    await loadAllTasks();
    setTaskLoading(true);
    try {
      const r = await api.get(`/plans/admin/${planId}/tasks`);
      setPlanTasksMap((prev) => ({ ...prev, [planId]: r.data }));
    } finally {
      setTaskLoading(false);
    }
  }

  async function addTaskToPlan(planId: string, taskId: string) {
    await api.post(`/plans/admin/${planId}/tasks`, { taskId });
    const r = await api.get(`/plans/admin/${planId}/tasks`);
    setPlanTasksMap((prev) => ({ ...prev, [planId]: r.data }));
  }

  async function removeTaskFromPlan(planId: string, taskId: string) {
    await api.delete(`/plans/admin/${planId}/tasks/${taskId}`);
    setPlanTasksMap((prev) => ({ ...prev, [planId]: (prev[planId] || []).filter((t) => t.id !== taskId) }));
  }

  function startCreate() {
    setEditing(null);
    setForm({ ...EMPTY, features: [] });
    setFeatInput("");
    setShowForm(true);
    setOpenTaskPlanId(null);
  }

  function startEdit(p: Plan) {
    setEditing(p.id);
    setForm({
      name: p.name, description: p.description || "", price: p.price,
      durationDays: p.durationDays, maxEarnings: p.maxEarnings || "",
      dailyEarning: p.dailyEarning ? String(p.dailyEarning) : "",
      maxUsers: p.maxUsers ? String(p.maxUsers) : "",
      features: [...p.features], isPopular: p.isPopular, isActive: p.isActive,
      sortOrder: p.sortOrder, logoUrl: p.logoUrl || "", dailyTaskLimit: p.dailyTaskLimit ? String(p.dailyTaskLimit) : "",
    });
    setFeatInput("");
    setShowForm(true);
    setOpenTaskPlanId(null);
  }

  async function uploadLogo(file: File) {
    setLogoUploading(true);
    try {
      const fd = new FormData();
      fd.append("logo", file);
      const r = await api.post("/admin/upload/logo", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setForm((p) => ({ ...p, logoUrl: r.data.url }));
    } catch { alert("Logo upload failed"); }
    finally { setLogoUploading(false); }
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
        logoUrl: form.logoUrl || null,
        dailyTaskLimit: form.dailyTaskLimit ? parseInt(form.dailyTaskLimit) : null,
      };
      if (editing) await api.patch(`/plans/admin/${editing}`, payload);
      else await api.post("/plans/admin", payload);
      setShowForm(false);
      await load();
    } catch { alert("Save failed"); }
    finally { setSaving(false); }
  }

  async function remove(id: string) {
    setDeleting(true);
    try {
      await api.delete(`/plans/admin/${id}`);
      setConfirmDeleteId(null);
      await load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Delete failed";
      setConfirmDeleteId(null);
      setDeleteError(msg);
      setTimeout(() => setDeleteError(""), 4000);
    } finally {
      setDeleting(false);
    }
  }

  // Tasks not yet assigned to the plan
  const assignedIds = new Set((planTasksMap[openTaskPlanId || ""] || []).map((t) => t.id));
  const availableTasks = allTasks.filter(
    (t) => !assignedIds.has(t.id) && (!taskSearch || t.title.toLowerCase().includes(taskSearch.toLowerCase()))
  );

  return (
    <div>
      <AdminPageHeader title="Plans" subtitle="Manage earning plans, logos, tasks, and limits." />

      <div className="flex justify-end mb-6">
        <button onClick={startCreate} className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold" style={{ background: "var(--color-accent)", color: "#000" }}>
          <Plus size={16} /> New plan
        </button>
      </div>

      {/* ── Plan form ── */}
      {showForm && (
        <div className="mb-8 rounded-2xl p-7" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <h3 className="font-display text-lg mb-6" style={{ color: "var(--color-surface)" }}>{editing ? "Edit plan" : "New plan"}</h3>

          {/* Logo upload */}
          <div className="mb-5">
            <label className="block text-xs mb-2 font-medium" style={{ color: "rgba(245,242,234,0.55)" }}>Plan Logo (optional)</label>
            <div className="flex items-center gap-4">
              {form.logoUrl ? (
                <div className="relative w-20 h-20 rounded-2xl overflow-hidden shrink-0"
                  style={{ border: "1.5px solid rgba(255,255,255,0.12)" }}>
                  <img src={form.logoUrl} alt="Plan logo" className="w-full h-full object-cover" />
                  <button onClick={() => setForm((p) => ({ ...p, logoUrl: "" }))}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: "rgba(0,0,0,0.7)" }}>
                    <X size={10} style={{ color: "#fff" }} />
                  </button>
                </div>
              ) : (
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center shrink-0"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1.5px dashed rgba(255,255,255,0.15)" }}>
                  <ImagePlus size={22} style={{ color: "rgba(245,242,234,0.3)" }} />
                </div>
              )}
              <div className="flex flex-col gap-2">
                <input ref={logoInputRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo(f); }} />
                <button onClick={() => logoInputRef.current?.click()} disabled={logoUploading}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                  style={{ background: "rgba(255,255,255,0.07)", color: "rgba(245,242,234,0.8)", border: "1px solid rgba(255,255,255,0.1)" }}>
                  <ImagePlus size={14} /> {logoUploading ? "Uploading…" : form.logoUrl ? "Change logo" : "Upload logo"}
                </button>
                {form.logoUrl && (
                  <button
                    onClick={() => setForm((p) => ({ ...p, logoUrl: "" }))}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
                    style={{ background: "rgba(232,99,58,0.1)", color: "#E8633A", border: "1px solid rgba(232,99,58,0.2)" }}>
                    <X size={14} /> Remove logo
                  </button>
                )}
                <div className="text-xs" style={{ color: "rgba(245,242,234,0.35)" }}>JPG, PNG, WEBP · max 5 MB</div>
              </div>
            </div>
          </div>

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

            {/* Daily task limit */}
            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: "rgba(245,242,234,0.55)" }}>
                Daily task limit <span style={{ color: "rgba(245,242,234,0.35)" }}>(tasks/day, optional)</span>
              </label>
              <input
                type="number" min="1" placeholder="e.g. 5"
                value={form.dailyTaskLimit}
                onChange={(e) => setForm((p) => ({ ...p, dailyTaskLimit: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--color-surface)" }}
              />
            </div>
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

      {/* ── Plans list ── */}
      {deleteError && (
        <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ background: "rgba(232,99,58,0.12)", color: "#E8633A", border: "1px solid rgba(232,99,58,0.25)" }}>
          {deleteError}
        </div>
      )}
      <div className="flex flex-col gap-4">
        {plans.length === 0 && <div className="text-center py-16 text-sm" style={{ color: "rgba(245,242,234,0.4)" }}>No plans yet. Create one above.</div>}
        {plans.map((p) => {
          const isTaskOpen = openTaskPlanId === p.id;
          const assignedTasks = planTasksMap[p.id] || [];

          return (
            <div key={p.id} className="rounded-xl overflow-hidden" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              {/* Plan row */}
              <div className="p-5 flex flex-wrap items-center gap-4 justify-between">
                <div className="flex items-center gap-4 min-w-0">
                  {/* Logo thumbnail */}
                  {p.logoUrl ? (
                    <img src={uploadUrl(p.logoUrl) ?? undefined} alt={p.name} className="w-12 h-12 rounded-xl object-cover shrink-0" style={{ border: "1px solid rgba(255,255,255,0.1)" }}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  ) : (
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <Star size={16} style={{ color: "rgba(245,242,234,0.3)" }} />
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="font-semibold text-sm" style={{ color: "var(--color-surface)" }}>{p.name}</span>
                      {p.isPopular && <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(0,200,117,0.15)", color: "var(--color-accent)" }}><Star size={10} />Popular</span>}
                      {!p.isActive && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(232,99,58,0.15)", color: "var(--color-alert)" }}>Inactive</span>}
                      {p.dailyTaskLimit && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(100,160,255,0.12)", color: "#7EB8FF" }}>
                          {p.dailyTaskLimit} tasks/day
                        </span>
                      )}
                    </div>
                    <div className="text-xs" style={{ color: "rgba(245,242,234,0.45)" }}>
                      ₨{parseFloat(p.price).toLocaleString()} · {p.durationDays} days · {p.features.length} features
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={() => openTaskPanel(p.id)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium"
                    style={{ background: isTaskOpen ? "rgba(100,160,255,0.18)" : "rgba(100,160,255,0.08)", color: "#7EB8FF", border: "1px solid rgba(100,160,255,0.2)" }}>
                    <ListChecks size={13} />
                    Tasks {planTasksMap[p.id] ? `(${planTasksMap[p.id].length})` : ""}
                    {isTaskOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                  <button onClick={() => startEdit(p)} className="p-2 rounded-lg" style={{ background: "rgba(255,255,255,0.06)" }}><Pencil size={15} style={{ color: "rgba(245,242,234,0.7)" }} /></button>
                  {confirmDeleteId === p.id ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => remove(p.id)}
                        disabled={deleting}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-50"
                        style={{ background: "rgba(232,99,58,0.9)", color: "#fff" }}>
                        {deleting ? "…" : "Yes, delete"}
                      </button>
                      <button onClick={() => setConfirmDeleteId(null)} className="p-1.5 rounded-lg" style={{ background: "rgba(255,255,255,0.07)" }}>
                        <X size={13} style={{ color: "rgba(245,242,234,0.6)" }} />
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDeleteId(p.id)} className="p-2 rounded-lg" style={{ background: "rgba(232,99,58,0.1)" }}>
                      <Trash2 size={15} style={{ color: "var(--color-alert)" }} />
                    </button>
                  )}
                </div>
              </div>

              {/* ── Task management panel ── */}
              {isTaskOpen && (
                <div className="border-t px-5 pb-5 pt-4" style={{ borderColor: "rgba(100,160,255,0.15)", background: "rgba(100,160,255,0.04)" }}>
                  <div className="text-xs font-semibold mb-3 uppercase tracking-wide" style={{ color: "rgba(100,160,255,0.8)" }}>
                    Assigned tasks for &ldquo;{p.name}&rdquo;
                  </div>

                  {/* Assigned tasks list */}
                  {taskLoading ? (
                    <div className="text-xs mb-4" style={{ color: "rgba(245,242,234,0.4)" }}>Loading…</div>
                  ) : assignedTasks.length === 0 ? (
                    <div className="text-xs mb-4 py-3 px-4 rounded-xl text-center"
                      style={{ background: "rgba(255,255,255,0.03)", color: "rgba(245,242,234,0.35)", border: "1px dashed rgba(255,255,255,0.08)" }}>
                      No tasks assigned yet. Add tasks below.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1.5 mb-4">
                      {assignedTasks.map((t) => (
                        <div key={t.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl"
                          style={{ background: "rgba(100,160,255,0.07)", border: "1px solid rgba(100,160,255,0.12)" }}>
                          <div className="min-w-0">
                            <div className="text-xs font-medium truncate" style={{ color: "#F5F2EA" }}>{t.title}</div>
                            <div className="text-xs" style={{ color: "rgba(245,242,234,0.4)" }}>
                              ₨{parseFloat(t.rewardAmount).toFixed(2)} reward
                              {t.categoryName && <> · {t.categoryName}</>}
                            </div>
                          </div>
                          <button onClick={() => removeTaskFromPlan(p.id, t.id)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                            style={{ background: "rgba(232,99,58,0.12)", border: "1px solid rgba(232,99,58,0.2)" }}>
                            <Minus size={12} style={{ color: "#E8633A" }} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add tasks section */}
                  <div className="text-xs font-medium mb-2" style={{ color: "rgba(245,242,234,0.5)" }}>Add tasks to this plan</div>
                  <div className="relative mb-2">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "rgba(245,242,234,0.3)" }} />
                    <input
                      value={taskSearch}
                      onChange={(e) => setTaskSearch(e.target.value)}
                      placeholder="Search tasks by name…"
                      className="w-full pl-8 pr-3 py-2 rounded-lg text-xs outline-none"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--color-surface)" }}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto">
                    {availableTasks.length === 0 ? (
                      <div className="text-xs py-3 text-center" style={{ color: "rgba(245,242,234,0.35)" }}>
                        {taskSearch ? "No matching tasks found." : "All tasks are already assigned."}
                      </div>
                    ) : availableTasks.map((t) => (
                      <div key={t.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl"
                        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                        <div className="min-w-0">
                          <div className="text-xs font-medium truncate" style={{ color: "#F5F2EA" }}>{t.title}</div>
                          <div className="text-xs" style={{ color: "rgba(245,242,234,0.4)" }}>
                            ₨{parseFloat(t.rewardAmount).toFixed(2)}
                            {t.categoryName && <> · {t.categoryName}</>}
                          </div>
                        </div>
                        <button onClick={() => addTaskToPlan(p.id, t.id)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                          style={{ background: "rgba(100,160,255,0.15)", border: "1px solid rgba(100,160,255,0.25)" }}>
                          <Check size={12} style={{ color: "#7EB8FF" }} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
