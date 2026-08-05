"use client";

import { useEffect, useState } from "react";
import api from "@/lib/admin-api";
import { Announcement } from "@/lib/types";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Plus, Trash2, X, Check, Pencil, ToggleLeft, ToggleRight, UploadCloud, Megaphone } from "lucide-react";

export default function AdminAnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Announcement | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  function load() {
    setLoading(true);
    api.get("/cms/admin/announcements")
      .then((r) => setItems(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  async function deleteItem(id: string) {
    setDeleting(true);
    try {
      await api.delete(`/cms/admin/announcements/${id}`);
      setConfirmDeleteId(null);
      load();
    } finally {
      setDeleting(false);
    }
  }

  async function toggleActive(a: Announcement) {
    await api.patch(`/cms/admin/announcements/${a.id}`, { isActive: !a.isActive });
    load();
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-8">
        <AdminPageHeader title="Announcements" subtitle="News/updates shown to users on their dashboard home." />
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-sm text-sm font-medium"
          style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
        >
          <Plus size={15} /> New announcement
        </button>
      </div>

      {loading ? (
        <div style={{ color: "rgba(245,242,234,0.5)" }}>Loading…</div>
      ) : (
        <div className="rounded-sm overflow-hidden" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          {items.length === 0 ? (
            <div className="p-10 text-center" style={{ color: "var(--color-muted)" }}>No announcements yet.</div>
          ) : (
            items.map((a) => (
              <div key={a.id} className="ledger-row flex items-center justify-between gap-3 px-5 py-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {a.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.imageUrl} alt={a.title} className="w-12 h-12 rounded-sm object-cover shrink-0" style={{ border: "1px solid rgba(255,255,255,0.1)" }} />
                  ) : (
                    <div className="w-12 h-12 rounded-sm flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <Megaphone size={16} style={{ color: "rgba(245,242,234,0.3)" }} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-sm font-medium" style={{ color: "var(--color-surface)" }}>{a.title}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full"
                        style={{ background: a.isActive ? "rgba(63,168,118,0.1)" : "rgba(232,99,58,0.1)", color: a.isActive ? "var(--color-accent-dim)" : "var(--color-alert)" }}>
                        {a.isActive ? "Active" : "Hidden"}
                      </span>
                    </div>
                    {a.description && <div className="text-xs" style={{ color: "var(--color-muted)" }}>{a.description}</div>}
                  </div>
                </div>

                {confirmDeleteId === a.id ? (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => deleteItem(a.id)} disabled={deleting}
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
                    <button onClick={() => toggleActive(a)} title={a.isActive ? "Hide from users" : "Show to users"}
                      style={{ color: a.isActive ? "var(--color-accent)" : "var(--color-muted)" }}>
                      {a.isActive ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                    </button>
                    <button onClick={() => setEditItem(a)} title="Edit announcement"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                      style={{ background: "rgba(0,200,117,0.12)", color: "#00C875", border: "1px solid rgba(0,200,117,0.25)" }}>
                      <Pencil size={13} /> Edit
                    </button>
                    <button onClick={() => setConfirmDeleteId(a.id)} className="p-2 rounded-sm" style={{ color: "var(--color-alert)" }} title="Delete announcement">
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
        <AnnouncementModal
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}

      {editItem && (
        <AnnouncementModal
          item={editItem}
          onClose={() => setEditItem(null)}
          onSaved={() => { setEditItem(null); load(); }}
        />
      )}
    </div>
  );
}

function AnnouncementModal({ item, onClose, onSaved }: { item?: Announcement; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!item;
  const [form, setForm] = useState({
    title: item?.title ?? "",
    description: item?.description ?? "",
    imageUrl: item?.imageUrl ?? "",
    sortOrder: item ? String(item.sortOrder) : "0",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

  async function handleImageUpload(file: File) {
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("logo", file);
      const r = await api.post<{ url: string }>("/admin/upload/logo", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setForm((f) => ({ ...f, imageUrl: r.data.url }));
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Image upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        imageUrl: form.imageUrl.trim() || undefined,
        sortOrder: parseInt(form.sortOrder) || 0,
      };
      if (isEdit) {
        await api.patch(`/cms/admin/announcements/${item!.id}`, payload);
      } else {
        await api.post("/cms/admin/announcements", payload);
      }
      onSaved();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || (isEdit ? "Failed to update announcement" : "Failed to create announcement"));
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
          <h3 className="font-display text-xl" style={{ color: "var(--color-surface)" }}>{isEdit ? "Edit Announcement" : "New Announcement"}</h3>
          <button onClick={onClose}><X size={18} style={{ color: "var(--color-muted)" }} /></button>
        </div>

        {error && <div className="text-sm mb-4 p-3 rounded-sm" style={{ background: "rgba(232,99,58,0.12)", color: "var(--color-alert)" }}>{error}</div>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>Title *</span>
            <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. New Gold Plan launched!"
              className="px-3 py-2.5 rounded-sm text-sm" style={inp} />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>Description (optional)</span>
            <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Details shown under the image…"
              className="px-3 py-2.5 rounded-sm text-sm resize-none" style={inp} />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>Picture (optional)</span>
            <div className="flex items-center gap-3">
              {form.imageUrl ? (
                <div className="relative w-16 h-16 rounded-sm overflow-hidden shrink-0" style={{ border: "1px solid rgba(255,255,255,0.12)" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={form.imageUrl} alt="Announcement" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => setForm((f) => ({ ...f, imageUrl: "" }))}
                    className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full flex items-center justify-center"
                    style={{ background: "rgba(0,0,0,0.7)" }}>
                    <X size={9} style={{ color: "#fff" }} />
                  </button>
                </div>
              ) : (
                <div className="w-16 h-16 rounded-sm flex items-center justify-center shrink-0"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1.5px dashed rgba(255,255,255,0.15)" }}>
                  <Megaphone size={18} style={{ color: "rgba(245,242,234,0.25)" }} />
                </div>
              )}
              <label className="flex items-center gap-1.5 px-3 py-2.5 rounded-sm text-sm font-medium cursor-pointer"
                style={{ background: "rgba(0,200,117,0.12)", color: "#00C875", border: "1px solid rgba(0,200,117,0.25)" }}>
                <UploadCloud size={14} />
                {uploading ? "Uploading…" : form.imageUrl ? "Change" : "Upload image"}
                <input type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" className="hidden"
                  disabled={uploading}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); }} />
              </label>
            </div>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>Sort Order</span>
            <input type="number" min="0" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
              className="px-3 py-2.5 rounded-sm text-sm" style={inp} />
          </label>

          <button type="submit" disabled={submitting}
            className="mt-1 px-4 py-3 rounded-sm text-sm font-medium disabled:opacity-60"
            style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}>
            {submitting ? (isEdit ? "Saving…" : "Creating…") : (isEdit ? "Save Changes" : "Create Announcement")}
          </button>
        </form>
      </div>
    </div>
  );
}
