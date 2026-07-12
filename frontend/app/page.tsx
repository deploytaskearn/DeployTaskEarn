"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, Smartphone, Wallet, ClipboardCheck, Star, Users, Zap, Shield } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { Plan } from "@/lib/types";
import api from "@/lib/api";

export default function HomePage() {
  const [plans, setPlans] = useState<Plan[]>([]);

  useEffect(() => {
    api.get("/plans").then((r) => setPlans(r.data.slice(0, 3))).catch(() => {});
  }, []);

  return (
    <PageShell>
      {/* ── Hero ── */}
      <section className="relative overflow-hidden animated-bg">
        {/* Orbs */}
        <div className="orb w-96 h-96 -top-20 -left-20 opacity-20" style={{ background: "var(--color-accent)" }} />
        <div className="orb w-72 h-72 top-40 right-0 opacity-10" style={{ background: "var(--color-gold)" }} />

        <div className="relative max-w-6xl mx-auto px-5 pt-24 pb-20 md:pt-36 md:pb-28">
          <div className="max-w-3xl">
            <div
              className="inline-flex items-center gap-2 text-xs tracking-widest uppercase mb-6 px-4 py-2 rounded-full font-medium"
              style={{ background: "var(--color-accent-glow)", color: "var(--color-accent)", border: "1px solid rgba(0,200,117,0.2)" }}
            >
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--color-accent)" }} />
              Pakistan's #1 Task Earning Platform
            </div>

            <h1 className="font-display text-5xl md:text-7xl leading-[1.05] mb-6" style={{ color: "var(--color-surface)" }}>
              Complete tasks.
              <br />
              <span className="gradient-text">Earn real money.</span>
            </h1>

            <p className="text-lg md:text-xl leading-relaxed max-w-xl mb-10" style={{ color: "rgba(245,242,234,0.65)" }}>
              Surveys, app installs, and partner offers from real advertisers —
              paid straight into your EasyPaisa, JazzCash, or bank account.
            </p>

            <div className="flex flex-wrap items-center gap-4">
              <Link href="/register" className="btn-glow inline-flex items-center gap-2 px-7 py-4 rounded-xl font-semibold text-sm" style={{ background: "var(--color-accent)", color: "#000" }}>
                Start earning free <ArrowRight size={18} />
              </Link>
              <Link href="/plans" className="inline-flex items-center gap-2 px-7 py-4 rounded-xl text-sm font-medium glass-card">
                View earning plans
              </Link>
            </div>
          </div>
        </div>

        {/* Stats strip */}
        <div className="relative max-w-6xl mx-auto px-5 pb-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Avg. task payout", value: "₨35–150" },
              { label: "Withdrawal methods", value: "3" },
              { label: "Review time", value: "24h" },
              { label: "Min. withdrawal", value: "₨500" },
            ].map((s) => (
              <div key={s.label} className="glass-card rounded-xl p-5 text-center premium-card">
                <div className="font-mono-tabular text-2xl font-bold mb-1 gradient-text">{s.value}</div>
                <div className="text-xs uppercase tracking-wide" style={{ color: "rgba(245,242,234,0.45)" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="py-24" style={{ background: "var(--color-bg2, #111A14)" }}>
        <div className="max-w-6xl mx-auto px-5">
          <div className="text-center mb-16">
            <div className="text-xs tracking-widest uppercase mb-3 font-medium" style={{ color: "var(--color-accent)" }}>How it works</div>
            <h2 className="font-display text-3xl md:text-5xl" style={{ color: "var(--color-surface)" }}>
              Three steps to your first payout.
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: Smartphone, step: "01", title: "Pick a task", body: "Browse live offers from advertisers — surveys, app installs, sign-ups, and social tasks." },
              { icon: ClipboardCheck, step: "02", title: "Submit proof", body: "Finish the task and upload your confirmation. Reviews completed within a day." },
              { icon: Wallet, step: "03", title: "Withdraw earnings", body: "Reward lands in your wallet. Cash out via EasyPaisa, JazzCash, or bank transfer." },
            ].map((s) => (
              <div key={s.step} className="glass-card rounded-2xl p-8 premium-card" style={{ border: "1px solid var(--color-hairline)" }}>
                <div className="font-mono-tabular text-xs mb-6 font-bold" style={{ color: "var(--color-accent)" }}>{s.step}</div>
                <s.icon size={32} strokeWidth={1.5} style={{ color: "var(--color-accent)" }} className="mb-5" />
                <h3 className="font-display text-xl mb-3" style={{ color: "var(--color-surface)" }}>{s.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "rgba(245,242,234,0.55)" }}>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Plans preview ── */}
      {plans.length > 0 && (
        <section className="py-24" style={{ background: "var(--color-bg)" }}>
          <div className="max-w-6xl mx-auto px-5">
            <div className="text-center mb-16">
              <div className="text-xs tracking-widest uppercase mb-3 font-medium" style={{ color: "var(--color-gold)" }}>Earning Plans</div>
              <h2 className="font-display text-3xl md:text-5xl mb-4" style={{ color: "var(--color-surface)" }}>
                Choose your plan, scale your earnings.
              </h2>
              <p className="text-sm max-w-md mx-auto" style={{ color: "rgba(245,242,234,0.5)" }}>
                Invest in a plan to unlock higher earning potential. Refer friends and earn a referral commission on their plan purchases.
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-6 mb-10">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className="glass-card rounded-2xl p-7 premium-card relative overflow-hidden"
                  style={{ border: plan.isPopular ? "1px solid var(--color-accent)" : "1px solid var(--color-hairline)" }}
                >
                  {plan.isPopular && (
                    <div className="shine-badge absolute top-4 right-4 overflow-hidden inline-flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full" style={{ background: "var(--color-accent)", color: "#000" }}>
                      <Star size={11} fill="currentColor" /> Popular
                    </div>
                  )}
                  <div className="text-xs uppercase tracking-wider font-medium mb-2" style={{ color: "var(--color-muted)" }}>{plan.durationDays} days</div>
                  <h3 className="font-display text-xl mb-1" style={{ color: "var(--color-surface)" }}>{plan.name}</h3>
                  <div className="font-mono-tabular text-3xl font-bold mb-5 gradient-text">₨{parseFloat(plan.price).toLocaleString()}</div>
                  <ul className="flex flex-col gap-2.5 mb-6">
                    {(plan.features || []).map((f, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm" style={{ color: "rgba(245,242,234,0.75)" }}>
                        <CheckCircle2 size={14} style={{ color: "var(--color-accent)" }} className="shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link href="/register" className="block text-center py-3 rounded-xl text-sm font-semibold transition-all hover:opacity-90" style={{ background: plan.isPopular ? "var(--color-accent)" : "rgba(255,255,255,0.06)", color: plan.isPopular ? "#000" : "var(--color-surface)" }}>
                    Get started
                  </Link>
                </div>
              ))}
            </div>
            <div className="text-center">
              <Link href="/plans" className="inline-flex items-center gap-2 text-sm font-medium" style={{ color: "var(--color-accent)" }}>
                See all plans <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ── Trust ── */}
      <section className="py-24" style={{ background: "var(--color-bg2, #111A14)" }}>
        <div className="max-w-6xl mx-auto px-5 grid md:grid-cols-2 gap-16 items-center">
          <div>
            <div className="text-xs tracking-widest uppercase mb-3 font-medium" style={{ color: "var(--color-accent)" }}>Why TaskEarn</div>
            <h2 className="font-display text-3xl md:text-4xl mb-6" style={{ color: "var(--color-surface)" }}>
              Built on real money, not empty promises.
            </h2>
            <p className="text-base leading-relaxed mb-8" style={{ color: "rgba(245,242,234,0.55)" }}>
              Every rupee you earn comes from an advertiser who paid for that task. No MLM, no fake returns — just honest work, honest pay.
            </p>
            <div className="flex flex-col gap-4">
              {[
                { icon: Shield, text: "Manual review on every task submission" },
                { icon: CheckCircle2, text: "Deposits confirmed against your transaction ID" },
                { icon: Zap, text: "Withdrawals processed to your own account" },
                { icon: Users, text: "Referral bonuses from real plan purchases" },
              ].map((item) => (
                <div key={item.text} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--color-accent-glow)" }}>
                    <item.icon size={15} style={{ color: "var(--color-accent)" }} />
                  </div>
                  <span className="text-sm" style={{ color: "rgba(245,242,234,0.75)" }}>{item.text}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="glass-card rounded-2xl p-8" style={{ border: "1px solid var(--color-hairline)" }}>
            <div className="text-xs tracking-widest uppercase mb-6 font-medium" style={{ color: "var(--color-gold)" }}>Referral Program</div>
            <h3 className="font-display text-2xl mb-3" style={{ color: "var(--color-surface)" }}>Earn a referral bonus on every plan purchase</h3>
            <p className="text-sm leading-relaxed mb-6" style={{ color: "rgba(245,242,234,0.55)" }}>
              Share your unique referral link. When your friend buys any plan, you instantly receive a referral bonus directly in your wallet.
            </p>
            <div className="rounded-xl p-4 mb-6" style={{ background: "rgba(244,200,66,0.08)", border: "1px solid rgba(244,200,66,0.2)" }}>
              <div className="text-xs mb-1" style={{ color: "var(--color-gold)" }}>Example</div>
              <div className="text-sm" style={{ color: "rgba(245,242,234,0.75)" }}>Friend buys ₨5,000 plan → You earn <strong style={{ color: "var(--color-gold)" }}>₨250 instantly</strong></div>
            </div>
            <Link href="/register" className="btn-glow block text-center py-3 rounded-xl text-sm font-semibold" style={{ background: "var(--color-gold)", color: "#000" }}>
              Start referring today
            </Link>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24 relative overflow-hidden" style={{ background: "var(--color-accent)" }}>
        <div className="orb w-80 h-80 -top-20 -right-20 opacity-20" style={{ background: "var(--color-gold)" }} />
        <div className="relative max-w-4xl mx-auto px-5 text-center">
          <h2 className="font-display text-3xl md:text-5xl mb-6" style={{ color: "#000" }}>
            Your first task pays in minutes.
          </h2>
          <p className="text-base mb-8 opacity-70" style={{ color: "#000" }}>Join thousands of Pakistanis earning from home.</p>
          <Link href="/register" className="btn-glow inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold" style={{ background: "#000", color: "var(--color-accent)" }}>
            Create free account <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </PageShell>
  );
}
