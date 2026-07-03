"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Star, ArrowRight, Users, Calculator, Flame, Lock } from "lucide-react";
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
      setMessage({ type: "ok", text: "Plan activated! Your tasks are now unlocked." });
      toast("🎉 Plan activated! Your tasks are now unlocked.", "success");
      api.get("/plans").then((r) => setPlans(r.data)).catch(() => {});
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Purchase failed";
      setMessage({ type: "err", text: msg });
    } finally {
      setPurchasing(null);
    }
  }

  return (
    <PageShell>
      <section className="relative overflow-hidden py-16 md:py-24" style={{ background: "var(--color-bg)" }}>
        <div className="orb w-96 h-96 -top-20 -right-0 opacity-10" style={{ background: "var(--color-accent)" }} />
        <div className="relative max-w-5xl mx-auto px-4">

          {/* Header */}
          <div className="text-center mb-12">
            <div className="text-xs tracking-widest uppercase mb-3 font-medium" style={{ color: "var(--color-gold)" }}>Earning Plans</div>
            <h1 className="font-display text-3xl md:text-5xl mb-4" style={{ color: "var(--color-surface)" }}>
              Invest smart, <span className="gradient-text">earn daily.</span>
            </h1>
            <p className="text-sm max-w-md mx-auto" style={{ color: "rgba(245,242,234,0.55)" }}>
              Choose a plan, complete tasks every day, and earn real money. Refer friends to earn 5% bonus on every plan they buy.
            </p>
          </div>

          {/* Referral callout */}
          <div className="rounded-2xl p-4 mb-10 flex flex-wrap items-center gap-3 justify-between" style={{ background: "rgba(244,200,66,0.07)", border: "1px solid rgba(244,200,66,0.18)" }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(244,200,66,0.15)" }}>
                <Users size={16} style={{ color: "var(--color-gold)" }} />
              </div>
              <div>
                <div className="text-sm font-semibold" style={{ color: "var(--color-gold)" }}>Referral Bonus — 5% per plan</div>
                <div className="text-xs" style={{ color: "rgba(245,242,234,0.55)" }}>Share your link → friend buys plan → you earn 5% instantly.</div>
              </div>
            </div>
            {user ? (
              <Link href="/dashboard" className="text-xs font-semibold px-4 py-2 rounded-lg shrink-0" style={{ background: "var(--color-gold)", color: "#000" }}>
                My referral link
              </Link>
            ) : (
              <Link href="/register" className="text-xs font-semibold px-4 py-2 rounded-lg shrink-0" style={{ background: "var(--color-gold)", color: "#000" }}>
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
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {plans.map((plan) => {
                const price = parseFloat(plan.price as unknown as string);
                const daily = plan.dailyEarning ? parseFloat(plan.dailyEarning as unknown as string) : null;
                const maxE = plan.maxEarnings ? parseFloat(plan.maxEarnings as unknown as string) : null;
                const maxU = plan.maxUsers ?? null;
                const curU = plan.currentUsers ?? 0;
                const spotsLeft = maxU ? maxU - curU : null;
                const isSoldOut = maxU ? curU >= maxU : false;

                return (
                  <div
                    key={plan.id}
                    className="rounded-2xl p-6 premium-card relative overflow-hidden flex flex-col"
                    style={{ background: "rgba(255,255,255,0.03)", border: plan.isPopular ? "1px solid var(--color-accent)" : "1px solid var(--color-hairline)" }}
                  >
                    {/* Popular badge */}
                    {plan.isPopular && (
                      <div className="shine-badge absolute top-4 right-4 overflow-hidden inline-flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full" style={{ background: "var(--color-accent)", color: "#000" }}>
                        <Star size={10} fill="currentColor" /> Most Popular
                      </div>
                    )}

                    {/* Limited offer badge */}
                    {maxU && !isSoldOut && spotsLeft !== null && spotsLeft <= maxU * 0.3 && (
                      <div className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full mb-3 w-fit" style={{ background: "rgba(232,99,58,0.15)", color: "var(--color-alert)", border: "1px solid rgba(232,99,58,0.2)" }}>
                        <Flame size={11} /> Limited — only {spotsLeft} spots left!
                      </div>
                    )}
                    {maxU && !isSoldOut && spotsLeft !== null && spotsLeft > maxU * 0.3 && (
                      <div className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full mb-3 w-fit" style={{ background: "rgba(244,200,66,0.1)", color: "var(--color-gold)" }}>
                        <Users size={11} /> {spotsLeft} of {maxU} spots left
                      </div>
                    )}

                    <div className="text-xs uppercase tracking-wider font-medium mb-1.5" style={{ color: "var(--color-muted)" }}>{plan.durationDays} days plan</div>
                    <h3 className="font-display text-2xl mb-3" style={{ color: "var(--color-surface)" }}>{plan.name}</h3>
                    {plan.description && <p className="text-xs mb-3" style={{ color: "rgba(245,242,234,0.45)" }}>{plan.description}</p>}

                    {/* Price */}
                    <div className="font-mono-tabular text-3xl font-bold mb-1 gradient-text">₨{price.toLocaleString()}</div>

                    {/* Per-day calculator */}
                    {daily && (
                      <div className="flex items-center gap-2 mt-2 mb-3 px-3 py-2.5 rounded-xl" style={{ background: "rgba(0,200,117,0.08)", border: "1px solid rgba(0,200,117,0.15)" }}>
                        <Calculator size={14} style={{ color: "var(--color-accent)" }} />
                        <div>
                          <div className="text-sm font-bold" style={{ color: "var(--color-accent)" }}>₨{daily.toLocaleString()} / day</div>
                          <div className="text-xs" style={{ color: "rgba(245,242,234,0.5)" }}>
                            Total in {plan.durationDays} days: ₨{(daily * plan.durationDays).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    )}

                    {maxE && (
                      <div className="text-xs mb-4 font-medium" style={{ color: "var(--color-gold)" }}>
                        Max earnings: ₨{maxE.toLocaleString()}
                      </div>
                    )}

                    {/* Features */}
                    <ul className="flex flex-col gap-2.5 mb-6 flex-1">
                      {(plan.features || []).map((f, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm" style={{ color: "rgba(245,242,234,0.75)" }}>
                          <CheckCircle2 size={14} style={{ color: "var(--color-accent)" }} className="mt-0.5 shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>

                    {/* CTA */}
                    {isSoldOut ? (
                      <div className="w-full py-3.5 rounded-xl text-sm font-semibold text-center flex items-center justify-center gap-2" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(245,242,234,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}>
                        <Lock size={14} /> Sold out
                      </div>
                    ) : user ? (
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
                );
              })}
            </div>
          )}
        </div>
      </section>
    </PageShell>
  );
}
