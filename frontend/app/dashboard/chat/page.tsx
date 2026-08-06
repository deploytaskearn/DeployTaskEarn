"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/lib/useRequireAuth";
import api from "@/lib/api";
import { ChatMessage } from "@/lib/types";
import { ArrowLeft, Send, MessageCircle } from "lucide-react";

export default function ChatPage() {
  const router = useRouter();
  const { user, loading } = useRequireAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const isFirstLoad = useRef(true);

  function load(isInitial = false) {
    api.get<ChatMessage[]>("/chat/my-messages")
      .then((r) => setMessages(r.data))
      .catch(() => {})
      .finally(() => { if (isInitial) setInitialLoading(false); });
  }

  useEffect(() => {
    if (!user) return;
    load(true);
    const interval = setInterval(() => load(false), 4000);
    return () => clearInterval(interval);
  }, [user?.id]);

  useEffect(() => {
    // Jump to bottom on first load, smooth-scroll on new messages after that.
    bottomRef.current?.scrollIntoView({ behavior: isFirstLoad.current ? "auto" : "smooth" });
    if (messages.length > 0) isFirstLoad.current = false;
  }, [messages.length]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const message = text.trim();
    if (!message || sending) return;
    setSending(true);
    setError("");
    try {
      const res = await api.post<ChatMessage>("/chat/my-messages", { message });
      setMessages((prev) => [...prev, res.data]);
      setText("");
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to send. Try again.");
    } finally {
      setSending(false);
    }
  }

  if (loading || !user) return null;

  return (
    <div className="min-h-screen w-full flex flex-col" style={{ background: "#0A1A12" }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-6 pb-4 sticky top-0 z-10" style={{ background: "#0A1A12", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <button onClick={() => router.back()} className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.07)" }}>
          <ArrowLeft size={18} style={{ color: "#F5F2EA" }} />
        </button>
        <h1 className="font-display text-xl" style={{ color: "#F5F2EA" }}>Support Chat</h1>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 max-w-2xl w-full mx-auto">
        {initialLoading ? (
          <div className="flex-1 flex items-center justify-center text-sm" style={{ color: "rgba(245,242,234,0.4)" }}>Loading…</div>
        ) : messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 py-16 text-center">
            <MessageCircle size={32} style={{ color: "rgba(245,242,234,0.2)" }} />
            <p className="text-sm" style={{ color: "rgba(245,242,234,0.45)" }}>No messages yet. Send us a message and our team will help you out.</p>
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="flex" style={{ justifyContent: m.senderRole === "USER" ? "flex-end" : "flex-start" }}>
              <div className="max-w-[78%] rounded-2xl px-4 py-2.5"
                style={{
                  background: m.senderRole === "USER" ? "#00C875" : "rgba(255,255,255,0.06)",
                  color: m.senderRole === "USER" ? "#000" : "#F5F2EA",
                  borderBottomRightRadius: m.senderRole === "USER" ? 4 : 16,
                  borderBottomLeftRadius: m.senderRole === "USER" ? 16 : 4,
                }}>
                <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">{m.message}</div>
                <div className="text-xs mt-1 text-right" style={{ color: m.senderRole === "USER" ? "rgba(0,0,0,0.5)" : "rgba(245,242,234,0.35)" }}>
                  {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="px-4 pb-5 pt-2 max-w-2xl w-full mx-auto" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        {error && (
          <div className="text-xs mb-2 px-3 py-2 rounded-lg" style={{ background: "rgba(232,99,58,0.1)", color: "#E8633A" }}>{error}</div>
        )}
        <form onSubmit={handleSend} className="flex items-center gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type your message…"
            maxLength={2000}
            className="flex-1 px-4 py-3 rounded-2xl text-sm outline-none"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#F5F2EA" }}
          />
          <button type="submit" disabled={sending || !text.trim()}
            className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 disabled:opacity-40"
            style={{ background: "#00C875", color: "#000" }}>
            <Send size={17} />
          </button>
        </form>
      </div>
    </div>
  );
}
