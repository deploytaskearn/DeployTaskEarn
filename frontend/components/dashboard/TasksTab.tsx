"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import api from "@/lib/api";
import { Task } from "@/lib/types";
import { CheckCircle2, ExternalLink, Trophy, Upload, X as XIcon, ImageIcon, Download, Clock } from "lucide-react";

const CARD = { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" };

// Cross-origin <a download> is ignored by most browsers (they just navigate
// instead), so fetch the image as a blob and trigger the download ourselves.
async function downloadImage(url: string, filename: string) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(blobUrl);
  } catch {
    window.open(url, "_blank");
  }
}

// ── Proof modal ──────────────────────────────────────────────────────────────

function ProofModal({
  task,
  onSubmit,
  onClose,
}: {
  task: Task;
  onSubmit: (proofText: string, proofFile: File | null) => void;
  onClose: () => void;
}) {
  const [proofText, setProofText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    if (f) {
      const url = URL.createObjectURL(f);
      setPreview(url);
    } else {
      setPreview(null);
    }
  }

  const canSubmit = file !== null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 flex flex-col gap-4"
        style={{ background: "var(--color-bg)", border: "1px solid rgba(255,255,255,0.1)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg" style={{ color: "var(--color-surface)" }}>Submit Proof</h3>
            <p className="text-xs mt-0.5" style={{ color: "rgba(245,242,234,0.45)" }}>{task.title}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: "rgba(245,242,234,0.5)" }}>
            <XIcon size={18} />
          </button>
        </div>

        {/* Screenshot upload */}
        <div>
          {preview ? (
            <div className="relative rounded-xl overflow-hidden" style={{ maxHeight: 200 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="proof preview" className="w-full object-cover" style={{ maxHeight: 200 }} />
              <button
                onClick={() => { setFile(null); setPreview(null); if (fileRef.current) fileRef.current.value = ""; }}
                className="absolute top-2 right-2 p-1 rounded-full"
                style={{ background: "rgba(0,0,0,0.6)" }}
              >
                <XIcon size={14} color="white" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full py-8 rounded-xl flex flex-col items-center gap-2 border-dashed transition-colors"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1.5px dashed rgba(255,255,255,0.15)",
                color: "rgba(245,242,234,0.4)",
              }}
            >
              <ImageIcon size={24} />
              <span className="text-sm">Tap to upload screenshot</span>
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={pickFile}
          />
        </div>

        {/* Submit */}
        <button
          onClick={() => onSubmit(proofText, file)}
          disabled={!canSubmit}
          className="w-full py-3 rounded-xl text-sm font-bold disabled:opacity-40"
          style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
        >
          Submit Proof
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function TasksTab({ onRewardEarned }: { onRewardEarned?: () => void }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({});

  // Which task is waiting for proof
  const [proofTask, setProofTask] = useState<Task | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api.get<Task[]>("/tasks")
      .then((r) => {
        setTasks((prev) => {
          const wasPending = new Set(prev.filter((t) => t.submissionStatus === "PENDING").map((t) => t.id));
          const justApproved = r.data.some((t) => wasPending.has(t.id) && t.submissionStatus === "APPROVED");
          if (justApproved) onRewardEarned?.();
          return r.data;
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [onRewardEarned]);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  async function handleProofSubmit(task: Task, proofText: string, proofFile: File | null) {
    setProofTask(null);
    setSubmitting(s => ({ ...s, [task.id]: true }));

    const form = new FormData();
    if (proofFile) form.append("proofFile", proofFile);
    if (proofText.trim()) form.append("proofText", proofText.trim());

    try {
      await api.post(`/tasks/${task.id}/submit`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, alreadySubmitted: true, submissionStatus: "PENDING" } : t));
    } catch {
      load();
    } finally {
      setSubmitting(s => ({ ...s, [task.id]: false }));
    }
  }

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
      </div>
    );
  }

  return (
    <>
      {/* Proof modal */}
      {proofTask && (
        <ProofModal
          task={proofTask}
          onSubmit={(text, file) => handleProofSubmit(proofTask, text, file)}
          onClose={() => setProofTask(null)}
        />
      )}

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
              <TaskCard key={t.id} task={t}
                submitting={!!submitting[t.id]}
                onComplete={() => setProofTask(t)}
              />
            ))}
          </div>
        </section>
      )}

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
              <TaskCard key={t.id} task={t}
                submitting={!!submitting[t.id]}
                onComplete={() => setProofTask(t)}
              />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

