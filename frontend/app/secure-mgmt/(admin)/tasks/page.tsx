"use client";

import { useEffect, useRef, useState } from "react";
import api from "@/lib/admin-api";
import { Task } from "@/lib/types";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Plus, Trash2, X, Check, Pencil, ImagePlus } from "lucide-react";

export default function AdminTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  function load() {
    setLoading(true);
    api.get("/admin/tasks")
      .then((r) => setTasks(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  async function deleteTask(id: string) {
    setDeleting(true);
    try {
      await api.delete(`/admin/tasks/${id}`);
      setConfirmDeleteId(null);
      load();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-8">
        <AdminPageHeader title="Tasks" subtitle="Create social media tasks for users." />
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-sm text-sm font-medium"
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
                {t.imageUrl ? (
                  <img src={t.imageUrl} alt="" className="w-11 h-11 rounded-lg object-cover shrink-0" style={{ border: "1px solid rgba(255,255,255,0.1)" }} />
                ) : null}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-sm font-medium" style={{ color: "var(--color-surface)" }}>{t.title}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: t.status === "ACTIVE" ? "rgba(63,168,118,0.1)" : "rgba(232,99,58,0.1)", color: t.status === "ACTIVE" ? "var(--color-accent-dim)" : "var(--color-alert)" }}>
                      {t.status}
                    </span>
                  </div>
                  <div className="text-xs flex items-center gap-1.5 flex-wrap" style={{ color: "var(--color-muted)" }}>
                    <span>₨{parseFloat(t.rewardAmount).toFixed(2)} · Social Media</span>
                    {t.externalUrl && <span style={{ color: "rgba(0,200,117,0.6)" }}>· URL</span>}
                    {t.plans && t.plans.length > 0 ? (
                      t.plans.map((p) => (
                        <span key={p.id} className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ background: "rgba(100,160,255,0.12)", color: "#7EB8FF" }}>
                          {p.name}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ background: "rgba(255,255,255,0.06)", color: "rgba(245,242,234,0.4)" }}>
                        Free task
                      </span>
                    )}
                  </div>
                </div>

                {confirmDeleteId === t.id ? (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => deleteTask(t.id)} disabled={deleting}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-50"
                      style={{ background: "rgba(232,99,58,0.9)", color: "#fff" }}>
                      {deleting ? "…" : <><Check size={12} /> Yes</>}
                    </button>
                    <button onClick={() => setConfirmDeleteId(null)} className="p-1.5 rounded-lg" style={{ background: "rgba(255,255,255,0.07)" }}>
                      <X size={13} style={{ color: "rgba(245,242,234,0.6)" }} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => setEditTask(t)} title="Edit task"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                      style={{ background: "rgba(0,200,117,0.12)", color: "#00C875", border: "1px solid rgba(0,200,117,0.25)" }}>
                      <Pencil size={13} /> Edit
                    </button>
                    <button onClick={() => setConfirmDeleteId(t.id)} className="p-2 rounded-sm" style={{ color: "var(--color-alert)" }} title="Delete task">
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {showForm && (
        <TaskModal
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}

      {editTask && (
        <TaskModal
          task={editTask}
          onClose={() => setEditTask(null)}
          onSaved={() => { setEditTask(null); load(); }}
        />
      )}
    </div>
  );
}

function TaskModal({ task, onClose, onSaved }: { task?: Task; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!task;
  const [form, setForm] = useState({
    title: task?.title ?? "",
    instructions: task?.instructions ?? "",
    externalUrl: task?.externalUrl ?? "",
    rewardAmount: task ? String(parseFloat(task.rewardAmount)) : "",
    imageUrl: task?.imageUrl ?? "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [error, setError] = useState("");
  const imageInputRef = useRef<HTMLInputElement>(null);

  async function uploadImage(file: File) {
    setImageUploading(true);
    try {
      const fd = new FormData();
      fd.append("logo", file);
      const r = await api.post("/admin/upload/logo", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setForm((p) => ({ ...p, imageUrl: r.data.url }));
    } catch {
      setError("Image upload failed");
    } finally {
      setImageUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const title = form.title.trim();
      const instructions = form.instructions.trim();
      const url = form.externalUrl.trim();
      const payload = {
        title,
        description: instructions.length >= 2 ? instructions : title,
        instructions: instructions || undefined,
        externalUrl: url || undefined,
        rewardAmount: parseFloat(form.rewardAmount),
        categoryName: "Social Media",
        source: "MANUAL",
        requiresProof: true,
        imageUrl: form.imageUrl || undefined,
      };
      if (isEdit) {
        await api.patch(`/admin/tasks/${task!.id}`, payload);
      } else {
        await api.post("/admin/tasks", payload);
      }
      onSaved();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || (isEdit ? "Failed to update task" : "Failed to create task"));
    } finally {
      setSubmitting(false);
    }
  }

  const inp = {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "var(--color-surface)",
    outline: "none",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5" style={{ background: "rgba(10,15,13,0.88)" }} onClick={onClose}>
      <div className="w-full max-w-md p-6 rounded-sm" style={{ background: "#0f1c17", border: "1px solid rgba(255,255,255,0.1)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-5">
          <div>
            <h3 className="font-display text-xl" style={{ color: "var(--color-surface)" }}>{isEdit ? "Edit Task" : "New Task"}</h3>
            <p className="text-xs mt-0.5" style={{ color: "var(--color-muted)" }}>Category: Social Media</p>
          </div>
          <button onClick={onClose}><X size={18} style={{ color: "var(--color-muted)" }} /></button>
        </div>

        {error && <div className="text-sm mb-4 p-3 rounded-sm" style={{ background: "rgba(232,99,58,0.12)", color: "var(--color-alert)" }}>{error}</div>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>Task Name *</span>
            <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Follow us on Instagram"
              className="px-3 py-2.5 rounded-sm text-sm" style={inp} />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>Instructions</span>
            <textarea rows={3} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })}
              placeholder="Step by step instructions for the user…"
              className="px-3 py-2.5 rounded-sm text-sm resize-none" style={inp} />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>URL (optional)</span>
            <input type="url" value={form.externalUrl} onChange={(e) => setForm({ ...form, externalUrl: e.target.value })}
              placeholder="https://instagram.com/…"
              className="px-3 py-2.5 rounded-sm text-sm" style={inp} />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>Reward (PKR) *</span>
            <input required type="number" min="1" step="0.01" value={form.rewardAmount} onChange={(e) => setForm({ ...form, rewardAmount: e.target.value })}
              placeholder="e.g. 50"
              className="px-3 py-2.5 rounded-sm text-sm" style={inp} />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>Image (optional)</span>
            <p className="text-xs -mt-1" style={{ color: "var(--color-muted)" }}>Users will see a Download button on the task to get this image.</p>
            <div className="flex items-center gap-3">
              {form.imageUrl ? (
                <div className="relative w-16 h-16 rounded-lg overflow-hidden shrink-0" style={{ border: "1.5px solid rgba(255,255,255,0.12)" }}>
                  <img src={form.imageUrl} alt="Task" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => setForm((p) => ({ ...p, imageUrl: "" }))}
                    className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: "rgba(0,0,0,0.7)" }}>
                    <X size={10} style={{ color: "#fff" }} />
                  </button>
                </div>
              ) : (
                <div className="w-16 h-16 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1.5px dashed rgba(255,255,255,0.15)" }}>
                  <ImagePlus size={18} style={{ color: "rgba(245,242,234,0.3)" }} />
                </div>
              )}
              <input ref={imageInputRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); }} />
              <button type="button" onClick={() => imageInputRef.current?.click()} disabled={imageUploading}
                className="px-3 py-2 rounded-sm text-xs font-medium disabled:opacity-50"
                style={{ background: "rgba(255,255,255,0.07)", color: "rgba(245,242,234,0.8)", border: "1px solid rgba(255,255,255,0.1)" }}>
                {imageUploading ? "Uploading…" : form.imageUrl ? "Change image" : "Upload image"}
              </button>
            </div>
          </label>

          <button type="submit" disabled={submitting}
            className="mt-1 px-4 py-3 rounded-sm text-sm font-medium disabled:opacity-60"
            style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}>
            {submitting ? (isEdit ? "Saving…" : "Creating…") : (isEdit ? "Save Changes" : "Create Task")}
          </button>
        </form>
      </div>
    </div>
  );
}
