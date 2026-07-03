"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Task } from "@/lib/types";
import { CheckCircle2, Clock, ExternalLink, Upload } from "lucide-react";

const CARD = { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" };
const INPUT = { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "var(--color-surface)" };

export function TasksTab() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  function load() {
    setLoading(true);
    api.get("/tasks").then((res) => setTasks(res.data)).catch(() => {}).finally(() => setLoading(false));
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetching the list on mount is the correct pattern here
    load();
  }, []);

  if (loading) {
    return <div className="py-12 text-center" style={{ color: "rgba(245,242,234,0.5)" }}>Loading tasks…</div>;
  }

  if (tasks.length === 0) {
    return (
      <div className="py-16 text-center rounded-xl flex flex-col items-center gap-3" style={CARD}>
        <div className="text-3xl">🔒</div>
        <p className="text-sm font-medium" style={{ color: "var(--color-surface)" }}>No tasks available for your plan</p>
        <p className="text-xs" style={{ color: "rgba(245,242,234,0.45)" }}>Upgrade your plan to unlock more high-paying tasks</p>
        <a href="/plans" className="mt-2 px-5 py-2.5 rounded-xl text-xs font-semibold" style={{ background: "var(--color-accent)", color: "#000" }}>
          View Plans
        </a>
      </div>
    );
  }

  return (
    <>
      <div className="grid md:grid-cols-2 gap-4">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} onSubmit={() => setActiveTask(task)} />
        ))}
      </div>

      {activeTask && (
        <SubmitModal task={activeTask} onClose={() => setActiveTask(null)} onSubmitted={() => { setActiveTask(null); load(); }} />
      )}
    </>
  );
}

function TaskCard({ task, onSubmit }: { task: Task; onSubmit: () => void }) {
  return (
    <div className="p-6 rounded-xl flex flex-col" style={CARD}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="font-display text-lg leading-snug" style={{ color: "var(--color-surface)" }}>{task.title}</h3>
        <span className="font-mono-tabular text-sm shrink-0" style={{ color: "var(--color-accent)" }}>
          ₨{parseFloat(task.rewardAmount).toFixed(0)}
        </span>
      </div>
      {task.categoryName && (
        <span className="text-xs uppercase tracking-wide mb-3" style={{ color: "rgba(245,242,234,0.4)" }}>{task.categoryName}</span>
      )}
      <p className="text-sm leading-relaxed mb-4 flex-1" style={{ color: "rgba(245,242,234,0.6)" }}>{task.description}</p>

      {task.alreadySubmitted ? (
        <div className="flex items-center gap-2 text-sm" style={{ color: "var(--color-accent)" }}>
          <CheckCircle2 size={16} /> Submitted — awaiting review
        </div>
      ) : task.source === "CPA_NETWORK" && task.externalUrl ? (
        <a href={task.externalUrl} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 text-sm font-medium px-4 py-2.5 rounded-lg"
          style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}>
          Start offer <ExternalLink size={14} />
        </a>
      ) : (
        <button onClick={onSubmit}
          className="inline-flex items-center justify-center gap-2 text-sm font-medium px-4 py-2.5 rounded-lg"
          style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}>
          <Upload size={14} /> Submit proof
        </button>
      )}
    </div>
  );
}

function SubmitModal({ task, onClose, onSubmitted }: { task: Task; onClose: () => void; onSubmitted: () => void }) {
  const [proofText, setProofText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const formData = new FormData();
      if (proofText) formData.append("proofText", proofText);
      if (file) formData.append("proofFile", file);
      await api.post(`/tasks/${task.id}/submit`, formData, { headers: { "Content-Type": "multipart/form-data" } });
      onSubmitted();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5" style={{ background: "rgba(10,15,13,0.88)" }} onClick={onClose}>
      <div className="w-full max-w-md p-6 rounded-2xl" style={{ background: "#111A14", border: "1px solid rgba(255,255,255,0.1)" }} onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display text-xl mb-1" style={{ color: "var(--color-surface)" }}>{task.title}</h3>
        <p className="text-sm mb-5 flex items-center gap-1.5" style={{ color: "rgba(245,242,234,0.5)" }}>
          <Clock size={14} /> Reviewed within 24 hours
        </p>

        {task.instructions && (
          <div className="text-sm mb-5 p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(245,242,234,0.7)" }}>
            {task.instructions}
          </div>
        )}

        {error && (
          <div className="text-sm mb-4 p-3 rounded-lg" style={{ background: "rgba(232,99,58,0.12)", color: "var(--color-alert)" }}>{error}</div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-wide" style={{ color: "rgba(245,242,234,0.45)" }}>Proof text (optional)</span>
            <textarea rows={3} value={proofText} onChange={(e) => setProofText(e.target.value)}
              className="px-3 py-2.5 rounded-lg text-sm outline-none resize-none" style={INPUT} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-wide" style={{ color: "rgba(245,242,234,0.45)" }}>Screenshot (optional)</span>
            <input type="file" accept="image/*,.pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} className="text-sm" style={{ color: "rgba(245,242,234,0.6)" }} />
          </label>
          <div className="flex gap-3 mt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg text-sm"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(245,242,234,0.7)" }}>
              Cancel
            </button>
            <button type="submit" disabled={submitting}
              className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium disabled:opacity-60"
              style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}>
              {submitting ? "Submitting…" : "Submit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
