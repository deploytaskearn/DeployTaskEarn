"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X, Wallet } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useSiteSettings } from "@/lib/site-settings-context";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/plans", label: "Plans" },
  { href: "/blog", label: "Blog" },
  { href: "/contact", label: "Contact" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const { site_name } = useSiteSettings();

  const siteName = site_name || "TaskEarn";

  return (
    <header
      className="sticky top-0 z-50 backdrop-blur-md"
      style={{ background: "rgba(15, 28, 23, 0.92)", borderBottom: "1px solid rgba(245,242,234,0.1)" }}
    >
      <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/taskearn-mark.svg" alt="" aria-hidden="true" style={{ height: 36, width: 36 }} />
          <span className="font-display text-xl tracking-tight" style={{ color: "var(--color-surface)" }}>
            Task<span style={{ color: "var(--color-accent)" }}>Earn</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm tracking-wide transition-colors hover:opacity-100"
              style={{ color: "rgba(245,242,234,0.75)" }}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <>
              <span className="flex items-center gap-1.5 text-sm font-mono-tabular px-3 py-1.5 rounded-sm" style={{ color: "var(--color-accent)" }}>
                <Wallet size={15} />
                ₨{parseFloat(user.balance || "0").toFixed(2)}
              </span>
              <Link href="/dashboard" className="text-sm px-4 py-2 rounded-sm font-medium" style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}>
                Dashboard
              </Link>
              <button onClick={logout} className="text-sm px-4 py-2 rounded-sm border transition-colors" style={{ borderColor: "rgba(245,242,234,0.25)", color: "var(--color-surface)" }}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-sm px-4 py-2" style={{ color: "var(--color-surface)" }}>Log in</Link>
              <Link href="/register" className="text-sm px-4 py-2 rounded-sm font-medium" style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}>
                Get started
              </Link>
            </>
          )}
        </div>

        {/* Mobile: Dashboard button always visible when logged in */}
        <div className="md:hidden flex items-center gap-2">
          {user && (
            <Link href="/dashboard" className="text-xs font-medium px-3 py-1.5 rounded-sm" style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}>
              Dashboard
            </Link>
          )}
          <button onClick={() => setOpen(!open)} aria-label="Toggle menu" style={{ color: "var(--color-surface)" }}>
            {open ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden px-5 pb-5 flex flex-col gap-4" style={{ borderTop: "1px solid rgba(245,242,234,0.1)" }}>
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="text-sm pt-3" style={{ color: "var(--color-surface)" }} onClick={() => setOpen(false)}>
              {link.label}
            </Link>
          ))}
          <div className="flex flex-col gap-3 pt-2">
            {user ? (
              <>
                <span className="text-sm font-mono-tabular" style={{ color: "var(--color-accent)" }}>
                  <Wallet size={13} className="inline mr-1" />
                  ₨{parseFloat(user.balance || "0").toFixed(2)}
                </span>
                <Link href="/dashboard" className="text-sm font-medium px-4 py-2 rounded-sm text-center" style={{ background: "var(--color-accent)", color: "var(--color-bg)" }} onClick={() => setOpen(false)}>
                  Dashboard
                </Link>
                <button onClick={logout} className="text-sm font-medium px-4 py-2 rounded-sm text-center" style={{ background: "#22c55e", color: "#fff" }}>
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="text-sm" style={{ color: "var(--color-surface)" }} onClick={() => setOpen(false)}>Log in</Link>
                <Link href="/register" className="text-sm px-4 py-2 rounded-sm font-medium text-center" style={{ background: "var(--color-accent)", color: "var(--color-bg)" }} onClick={() => setOpen(false)}>
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
