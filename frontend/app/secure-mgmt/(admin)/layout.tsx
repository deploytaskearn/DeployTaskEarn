"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useAdminAuth } from "@/lib/admin-auth-context";
import {
  LayoutDashboard,
  Banknote,
  ArrowUpFromLine,
  ListChecks,
  ClipboardCheck,
  Users,
  Newspaper,
  Settings,
  LogOut,
  Trophy,
  Palette,
  Menu,
  X,
  Ticket,
  Package,
} from "lucide-react";

const NAV = [
  { href: "/secure-mgmt", label: "Overview", icon: LayoutDashboard },
  { href: "/secure-mgmt/plans", label: "Plans", icon: Trophy },
  { href: "/secure-mgmt/customize", label: "Customize site", icon: Palette },
  { href: "/secure-mgmt/deposits", label: "Deposits", icon: Banknote },
  { href: "/secure-mgmt/withdrawals", label: "Withdrawals", icon: ArrowUpFromLine },
  { href: "/secure-mgmt/tasks", label: "Tasks", icon: ListChecks },
  { href: "/secure-mgmt/submissions", label: "Submissions", icon: ClipboardCheck },
  { href: "/secure-mgmt/users", label: "Users", icon: Users },
  { href: "/secure-mgmt/blog", label: "Blog", icon: Newspaper },
  { href: "/secure-mgmt/settings", label: "Payment settings", icon: Settings },
  { href: "/secure-mgmt/spin", label: "Spin Wheel", icon: Ticket },
  { href: "/secure-mgmt/mystery", label: "Mystery Box", icon: Package },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { admin: user, loading, logout } = useAdminAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/secure-mgmt/login");
    }
  }, [user, loading, router]);
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--color-bg)", color: "rgba(245,242,234,0.5)" }}>
        Loading…
      </div>
    );
  }

  function handleLogout() {
    setDrawerOpen(false);
    logout();
  }

  const NavLinks = ({ onNav }: { onNav?: () => void }) => (
    <>
      {NAV.map((item) => {
        const active = item.href === "/secure-mgmt" ? pathname === item.href : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNav}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors"
            style={{
              background: active ? "rgba(63,168,118,0.14)" : "transparent",
              color: active ? "var(--color-accent)" : "rgba(245,242,234,0.7)",
            }}
          >
            <Icon size={16} />
            {item.label}
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="min-h-screen flex flex-col md:flex-row" style={{ background: "var(--color-bg)" }}>

      {/* ── Desktop sidebar ── */}
      <aside
        className="w-64 shrink-0 hidden md:flex flex-col py-6 px-4"
        style={{ borderRight: "1px solid rgba(245,242,234,0.1)" }}
      >
        <Link href="/secure-mgmt" className="font-display text-xl mb-8 px-2" style={{ color: "var(--color-surface)" }}>
          TaskEarn <span style={{ color: "var(--color-accent)" }}>Admin</span>
        </Link>
        <nav className="flex flex-col gap-1 flex-1">
          <NavLinks />
        </nav>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm mt-4"
          style={{ color: "rgba(245,242,234,0.6)" }}
        >
          <LogOut size={16} /> Sign out
        </button>
      </aside>

      {/* ── Mobile top bar ── */}
      <div
        className="md:hidden flex items-center justify-between px-4 py-3 sticky top-0 z-30"
        style={{ background: "var(--color-bg)", borderBottom: "1px solid rgba(245,242,234,0.08)" }}
      >
        <span className="font-display text-base" style={{ color: "var(--color-surface)" }}>
          TaskEarn <span style={{ color: "var(--color-accent)" }}>Admin</span>
        </span>
        <button
          onClick={() => setDrawerOpen(true)}
          className="w-9 h-9 flex items-center justify-center rounded-xl"
          style={{ background: "rgba(255,255,255,0.07)" }}
        >
          <Menu size={20} style={{ color: "#F5F2EA" }} />
        </button>
      </div>

      {/* ── Mobile drawer backdrop ── */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* ── Mobile drawer ── */}
      <div
        className="fixed top-0 left-0 h-full z-50 md:hidden flex flex-col py-6 px-4 transition-transform duration-300"
        style={{
          width: 260,
          background: "#0d1f16",
          borderRight: "1px solid rgba(245,242,234,0.1)",
          transform: drawerOpen ? "translateX(0)" : "translateX(-100%)",
        }}
      >
        <div className="flex items-center justify-between mb-7 px-1">
          <span className="font-display text-lg" style={{ color: "var(--color-surface)" }}>
            TaskEarn <span style={{ color: "var(--color-accent)" }}>Admin</span>
          </span>
          <button
            onClick={() => setDrawerOpen(false)}
            className="w-8 h-8 flex items-center justify-center rounded-lg"
            style={{ background: "rgba(255,255,255,0.07)" }}
          >
            <X size={16} style={{ color: "#F5F2EA" }} />
          </button>
        </div>

        <nav className="flex flex-col gap-1 flex-1 overflow-y-auto">
          <NavLinks onNav={() => setDrawerOpen(false)} />
        </nav>

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm mt-4"
          style={{ color: "rgba(245,242,234,0.6)" }}
        >
          <LogOut size={16} /> Sign out
        </button>
      </div>

      {/* ── Page content ── */}
      <main className="flex-1 min-w-0 p-4 md:p-10">{children}</main>
    </div>
  );
}
