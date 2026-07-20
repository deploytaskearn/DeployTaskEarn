"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { useAuth } from "@/lib/auth-context";
import api from "@/lib/api";
import { AlertCircle, CheckCircle2 } from "lucide-react";

export default function VerifyEmailPage() {
  const { user, loading } = useRequireAuth();
  const { refreshUser } = useAuth();
  const router = useRouter();

  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [resendMsg, setResendMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (user?.emailVerifiedAt) {
      router.replace("/dashboard");
    }
  }, [user, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (otp.length !== 6) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/auth/verify-email", { otp });
      setDone(true);
      await refreshUser();
      setTimeout(() => router.push("/dashboard"), 1200);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Verification failed. Please try again.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    setResendMsg("");
    setError("");
    setResending(true);
    try {
      const r = await api.post("/auth/resend-verification");
      setResendMsg(r.data.message || "A new code has been sent.");
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to resend code.";
      setError(message);
    } finally {
      setResending(false);
    }
  }

  if (loading || !user) {
    return (
      <PageShell>
        <section className="py-20 md:py-28">
          <div className="max-w-sm mx-auto px-5 text-sm" style={{ color: "rgba(245,242,234,0.5)" }}>Loading…</div>
        </section>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <section className="py-20 md:py-28">
        <div className="max-w-sm mx-auto px-5">
          <h1 className="font-display text-3xl md:text-4xl mb-2" style={{ color: "var(--color-surface)" }}>
            Verify your email
          </h1>
          <p className="text-sm mb-8" style={{ color: "rgba(245,242,234,0.6)" }}>
            We sent a 6-digit code to <span style={{ color: "var(--color-surface)" }}>{user.email}</span>. Enter it below to verify your account.
          </p>

          {error && (
            <div className="flex items-start gap-2 text-sm mb-5 p-3 rounded-sm" style={{ background: "rgba(232,99,58,0.12)", color: "var(--color-alert)" }}>
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {done ? (
            <div className="flex items-start gap-2 text-sm p-4 rounded-sm" style={{ background: "rgba(0,200,117,0.1)", color: "var(--color-accent)" }}>
              <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
              <span>Email verified! Taking you to your dashboard…</span>
            </div>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs uppercase tracking-wide" style={{ color: "rgba(245,242,234,0.55)" }}>6-digit code</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoFocus
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="px-4 py-3 rounded-sm text-center outline-none"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "var(--color-surface)", fontSize: 28, letterSpacing: 10, fontFamily: "var(--font-mono, monospace)" }}
                  />
                </label>

                <button
                  type="submit"
                  disabled={submitting || otp.length !== 6}
                  className="mt-2 px-5 py-3.5 rounded-sm font-medium text-sm disabled:opacity-60"
                  style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
                >
                  {submitting ? "Verifying…" : "Verify email"}
                </button>
              </form>

              {resendMsg && (
                <div className="text-sm mt-4" style={{ color: "var(--color-accent)" }}>{resendMsg}</div>
              )}

              <div className="flex items-center justify-between mt-6 text-xs">
                <button onClick={handleResend} disabled={resending} className="disabled:opacity-60" style={{ color: "var(--color-accent)" }}>
                  {resending ? "Sending…" : "Resend code"}
                </button>
                <Link href="/dashboard" style={{ color: "rgba(245,242,234,0.4)" }}>Skip for now →</Link>
              </div>
            </>
          )}
        </div>
      </section>
    </PageShell>
  );
}
