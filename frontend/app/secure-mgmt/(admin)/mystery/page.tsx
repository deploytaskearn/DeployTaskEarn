"use client";

import { useEffect, useState } from "react";
import api from "@/lib/admin-api";
import { Plus, Pencil, Trash2, X, Settings } from "lucide-react";

interface Prize {
  id: string;
  label: string;
  rewardAmount: string | number;
  weight: string | number;
  isActive: boolean;
  sortOrder: string | number;
}

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

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.7)", padding: 16 }}>
      <div style={{ background: "#0d1f16", borderRadius: 20, border: "1px solid rgba(255,255,255,0.1)", padding: 24, width: "100%", maxWidth: 420 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ color: "#F5F2EA", fontSize: 16, fontWeight: 700 }}>{initial.id ? "Edit Prize" : "Add Prize"}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={18} color="rgba(245,242,234,0.5)" /></button>
        </div>

        {err && <div style={{ marginBottom: 14, padding: "10px 14px", borderRadius: 10, background: "rgba(232,99,58,0.1)", color: "#E8633A", fontSize: 13 }}>{err}</div>}

        <form onSubmit={submit}>
          {(["label", "rewardAmount", "weight", "sortOrder"] as const).map((key) => (
            <div key={key} style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "rgba(245,242,234,0.5)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
                {key === "rewardAmount" ? "Reward Amount (Rs)" : key === "weight" ? "Weight (higher = more common)" : key === "sortOrder" ? "Sort Order" : "Label"}
              </label>
              <input
                type={key === "label" ? "text" : "number"}
                placeholder={key === "label" ? "e.g. Rs 100" : key === "rewardAmount" ? "0 for Better Luck" : key === "weight" ? "10" : "0"}
                value={form[key]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "#F5F2EA", fontSize: 14, outline: "none", boxSizing: "border-box" }}
              />
            </div>
          ))}

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

