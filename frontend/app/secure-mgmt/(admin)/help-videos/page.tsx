"use client";

import { useEffect, useState } from "react";
import api from "@/lib/admin-api";
import { HelpVideo } from "@/lib/types";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { getYouTubeEmbedUrl } from "@/lib/youtube";
import { Plus, Trash2, X, Check, Pencil, ToggleLeft, ToggleRight } from "lucide-react";

export default function AdminHelpVideosPage() {
  const [videos, setVideos] = useState<HelpVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editVideo, setEditVideo] = useState<HelpVideo | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  function load() {
    setLoading(true);
    api.get("/admin/help-videos")
      .then((r) => setVideos(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  async function deleteVideo(id: string) {
    setDeleting(true);
    try {
      await api.delete(`/admin/help-videos/${id}`);
      setConfirmDeleteId(null);
      load();
    } finally {
      setDeleting(false);
    }
  }

  async function toggleActive(v: HelpVideo) {
    await api.patch(`/admin/help-videos/${v.id}`, { isActive: !v.isActive });
    load();
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-8">
        <AdminPageHeader title="Help Videos" subtitle="Tutorial videos shown to users under Dashboard → Help (deposit, withdraw, etc.)." />
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-sm text-sm font-medium"
          style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
        >
          <Plus size={15} /> New video
        </button>
      </div>

      {loading ? (
        <div style={{ color: "rgba(245,242,234,0.5)" }}>Loading…</div>
      ) : (
        <div className="rounded-sm overflow-hidden" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          {videos.length === 0 ? (
            <div className="p-10 text-center" style={{ color: "var(--color-muted)" }}>No help videos yet.</div>
          ) : (
            videos.map((v) => (
              <div key={v.id} className="ledger-row flex items-center justify-between gap-3 px-5 py-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-sm font-medium" style={{ color: "var(--color-surface)" }}>{v.title}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: v.isActive ? "rgba(63,168,118,0.1)" : "rgba(232,99,58,0.1)", color: v.isActive ? "var(--color-accent-dim)" : "var(--color-alert)" }}>
                      {v.isActive ? "Active" : "Hidden"}
                    </span>
                  </div>
                  {v.description && <div className="text-xs mb-1" style={{ color: "var(--color-muted)" }}>{v.description}</div>}
                  <div className="text-xs truncate" style={{ color: "rgba(245,242,234,0.35)" }}>{v.videoUrl}</div>
                </div>

                {confirmDeleteId === v.id ? (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => deleteVideo(v.id)} disabled={deleting}
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
                    <button onClick={() => toggleActive(v)} title={v.isActive ? "Hide from users" : "Show to users"}
                      style={{ color: v.isActive ? "var(--color-accent)" : "var(--color-muted)" }}>
                      {v.isActive ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                    </button>
                    <button onClick={() => setEditVideo(v)} title="Edit video"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                      style={{ background: "rgba(0,200,117,0.12)", color: "#00C875", border: "1px solid rgba(0,200,117,0.25)" }}>
                      <Pencil size={13} /> Edit
                    </button>
                    <button onClick={() => setConfirmDeleteId(v.id)} className="p-2 rounded-sm" style={{ color: "var(--color-alert)" }} title="Delete video">
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
        <VideoModal
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}

      {editVideo && (
        <VideoModal
          video={editVideo}
          onClose={() => setEditVideo(null)}
          onSaved={() => { setEditVideo(null); load(); }}
        />
      )}
    </div>
  );
}

function VideoModal({ video, onClose, onSaved }: { video?: HelpVideo; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!video;
  const [form, setForm] = useState({
    title: video?.title ?? "",
    description: video?.description ?? "",
    videoUrl: video?.videoUrl ?? "",
    sortOrder: video ? String(video.sortOrder) : "0",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const embedUrl = getYouTubeEmbedUrl(form.videoUrl.trim());

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        videoUrl: form.videoUrl.trim(),
        sortOrder: parseInt(form.sortOrder) || 0,
      };
      if (isEdit) {
        await api.patch(`/admin/help-videos/${video!.id}`, payload);
      } else {
        await api.post("/admin/help-videos", payload);
      }
      onSaved();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || (isEdit ? "Failed to update video" : "Failed to create video"));
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
          <h3 className="font-display text-xl" style={{ color: "var(--color-surface)" }}>{isEdit ? "Edit Help Video" : "New Help Video"}</h3>
          <button onClick={onClose}><X size={18} style={{ color: "var(--color-muted)" }} /></button>
        </div>

        {error && <div className="text-sm mb-4 p-3 rounded-sm" style={{ background: "rgba(232,99,58,0.12)", color: "var(--color-alert)" }}>{error}</div>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>Title *</span>
            <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. How to deposit money"
              className="px-3 py-2.5 rounded-sm text-sm" style={inp} />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>Description (optional)</span>
            <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Short summary shown under the video…"
              className="px-3 py-2.5 rounded-sm text-sm resize-none" style={inp} />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>YouTube URL *</span>
            <input required type="url" value={form.videoUrl} onChange={(e) => setForm({ ...form, videoUrl: e.target.value })}
              placeholder="https://www.youtube.com/watch?v=…"
              className="px-3 py-2.5 rounded-sm text-sm" style={inp} />
            {form.videoUrl.trim() && !embedUrl && (
              <span className="text-xs" style={{ color: "var(--color-alert)" }}>Doesn&apos;t look like a valid YouTube link.</span>
            )}
          </label>

          {embedUrl && (
            <div className="rounded-sm overflow-hidden" style={{ aspectRatio: "16/9" }}>
              <iframe src={embedUrl} className="w-full h-full" allowFullScreen title="Preview" />
            </div>
          )}

          <label className="flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>Sort Order</span>
            <input type="number" min="0" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
              className="px-3 py-2.5 rounded-sm text-sm" style={inp} />
          </label>

          <button type="submit" disabled={submitting}
            className="mt-1 px-4 py-3 rounded-sm text-sm font-medium disabled:opacity-60"
            style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}>
            {submitting ? (isEdit ? "Saving…" : "Creating…") : (isEdit ? "Save Changes" : "Create Video")}
          </button>
        </form>
      </div>
    </div>
  );
}
