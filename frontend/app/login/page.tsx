"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { useAuth } from "@/lib/auth-context";
import { useSiteSettings } from "@/lib/site-settings-context";
import { AlertCircle, ShieldCheck } from "lucide-react";

export default function LoginPage() {
  const { login, logout } = useAuth();
  const { fbr_certificate_url } = useSiteSettings();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await login(email, password);
      if (user.role === "ADMIN") {
        logout();
        setError("Invalid credentials. Please check your email and password.");
        return;
      }
      router.push("/dashboard");
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Login failed. Check your details and try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageShell>
      <section className="py-20 md:py-28">
        <div className="max-w-sm mx-auto px-5">
          <h1 className="font-display text-3xl md:text-4xl mb-2" style={{ color: "var(--color-surface)" }}>
            Welcome back
          </h1>
          <p className="text-sm mb-8" style={{ color: "rgba(245,242,234,0.6)" }}>
            Log in to view your tasks and wallet.
          </p>

          {error && (
            <div
              className="flex items-start gap-2 text-sm mb-5 p-3 rounded-sm"
              style={{ background: "rgba(232,99,58,0.12)", color: "var(--color-alert)" }}
            >
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
            <label className="flex flex-col gap-1.5">
              <span className="text-xs uppercase tracking-wide" style={{ color: "rgba(245,242,234,0.55)" }}>Password</span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
              {loading ? "Logging in…" : "Log in"}
            </button>
          </form>

          <p className="text-sm mt-6" style={{ color: "rgba(245,242,234,0.55)" }}>
            New here?{" "}
            <Link href="/register" style={{ color: "var(--color-accent)" }}>
              Create an account
            </Link>
          </p>

          {fbr_certificate_url && (
            <a href={fbr_certificate_url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 mt-8 p-3 rounded-2xl transition-colors hover:opacity-90"
              style={{ background: "rgba(0,200,117,0.05)", border: "1px solid rgba(0,200,117,0.15)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={fbr_certificate_url} alt="FBR registration certificate"
                className="rounded-xl object-cover shrink-0" style={{ width: 44, height: 44, border: "1px solid rgba(255,255,255,0.12)" }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck size={13} style={{ color: "var(--color-accent)" }} />
                  <span className="text-xs font-semibold" style={{ color: "var(--color-surface)" }}>FBR Registered</span>
                </div>
                <div className="text-xs mt-0.5" style={{ color: "rgba(245,242,234,0.4)" }}>Tap to view certificate</div>
              </div>
            </a>
          )}
        </div>
      </section>
    </PageShell>
  );
}
