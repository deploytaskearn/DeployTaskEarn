"use client";

import { useEffect, useState, useCallback } from "react";
import api from "@/lib/api";
import { Task } from "@/lib/types";
import { CheckCircle2, ExternalLink, Trophy, Zap } from "lucide-react";

const CARD = { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" };

interface CompletionResult {
  rewardAmount: number;
  coinsEarned: number;
  bonusSpinsEarned: number;
}

export function TasksTab({ onRewardEarned }: { onRewardEarned?: () => void }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  // per-task state: submitting | done+result
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({});
  const [done, setDone] = useState<Record<string, CompletionResult>>({});

  const load = useCallback(() => {
    setLoading(true);
    api.get("/tasks").then((r) => setTasks(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  async function completeTask(task: Task) {
    if (submitting[task.id] || done[task.id] || task.alreadySubmitted) return;
    setSubmitting(s => ({ ...s, [task.id]: true }));
    try {
      const r = await api.post<CompletionResult>(`/tasks/${task.id}/submit`, {});
      setDone(d => ({ ...d, [task.id]: r.data }));
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, alreadySubmitted: true } : t));
      onRewardEarned?.();
    } catch {
      // already submitted or other error — reload to sync state
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
                result={done[t.id] ?? null}
                onComplete={() => completeTask(t)}
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
                result={done[t.id] ?? null}
                onComplete={() => completeTask(t)}
              />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

function TaskCard({
  task, submitting, result, onComplete,
}: {
  task: Task;
  submitting: boolean;
  result: CompletionResult | null;
  onComplete: () => void;
}) {
  const isDone = task.alreadySubmitted || !!result;

  return (
    <div className="p-5 rounded-xl flex flex-col gap-3" style={{
      ...CARD,
      border: result ? "1px solid rgba(0,200,117,0.3)" : CARD.border,
      background: result ? "rgba(0,200,117,0.04)" : CARD.background,
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

      {task.categoryName && (
        <span className="text-xs uppercase tracking-wide" style={{ color: "rgba(245,242,234,0.4)" }}>{task.categoryName}</span>
      )}

      <p className="text-sm leading-relaxed flex-1" style={{ color: "rgba(245,242,234,0.6)" }}>{task.description}</p>

      {/* External link if present */}
      {task.externalUrl && !isDone && (
        <a href={task.externalUrl.startsWith("http") ? task.externalUrl : `https://${task.externalUrl}`}
          target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 text-sm font-medium px-4 py-2.5 rounded-lg"
          style={{ background: "rgba(0,200,117,0.1)", color: "#00C875", border: "1px solid rgba(0,200,117,0.2)" }}>
          Open Task Link <ExternalLink size={14} />
        </a>
      )}

      {/* CTA / result */}
      {result ? (
        <div className="rounded-xl px-4 py-3 text-center" style={{ background: "rgba(0,200,117,0.1)", border: "1px solid rgba(0,200,117,0.25)" }}>
          <div className="flex items-center justify-center gap-2 mb-1">
            <CheckCircle2 size={16} color="#00C875" />
            <span className="text-sm font-bold" style={{ color: "#00C875" }}>Task Completed!</span>
          </div>
          <div className="flex items-center justify-center gap-4 text-xs" style={{ color: "rgba(245,242,234,0.7)" }}>
            <span>💰 Rs{result.rewardAmount.toFixed(0)} added</span>
            <span>🪙 {result.coinsEarned} coins</span>
            {result.bonusSpinsEarned > 0 && <span>🎡 +{result.bonusSpinsEarned} spins!</span>}
          </div>
        </div>
      ) : isDone ? (
        <div className="flex items-center gap-2 text-sm px-4 py-2.5 rounded-lg" style={{ background: "rgba(0,200,117,0.06)", color: "#00C875" }}>
          <CheckCircle2 size={15} /> Already completed
        </div>
      ) : (
        <button
          onClick={onComplete}
          disabled={submitting}
          className="inline-flex items-center justify-center gap-2 text-sm font-bold px-4 py-2.5 rounded-lg disabled:opacity-50"
          style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
        >
          {submitting ? (
            <><span className="animate-spin inline-block">⟳</span> Processing…</>
          ) : (
            <><Zap size={15} /> Complete Task</>
          )}
        </button>
      )}
    </div>
  );
}
