"use client";

import { useEffect, useState } from "react";
import api from "@/lib/admin-api";
import { Users, Link2, RefreshCw, CheckCircle2, AlertCircle, Lock, ToggleLeft, ToggleRight } from "lucide-react";

interface PaidRow {
  id: string;
  commissionAmount: string;
  createdAt: string;
  referrerName: string;
  referrerEmail: string;
  referrerRate: number | null;
  referredName: string;
  referredEmail: string;
  planName: string;
  planPrice: string;
}

interface RegisteredRow {
  referredId: string;
  referredName: string;
  referredEmail: string;
  joinedAt: string;
  referrerId: string;
  referrerName: string;
  referrerEmail: string;
  referralCode: string;
  referrerRate: number | null;
  plansBought: string;
}

interface Data {
  paid: PaidRow[];
  registered: RegisteredRow[];
}

interface HoldUserRow {
  id: string;
  name: string;
  email: string;
  status: "ACTIVE" | "HOLD" | "SUSPENDED" | "BANNED";
  createdAt: string;
  totalReferrals: string;
  activatedReferrals: string;
}

interface HoldOverview {
  enabled: boolean;
  ruleStartDate: string;
  windowDays: number;
  requiredReferrals: number;
  users: HoldUserRow[];
}

export default function ReferralsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"paid" | "registered" | "hold">("paid");

  // 20-day hold rule overview
  const [holdData, setHoldData] = useState<HoldOverview | null>(null);
  const [holdLoading, setHoldLoading] = useState(true);
  const [togglingHold, setTogglingHold] = useState(false);
  const [requiredInput, setRequiredInput] = useState("");
  const [savingRequired, setSavingRequired] = useState(false);
  const [savedRequired, setSavedRequired] = useState(false);

  // Link modal state (for "registered" tab rows)
  const [linkModal, setLinkModal] = useState<RegisteredRow | null>(null);
  const [creditBonus, setCreditBonus] = useState(true);
  const [linking, setLinking] = useState(false);
  const [linkMsg, setLinkMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Manual link by email
  const [manualReferredEmail, setManualReferredEmail] = useState("");
  const [manualReferrerEmail, setManualReferrerEmail] = useState("");
  const [manualCredit, setManualCredit] = useState(true);
  const [manualLinking, setManualLinking] = useState(false);
  const [manualMsg, setManualMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleManualLink(e: React.FormEvent) {
    e.preventDefault();
    if (!manualReferredEmail.trim() || !manualReferrerEmail.trim()) return;
    setManualLinking(true);
    setManualMsg(null);
    try {
      const r = await api.post<{ ok: boolean; referredUser: string; referrer: string; credited: number }>(
        "/plans/admin/referrals/link-by-email",
        { referredEmail: manualReferredEmail.trim(), referrerEmail: manualReferrerEmail.trim(), creditBonus: manualCredit }
      );
      const credited = r.data.credited > 0 ? ` Rs ${r.data.credited.toFixed(0)} credited to ${r.data.referrer}.` : "";
      setManualMsg({ ok: true, text: `Linked ${r.data.referredUser} → ${r.data.referrer}.${credited}` });
      setManualReferredEmail("");
      setManualReferrerEmail("");
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed.";
      setManualMsg({ ok: false, text: msg });
    } finally {
      setManualLinking(false);
    }
  }

  async function load() {
    setLoading(true);
    try {
      const r = await api.get<Data>("/plans/admin/referrals");
      setData(r.data);
    } finally {
      setLoading(false);
    }
  }

  async function loadHold() {
    setHoldLoading(true);
    try {
      const r = await api.get<HoldOverview>("/plans/admin/referral-hold/overview");
      setHoldData(r.data);
      setRequiredInput(String(r.data.requiredReferrals));
    } finally {
      setHoldLoading(false);
    }
  }

  async function saveRequiredReferrals() {
    const n = parseInt(requiredInput, 10);
    if (!Number.isInteger(n) || n <= 0) return;
    setSavingRequired(true);
    try {
      await api.post("/cms/admin/settings", { key: "referral_hold_required_count", value: String(n) });
      setHoldData((prev) => (prev ? { ...prev, requiredReferrals: n } : prev));
      setSavedRequired(true);
      setTimeout(() => setSavedRequired(false), 2000);
    } finally {
      setSavingRequired(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetching admin data on mount is the correct, standard pattern here
    loadHold();
  }, []);

  async function toggleHoldRule() {
    if (!holdData) return;
    setTogglingHold(true);
    try {
      const next = !holdData.enabled;
      await api.post("/cms/admin/settings", { key: "referral_hold_enabled", value: String(next) });
      setHoldData({ ...holdData, enabled: next });
    } finally {
      setTogglingHold(false);
    }
  }

  async function handleLink() {
    if (!linkModal) return;
    setLinking(true);
    setLinkMsg(null);
    try {
      const r = await api.post<{ ok: boolean; linked: boolean; credited: number }>("/plans/admin/referrals/link", {
        referredUserId: linkModal.referredId,
        referrerId: linkModal.referrerId,
        creditBonus,
      });
      const credited = r.data.credited > 0 ? ` Rs ${r.data.credited.toFixed(0)} credited.` : "";
      setLinkMsg({ ok: true, text: `Done!${credited}` });
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed.";
      setLinkMsg({ ok: false, text: msg });
    } finally {
      setLinking(false);
    }
  }

  const rate = (r: number | null) => r !== null && r !== undefined ? `${r}%` : "5%";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--color-surface)" }}>Referrals</h1>
          <p className="text-sm" style={{ color: "rgba(245,242,234,0.5)" }}>
            Track who referred whom, commission rates, and bonuses paid.
          </p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm"
          style={{ background: "rgba(255,255,255,0.06)", color: "rgba(245,242,234,0.7)", border: "1px solid rgba(255,255,255,0.1)" }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Manual link form */}
      <div className="rounded-2xl p-5 mb-6" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex items-center gap-2 mb-4">
          <Link2 size={15} style={{ color: "var(--color-accent)" }} />
          <span className="text-sm font-semibold" style={{ color: "var(--color-surface)" }}>Manually Link Referral</span>
          <span className="text-xs ml-1" style={{ color: "rgba(245,242,234,0.4)" }}>— use to fix missed referrals</span>
        </div>
        <form onSubmit={handleManualLink} className="flex flex-col gap-3">
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs mb-1 block" style={{ color: "rgba(245,242,234,0.5)" }}>Referred User Email (who joined via link)</label>
              <input value={manualReferredEmail} onChange={e => setManualReferredEmail(e.target.value)}
                placeholder="user@email.com" type="email" required
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--color-surface)" }} />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: "rgba(245,242,234,0.5)" }}>Referrer Email (who gets the commission)</label>
              <input value={manualReferrerEmail} onChange={e => setManualReferrerEmail(e.target.value)}
                placeholder="referrer@email.com" type="email" required
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--color-surface)" }} />
            </div>
          </div>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={manualCredit} onChange={e => setManualCredit(e.target.checked)}
                style={{ width: 15, height: 15, accentColor: "var(--color-accent)" }} />
              <span className="text-sm" style={{ color: "rgba(245,242,234,0.7)" }}>Credit missed bonus for existing plan purchases</span>
            </label>
            <button type="submit" disabled={manualLinking || !manualReferredEmail || !manualReferrerEmail}
              className="px-5 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50"
              style={{ background: "var(--color-accent)", color: "#000" }}>
              {manualLinking ? "Linking…" : "Link & Credit"}
            </button>
          </div>
          {manualMsg && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm"
              style={{ background: manualMsg.ok ? "rgba(0,200,117,0.1)" : "rgba(232,99,58,0.1)", color: manualMsg.ok ? "var(--color-accent)" : "#E8633A", border: `1px solid ${manualMsg.ok ? "rgba(0,200,117,0.2)" : "rgba(232,99,58,0.2)"}` }}>
              {manualMsg.ok ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
              {manualMsg.text}
            </div>
          )}
        </form>
      </div>

      {/* Stats */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="text-xs mb-1" style={{ color: "rgba(245,242,234,0.45)" }}>Commissions Paid</div>
            <div className="text-2xl font-bold" style={{ color: "var(--color-accent)" }}>{data.paid.length}</div>
          </div>
          <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="text-xs mb-1" style={{ color: "rgba(245,242,234,0.45)" }}>Total Paid Out</div>
            <div className="text-2xl font-bold" style={{ color: "var(--color-accent)" }}>
              Rs {data.paid.reduce((s, r) => s + parseFloat(r.commissionAmount), 0).toFixed(0)}
            </div>
          </div>
          <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="text-xs mb-1" style={{ color: "rgba(245,242,234,0.45)" }}>Registered via Referral</div>
            <div className="text-2xl font-bold" style={{ color: "var(--color-accent)" }}>{data.registered.length}</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        {([
          { id: "paid" as const, label: `Commissions Paid (${data?.paid.length ?? 0})` },
          { id: "registered" as const, label: `Registered via Referral (${data?.registered.length ?? 0})` },
          { id: "hold" as const, label: "20-Day Hold Rule" },
        ]).map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="px-4 py-2 rounded-xl text-sm font-medium"
            style={{
              background: tab === t.id ? "var(--color-accent)" : "rgba(255,255,255,0.06)",
              color: tab === t.id ? "#000" : "rgba(245,242,234,0.6)",
              border: tab === t.id ? "none" : "1px solid rgba(255,255,255,0.08)",
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "hold" ? (
        holdLoading ? (
          <div className="text-sm py-16 text-center" style={{ color: "rgba(245,242,234,0.4)" }}>Loading…</div>
        ) : !holdData ? (
          <div className="text-sm py-16 text-center" style={{ color: "rgba(245,242,234,0.4)" }}>Failed to load.</div>
        ) : (
          <div>
            <div className="rounded-2xl p-5 mb-6 flex items-center justify-between gap-4 flex-wrap"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="flex items-center gap-3">
                <Lock size={18} style={{ color: holdData.enabled ? "var(--color-accent)" : "rgba(245,242,234,0.4)" }} />
                <div>
                  <div className="text-sm font-semibold" style={{ color: "var(--color-surface)" }}>
                    {holdData.requiredReferrals} referrals in {holdData.windowDays} days
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: "rgba(245,242,234,0.45)" }}>
                    New users (signed up on/after {new Date(holdData.ruleStartDate).toLocaleDateString()}) who don&apos;t land {holdData.requiredReferrals} referrals with an activated plan within {holdData.windowDays} days get put on hold automatically.
                  </div>
                </div>
              </div>
              <button onClick={toggleHoldRule} disabled={togglingHold}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 shrink-0"
                style={{
                  background: holdData.enabled ? "rgba(0,200,117,0.12)" : "rgba(255,255,255,0.06)",
                  color: holdData.enabled ? "var(--color-accent)" : "rgba(245,242,234,0.6)",
                  border: `1px solid ${holdData.enabled ? "rgba(0,200,117,0.25)" : "rgba(255,255,255,0.1)"}`,
                }}>
                {holdData.enabled ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                {togglingHold ? "…" : holdData.enabled ? "Enabled" : "Disabled"}
              </button>
              <div className="flex items-center gap-2 shrink-0">
                <label className="text-xs" style={{ color: "rgba(245,242,234,0.5)" }}>Required referrals</label>
                <input type="number" min="1" value={requiredInput} onChange={(e) => setRequiredInput(e.target.value)}
                  className="w-16 px-2 py-2 rounded-lg text-sm text-center outline-none"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--color-surface)" }} />
                <button onClick={saveRequiredReferrals} disabled={savingRequired || parseInt(requiredInput, 10) === holdData.requiredReferrals}
                  className="px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-50"
                  style={{ background: savedRequired ? "rgba(0,200,117,0.25)" : "var(--color-accent)", color: "#000" }}>
                  {savingRequired ? "…" : savedRequired ? "Saved ✓" : "Save"}
                </button>
              </div>
            </div>

            {holdData.users.length === 0 ? (
              <div className="text-sm py-16 text-center" style={{ color: "rgba(245,242,234,0.4)" }}>No users yet.</div>
            ) : (
              <div className="overflow-x-auto rounded-2xl" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }}>
                      {["User", "Signed Up", "Progress", "Status"].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                          style={{ color: "rgba(245,242,234,0.4)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {holdData.users.map((u, i) => {
                      const created = new Date(u.createdAt);
                      const ruleApplies = created >= new Date(holdData.ruleStartDate);
                      const activated = parseInt(u.activatedReferrals);
                      const met = activated >= holdData.requiredReferrals;
                      const deadline = new Date(created.getTime() + holdData.windowDays * 24 * 60 * 60 * 1000);
                      const daysLeft = Math.ceil((deadline.getTime() - Date.now()) / (24 * 60 * 60 * 1000));

                      let statusLabel: string;
                      let statusColor: string;
                      if (u.status === "HOLD") {
                        statusLabel = "On hold";
                        statusColor = "#E8633A";
                      } else if (!ruleApplies) {
                        statusLabel = "N/A (existing user)";
                        statusColor = "rgba(245,242,234,0.4)";
                      } else if (met) {
                        statusLabel = "Target met";
                        statusColor = "var(--color-accent)";
                      } else if (daysLeft > 0) {
                        statusLabel = `${daysLeft}d left`;
                        statusColor = daysLeft <= 5 ? "#F4C842" : "rgba(245,242,234,0.6)";
                      } else {
                        statusLabel = "Deadline passed";
                        statusColor = "#F4C842";
                      }

                      return (
                        <tr key={u.id} style={{ borderBottom: i < holdData.users.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                          <td className="px-4 py-3">
                            <div className="font-semibold" style={{ color: "var(--color-surface)" }}>{u.name}</div>
                            <div className="text-xs" style={{ color: "rgba(245,242,234,0.4)" }}>{u.email}</div>
                          </td>
                          <td className="px-4 py-3 text-xs" style={{ color: "rgba(245,242,234,0.5)" }}>
                            {created.toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-bold" style={{ color: met ? "var(--color-accent)" : "var(--color-surface)" }}>
                              {activated}/{holdData.requiredReferrals}
                            </span>
                            <span className="text-xs ml-1" style={{ color: "rgba(245,242,234,0.4)" }}>activated</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-1 rounded-full text-xs font-bold" style={{ background: `${statusColor}22`, color: statusColor }}>
                              {statusLabel}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      ) : loading ? (
        <div className="text-sm py-16 text-center" style={{ color: "rgba(245,242,234,0.4)" }}>Loading…</div>
      ) : !data ? (
        <div className="text-sm py-16 text-center" style={{ color: "rgba(245,242,234,0.4)" }}>Failed to load.</div>
      ) : tab === "paid" ? (
        data.paid.length === 0 ? (
          <div className="text-sm py-16 text-center" style={{ color: "rgba(245,242,234,0.4)" }}>No commissions paid yet.</div>
        ) : (
          <div className="overflow-x-auto rounded-2xl" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }}>
                  {["Referrer", "Rate", "Referred User", "Plan", "Commission", "Date"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                      style={{ color: "rgba(245,242,234,0.4)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.paid.map((row, i) => (
                  <tr key={row.id} style={{ borderBottom: i < data.paid.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                    <td className="px-4 py-3">
                      <div className="font-semibold" style={{ color: "var(--color-surface)" }}>{row.referrerName}</div>
                      <div className="text-xs" style={{ color: "rgba(245,242,234,0.4)" }}>{row.referrerEmail}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded-full text-xs font-bold"
                        style={{ background: "rgba(0,200,117,0.15)", color: "var(--color-accent)" }}>
                        {rate(row.referrerRate)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold" style={{ color: "var(--color-surface)" }}>{row.referredName}</div>
                      <div className="text-xs" style={{ color: "rgba(245,242,234,0.4)" }}>{row.referredEmail}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div style={{ color: "var(--color-surface)" }}>{row.planName}</div>
                      <div className="text-xs" style={{ color: "rgba(245,242,234,0.4)" }}>Rs {parseFloat(row.planPrice).toLocaleString()}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-bold font-mono" style={{ color: "var(--color-accent)" }}>
                        +Rs {parseFloat(row.commissionAmount).toFixed(0)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: "rgba(245,242,234,0.5)" }}>
                      {new Date(row.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        /* Registered via referral tab */
        data.registered.length === 0 ? (
          <div className="text-sm py-16 text-center" style={{ color: "rgba(245,242,234,0.4)" }}>No referred users found.</div>
        ) : (
          <div className="overflow-x-auto rounded-2xl" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }}>
                  {["Referred User", "Joined", "Referrer", "Rate", "Plans Bought", "Action"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                      style={{ color: "rgba(245,242,234,0.4)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.registered.map((row, i) => (
                  <tr key={row.referredId} style={{ borderBottom: i < data.registered.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                    <td className="px-4 py-3">
                      <div className="font-semibold" style={{ color: "var(--color-surface)" }}>{row.referredName}</div>
                      <div className="text-xs" style={{ color: "rgba(245,242,234,0.4)" }}>{row.referredEmail}</div>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: "rgba(245,242,234,0.5)" }}>
                      {new Date(row.joinedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold" style={{ color: "var(--color-surface)" }}>{row.referrerName}</div>
                      <div className="text-xs font-mono" style={{ color: "rgba(245,242,234,0.4)" }}>{row.referralCode}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded-full text-xs font-bold"
                        style={{ background: "rgba(244,200,66,0.15)", color: "#F4C842" }}>
                        {rate(row.referrerRate)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {parseInt(row.plansBought) > 0 ? (
                        <span className="flex items-center gap-1 text-xs font-bold" style={{ color: "var(--color-accent)" }}>
                          <CheckCircle2 size={13} /> {row.plansBought} plan{parseInt(row.plansBought) > 1 ? "s" : ""}
                        </span>
                      ) : (
                        <span className="text-xs" style={{ color: "rgba(245,242,234,0.3)" }}>No plan yet</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {parseInt(row.plansBought) > 0 && (
                        <button onClick={() => { setLinkModal(row); setCreditBonus(true); setLinkMsg(null); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
                          style={{ background: "rgba(0,200,117,0.12)", color: "var(--color-accent)", border: "1px solid rgba(0,200,117,0.25)" }}>
                          <Link2 size={12} /> Credit Bonus
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Link / Credit modal */}
      {linkModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#0d1a12", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 24, padding: 28, width: "100%", maxWidth: 440 }}>
            <div className="flex items-center gap-2 mb-5">
              <Users size={18} style={{ color: "var(--color-accent)" }} />
              <h2 className="text-lg font-bold" style={{ color: "var(--color-surface)" }}>Credit Referral Bonus</h2>
            </div>

            <div className="rounded-2xl p-4 mb-4" style={{ background: "rgba(255,255,255,0.04)" }}>
              <div className="text-xs mb-2" style={{ color: "rgba(245,242,234,0.45)" }}>Referrer (gets the bonus)</div>
              <div className="font-semibold" style={{ color: "var(--color-surface)" }}>{linkModal.referrerName}</div>
              <div className="text-xs" style={{ color: "rgba(245,242,234,0.4)" }}>{linkModal.referrerEmail} · {rate(linkModal.referrerRate)} commission</div>
            </div>

            <div className="rounded-2xl p-4 mb-4" style={{ background: "rgba(255,255,255,0.04)" }}>
              <div className="text-xs mb-2" style={{ color: "rgba(245,242,234,0.45)" }}>Referred User</div>
              <div className="font-semibold" style={{ color: "var(--color-surface)" }}>{linkModal.referredName}</div>
              <div className="text-xs" style={{ color: "rgba(245,242,234,0.4)" }}>{linkModal.referredEmail} · {linkModal.plansBought} plan(s) bought</div>
            </div>

            <label className="flex items-center gap-3 mb-5 cursor-pointer">
              <input type="checkbox" checked={creditBonus} onChange={e => setCreditBonus(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: "var(--color-accent)" }} />
              <span className="text-sm" style={{ color: "rgba(245,242,234,0.75)" }}>
                Credit {rate(linkModal.referrerRate)} bonus for all existing plan purchases
              </span>
            </label>

            {linkMsg && (
              <div className="flex items-center gap-2 mb-4 px-3 py-2.5 rounded-xl text-sm"
                style={{ background: linkMsg.ok ? "rgba(0,200,117,0.1)" : "rgba(232,99,58,0.1)", color: linkMsg.ok ? "var(--color-accent)" : "#E8633A", border: `1px solid ${linkMsg.ok ? "rgba(0,200,117,0.2)" : "rgba(232,99,58,0.2)"}` }}>
                {linkMsg.ok ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                {linkMsg.text}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => { setLinkModal(null); setLinkMsg(null); }}
                className="flex-1 py-3 rounded-2xl text-sm font-semibold"
                style={{ background: "rgba(255,255,255,0.06)", color: "rgba(245,242,234,0.6)", border: "1px solid rgba(255,255,255,0.1)" }}>
                Cancel
              </button>
              <button onClick={handleLink} disabled={linking}
                className="flex-1 py-3 rounded-2xl text-sm font-bold disabled:opacity-50"
                style={{ background: "var(--color-accent)", color: "#000" }}>
                {linking ? "Processing…" : "Confirm & Credit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
