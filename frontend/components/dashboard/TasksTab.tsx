"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Task } from "@/lib/types";
import { CheckCircle2, Clock, ExternalLink, Upload, Trophy } from "lucide-react";
import { useRouter } from "next/navigation";

const CARD = { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" };

export function TasksTab() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const router = useRouter();

  function load() {
    setLoading(true);
    api.get("/tasks").then((res) => setTasks(res.data)).catch(() => {}).finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <div className="py-12 text-center" style={{ color: "rgba(245,242,234,0.5)" }}>Loading tasks…</div>;
  }

  const freeTasks = tasks.filter(t => t.isFreeTask);
  const planMap = new Map<string, { name: string; tasks: Task[] }>();
  for (const t of tasks) {
    if (!t.isFreeTask && t.planName) {
      if (!planMap.has(t.planName)) planMap.set(t.planName, { name: t.planName, tasks: [] });
      planMap.get(t.planName)!.tasks.push(t);
    }
  }
  const planGroups = Array.from(planMap.values());

  if (freeTasks.length === 0 && planGroups.length === 0) {
    return (
      <div className="py-16 text-center rounded-xl flex flex-col items-center gap-3" style={CARD}>
        <Trophy size={32} style={{ color: "rgba(245,242,234,0.2)" }} />
        <p className="text-sm font-semibold" style={{ color: "var(--color-surface)" }}>No tasks available</p>
        <p className="text-xs" style={{ color: "rgba(245,242,234,0.45)" }}>Activate a plan to unlock tasks and start earning.</p>
        <button onClick={() => router.push("/dashboard")} className="mt-2 px-5 py-2.5 rounded-xl text-xs font-semibold" style={{ background: "var(--color-accent)", color: "#000" }}>
          View Plans
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Free Tasks */}
      {freeTasks.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-base font-bold" style={{ color: "var(--color-surface)" }}>Free Tasks</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: "rgba(0,200,117,0.12)", color: "#00C875" }}>
              {freeTasks.length}
            </span>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {freeTasks.map(t => (
              <TaskCard key={t.id} task={t} onSubmit={() => setActiveTask(t)} />
            ))}
          </div>
        </section>
      )}

      {/* Plan-specific tasks */}
      {planGroups.map(group => (
        <section key={group.name} className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-base font-bold" style={{ color: "var(--color-surface)" }}>
              {group.name === "Gold" ? "👑" : group.name === "Silver" ? "🥈" : "📦"} {group.name} Plan Tasks
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: "rgba(245,176,0,0.12)", color: "#F5B000" }}>
              {group.tasks.length}
            </span>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {group.tasks.map(t => (
              <TaskCard key={t.id} task={t} onSubmit={() => setActiveTask(t)} />
            ))}
          </div>
        </section>
      ))}

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
      ) : task.externalUrl ? (
        <div className="flex flex-col gap-2">
          <a href={task.externalUrl.startsWith("http") ? task.externalUrl : `https://${task.externalUrl}`}
            target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 text-sm font-medium px-4 py-2.5 rounded-lg"
            style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}>
            Open Link <ExternalLink size={14} />
          </a>
          <button onClick={onSubmit}
            className="inline-flex items-center justify-center gap-2 text-sm font-medium px-4 py-2.5 rounded-lg"
            style={{ background: "rgba(255,255,255,0.07)", color: "var(--color-surface)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <Upload size={14} /> Submit Screenshot
          </button>
        </div>
      ) : (
        <button onClick={onSubmit}
          className="inline-flex items-center justify-center gap-2 text-sm font-medium px-4 py-2.5 rounded-lg"
          style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}>
          <Upload size={14} /> Submit Screenshot
        </button>
      )}
    </div>
  );
}

function SubmitModal({ task, onClose, onSubmitted }: { task: Task; onClose: () => void; onSubmitted: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) { setError("Please select a screenshot to submit."); return; }
    setError("");
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("proofFile", file);
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
          <label className="flex flex-col gap-2 cursor-pointer">
            <span className="text-xs uppercase tracking-wide" style={{ color: "rgba(245,242,234,0.45)" }}>Screenshot <span style={{ color: "#E8633A" }}>*</span></span>
            <div className="flex items-center justify-center gap-3 py-5 rounded-xl"
              style={{
                background: file ? "rgba(0,200,117,0.08)" : "rgba(255,255,255,0.04)",
                border: `2px dashed ${file ? "rgba(0,200,117,0.5)" : "rgba(255,255,255,0.15)"}`,
                color: file ? "#00C875" : "rgba(245,242,234,0.5)",
              }}>
              <Upload size={20} style={{ color: file ? "#00C875" : "rgba(245,242,234,0.4)" }} />
              <span className="text-sm font-medium">{file ? file.name : "Choose Screenshot"}</span>
            </div>
            <input type="file" accept="image/*" required onChange={(e) => setFile(e.target.files?.[0] || null)} className="hidden" />
          </label>

          <div className="flex gap-3 mt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg text-sm"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(245,242,234,0.7)" }}>
              Cancel
            </button>
            <button type="submit" disabled={submitting || !file}
              className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
              style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}>
              {submitting ? "Submitting…" : "Submit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
