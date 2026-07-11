"use client";

import { useEffect, useState } from "react";
import api from "@/lib/admin-api";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Plus, Trash2, X, ToggleLeft, ToggleRight, Pencil } from "lucide-react";
import { RedeemCode } from "@/lib/types";

interface Segment {
  id: string;
  label: string;
  rewardAmount: string;
  weight: string;
  color: string;
  isActive: boolean;
  sortOrder: number;
  segmentType?: string;
}

const INP = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.12)",
  color: "var(--color-surface)",
  outline: "none",
};

type TabId = "codes" | "segments" | "gold";

export default function AdminSpinPage() {
  const [tab, setTab] = useState<TabId>("codes");
  const [segments, setSegments] = useState<Segment[]>([]);
  const [goldSegments, setGoldSegments] = useState<Segment[]>([]);
  const [codes, setCodes] = useState<RedeemCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSegForm, setShowSegForm] = useState(false);
  const [editSeg, setEditSeg] = useState<Segment | null>(null);
  const [segApiBase, setSegApiBase] = useState<"/admin/spin/segments" | "/admin/spin/gold-segments">("/admin/spin/segments");
  const [showCodeForm, setShowCodeForm] = useState(false);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  function loadAll() {
    setLoading(true);
    Promise.all([
      api.get<Segment[]>("/admin/spin/segments"),
      api.get<Segment[]>("/admin/spin/gold-segments"),
      api.get<RedeemCode[]>("/admin/spin/codes"),
    ])
      .then(([s, g, c]) => { setSegments(s.data); setGoldSegments(g.data); setCodes(c.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadAll(); }, []);

  async function deleteSeg(id: string, gold: boolean) {
    const base = gold ? "/admin/spin/gold-segments" : "/admin/spin/segments";
    await api.delete(`${base}/${id}`);
    setConfirmDel(null);
    loadAll();
  }

  async function deleteCode(id: string) {
    await api.delete(`/admin/spin/codes/${id}`);
    setConfirmDel(null);
    loadAll();
  }

  async function toggleCode(id: string) {
    await api.patch(`/admin/spin/codes/${id}/toggle`);
    loadAll();
  }

  function openSegForm(gold: boolean, seg: Segment | null) {
    setSegApiBase(gold ? "/admin/spin/gold-segments" : "/admin/spin/segments");
    setEditSeg(seg);
    setShowSegForm(true);
  }

  const addButtonLabel = tab === "codes" ? "New Code" : tab === "gold" ? "New Gold Segment" : "New Segment";

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <AdminPageHeader title="Spin Wheel" subtitle="Manage wheel segments, gold wheel, and redeem codes." />
        <button
          onClick={() => {
            if (tab === "codes") setShowCodeForm(true);
            else openSegForm(tab === "gold", null);
          }}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-sm text-sm font-medium"
          style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
        >
          <Plus size={15} /> {addButtonLabel}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {([
          { id: "codes" as TabId, label: "Redeem Codes" },
          { id: "segments" as TabId, label: "Normal Wheel" },
          { id: "gold" as TabId, label: "👑 Gold Wheel" },
        ]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="px-4 py-2 rounded-lg text-sm font-semibold"
            style={{
              background: tab === t.id
                ? (t.id === "gold" ? "linear-gradient(90deg,#b8860b,#ffd700)" : "var(--color-accent)")
                : "rgba(255,255,255,0.06)",
              color: tab === t.id ? "#000" : "rgba(245,242,234,0.6)",
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: "rgba(245,242,234,0.5)" }}>Loading…</div>
      ) : tab === "codes" ? (
        <CodesTable
          codes={codes}
          confirmDel={confirmDel}
          setConfirmDel={setConfirmDel}
          onToggle={toggleCode}
          onDelete={deleteCode}
        />
      ) : tab === "gold" ? (
        <SegmentsTable
          segments={goldSegments}
          isGold
          confirmDel={confirmDel}
          setConfirmDel={setConfirmDel}
          onEdit={(s) => openSegForm(true, s)}
          onDelete={(id) => deleteSeg(id, true)}
        />
      ) : (
        <SegmentsTable
          segments={segments}
          isGold={false}
          confirmDel={confirmDel}
          setConfirmDel={setConfirmDel}
          onEdit={(s) => openSegForm(false, s)}
          onDelete={(id) => deleteSeg(id, false)}
        />
      )}

      {showCodeForm && (
        <CodeModal onClose={() => setShowCodeForm(false)} onSaved={() => { setShowCodeForm(false); loadAll(); }} />
      )}

      {showSegForm && (
        <SegmentModal
          seg={editSeg}
          apiBase={segApiBase}
          isGold={segApiBase === "/admin/spin/gold-segments"}
          onClose={() => { setShowSegForm(false); setEditSeg(null); }}
          onSaved={() => { setShowSegForm(false); setEditSeg(null); loadAll(); }}
        />
      )}
    </div>
  );
}

