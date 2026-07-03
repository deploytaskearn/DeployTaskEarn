"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "info";
interface Toast { id: number; type: ToastType; message: string; }

interface ToastContextValue { toast: (message: string, type?: ToastType) => void; }
const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  let counter = 0;

  const toast = useCallback((message: string, type: ToastType = "success") => {
    const id = ++counter + Date.now();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const ICONS = { success: CheckCircle2, error: AlertCircle, info: Info };
  const COLORS = {
    success: { bg: "rgba(0,200,117,0.12)", border: "rgba(0,200,117,0.25)", icon: "var(--color-accent)" },
    error: { bg: "rgba(232,99,58,0.12)", border: "rgba(232,99,58,0.25)", icon: "var(--color-alert)" },
    info: { bg: "rgba(255,255,255,0.07)", border: "rgba(255,255,255,0.15)", icon: "rgba(245,242,234,0.6)" },
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed top-4 left-4 z-[9999] flex flex-col gap-2 pointer-events-none" style={{ maxWidth: 360, width: "calc(100vw - 32px)" }}>
        {toasts.map((t) => {
          const Icon = ICONS[t.type];
          const c = COLORS[t.type];
          return (
            <div key={t.id} className="flex items-start gap-3 px-5 py-4 rounded-2xl pointer-events-auto shadow-2xl"
              style={{ background: c.bg, border: `1px solid ${c.border}`, backdropFilter: "blur(16px)", animation: "fadeUp 0.3s ease" }}>
              <Icon size={18} style={{ color: c.icon, marginTop: 1, flexShrink: 0 }} />
              <span className="text-sm font-medium flex-1 leading-snug" style={{ color: "var(--color-surface)" }}>{t.message}</span>
              <button onClick={() => setToasts((p) => p.filter((x) => x.id !== t.id))} style={{ color: "rgba(245,242,234,0.4)", flexShrink: 0 }}>
                <X size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx.toast;
}
