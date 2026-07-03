"use client";

import { useState } from "react";
import { PageShell } from "@/components/PageShell";
import api from "@/lib/api";
import { CheckCircle2, AlertCircle, Mail, MessageSquare } from "lucide-react";

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    try {
      await api.post("/cms/contact", form);
      setStatus("sent");
      setForm({ name: "", email: "", subject: "", message: "" });
    } catch {
      setStatus("error");
    }
  }

  return (
    <PageShell>
      <section className="py-20 md:py-28">
        <div className="max-w-5xl mx-auto px-5 grid md:grid-cols-2 gap-16">
          <div>
            <div className="text-xs tracking-widest uppercase mb-4" style={{ color: "var(--color-accent)" }}>
              Contact us
            </div>
            <h1 className="font-display text-4xl md:text-5xl mb-6 leading-tight" style={{ color: "var(--color-surface)" }}>
              Questions about a task, deposit, or withdrawal?
            </h1>
            <p className="text-base leading-relaxed mb-10" style={{ color: "rgba(245,242,234,0.65)" }}>
              Send us a message and our team will get back to you, usually within one business day.
            </p>

            <div className="flex flex-col gap-5">
              <div className="flex items-start gap-3">
                <Mail size={18} style={{ color: "var(--color-accent)" }} className="mt-0.5" />
                <div>
                  <div className="text-sm font-medium" style={{ color: "var(--color-surface)" }}>Email</div>
                  <div className="text-sm" style={{ color: "rgba(245,242,234,0.6)" }}>support@taskearn.example</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MessageSquare size={18} style={{ color: "var(--color-accent)" }} className="mt-0.5" />
                <div>
                  <div className="text-sm font-medium" style={{ color: "var(--color-surface)" }}>Response time</div>
                  <div className="text-sm" style={{ color: "rgba(245,242,234,0.6)" }}>Within 24 hours, Monday–Saturday</div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-8 rounded-2xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            {status === "sent" ? (
              <div className="flex flex-col items-center text-center py-10">
                <CheckCircle2 size={40} style={{ color: "var(--color-accent)" }} className="mb-4" />
                <h3 className="font-display text-xl mb-2" style={{ color: "var(--color-surface)" }}>Message sent</h3>
                <p className="text-sm" style={{ color: "rgba(245,242,234,0.55)" }}>We&apos;ll reply to your email soon.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                {status === "error" && (
                  <div className="flex items-start gap-2 text-sm p-3 rounded-lg" style={{ background: "rgba(232,99,58,0.12)", color: "var(--color-alert)" }}>
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    Something went wrong. Please try again.
                  </div>
                )}
                {["Name", "Email", "Subject (optional)", "Message"].map((lbl, i) => (
                  <label key={lbl} className="flex flex-col gap-1.5">
                    <span className="text-xs uppercase tracking-wide" style={{ color: "rgba(245,242,234,0.45)" }}>{lbl}</span>
                    {i === 3 ? (
                      <textarea required rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })}
                        className="px-4 py-3 rounded-lg text-sm outline-none resize-none"
                        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "var(--color-surface)" }} />
                    ) : (
                      <input type={i === 1 ? "email" : "text"} required={i !== 2}
                        value={i === 0 ? form.name : i === 1 ? form.email : form.subject}
                        onChange={(e) => setForm({ ...form, [i === 0 ? "name" : i === 1 ? "email" : "subject"]: e.target.value })}
                        className="px-4 py-3 rounded-lg text-sm outline-none"
                        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "var(--color-surface)" }} />
                    )}
                  </label>
                ))}
                <button type="submit" disabled={status === "sending"}
                  className="mt-1 px-5 py-3.5 rounded-lg font-medium text-sm disabled:opacity-60"
                  style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}>
                  {status === "sending" ? "Sending…" : "Send message"}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </PageShell>
  );
}
