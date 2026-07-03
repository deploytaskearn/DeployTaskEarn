"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { useAuth } from "@/lib/auth-context";
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
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useRequireAuth(true);
  const { logout } = useAuth();
  const pathname = usePathname();

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--color-bg)", color: "rgba(245,242,234,0.5)" }}>
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen flex" style={{ background: "var(--color-bg)" }}>
      <aside
        className="w-64 shrink-0 hidden md:flex flex-col py-6 px-4"
        style={{ borderRight: "1px solid rgba(245,242,234,0.1)" }}
      >
        <Link href="/secure-mgmt" className="font-display text-xl mb-8 px-2" style={{ color: "var(--color-surface)" }}>
          TaskEarn <span style={{ color: "var(--color-accent)" }}>Admin</span>
        </Link>
        <nav className="flex flex-col gap-1 flex-1">
          {NAV.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm transition-colors"
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
        </nav>
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm mt-4"
          style={{ color: "rgba(245,242,234,0.6)" }}
        >
          <LogOut size={16} /> Sign out
        </button>
      </aside>

      <main className="flex-1 min-w-0 p-6 md:p-10">{children}</main>
    </div>
  );
}