// ── Task card ─────────────────────────────────────────────────────────────────

function TaskCard({
  task, submitting, onComplete,
}: {
  task: Task;
  submitting: boolean;
  onComplete: () => void;
}) {
  const status = task.submissionStatus;
  const isDone = task.alreadySubmitted;

  return (
    <div className="p-5 rounded-xl flex flex-col gap-3" style={{
      ...CARD,
      border: status === "APPROVED" ? "1px solid rgba(0,200,117,0.3)" : status === "REJECTED" ? "1px solid rgba(232,99,58,0.3)" : CARD.border,
      background: status === "APPROVED" ? "rgba(0,200,117,0.04)" : CARD.background,
    }}>
      {/* Title + reward */}
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-base leading-snug" style={{ color: "var(--color-surface)" }}>
          {task.title}
        </h3>
        <div className="flex flex-col items-end shrink-0 gap-0.5">
          <span className="font-mono-tabular text-sm font-bold" style={{ color: "#00C875" }}>
            +Rs{parseFloat(task.rewardAmount).toFixed(0)}
          </span>
          <span className="text-xs" style={{ color: "rgba(244,200,66,0.8)" }}>+10 🪙</span>
        </div>
      </div>

      <p className="text-sm leading-relaxed flex-1" style={{ color: "rgba(245,242,234,0.6)" }}>{task.description}</p>

      {task.imageUrl && (
        <button
          onClick={() => downloadImage(task.imageUrl!, `${task.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.jpg`)}
          className="inline-flex items-center justify-center gap-2 text-sm font-medium px-4 py-2.5 rounded-lg"
          style={{ background: "rgba(100,160,255,0.1)", color: "#7EB8FF", border: "1px solid rgba(100,160,255,0.2)" }}>
          <Download size={14} /> Download Image
        </button>
      )}

      {task.externalUrl && !isDone && (
        <a href={task.externalUrl.startsWith("http") ? task.externalUrl : `https://${task.externalUrl}`}
          target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 text-sm font-medium px-4 py-2.5 rounded-lg"
          style={{ background: "rgba(0,200,117,0.1)", color: "#00C875", border: "1px solid rgba(0,200,117,0.2)" }}>
          Open Task Link <ExternalLink size={14} />
        </a>
      )}

      {/* CTA / status */}
      {status === "APPROVED" ? (
        <div className="rounded-xl px-4 py-3 text-center" style={{ background: "rgba(0,200,117,0.1)", border: "1px solid rgba(0,200,117,0.25)" }}>
          <div className="flex items-center justify-center gap-2">
            <CheckCircle2 size={16} color="#00C875" />
            <span className="text-sm font-bold" style={{ color: "#00C875" }}>Approved — Rs{parseFloat(task.rewardAmount).toFixed(0)} added</span>
          </div>
        </div>
      ) : status === "REJECTED" ? (
        <div className="rounded-xl px-4 py-3 text-center" style={{ background: "rgba(232,99,58,0.1)", border: "1px solid rgba(232,99,58,0.25)" }}>
          <span className="text-sm font-bold" style={{ color: "#E8633A" }}>Submission rejected</span>
        </div>
      ) : status === "PENDING" ? (
        <div className="flex items-center gap-2 text-sm px-4 py-2.5 rounded-lg" style={{ background: "rgba(244,200,66,0.1)", color: "#F4C842" }}>
          <Clock size={15} /> Pending admin review
        </div>
      ) : (
        <button
          onClick={onComplete}
          disabled={submitting}
          className="inline-flex items-center justify-center gap-2 text-sm font-bold px-4 py-2.5 rounded-lg disabled:opacity-50"
          style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
        >
          {submitting ? (
            <><span className="animate-spin inline-block">⟳</span> Submitting…</>
          ) : (
            <><Upload size={15} /> Submit Proof</>
          )}
        </button>
      )}
    </div>
  );
}
