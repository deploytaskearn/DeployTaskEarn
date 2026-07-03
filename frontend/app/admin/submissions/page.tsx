"use client";

import { useEffect, useState } from "react";
import api, { uploadUrl } from "@/lib/api";
import { TaskSubmission } from "@/lib/types";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Check, X, ImageIcon } from "lucide-react";

const STATUS_FILTERS = ["PENDING", "APPROVED", "REJECTED", "ALL"] as const;

export default function AdminSubmissionsPage() {
  const [submissions, setSubmissions] = useState<TaskSubmission[]>([]);
  const [filter, setFilter] = useState<typeof STATUS_FILTERS[number]>("PENDING");
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    const params = filter === "ALL" ? {} : { status: filter };
    api.get("/admin/task-submissions", { params }).then((res) => setSubmissions(res.data)).catch(() => {}).finally(() => setLoading(false));
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetching the list when the filter changes is the correct pattern here
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function review(id: string, action: "APPROVE" | "REJECT") {
    setProcessingId(id);
    try {
      await api.post(`/admin/task-submissions/${id}/review`, { action });
      load();
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <div>
      <AdminPageHeader title="Task submissions" subtitle="Review proof submitted for manual tasks before releasing payment." />

      <div className="flex gap-2 mb-6">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-3.5 py-1.5 rounded-sm text-xs font-medium uppercase tracking-wide"
            style={{
              background: filter === f ? "var(--color-accent)" : "transparent",
              color: filter === f ? "var(--color-bg)" : "rgba(245,242,234,0.6)",
              border: filter === f ? "none" : "1px solid rgba(245,242,234,0.15)",
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: "rgba(245,242,234,0.5)" }}>Loading…</div>
      ) : submissions.length === 0 ? (
        <div className="p-10 text-center rounded-sm" style={{ background: "rgba(255,255,255,0.04)", color: "var(--color-muted)" }}>
          No {filter !== "ALL" ? filter.toLowerCase() : ""} submissions.
        </div>
      ) : (
        <div className="rounded-sm overflow-hidden" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          {submissions.map((s) => (
            <div key={s.id} className="ledger-row flex flex-col sm:flex-row sm:items-start justify-between gap-3 px-5 py-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium" style={{ color: "var(--color-surface)" }}>{s.taskTitle}</span>
                  <span className="font-mono-tabular text-xs" style={{ color: "var(--color-accent-dim)" }}>₨{parseFloat(s.rewardAmount || "0").toFixed(2)}</span>
                </div>
                {s.proofText && <p className="text-sm mb-1" style={{ color: "var(--color-surface)" }}>&ldquo;{s.proofText}&rdquo;</p>}
                {s.proofFileUrl && (
                  <a href={uploadUrl(s.proofFileUrl) || "#"} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs" style={{ color: "var(--color-accent-dim)" }}>
                    <ImageIcon size={13} /> View proof file
                  </a>
                )}
                <div className="text-xs mt-1" style={{ color: "var(--color-muted)" }}>{new Date(s.createdAt).toLocaleString()}</div>
              </div>

              {s.status === "PENDING" ? (
                <div className="flex gap-2 shrink-0">
                  <button
                    disabled={processingId === s.id}
                    onClick={() => review(s.id, "APPROVE")}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-sm text-xs font-medium disabled:opacity-50"
                    style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
                  >
                    <Check size={14} /> Approve
                  </button>
                  <button
                    disabled={processingId === s.id}
                    onClick={() => review(s.id, "REJECT")}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-sm text-xs font-medium border disabled:opacity-50"
                    style={{ borderColor: "var(--color-alert)", color: "var(--color-alert)" }}
                  >
                    <X size={14} /> Reject
                  </button>
                </div>
              ) : (
                <span
                  className="text-xs font-medium px-3 py-1.5 rounded-full shrink-0"
                  style={{
                    background: s.status === "APPROVED" ? "rgba(63,168,118,0.1)" : "rgba(232,99,58,0.1)",
                    color: s.status === "APPROVED" ? "var(--color-accent-dim)" : "var(--color-alert)",
                  }}
                >
                  {s.status}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
