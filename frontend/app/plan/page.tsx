"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageShell } from "@/components/PageShell";
import api from "@/lib/api";
import { TaskCategory } from "@/lib/types";
import { ArrowRight, FileText, Smartphone, Share2, UserPlus } from "lucide-react";

const ICONS: Record<string, React.ComponentType<{ size?: number; strokeWidth?: number; style?: React.CSSProperties; className?: string }>> = {
  surveys: FileText,
  "app-installs": Smartphone,
  "social-media": Share2,
  "sign-up-offers": UserPlus,
};

export default function PlanPage() {
  const [categories, setCategories] = useState<TaskCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/cms/categories")
      .then((res) => setCategories(res.data))
      .catch(() => setCategories([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <PageShell>
      <section className="py-20 md:py-28">
        <div className="max-w-3xl mx-auto px-5 text-center">
          <div className="text-xs tracking-widest uppercase mb-4" style={{ color: "var(--color-accent)" }}>
            Earning plans
          </div>
          <h1 className="font-display text-4xl md:text-6xl mb-6" style={{ color: "var(--color-surface)" }}>
            Pick a category. Every task pays a fixed reward.
          </h1>
          <p className="text-lg leading-relaxed" style={{ color: "rgba(245,242,234,0.65)" }}>
            There&apos;s no tiered membership or deposit required to unlock tasks. The reward shown on
            each task is exactly what lands in your wallet once it&apos;s approved.
          </p>
        </div>
      </section>

      <section className="py-12">
        <div className="max-w-6xl mx-auto px-5">
          {loading ? (
            <div className="text-center py-12" style={{ color: "rgba(245,242,234,0.5)" }}>Loading categories…</div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {categories.map((cat) => {
                const Icon = ICONS[cat.slug] || FileText;
                return (
                  <div key={cat.id} className="p-8 flex flex-col rounded-2xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <Icon size={28} strokeWidth={1.5} style={{ color: "var(--color-accent)" }} className="mb-4" />
                    <h3 className="font-display text-2xl mb-2" style={{ color: "var(--color-surface)" }}>{cat.name}</h3>
                    <p className="text-sm leading-relaxed mb-6 flex-1" style={{ color: "rgba(245,242,234,0.6)" }}>
                      {cat.description}
                    </p>
                    <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-medium" style={{ color: "var(--color-accent)" }}>
                      View open tasks <ArrowRight size={15} />
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="py-20" style={{ background: "var(--color-bg)" }}>
        <div className="max-w-3xl mx-auto px-5">
          <h2 className="font-display text-2xl md:text-3xl mb-8 text-center" style={{ color: "var(--color-surface)" }}>
            How rewards are calculated
          </h2>
          <div className="flex flex-col gap-0">
            {[
              ["Manual tasks (surveys, sign-ups)", "Fixed reward set per task. Paid after a quick manual review of your proof."],
              ["Partner offers (app installs, etc.)", "Reward is confirmed automatically by our partner network once your action is verified, then credited right away."],
              ["Referrals", "Earn a bonus when someone you refer completes their first paid task."],
            ].map(([title, body]) => (
              <div key={title} className="ledger-row py-5 flex flex-col sm:flex-row sm:items-baseline gap-2">
                <div className="font-mono-tabular text-sm w-full sm:w-72 shrink-0" style={{ color: "var(--color-accent)" }}>{title}</div>
                <div className="text-sm" style={{ color: "rgba(245,242,234,0.65)" }}>{body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </PageShell>
  );
}
