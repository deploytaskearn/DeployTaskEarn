"use client";

import { useEffect, useState } from "react";
import api from "@/lib/admin-api";
import { MysteryBoxPrize } from "@/lib/types";
import { Plus, Pencil, Trash2, X } from "lucide-react";

interface PrizeForm {
  id?: string;
  label: string;
  rewardAmount: string;
  weight: string;
  isActive: boolean;
  sortOrder: string;
}

function PrizeModal({ initial, onSave, onClose }: { initial: PrizeForm; onSave: (f: PrizeForm) => Promise<void>; onClose: () => void }) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.label.trim()) return setErr("Label is required");
    setSaving(true); setErr("");
    try { await onSave(form); onClose(); }
    catch { setErr("Save failed. Try again."); }
    finally { setSaving(false); }
  }

  const field = (label: string, key: keyof PrizeForm, type = "text", placeholder = "") => (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "rgba(245,242,234,0.5)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        value={form[key] as string}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "#F5F2EA", fontSize: 14, outline: "none", boxSizing: "border-box" }}
      />
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.7)", padding: 16 }}>
      <div style={{ background: "#0d1f16", borderRadius: 20, border: "1px solid rgba(255,255,255,0.1)", padding: 24, width: "100%", maxWidth: 420 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ color: "#F5F2EA", fontSize: 16, fontWeight: 700 }}>{initial.id ? "Edit Prize" : "Add Prize"}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={18} color="rgba(245,242,234,0.5)" /></button>
        </div>

        {err && <div style={{ marginBottom: 14, padding: "10px 14px", borderRadius: 10, background: "rgba(232,99,58,0.1)", color: "#E8633A", fontSize: 13 }}>{err}</div>}

        <form onSubmit={submit}>
          {field("Label", "label", "text", "e.g. Rs 100")}
          {field("Reward Amount (Rs)", "rewardAmount", "number", "0 for 'Better Luck'")}
          {field("Weight (higher = more common)", "weight", "number", "10")}
          {field("Sort Order", "sortOrder", "number", "0")}

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
              <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} />
              <span style={{ fontSize: 13, color: "rgba(245,242,234,0.7)" }}>Active</span>
            </label>
          </div>

          <button type="submit" disabled={saving} style={{ width: "100%", padding: "12px 0", borderRadius: 12, background: "#00C875", color: "#000", fontSize: 14, fontWeight: 700, border: "none", cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Saving…" : "Save Prize"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AdminMysteryPage() {
  const [prizes, setPrizes] = useState<MysteryBoxPrize[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<PrizeForm | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function fetchPrizes() {
    try {
      const r = await api.get<MysteryBoxPrize[]>("/admin/mystery/prizes");
      setPrizes(r.data);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }

  useEffect(() => { fetchPrizes(); }, []);

  async function savePrize(f: PrizeForm) {
    await api.post("/admin/mystery/prizes", {
      id: f.id,
      label: f.label,
      rewardAmount: parseFloat(f.rewardAmount) || 0,
      weight: parseFloat(f.weight) || 10,
      isActive: f.isActive,
      sortOrder: parseInt(f.sortOrder) || 0,
    });
    await fetchPrizes();
  }

  async function deletePrize(id: string) {
    if (!confirm("Delete this prize?")) return;
    setDeleting(id);
    try { await api.delete(`/admin/mystery/prizes/${id}`); await fetchPrizes(); }
    catch { alert("Delete failed."); }
    finally { setDeleting(null); }
  }

  const blankForm: PrizeForm = { label: "", rewardAmount: "0", weight: "10", isActive: true, sortOrder: "99" };

  const totalWeight = prizes.filter(p => p.isActive).reduce((s, p) => s + parseFloat(p.weight), 0);

  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#F5F2EA", marginBottom: 4 }}>Mystery Box Prizes</h1>
          <p style={{ fontSize: 13, color: "rgba(245,242,234,0.45)" }}>Manage rewards that appear in the Mystery Box game.</p>
        </div>
        <button onClick={() => setModal(blankForm)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 12, background: "#00C875", color: "#000", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer" }}>
          <Plus size={15} /> Add Prize
        </button>
      </div>

      {loading ? (
        <div style={{ color: "rgba(245,242,234,0.4)", fontSize: 13 }}>Loading…</div>
      ) : (
        <div style={{ borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }}>
                {["Label", "Amount", "Weight", "Prob %", "Status", "Actions"].map(h => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "rgba(245,242,234,0.4)", textTransform: "uppercase", letterSpacing: 1 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {prizes.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: "32px 16px", textAlign: "center", color: "rgba(245,242,234,0.35)", fontSize: 13 }}>No prizes yet. Add one!</td>
                </tr>
              ) : prizes.map((p, i) => {
                const prob = totalWeight > 0 ? ((parseFloat(p.weight) / totalWeight) * 100).toFixed(1) : "0.0";
                return (
                  <tr key={p.id} style={{ borderBottom: i < prizes.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
                    <td style={{ padding: "14px 16px", fontSize: 13, color: "#F5F2EA", fontWeight: 600 }}>
                      <span style={{ marginRight: 8 }}>🎁</span>{p.label}
                    </td>
                    <td style={{ padding: "14px 16px", fontSize: 13, color: parseFloat(p.rewardAmount) > 0 ? "#00C875" : "rgba(245,242,234,0.4)", fontWeight: 600 }}>
                      {parseFloat(p.rewardAmount) > 0 ? `Rs ${parseFloat(p.rewardAmount).toLocaleString()}` : "—"}
                    </td>
                    <td style={{ padding: "14px 16px", fontSize: 13, color: "rgba(245,242,234,0.7)" }}>{p.weight}</td>
                    <td style={{ padding: "14px 16px", fontSize: 13, color: "rgba(245,242,234,0.7)" }}>
                      {p.isActive ? `${prob}%` : "—"}
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 99, background: p.isActive ? "rgba(0,200,117,0.15)" : "rgba(255,255,255,0.06)", color: p.isActive ? "#00C875" : "rgba(245,242,234,0.35)" }}>
                        {p.isActive ? "Active" : "Hidden"}
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={() => setModal({ id: p.id, label: p.label, rewardAmount: p.rewardAmount, weight: p.weight, isActive: p.isActive, sortOrder: String(p.sortOrder) })}
                          style={{ padding: "6px 10px", borderRadius: 8, background: "rgba(255,255,255,0.07)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, color: "#F5F2EA", fontSize: 12 }}
                        >
                          <Pencil size={12} /> Edit
                        </button>
                        <button
                          onClick={() => deletePrize(p.id)}
                          disabled={deleting === p.id}
                          style={{ padding: "6px 10px", borderRadius: 8, background: "rgba(232,99,58,0.08)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, color: "#E8633A", fontSize: 12, opacity: deleting === p.id ? 0.5 : 1 }}
                        >
                          <Trash2 size={12} /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Info box */}
      <div style={{ marginTop: 20, padding: "14px 18px", borderRadius: 14, background: "rgba(168,85,247,0.07)", border: "1px solid rgba(168,85,247,0.2)", fontSize: 12, color: "rgba(245,242,234,0.55)", lineHeight: 1.6 }}>
        <strong style={{ color: "#a855f7" }}>Prize probability</strong> is based on weight ratios. Higher weight = more likely. Set <strong>rewardAmount = 0</strong> for "Better Luck Next Time" type prizes.
        Users get <strong>5 free boxes per day</strong>, resetting at midnight.
      </div>

      {modal && (
        <PrizeModal
          initial={modal}
          onSave={savePrize}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
