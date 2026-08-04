"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import axios from "axios";
import api from "@/lib/api";
import { Task } from "@/lib/types";
import { CheckCircle2, ExternalLink, Trophy, Upload, X as XIcon, ImageIcon, Download, Clock, AlertCircle } from "lucide-react";

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

// Phone-camera screenshots are often 3-8MB, which is slow (and prone to
// failing) to upload over weak mobile connections. Downscale + re-encode to
// JPEG client-side before it ever hits the network, so the first upload
// attempt is small and fast instead of relying on the user to retry with
// the same oversized file.
//
// Guarded with a hard timeout: some older/in-app-browser WebViews either
// lack createImageBitmap or have it hang indefinitely on certain image
// formats, which would otherwise freeze the "preparing image" step forever.
// If it doesn't finish in time, fall back to uploading the original file.
async function compressImage(file: File, maxDim = 1280, quality = 0.7): Promise<File> {
  if (!file.type.startsWith("image/") || file.size < 350 * 1024 || typeof createImageBitmap !== "function") {
    return file;
  }

  const doCompress = async (): Promise<File> => {
    const bitmap = await createImageBitmap(file);
    let { width, height } = bitmap;
    if (width > maxDim || height > maxDim) {
      const scale = maxDim / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  };

  try {
    return await Promise.race([
      doCompress(),
      new Promise<File>((resolve) => setTimeout(() => resolve(file), 6000)),
    ]);
  } catch {
    return file; // any failure (e.g. unsupported format) → fall back to the original
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

  // Picking a file just shows the preview instantly — compression happens
  // later, only once the user actually taps Submit, so browsing/choosing a
  // screenshot never itself shows a loading state.
  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
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
  const [submitError, setSubmitError] = useState<Record<string, string>>({});
  const [uploadPct, setUploadPct] = useState<Record<string, number>>({});

  // Which task is waiting for proof
  const [proofTask, setProofTask] = useState<Task | null>(null);

  // isInitial only shows the full-page "Loading tasks…" state on first mount —
  // the 30s background refresh used to also flip this on, which blanked out
  // the whole list and re-showed the loading screen every 30 seconds while
  // someone was actively browsing/submitting tasks.
  const load = useCallback((isInitial = false) => {
    if (isInitial) setLoading(true);
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
      .finally(() => { if (isInitial) setLoading(false); });
  }, [onRewardEarned]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetching tasks on mount is the correct, standard pattern here
    load(true);
    const t = setInterval(() => load(false), 30000);
    return () => clearInterval(t);
  }, [load]);

  async function handleProofSubmit(task: Task, proofText: string, proofFile: File | null) {
    setProofTask(null);
    setSubmitting(s => ({ ...s, [task.id]: true }));
    setSubmitError(s => ({ ...s, [task.id]: "" }));

    // Compress here (after Submit is tapped, not while picking/previewing the
    // file) so choosing a screenshot always feels instant.
    const compressedFile = proofFile ? await compressImage(proofFile) : null;

    const form = new FormData();
    if (compressedFile) form.append("proofFile", compressedFile);
    if (proofText.trim()) form.append("proofText", proofText.trim());

    try {
      const res = await api.post(`/tasks/${task.id}/submit`, form, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 45000,
        onUploadProgress: (evt) => {
          if (evt.total) setUploadPct(s => ({ ...s, [task.id]: Math.round((evt.loaded / evt.total!) * 100) }));
        },
      });
      const status = res.data.pending ? "PENDING" : "APPROVED";
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, alreadySubmitted: true, submissionStatus: status } : t));
      if (status === "APPROVED") onRewardEarned?.();
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? err.code === "ECONNABORTED"
          ? "Upload timed out. Check your connection and try again."
          : err.response?.data?.error || "Submission failed. Please try again."
        : "Submission failed. Please try again.";
      setSubmitError(s => ({ ...s, [task.id]: message }));
      load(false);
    } finally {
      setSubmitting(s => ({ ...s, [task.id]: false }));
      setUploadPct(s => ({ ...s, [task.id]: 0 }));
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
                uploadPct={uploadPct[t.id] || 0}
                error={submitError[t.id]}
                onComplete={() => { setSubmitError(s => ({ ...s, [t.id]: "" })); setProofTask(t); }}
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
                uploadPct={uploadPct[t.id] || 0}
                error={submitError[t.id]}
                onComplete={() => { setSubmitError(s => ({ ...s, [t.id]: "" })); setProofTask(t); }}
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
  task, submitting, uploadPct, error, onComplete,
}: {
  task: Task;
  submitting: boolean;
  uploadPct?: number;
  error?: string;
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
          {!task.isFreeTask && (
            <p className="text-xs mt-1" style={{ color: "rgba(0,200,117,0.7)" }}>New task unlocks at 12:00 AM</p>
          )}
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
        <>
          {error && (
            <div className="flex items-center gap-2 text-xs px-3 py-2.5 rounded-lg" style={{ background: "rgba(232,99,58,0.1)", color: "#E8633A" }}>
              <AlertCircle size={14} className="shrink-0" /> {error}
            </div>
          )}
          <button
            onClick={onComplete}
            disabled={submitting}
            className="inline-flex items-center justify-center gap-2 text-sm font-bold px-4 py-2.5 rounded-lg disabled:opacity-50"
            style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
          >
            {submitting ? (
              <><span className="animate-spin inline-block">⟳</span> {uploadPct && uploadPct > 0 && uploadPct < 100 ? `Uploading… ${uploadPct}%` : "Submitting…"}</>
            ) : (
              <><Upload size={15} /> Submit Proof</>
            )}
          </button>
        </>
      )}
    </div>
  );
}