function CodesTable({ codes, confirmDel, setConfirmDel, onToggle, onDelete }: {
  codes: RedeemCode[];
  confirmDel: string | null;
  setConfirmDel: (id: string | null) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  if (!codes.length) return (
    <div className="p-10 text-center rounded-sm" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "var(--color-muted)" }}>
      No redeem codes yet. Create one above.
    </div>
  );

  return (
    <div className="rounded-sm overflow-hidden" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
      {codes.map(c => (
        <div key={c.id} className="ledger-row flex items-center justify-between gap-3 px-5 py-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-mono font-bold text-sm" style={{ color: "var(--color-surface)", letterSpacing: 1 }}>{c.code}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${c.isActive ? "" : "opacity-50"}`}
                style={{ background: c.isActive ? "rgba(0,200,117,0.1)" : "rgba(255,255,255,0.05)", color: c.isActive ? "var(--color-accent)" : "var(--color-muted)" }}>
                {c.isActive ? "Active" : "Disabled"}
              </span>
            </div>
            <div className="text-xs" style={{ color: "var(--color-muted)" }}>
              Rs {parseFloat(c.rewardAmount).toLocaleString()} · Used {c.usedCount}/{c.maxUses}
              {c.expiresAt && ` · Expires ${new Date(c.expiresAt).toLocaleDateString()}`}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => onToggle(c.id)} title={c.isActive ? "Disable" : "Enable"}
              style={{ color: c.isActive ? "var(--color-accent)" : "var(--color-muted)" }}>
              {c.isActive ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
            </button>
            {confirmDel === c.id ? (
              <>
                <button onClick={() => onDelete(c.id)} className="px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: "rgba(232,99,58,0.9)", color: "#fff" }}>Delete</button>
                <button onClick={() => setConfirmDel(null)} className="p-1.5 rounded-lg" style={{ background: "rgba(255,255,255,0.07)" }}><X size={13} style={{ color: "rgba(245,242,234,0.6)" }} /></button>
              </>
            ) : (
              <button onClick={() => setConfirmDel(c.id)} style={{ color: "var(--color-alert)" }}><Trash2 size={16} /></button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function SegmentsTable({ segments, isGold, confirmDel, setConfirmDel, onEdit, onDelete }: {
  segments: Segment[];
  isGold: boolean;
  confirmDel: string | null;
  setConfirmDel: (id: string | null) => void;
  onEdit: (s: Segment) => void;
  onDelete: (id: string) => void;
}) {
  const totalWeight = segments.reduce((sum, s) => sum + parseFloat(s.weight), 0);

  if (!segments.length) return (
    <div className="p-10 text-center rounded-sm" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "var(--color-muted)" }}>
      {isGold ? "No gold wheel segments. Create some above." : "No wheel segments. Create some above."}
    </div>
  );

  return (
    <div>
      {isGold && (
        <div className="mb-3 px-4 py-3 rounded-lg text-xs" style={{ background: "rgba(255,215,0,0.07)", border: "1px solid rgba(255,215,0,0.2)", color: "#ffd700" }}>
          👑 Gold wheel is shown to users with the Rs 500 plan. Higher rewards recommended.
        </div>
      )}
      <div className="text-xs mb-3" style={{ color: "var(--color-muted)" }}>
        Total weight: {totalWeight.toFixed(1)} — probabilities are weight / total_weight
      </div>
      <div className="rounded-sm overflow-hidden" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
        {segments.map(s => {
          const prob = totalWeight > 0 ? (parseFloat(s.weight) / totalWeight * 100).toFixed(1) : "0";
          return (
            <div key={s.id} className="ledger-row flex items-center justify-between gap-3 px-5 py-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div style={{ width: 20, height: 20, borderRadius: 4, background: s.color, border: "1px solid rgba(255,255,255,0.15)", flexShrink: 0 }} />
                <div>
                  <div className="text-sm font-medium mb-0.5" style={{ color: "var(--color-surface)" }}>
                    {s.label}
                    {s.segmentType === "BONUS_SPIN" && <span className="ml-2 text-xs" style={{ color: "#a0b8ff" }}>+1 Spin</span>}
                  </div>
                  <div className="text-xs" style={{ color: "var(--color-muted)" }}>
                    {parseFloat(s.rewardAmount) > 0 ? `Rs ${parseFloat(s.rewardAmount).toLocaleString()}` : "No prize"} · Weight {s.weight} · {prob}% chance
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => onEdit(s)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold"
                  style={{ background: isGold ? "rgba(255,215,0,0.12)" : "rgba(0,200,117,0.12)", color: isGold ? "#ffd700" : "#00C875", border: `1px solid ${isGold ? "rgba(255,215,0,0.25)" : "rgba(0,200,117,0.25)"}` }}>
                  <Pencil size={12} /> Edit
                </button>
                {confirmDel === s.id ? (
                  <>
                    <button onClick={() => onDelete(s.id)} className="px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: "rgba(232,99,58,0.9)", color: "#fff" }}>Delete</button>
                    <button onClick={() => setConfirmDel(null)} className="p-1.5 rounded-lg" style={{ background: "rgba(255,255,255,0.07)" }}><X size={13} style={{ color: "rgba(245,242,234,0.6)" }} /></button>
                  </>
                ) : (
                  <button onClick={() => setConfirmDel(s.id)} style={{ color: "var(--color-alert)" }}><Trash2 size={16} /></button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CodeModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ code: "", rewardAmount: "", maxUses: "1", expiresAt: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post("/admin/spin/codes", {
        code: form.code.trim().toUpperCase(),
        rewardAmount: parseFloat(form.rewardAmount),
        maxUses: parseInt(form.maxUses) || 1,
        expiresAt: form.expiresAt || null,
      });
      onSaved();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to create code.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5" style={{ background: "rgba(10,15,13,0.88)" }} onClick={onClose}>
      <div className="w-full max-w-md p-6 rounded-sm" style={{ background: "#0f1c17", border: "1px solid rgba(255,255,255,0.1)" }} onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-5">
          <h3 className="font-display text-xl" style={{ color: "var(--color-surface)" }}>New Redeem Code</h3>
          <button onClick={onClose}><X size={18} style={{ color: "var(--color-muted)" }} /></button>
        </div>
        {error && <div className="text-sm mb-4 p-3 rounded-sm" style={{ background: "rgba(232,99,58,0.12)", color: "var(--color-alert)" }}>{error}</div>}
        <form onSubmit={submit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>Code *</span>
            <input required value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
              placeholder="e.g. WELCOME100" className="px-3 py-2.5 rounded-sm text-sm font-mono tracking-wider" style={INP} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>Reward Amount (PKR) *</span>
            <input required type="number" min="1" step="1" value={form.rewardAmount} onChange={e => setForm({ ...form, rewardAmount: e.target.value })}
              placeholder="e.g. 500" className="px-3 py-2.5 rounded-sm text-sm" style={INP} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>Max Uses</span>
            <input type="number" min="1" value={form.maxUses} onChange={e => setForm({ ...form, maxUses: e.target.value })}
              className="px-3 py-2.5 rounded-sm text-sm" style={INP} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>Expiry Date (optional)</span>
            <input type="datetime-local" value={form.expiresAt} onChange={e => setForm({ ...form, expiresAt: e.target.value })}
              className="px-3 py-2.5 rounded-sm text-sm" style={INP} />
          </label>
          <button type="submit" disabled={loading}
            className="mt-1 px-4 py-3 rounded-sm text-sm font-medium disabled:opacity-60"
            style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}>
            {loading ? "Creating…" : "Create Code"}
          </button>
        </form>
      </div>
    </div>
  );
}

function SegmentModal({ seg, apiBase, isGold, onClose, onSaved }: {
  seg: Segment | null;
  apiBase: string;
  isGold: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!seg;
  const [form, setForm] = useState({
    label: seg?.label ?? "",
    rewardAmount: seg ? String(parseFloat(seg.rewardAmount)) : "0",
    weight: seg?.weight ?? "10",
    color: seg?.color ?? (isGold ? "#1a0d00" : "#0d2a1a"),
    sortOrder: seg ? String(seg.sortOrder) : "0",
    isActive: seg?.isActive !== false,
    segmentType: seg?.segmentType ?? "PRIZE",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post(apiBase, {
        id: seg?.id,
        label: form.label.trim(),
        rewardAmount: parseFloat(form.rewardAmount) || 0,
        weight: parseFloat(form.weight as string) || 10,
        color: form.color,
        sortOrder: parseInt(form.sortOrder as string) || 0,
        isActive: form.isActive,
        segmentType: form.segmentType,
      });
      onSaved();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to save segment.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5" style={{ background: "rgba(10,15,13,0.88)" }} onClick={onClose}>
      <div className="w-full max-w-md p-6 rounded-sm" style={{ background: isGold ? "#1a0d00" : "#0f1c17", border: `1px solid ${isGold ? "rgba(255,215,0,0.25)" : "rgba(255,255,255,0.1)"}` }} onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-5">
          <h3 className="font-display text-xl" style={{ color: "var(--color-surface)" }}>
            {isGold ? "👑 " : ""}{isEdit ? "Edit Segment" : "New Segment"}
          </h3>
          <button onClick={onClose}><X size={18} style={{ color: "var(--color-muted)" }} /></button>
        </div>
        {error && <div className="text-sm mb-4 p-3 rounded-sm" style={{ background: "rgba(232,99,58,0.12)", color: "var(--color-alert)" }}>{error}</div>}
        <form onSubmit={submit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>Label *</span>
            <input required value={form.label} onChange={e => setForm({ ...form, label: e.target.value })}
              placeholder="e.g. Rs 1,000" className="px-3 py-2.5 rounded-sm text-sm" style={INP} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>Segment Type</span>
            <select value={form.segmentType} onChange={e => setForm({ ...form, segmentType: e.target.value })}
              className="px-3 py-2.5 rounded-sm text-sm" style={INP}>
              <option value="PRIZE">Prize (cash reward)</option>
              <option value="BONUS_SPIN">Bonus Spin (+1 extra spin)</option>
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>Reward (PKR)</span>
              <input type="number" min="0" step="1" value={form.rewardAmount} onChange={e => setForm({ ...form, rewardAmount: e.target.value })}
                disabled={form.segmentType === "BONUS_SPIN"}
                className="px-3 py-2.5 rounded-sm text-sm disabled:opacity-40" style={INP} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>Weight</span>
              <input type="number" min="0.1" step="0.1" value={form.weight} onChange={e => setForm({ ...form, weight: e.target.value })}
                className="px-3 py-2.5 rounded-sm text-sm" style={INP} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>Color</span>
              <div className="flex items-center gap-2">
                <input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })}
                  className="w-10 h-10 rounded cursor-pointer" style={{ border: "1px solid rgba(255,255,255,0.15)", padding: 2, background: "transparent" }} />
                <input value={form.color} onChange={e => setForm({ ...form, color: e.target.value })}
                  className="flex-1 px-2 py-2 rounded-sm text-xs font-mono" style={INP} />
              </div>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>Sort Order</span>
              <input type="number" min="0" value={form.sortOrder} onChange={e => setForm({ ...form, sortOrder: e.target.value })}
                className="px-3 py-2.5 rounded-sm text-sm" style={INP} />
            </label>
          </div>
          <button type="submit" disabled={loading}
            className="mt-1 px-4 py-3 rounded-sm text-sm font-medium disabled:opacity-60"
            style={{ background: isGold ? "linear-gradient(90deg,#b8860b,#ffd700)" : "var(--color-accent)", color: "#000" }}>
            {loading ? "Saving…" : (isEdit ? "Save Changes" : "Create Segment")}
          </button>
        </form>
      </div>
    </div>
  );
}
