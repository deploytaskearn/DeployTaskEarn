"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import api from "@/lib/admin-api";

interface AdminNotification {
  id: string;
  type: string;
  title: string;
  message: string | null;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function NotificationBell() {
  const [items, setItems] = useState<AdminNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  async function load() {
    try {
      const res = await api.get("/admin/notifications");
      setItems(res.data.notifications);
      setUnreadCount(res.data.unreadCount);
    } catch {}
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 20000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function handleClickItem(n: AdminNotification) {
    if (!n.isRead) {
      api.post(`/admin/notifications/${n.id}/read`).catch(() => {});
      setItems((prev) => prev.map((i) => (i.id === n.id ? { ...i, isRead: true } : i)));
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    setOpen(false);
    if (n.link) router.push(`/mg-5bcdfea71b${n.link}`);
  }

  async function handleMarkAllRead() {
    api.post("/admin/notifications/read-all").catch(() => {});
    setItems((prev) => prev.map((i) => ({ ...i, isRead: true })));
    setUnreadCount(0);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative w-9 h-9 flex items-center justify-center rounded-xl"
        style={{ background: "rgba(255,255,255,0.07)" }}
      >
        <Bell size={18} style={{ color: "#F5F2EA" }} />
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full text-[10px] font-bold"
            style={{ background: "var(--color-alert)", color: "#fff" }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto rounded-2xl shadow-xl z-50"
          style={{ background: "#0d1f16", border: "1px solid rgba(245,242,234,0.12)" }}
        >
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid rgba(245,242,234,0.08)" }}>
            <span className="text-sm font-medium" style={{ color: "var(--color-surface)" }}>Notifications</span>
            {unreadCount > 0 && (
              <button onClick={handleMarkAllRead} className="text-xs" style={{ color: "var(--color-accent)" }}>
                Mark all read
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm" style={{ color: "rgba(245,242,234,0.45)" }}>
              No notifications yet
            </div>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                onClick={() => handleClickItem(n)}
                className="w-full text-left px-4 py-3 flex flex-col gap-0.5 transition-colors hover:bg-white/5"
                style={{ borderBottom: "1px solid rgba(245,242,234,0.05)", background: n.isRead ? "transparent" : "rgba(63,168,118,0.08)" }}
              >
                <span className="text-sm" style={{ color: "var(--color-surface)" }}>{n.title}</span>
                {n.message && (
                  <span className="text-xs" style={{ color: "rgba(245,242,234,0.5)" }}>{n.message}</span>
                )}
                <span className="text-[11px] mt-0.5" style={{ color: "rgba(245,242,234,0.35)" }}>{timeAgo(n.createdAt)}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
