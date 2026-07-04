"use client";

import { useEffect, useState } from "react";
import api, { uploadUrl } from "@/lib/api";
import { Deposit } from "@/lib/types";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Check, X, ZoomIn, ExternalLink, ImageOff } from "lucide-react";

const STATUS_FILTERS = ["PENDING", "APPROVED", "REJECTED", "ALL"] as const;

export default function AdminDepositsPage() {
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [filter, setFilter] = useState<typeof STATUS_FILTERS[number]>("PENDING");
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [note, setNote] = useState<Record<string, string>>({});

  function load() {
    setLoading(true);
    const params = filter === "ALL" ? {} : { status: filter };
    api.get("/deposits/admin/all", { params })
      .then((res) => setDeposits(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function review(id: string, action: "APPROVE" | "REJECT") {
    setProcessingId(id);
    try {
      await api.post(`/deposits/admin/${id}/review`, { action, note: note[id] || undefined });
      load();
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <div>
      <AdminPageHeader title="Deposits" subtitle="Review deposit proofs and approve or reject wallet credits." />

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {STATUS_FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide transition-colors"
            style={{
              background: filter === f ? "var(--color-accent)" : "rgba(255,255,255,0.06)",
              color: filter === f ? "#000" : "rgba(245,242,234,0.6)",
            }}>
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-10 text-center text-sm" style={{ color: "rgba(245,242,234,0.4)" }}>Loading…</div>
      ) : deposits.length === 0 ? (
        <div className="p-12 text-center rounded-2xl text-sm" style={{ background: "rgba(255,255,255,0.03)", color: "var(--color-muted)", border: "1px solid rgba(255,255,255,0.07)" }}>
          No {filter !== "ALL" ? filter.toLowerCase() : ""} deposits.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {deposits.map((d) => {
            const imgUrl = d.screenshotUrl ? uploadUrl(d.screenshotUrl) : null;
            return (
              <div key={d.id} className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="flex flex-col md:flex-row gap-0">

                  {/* ── Screenshot panel ── */}
                  <div className="md:w-52 shrink-0" style={{ background: "rgba(0,0,0,0.2)", minHeight: 140 }}>
                    {imgUrl ? (
                      <ImgWithFallback imgUrl={imgUrl} onOpen={() => setLightbox(imgUrl)} />
                    ) : (
                      <div className="w-full min-h-[140px] flex flex-col items-center justify-center gap-2"
                        style={{ color: "rgba(245,242,234,0.2)" }}>
                        <div className="text-xs">No screenshot</div>
                      </div>
                    )}
                  </div>

                  {/* ── Details panel ── */}
                  <div className="flex-1 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono-tabular text-2xl font-bold" style={{ color: "var(--color-accent)" }}>
                            ₨{parseFloat(d.amount).toLocaleString()}
                          </span>
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full uppercase" style={{ background: "rgba(255,255,255,0.07)", color: "rgba(245,242,234,0.6)" }}>
                            {d.method.replace("_", " ")}
                          </span>
                          {d.status !== "PENDING" && (
                            <span className="text-xs font-semibold px-2.5 py-1 rounded-full uppercase" style={{
                              background: d.status === "APPROVED" ? "rgba(0,200,117,0.12)" : "rgba(232,99,58,0.12)",
                              color: d.status === "APPROVED" ? "var(--color-accent)" : "var(--color-alert)",
                            }}>
                              {d.status}
                            </span>
                          )}
                        </div>
                        <div className="text-sm font-semibold mb-0.5" style={{ color: "var(--color-surface)" }}>
                          {d.userName}
                        </div>
                        <div className="text-xs" style={{ color: "rgba(245,242,234,0.5)" }}>{d.userEmail}</div>
                      </div>
                      {imgUrl && (
                        <a href={imgUrl} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg shrink-0"
                          style={{ background: "rgba(255,255,255,0.06)", color: "rgba(245,242,234,0.6)" }}>
                          <ExternalLink size={12} /> Open full
                        </a>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-x-5 gap-y-1 mb-4 text-xs" style={{ color: "rgba(245,242,234,0.5)" }}>
                      {d.transactionId && <span>TxID: <span className="font-mono" style={{ color: "var(--color-surface)" }}>{d.transactionId}</span></span>}
                      {d.senderAccountNo && <span>From: <span className="font-mono" style={{ color: "var(--color-surface)" }}>{d.senderAccountNo}</span></span>}
                      <span>{new Date(d.createdAt).toLocaleString()}</span>
                    </div>

                    {d.status === "PENDING" && (
                      <div className="flex flex-col gap-2">
                        <input
                          placeholder="Note (optional — shown to user on reject)"
                          value={note[d.id] || ""}
                          onChange={(e) => setNote((p) => ({ ...p, [d.id]: e.target.value }))}
                          className="w-full px-3 py-2 rounded-lg text-xs outline-none"
                          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--color-surface)" }}
                        />
                        <div className="flex gap-2">
                          <button disabled={processingId === d.id} onClick={() => review(d.id, "APPROVE")}
                            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50"
                            style={{ background: "var(--color-accent)", color: "#000" }}>
                            <Check size={15} /> Approve
                          </button>
                          <button disabled={processingId === d.id} onClick={() => review(d.id, "REJECT")}
                            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
                            style={{ background: "rgba(232,99,58,0.12)", color: "var(--color-alert)", border: "1px solid rgba(232,99,58,0.3)" }}>
                            <X size={15} /> Reject
                          </button>
                        </div>
                      </div>
                    )}

                    {d.status !== "PENDING" && d.reviewNote && (
                      <div className="text-xs px-3 py-2 rounded-lg mt-1" style={{ background: "rgba(255,255,255,0.04)", color: "rgba(245,242,234,0.5)" }}>
                        Note: {d.reviewNote}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Lightbox ── */}

      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.9)" }}
          onClick={() => setLightbox(null)}>
          <div className="relative max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightbox} alt="deposit proof" className="w-full rounded-2xl" style={{ maxHeight: "85vh", objectFit: "contain" }} />
            <button onClick={() => setLightbox(null)}
              className="absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: "rgba(0,0,0,0.6)" }}>
              <X size={18} style={{ color: "#fff" }} />
            </button>
            <a href={lightbox} target="_blank" rel="noopener noreferrer"
              className="absolute bottom-3 right-3 flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg"
              style={{ background: "rgba(0,0,0,0.6)", color: "#fff" }}>
              <ExternalLink size={13} /> Open original
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

function ImgWithFallback({ imgUrl, onOpen }: { imgUrl: string; onOpen: () => void }) {
  const [err, setErr] = useState(false);
  if (err) {
    return (
      <div className="w-full min-h-[140px] flex flex-col items-center justify-center gap-2 cursor-pointer"
        style={{ color: "rgba(245,242,234,0.2)" }}>
        <ImageOff size={28} />
        <div className="text-xs text-center px-2">Image not available<br />(old upload)</div>
      </div>
    );
  }
  return (
    <div className="relative w-full h-full min-h-[140px] cursor-pointer group" onClick={onOpen}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imgUrl}
        alt="deposit proof"
        className="w-full h-full object-cover"
        style={{ minHeight: 140, maxHeight: 200 }}
        onError={() => setErr(true)}
      />
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: "rgba(0,0,0,0.5)" }}>
        <ZoomIn size={28} style={{ color: "#fff" }} />
      </div>
    </div>
  );
}
