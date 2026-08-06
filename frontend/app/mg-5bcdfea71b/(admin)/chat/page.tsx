"use client";

import { useEffect, useRef, useState } from "react";
import api from "@/lib/admin-api";
import { ChatConversation, ChatMessage } from "@/lib/types";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Send, MessageCircle } from "lucide-react";

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function AdminChatPage() {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  function loadConversations() {
    api.get<ChatConversation[]>("/chat/admin/conversations")
      .then((r) => setConversations(r.data))
      .catch(() => {})
      .finally(() => setLoadingList(false));
  }

  useEffect(() => {
    loadConversations();
    const interval = setInterval(loadConversations, 10000);
    return () => clearInterval(interval);
  }, []);

  function openThread(userId: string) {
    setActiveUserId(userId);
    setLoadingThread(true);
    api.get<ChatMessage[]>(`/chat/admin/conversations/${userId}/messages`)
      .then((r) => setMessages(r.data))
      .catch(() => setMessages([]))
      .finally(() => setLoadingThread(false));
    // Clear the badge locally right away instead of waiting for the next poll.
    setConversations((prev) => prev.map((c) => (c.userId === userId ? { ...c, unreadCount: 0 } : c)));
  }

  useEffect(() => {
    if (!activeUserId) return;
    const interval = setInterval(() => {
      api.get<ChatMessage[]>(`/chat/admin/conversations/${activeUserId}/messages`)
        .then((r) => setMessages(r.data))
        .catch(() => {});
    }, 4000);
    return () => clearInterval(interval);
  }, [activeUserId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const message = text.trim();
    if (!message || sending || !activeUserId) return;
    setSending(true);
    try {
      const res = await api.post<ChatMessage>(`/chat/admin/conversations/${activeUserId}/messages`, { message });
      setMessages((prev) => [...prev, res.data]);
      setText("");
      loadConversations();
    } catch {
      alert("Failed to send reply.");
    } finally {
      setSending(false);
    }
  }

  const active = conversations.find((c) => c.userId === activeUserId);

  return (
    <div>
      <AdminPageHeader title="Support Chat" subtitle="Reply to user messages here." />

      <div className="rounded-sm overflow-hidden flex" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", height: "70vh" }}>
        {/* ── Conversation list ── */}
        <div className={`${activeUserId ? "hidden md:block" : "block"} w-full md:w-80 shrink-0 overflow-y-auto`} style={{ borderRight: "1px solid rgba(255,255,255,0.08)" }}>
          {loadingList ? (
            <div className="p-6 text-sm" style={{ color: "rgba(245,242,234,0.4)" }}>Loading…</div>
          ) : conversations.length === 0 ? (
            <div className="p-6 text-sm text-center" style={{ color: "rgba(245,242,234,0.4)" }}>No conversations yet.</div>
          ) : (
            conversations.map((c) => (
              <button key={c.userId} onClick={() => openThread(c.userId)}
                className="w-full text-left px-4 py-3 flex items-start gap-3"
                style={{
                  background: activeUserId === c.userId ? "rgba(0,200,117,0.08)" : "transparent",
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="text-sm font-medium truncate" style={{ color: "var(--color-surface)" }}>{c.name}</span>
                    <span className="text-xs shrink-0" style={{ color: "rgba(245,242,234,0.35)" }}>{timeAgo(c.lastMessageAt)}</span>
                  </div>
                  <div className="text-xs truncate" style={{ color: "rgba(245,242,234,0.45)" }}>
                    {c.lastSenderRole === "ADMIN" ? "You: " : ""}{c.lastMessage}
                  </div>
                </div>
                {c.unreadCount > 0 && (
                  <span className="text-xs font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ background: "var(--color-accent)", color: "#000" }}>
                    {c.unreadCount}
                  </span>
                )}
              </button>
            ))
          )}
        </div>

        {/* ── Thread ── */}
        <div className={`${activeUserId ? "flex" : "hidden md:flex"} flex-col flex-1 min-w-0`}>
          {!activeUserId ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2" style={{ color: "rgba(245,242,234,0.3)" }}>
              <MessageCircle size={28} />
              <p className="text-sm">Select a conversation to view messages.</p>
            </div>
          ) : (
            <>
              <div className="px-5 py-3.5 flex items-center gap-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                <button onClick={() => setActiveUserId(null)} className="md:hidden text-xs font-semibold shrink-0" style={{ color: "var(--color-accent)" }}>
                  ‹ Back
                </button>
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate" style={{ color: "var(--color-surface)" }}>{active?.name}</div>
                  <div className="text-xs truncate" style={{ color: "rgba(245,242,234,0.4)" }}>{active?.email}</div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
                {loadingThread ? (
                  <div className="text-sm" style={{ color: "rgba(245,242,234,0.4)" }}>Loading…</div>
                ) : (
                  messages.map((m) => (
                    <div key={m.id} className="flex" style={{ justifyContent: m.senderRole === "ADMIN" ? "flex-end" : "flex-start" }}>
                      <div className="max-w-[70%] rounded-2xl px-4 py-2.5"
                        style={{
                          background: m.senderRole === "ADMIN" ? "var(--color-accent)" : "rgba(255,255,255,0.06)",
                          color: m.senderRole === "ADMIN" ? "#000" : "var(--color-surface)",
                        }}>
                        <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">{m.message}</div>
                        <div className="text-xs mt-1 text-right" style={{ color: m.senderRole === "ADMIN" ? "rgba(0,0,0,0.5)" : "rgba(245,242,234,0.35)" }}>
                          {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={bottomRef} />
              </div>
              <form onSubmit={handleSend} className="px-4 py-3 flex items-center gap-2" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Type a reply…"
                  maxLength={2000}
                  className="flex-1 px-4 py-2.5 rounded-lg text-sm outline-none"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "var(--color-surface)" }}
                />
                <button type="submit" disabled={sending || !text.trim()}
                  className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 disabled:opacity-40"
                  style={{ background: "var(--color-accent)", color: "#000" }}>
                  <Send size={15} />
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