function PrizeTable({
  prizes, loading, onEdit, onDelete, deleting,
}: {
  prizes: Prize[]; loading: boolean; onEdit: (p: Prize) => void; onDelete: (id: string) => void; deleting: string | null;
}) {
  const totalWeight = prizes.filter(p => p.isActive).reduce((s, p) => s + parseFloat(String(p.weight)), 0);

  if (loading) return <div style={{ color: "rgba(245,242,234,0.4)", fontSize: 13 }}>Loading…</div>;

  return (
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
            const prob = totalWeight > 0 ? ((parseFloat(String(p.weight)) / totalWeight) * 100).toFixed(1) : "0.0";
            return (
              <tr key={p.id} style={{ borderBottom: i < prizes.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
                <td style={{ padding: "14px 16px", fontSize: 13, color: "#F5F2EA", fontWeight: 600 }}>
                  <span style={{ marginRight: 8 }}>🎁</span>{p.label}
                </td>
                <td style={{ padding: "14px 16px", fontSize: 13, color: parseFloat(String(p.rewardAmount)) > 0 ? "#00C875" : "rgba(245,242,234,0.4)", fontWeight: 600 }}>
                  {parseFloat(String(p.rewardAmount)) > 0 ? `Rs ${parseFloat(String(p.rewardAmount)).toLocaleString()}` : "—"}
                </td>
                <td style={{ padding: "14px 16px", fontSize: 13, color: "rgba(245,242,234,0.7)" }}>{p.weight}</td>
                <td style={{ padding: "14px 16px", fontSize: 13, color: "rgba(245,242,234,0.7)" }}>{p.isActive ? `${prob}%` : "—"}</td>
                <td style={{ padding: "14px 16px" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 99, background: p.isActive ? "rgba(0,200,117,0.15)" : "rgba(255,255,255,0.06)", color: p.isActive ? "#00C875" : "rgba(245,242,234,0.35)" }}>
                    {p.isActive ? "Active" : "Hidden"}
                  </span>
                </td>
                <td style={{ padding: "14px 16px" }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => onEdit(p)} style={{ padding: "6px 10px", borderRadius: 8, background: "rgba(255,255,255,0.07)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, color: "#F5F2EA", fontSize: 12 }}>
                      <Pencil size={12} /> Edit
                    </button>
                    <button onClick={() => onDelete(p.id)} disabled={deleting === p.id} style={{ padding: "6px 10px", borderRadius: 8, background: "rgba(232,99,58,0.08)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, color: "#E8633A", fontSize: 12, opacity: deleting === p.id ? 0.5 : 1 }}>
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
  );
}

export default function AdminMysteryPage() {
  const [tab, setTab] = useState<"free" | "premium" | "settings">("free");

  // Free prizes
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [loadingFree, setLoadingFree] = useState(true);

  // Premium prizes
  const [premiumPrizes, setPremiumPrizes] = useState<Prize[]>([]);
  const [loadingPremium, setLoadingPremium] = useState(true);

  // Config
  const [premiumBoxPrice, setPremiumBoxPrice] = useState<string>("");
  const [savingConfig, setSavingConfig] = useState(false);
  const [configMsg, setConfigMsg] = useState("");

  // Modal
  const [modal, setModal] = useState<{ form: PrizeForm; type: "free" | "premium" } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function fetchFree() {
    setLoadingFree(true);
    try { setPrizes((await api.get<Prize[]>("/admin/mystery/prizes")).data); } catch {}
    finally { setLoadingFree(false); }
  }
  async function fetchPremium() {
    setLoadingPremium(true);
    try { setPremiumPrizes((await api.get<Prize[]>("/admin/mystery/premium-prizes")).data); } catch {}
    finally { setLoadingPremium(false); }
  }
  async function fetchConfig() {
    try {
      const r = await api.get<{ premiumBoxPrice: number }>("/admin/mystery/config");
      setPremiumBoxPrice(String(r.data.premiumBoxPrice));
    } catch {}
  }

  useEffect(() => { fetchFree(); fetchPremium(); fetchConfig(); }, []);

  const blank: PrizeForm = { label: "", rewardAmount: "0", weight: "10", isActive: true, sortOrder: "99" };

  async function savePrize(f: PrizeForm) {
    const payload = { id: f.id, label: f.label, rewardAmount: parseFloat(f.rewardAmount) || 0, weight: parseFloat(f.weight) || 10, isActive: f.isActive, sortOrder: parseInt(f.sortOrder) || 0 };
    if (modal?.type === "premium") {
      await api.post("/admin/mystery/premium-prizes", payload);
      await fetchPremium();
    } else {
      await api.post("/admin/mystery/prizes", payload);
      await fetchFree();
    }
  }

  async function deletePrize(id: string, type: "free" | "premium") {
    if (!confirm("Delete this prize?")) return;
    setDeleting(id);
    try {
      if (type === "premium") { await api.delete(`/admin/mystery/premium-prizes/${id}`); await fetchPremium(); }
      else { await api.delete(`/admin/mystery/prizes/${id}`); await fetchFree(); }
    } catch { alert("Delete failed."); }
    finally { setDeleting(null); }
  }

  async function saveConfig(e: React.FormEvent) {
    e.preventDefault();
    const price = parseFloat(premiumBoxPrice);
    if (isNaN(price) || price <= 0) return setConfigMsg("Enter a valid price.");
    setSavingConfig(true); setConfigMsg("");
    try {
      await api.post("/admin/mystery/config", { premiumBoxPrice: price });
      setConfigMsg("Saved!");
    } catch { setConfigMsg("Save failed."); }
    finally { setSavingConfig(false); }
  }

  const tabs: { key: typeof tab; label: string }[] = [
    { key: "free", label: "Free Box Prizes" },
    { key: "premium", label: "Premium Box Prizes" },
    { key: "settings", label: "Settings" },
  ];

  return (
    <div style={{ maxWidth: 780 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#F5F2EA", marginBottom: 4 }}>Mystery Box</h1>
        <p style={{ fontSize: 13, color: "rgba(245,242,234,0.45)" }}>Manage free and premium mystery box prizes and pricing.</p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 28, borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 0 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding: "9px 18px", borderRadius: "10px 10px 0 0", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
              background: tab === t.key ? "rgba(0,200,117,0.12)" : "transparent",
              color: tab === t.key ? "#00C875" : "rgba(245,242,234,0.5)",
              borderBottom: tab === t.key ? "2px solid #00C875" : "2px solid transparent" }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "free" && (
        <>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
            <button onClick={() => setModal({ form: blank, type: "free" })}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 12, background: "#00C875", color: "#000", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer" }}>
              <Plus size={15} /> Add Prize
            </button>
          </div>
          <PrizeTable prizes={prizes} loading={loadingFree}
            onEdit={p => setModal({ form: { id: p.id, label: p.label, rewardAmount: String(p.rewardAmount), weight: String(p.weight), isActive: p.isActive, sortOrder: String(p.sortOrder) }, type: "free" })}
            onDelete={id => deletePrize(id, "free")} deleting={deleting} />
          <div style={{ marginTop: 16, padding: "14px 18px", borderRadius: 14, background: "rgba(168,85,247,0.07)", border: "1px solid rgba(168,85,247,0.2)", fontSize: 12, color: "rgba(245,242,234,0.55)", lineHeight: 1.6 }}>
            <strong style={{ color: "#a855f7" }}>Free box</strong> — all users get 1 free open per 24 hours. Set <strong>rewardAmount = 0</strong> for "Better Luck Next Time" prizes.
          </div>
        </>
      )}

      {tab === "premium" && (
        <>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
            <button onClick={() => setModal({ form: blank, type: "premium" })}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 12, background: "#00C875", color: "#000", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer" }}>
              <Plus size={15} /> Add Prize
            </button>
          </div>
          <PrizeTable prizes={premiumPrizes} loading={loadingPremium}
            onEdit={p => setModal({ form: { id: p.id, label: p.label, rewardAmount: String(p.rewardAmount), weight: String(p.weight), isActive: p.isActive, sortOrder: String(p.sortOrder) }, type: "premium" })}
            onDelete={id => deletePrize(id, "premium")} deleting={deleting} />
          <div style={{ marginTop: 16, padding: "14px 18px", borderRadius: 14, background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.2)", fontSize: 12, color: "rgba(245,242,234,0.55)", lineHeight: 1.6 }}>
            <strong style={{ color: "#fbbf24" }}>Premium box</strong> — users pay Rs {premiumBoxPrice || "…"} per open from their wallet. Higher value prizes. Change the price in the Settings tab.
          </div>
        </>
      )}

      {tab === "settings" && (
        <div style={{ maxWidth: 420 }}>
          <div style={{ padding: 24, borderRadius: 18, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <Settings size={18} color="#00C875" />
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "#F5F2EA" }}>Premium Box Price</h3>
            </div>
            <p style={{ fontSize: 12, color: "rgba(245,242,234,0.45)", marginBottom: 20, lineHeight: 1.6 }}>
              How much a user pays (from their wallet) to open one Premium Mystery Box.
            </p>
            <form onSubmit={saveConfig}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "rgba(245,242,234,0.5)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Price (Rs)</label>
                <input
                  type="number"
                  min="1"
                  value={premiumBoxPrice}
                  onChange={e => setPremiumBoxPrice(e.target.value)}
                  placeholder="300"
                  style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "#F5F2EA", fontSize: 15, outline: "none", boxSizing: "border-box" }}
                />
              </div>
              {configMsg && (
                <div style={{ marginBottom: 14, fontSize: 13, color: configMsg === "Saved!" ? "#00C875" : "#E8633A" }}>{configMsg}</div>
              )}
              <button type="submit" disabled={savingConfig}
                style={{ width: "100%", padding: "12px 0", borderRadius: 12, background: "#00C875", color: "#000", fontSize: 14, fontWeight: 700, border: "none", cursor: "pointer", opacity: savingConfig ? 0.6 : 1 }}>
                {savingConfig ? "Saving…" : "Save Price"}
              </button>
            </form>
          </div>
        </div>
      )}

      {modal && (
        <PrizeModal
          initial={modal.form}
          onSave={savePrize}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
