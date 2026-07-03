"use client";

import Link from "next/link";
import { useSiteSettings } from "@/lib/site-settings-context";

export function SiteFooter() {
  const { site_name } = useSiteSettings();
  const name = site_name || "TaskEarn";

  return (
    <footer style={{ borderTop: "1px solid rgba(245,242,234,0.1)", background: "var(--color-bg)" }}>
      <div className="max-w-6xl mx-auto px-5 py-12 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div>
          <div className="mb-3 flex items-center gap-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/taskearn-mark.svg" alt="" aria-hidden="true" style={{ height: 28, width: 28 }} />
            <span className="font-display text-lg" style={{ color: "var(--color-surface)" }}>
              Task<span style={{ color: "var(--color-accent)" }}>Earn</span>
            </span>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: "rgba(245,242,234,0.55)" }}>
            Real tasks from real advertisers. Get paid into EasyPaisa, JazzCash, or your bank account.
          </p>
        </div>

        <div>
          <div className="text-xs tracking-widest uppercase mb-3" style={{ color: "var(--color-accent)" }}>Platform</div>
          <ul className="flex flex-col gap-2 text-sm" style={{ color: "rgba(245,242,234,0.7)" }}>
            <li><Link href="/plans">Earning plans</Link></li>
            <li><Link href="/about">About us</Link></li>
            <li><Link href="/blog">Blog</Link></li>
          </ul>
        </div>

        <div>
          <div className="text-xs tracking-widest uppercase mb-3" style={{ color: "var(--color-accent)" }}>Account</div>
          <ul className="flex flex-col gap-2 text-sm" style={{ color: "rgba(245,242,234,0.7)" }}>
            <li><Link href="/login">Log in</Link></li>
            <li><Link href="/register">Create account</Link></li>
            <li><Link href="/dashboard">Dashboard</Link></li>
          </ul>
        </div>

        <div>
          <div className="text-xs tracking-widest uppercase mb-3" style={{ color: "var(--color-accent)" }}>Support</div>
          <ul className="flex flex-col gap-2 text-sm" style={{ color: "rgba(245,242,234,0.7)" }}>
            <li><Link href="/contact">Contact us</Link></li>
          </ul>
        </div>
      </div>

      <div
        className="max-w-6xl mx-auto px-5 py-5 text-xs flex flex-col sm:flex-row justify-between gap-2"
        style={{ borderTop: "1px solid rgba(245,242,234,0.08)", color: "rgba(245,242,234,0.4)" }}
      >
        <span>© {new Date().getFullYear()} {name}. All rights reserved.</span>
        <span>Payouts via EasyPaisa · JazzCash · Bank transfer</span>
      </div>
    </footer>
  );
}
