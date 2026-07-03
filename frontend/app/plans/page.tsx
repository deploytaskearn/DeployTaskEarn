"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Star, ArrowRight, Users } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { Plan } from "@/lib/types";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/ToastProvider";

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const { user } = useAuth();
  const toast = useToast();

  useEffect(() => {
    api.get("/plans").then((r) => setPlans(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function handlePurchase(planId: string) {
    if (!user) return;
    setPurchasing(planId);
    setMessage(null);
    try {
      await api.post("/plans/purchase", { planId });
      setMessage({ type: "ok", text: "Plan activated! Check your dashboard." });
      toast("🎉 Plan activated! Your tasks are now unlocked.", "success");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Purchase failed";
      setMessage({ type: "err", text: msg });
    } finally {
      setPurchasing(null);
    }
  }

  return (
    <PageShell>
      <section className="relative overflow-hidden py-24" style={{ background: "var(--color-bg)" }}>
        <div className="orb w-96 h-96 -top-20 -right-0 opacity-10" style={{ background: "var(--color-accent)" }} />
        <div className="relative max-w-6xl mx-auto px-5">
          <div className="text-center mb-16">
            <div className="text-xs tracking-widest uppercase mb-3 font-medium" style={{ color: "var(--color-gold)" }}>Earning Plans</div>
            <h1 className="font-display text-4xl md:text-6xl mb-5" style={{ color: "var(--color-surface)" }}>
              Invest smart, <span className="gradient-text">earn more.</span>
            </h1>
            <p className="text-base max-w-lg mx-auto" style={{ color: "rgba(245,242,234,0.55)" }}>
              Choose a plan that fits your goals. All plans include task access plus referral bonuses — refer a friend and earn 5% of their plan price instantly.
            </p>
          </div>

          {/* Referral callout */}
          <div className="rounded-2xl p-5 mb-12 flex flex-wrap items-center gap-4 justify-between" style={{ background: "rgba(244,200,66,0.07)", border: "1px solid rgba(244,200,66,0.18)" }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(244,200,66,0.15)" }}>
                <Users size={18} style={{ color: "var(--color-gold)" }} />
              </div>
              <div>
                <div className="text-sm font-semibold" style={{ color: "var(--color-gold)" }}>Referral Bonus — 5% per plan</div>
                <div className="text-xs" style={{ color: "rgba(245,242,234,0.55)" }}>Share your link. When your friend buys any plan, you earn 5% instantly in your wallet.</div>
              </div>
            </div>
            {user ? (
              <Link href="/dashboard" className="text-xs font-semibold px-4 py-2 rounded-lg" style={{ background: "var(--color-gold)", color: "#000" }}>
                My referral link
              </Link>
            ) : (
              <Link href="/register" className="text-xs font-semibold px-4 py-2 rounded-lg" style={{ background: "var(--color-gold)", color: "#000" }}>
                Register to refer
              </Link>
            )}
          </div>

          {message && (
            <div className="mb-8 p-4 rounded-xl text-sm text-center" style={{ background: message.type === "ok" ? "rgba(0,200,117,0.1)" : "rgba(232,99,58,0.1)", color: message.type === "ok" ? "var(--color-accent)" : "var(--color-alert)", border: `1px solid ${message.type === "ok" ? "rgba(0,200,117,0.2)" : "rgba(232,99,58,0.2)"}` }}>
              {message.text}
            </div>
          )}

          {loading ? (
            <div className="text-center py-20 text-sm" style={{ color: "rgba(245,242,234,0.4)" }}>Loading plans…</div>
          ) : plans.length === 0 ? (
            <div className="text-center py-20 text-sm" style={{ color: "rgba(245,242,234,0.4)" }}>No plans available yet. Check back soon.</div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className="rounded-2xl p-7 premium-card relative overflow-hidden flex flex-col"
                  style={{ background: "rgba(255,255,255,0.03)", border: plan.isPopular ? "1px solid var(--color-accent)" : "1px solid var(--color-hairline)" }}
                >
                  {plan.isPopular && (
                    <div className="shine-badge absolute top-4 right-4 overflow-hidden inline-flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full" style={{ background: "var(--color-accent)", color: "#000" }}>
                      <Star size={11} fill="currentColor" /> Most Popular
                    </div>
                  )}
                  <div className="text-xs uppercase tracking-wider font-medium mb-2" style={{ color: "var(--color-muted)" }}>{plan.durationDays} days plan</div>
                  <h3 className="font-display text-2xl mb-1" style={{ color: "var(--color-surface)" }}>{plan.name}</h3>
                  {plan.description && <p className="text-xs mb-4" style={{ color: "rgba(245,242,234,0.45)" }}>{plan.description}</p>}
                  <div className="font-mono-tabular text-4xl font-bold mb-1 gradient-text">₨{parseFloat(plan.price).toLocaleString()}</div>
                  {plan.maxEarnings && (
                    <div className="text-xs mb-5 font-medium" style={{ color: "var(--color-gold)" }}>
                      Max earnings: ₨{parseFloat(plan.maxEarnings).toLocaleString()}
                    </div>
                  )}
                  <ul className="flex flex-col gap-3 mb-8 flex-1">
                    {(plan.features || []).map((f, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm" style={{ color: "rgba(245,242,234,0.75)" }}>
                        <CheckCircle2 size={15} style={{ color: "var(--color-accent)" }} className="mt-0.5 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  {user ? (
                    <button
                      onClick={() => handlePurchase(plan.id)}
                      disabled={purchasing === plan.id}
                      className="w-full py-3.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50"
                      style={{ background: plan.isPopular ? "var(--color-accent)" : "rgba(255,255,255,0.08)", color: plan.isPopular ? "#000" : "var(--color-surface)" }}
                    >
                      {purchasing === plan.id ? "Activating…" : "Activate plan"}
                    </button>
                  ) : (
                    <Link
                      href="/register"
                      className="w-full py-3.5 rounded-xl text-sm font-semibold text-center block transition-all hover:opacity-90"
                      style={{ background: plan.isPopular ? "var(--color-accent)" : "rgba(255,255,255,0.08)", color: plan.isPopular ? "#000" : "var(--color-surface)" }}
                    >
                      Get started <ArrowRight size={14} className="inline ml-1" />
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </PageShell>
  );
}
