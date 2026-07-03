import { PageShell } from "@/components/PageShell";
import { ShieldCheck, Users, Banknote } from "lucide-react";

export default function AboutPage() {
  return (
    <PageShell>
      <section className="py-20 md:py-28">
        <div className="max-w-3xl mx-auto px-5">
          <div className="text-xs tracking-widest uppercase mb-4" style={{ color: "var(--color-accent)" }}>
            About TaskEarn
          </div>
          <h1 className="font-display text-4xl md:text-6xl mb-8 leading-tight" style={{ color: "var(--color-surface)" }}>
            We connect advertisers with people who&apos;ll actually do the work.
          </h1>
          <p className="text-lg leading-relaxed mb-6" style={{ color: "rgba(245,242,234,0.7)" }}>
            TaskEarn is a micro-task platform. Advertisers and partner networks pay us to get real
            tasks completed — surveys filled, apps tried, offers signed up for — and we pass that
            payment on to the people who do the work, minus our service fee.
          </p>
          <p className="text-lg leading-relaxed" style={{ color: "rgba(245,242,234,0.7)" }}>
            We&apos;re not an investment platform. We don&apos;t promise returns, and nobody&apos;s payout
            depends on someone else signing up after them. Every task is reviewed by our team
            before it&apos;s marked paid, and every withdrawal goes straight to your own EasyPaisa,
            JazzCash, or bank account.
          </p>
        </div>
      </section>

      <section className="py-16" style={{ background: "rgba(255,255,255,0.02)" }}>
        <div className="max-w-6xl mx-auto px-5 grid md:grid-cols-3 gap-4 px-5">
          {[
            { icon: ShieldCheck, title: "Reviewed, not automatic", body: "Most manual tasks are checked by a person before reward is released — fewer disputes, fewer fakes." },
            { icon: Users, title: "Built for everyday earners", body: "No special skills or equipment. Just a phone, a bit of time, and an account to get paid into." },
            { icon: Banknote, title: "Local payout methods", body: "We pay out through the methods people already use day to day: EasyPaisa, JazzCash, and bank transfer." },
          ].map((item) => (
            <div key={item.title} className="p-8 rounded-2xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <item.icon size={26} strokeWidth={1.5} style={{ color: "var(--color-accent)" }} className="mb-4" />
              <h3 className="font-display text-xl mb-2" style={{ color: "var(--color-surface)" }}>{item.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: "rgba(245,242,234,0.6)" }}>{item.body}</p>
            </div>
          ))}
        </div>
      </section>
    </PageShell>
  );
}
