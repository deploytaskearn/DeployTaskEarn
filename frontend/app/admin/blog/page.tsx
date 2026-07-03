"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { BlogPost } from "@/lib/types";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Plus, Trash2, X } from "lucide-react";

export default function AdminBlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  function load() {
    setLoading(true);
    api.get("/cms/admin/blog").then((res) => setPosts(res.data)).catch(() => {}).finally(() => setLoading(false));
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetching the list on mount is the correct pattern here
    load();
  }, []);

  async function deletePost(id: string) {
    if (!confirm("Delete this post?")) return;
    await api.delete(`/cms/admin/blog/${id}`);
    load();
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-8">
        <AdminPageHeader title="Blog" subtitle="Publish updates and earner stories." />
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-4 py-2.5 rounded-sm text-sm font-medium shrink-0" style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}>
          <Plus size={15} /> New post
        </button>
      </div>

      {loading ? (
        <div style={{ color: "rgba(245,242,234,0.5)" }}>Loading…</div>
      ) : (
        <div className="rounded-sm overflow-hidden" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          {posts.length === 0 ? (
            <div className="p-10 text-center" style={{ color: "var(--color-muted)" }}>No posts yet.</div>
          ) : (
            posts.map((p) => (
              <div key={p.id} className="ledger-row flex items-center justify-between gap-3 px-5 py-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium" style={{ color: "var(--color-surface)" }}>{p.title}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: p.isPublished ? "rgba(63,168,118,0.1)" : "rgba(20,36,29,0.08)", color: p.isPublished ? "var(--color-accent-dim)" : "var(--color-muted)" }}>
                      {p.isPublished ? "Published" : "Draft"}
                    </span>
                  </div>
                  <div className="text-xs" style={{ color: "var(--color-muted)" }}>/{p.slug}</div>
                </div>
                <button onClick={() => deletePost(p.id)} className="p-2 rounded-sm shrink-0" style={{ color: "var(--color-alert)" }}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {showForm && (
        <CreatePostModal
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

function CreatePostModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ title: "", slug: "", excerpt: "", content: "", isPublished: false });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function handleTitleChange(title: string) {
    setForm({
      ...form,
      title,
      slug: form.slug === "" || form.slug === slugify(form.title) ? slugify(title) : form.slug,
    });
  }

  function slugify(s: string) {
    return s.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await api.post("/cms/admin/blog", form);
      onCreated();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to create post");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5" style={{ background: "rgba(15,28,23,0.85)" }} onClick={onClose}>
      <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto p-6 rounded-sm" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-5">
          <h3 className="font-display text-xl" style={{ color: "var(--color-surface)" }}>New post</h3>
          <button onClick={onClose}><X size={18} style={{ color: "var(--color-muted)" }} /></button>
        </div>

        {error && <div className="text-sm mb-4 p-3 rounded-sm" style={{ background: "rgba(232,99,58,0.12)", color: "var(--color-alert)" }}>{error}</div>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>Title</span>
            <input required value={form.title} onChange={(e) => handleTitleChange(e.target.value)} className="px-3 py-2.5 rounded-sm text-sm outline-none border" style={{ borderColor: "rgba(255,255,255,0.12)", color: "var(--color-surface)" }} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>Slug</span>
            <input required value={form.slug} onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })} className="px-3 py-2.5 rounded-sm text-sm font-mono-tabular outline-none border" style={{ borderColor: "rgba(255,255,255,0.12)", color: "var(--color-surface)" }} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>Excerpt</span>
            <input value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} className="px-3 py-2.5 rounded-sm text-sm outline-none border" style={{ borderColor: "rgba(255,255,255,0.12)", color: "var(--color-surface)" }} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>Content</span>
            <textarea required rows={6} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} className="px-3 py-2.5 rounded-sm text-sm outline-none border resize-none" style={{ borderColor: "rgba(255,255,255,0.12)", color: "var(--color-surface)" }} />
          </label>
          <label className="flex items-center gap-2 text-sm" style={{ color: "var(--color-surface)" }}>
            <input type="checkbox" checked={form.isPublished} onChange={(e) => setForm({ ...form, isPublished: e.target.checked })} />
            Publish immediately
          </label>

          <button type="submit" disabled={submitting} className="mt-1 px-4 py-3 rounded-sm text-sm font-medium disabled:opacity-60" style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}>
            {submitting ? "Saving…" : "Save post"}
          </button>
        </form>
      </div>
    </div>
  );
}
