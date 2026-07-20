"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import api from "@/lib/api";
import { AlertCircle } from "lucide-react";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState("");

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setStep("otp");
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Something went wrong. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (otp.length !== 6) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/verify-reset-otp", { email, otp });
      router.push(`/reset-password?email=${encodeURIComponent(email)}&otp=${otp}`);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Invalid or expired code.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResendMsg("");
    setError("");
    setResending(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setResendMsg("A new code has been sent.");
    } catch {
      setError("Failed to resend code.");
    } finally {
      setResending(false);
    }
  }

  return (
    <PageShell>
      <section className="py-20 md:py-28">
        <div className="max-w-sm mx-auto px-5">
          <h1 className="font-display text-3xl md:text-4xl mb-2" style={{ color: "var(--color-surface)" }}>
            Forgot password?
          </h1>
          <p className="text-sm mb-8" style={{ color: "rgba(245,242,234,0.6)" }}>
            {step === "email"
              ? "Enter your email and we'll send you a 6-digit code to reset it."
              : <>We sent a code to <span style={{ color: "var(--color-surface)" }}>{email}</span>. Enter it below.</>}
          </p>

          {error && (
            <div className="flex items-start gap-2 text-sm mb-5 p-3 rounded-sm" style={{ background: "rgba(232,99,58,0.12)", color: "var(--color-alert)" }}>
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {step === "email" ? (
            <form onSubmit={handleSendCode} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs uppercase tracking-wide" style={{ color: "rgba(245,242,234,0.55)" }}>Email</span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                {loading ? "Sending…" : "Send code"}
              </button>
            </form>
          ) : (
            <>
              <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4">
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
                  disabled={loading || otp.length !== 6}
                  className="mt-2 px-5 py-3.5 rounded-sm font-medium text-sm disabled:opacity-60"
                  style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
                >
                  {loading ? "Verifying…" : "Continue"}
                </button>
              </form>

              {resendMsg && (
                <div className="text-sm mt-4" style={{ color: "var(--color-accent)" }}>{resendMsg}</div>
              )}

              <div className="flex items-center justify-between mt-6 text-xs">
                <button onClick={handleResend} disabled={resending} className="disabled:opacity-60" style={{ color: "var(--color-accent)" }}>
                  {resending ? "Sending…" : "Resend code"}
                </button>
                <button onClick={() => { setStep("email"); setOtp(""); setError(""); }} style={{ color: "rgba(245,242,234,0.4)" }}>
                  Use a different email
                </button>
              </div>
            </>
          )}

          <p className="text-sm mt-6" style={{ color: "rgba(245,242,234,0.55)" }}>
            <Link href="/login" style={{ color: "var(--color-accent)" }}>
              Back to log in
            </Link>
          </p>
        </div>
      </section>
    </PageShell>
  );
}
