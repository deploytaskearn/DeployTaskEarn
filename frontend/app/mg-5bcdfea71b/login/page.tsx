"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/lib/admin-auth-context";
import { Shield } from "lucide-react";

export default function AdminLoginPage() {
  const { login, admin, loading } = useAdminAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && admin) {
      router.replace("/mg-5bcdfea71b");
    }
  }, [admin, loading, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email, password);
      router.replace("/mg-5bcdfea71b");
    } catch {
      setError("Invalid credentials.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--color-bg)" }}>
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8 gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: "var(--color-accent-glow)", border: "1px solid rgba(0,200,117,0.3)" }}>
            <Shield size={22} style={{ color: "var(--color-accent)" }} />
          </div>
          <h1 className="font-display text-2xl" style={{ color: "var(--color-surface)" }}>Admin Access</h1>
          <p className="text-sm text-center" style={{ color: "rgba(245,242,234,0.45)" }}>Restricted area. Authorized personnel only.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="email"
            placeholder="Admin email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-xl text-sm"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(245,242,234,0.12)", color: "var(--color-surface)", outline: "none" }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-xl text-sm"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(245,242,234,0.12)", color: "var(--color-surface)", outline: "none" }}
          />
          {error && (
            <p className="text-sm text-center" style={{ color: "var(--color-alert)" }}>{error}</p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-xl text-sm font-semibold transition-opacity"
            style={{ background: "var(--color-accent)", color: "#000", opacity: submitting ? 0.6 : 1 }}
          >
            {submitting ? "Verifying…" : "Access Panel"}
          </button>
        </form>
      </div>
    </div>
  );
}
