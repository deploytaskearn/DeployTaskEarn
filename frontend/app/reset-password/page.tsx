"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import api from "@/lib/api";
import { AlertCircle, CheckCircle2 } from "lucide-react";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, password });
      setDone(true);
      setTimeout(() => router.push("/login"), 2500);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Something went wrong. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="flex items-start gap-2 text-sm p-4 rounded-sm" style={{ background: "rgba(232,99,58,0.12)", color: "var(--color-alert)" }}>
        <AlertCircle size={16} className="mt-0.5 shrink-0" />
        <span>This reset link is missing its token. Please request a new one from the <Link href="/forgot-password" style={{ color: "var(--color-accent)" }}>forgot password</Link> page.</span>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex items-start gap-2 text-sm p-4 rounded-sm" style={{ background: "rgba(0,200,117,0.1)", color: "var(--color-accent)" }}>
        <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
        <span>Password updated! Redirecting you to log in…</span>
      </div>
    );
  }

  return (
    <>
      {error && (
        <div className="flex items-start gap-2 text-sm mb-5 p-3 rounded-sm" style={{ background: "rgba(232,99,58,0.12)", color: "var(--color-alert)" }}>
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-wide" style={{ color: "rgba(245,242,234,0.55)" }}>New password</span>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="px-4 py-3 rounded-sm text-sm outline-none"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "var(--color-surface)" }}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-wide" style={{ color: "rgba(245,242,234,0.55)" }}>Confirm new password</span>
          <input
            type="password"
            required
            minLength={6}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="px-4 py-3 rounded-sm text-sm outline-none"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "var(--color-surface)" }}
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="mt-2 px-5 py-3.5 rounded-sm font-medium text-sm disabled:opacity-60"
          style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
        >
          {loading ? "Updating…" : "Update password"}
        </button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <PageShell>
      <section className="py-20 md:py-28">
        <div className="max-w-sm mx-auto px-5">
          <h1 className="font-display text-3xl md:text-4xl mb-2" style={{ color: "var(--color-surface)" }}>
            Set a new password
          </h1>
          <p className="text-sm mb-8" style={{ color: "rgba(245,242,234,0.6)" }}>
            Choose a new password for your account.
          </p>
          <Suspense>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </section>
    </PageShell>
  );
}
