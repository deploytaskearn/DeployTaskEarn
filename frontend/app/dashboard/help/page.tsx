"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, PlayCircle } from "lucide-react";
import api from "@/lib/api";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { HelpVideo } from "@/lib/types";
import { HelpVideoCard } from "@/components/HelpVideoCard";

export default function HelpPage() {
  const { user, loading } = useRequireAuth();
  const router = useRouter();
  const [videos, setVideos] = useState<HelpVideo[]>([]);
  const [fetchError, setFetchError] = useState("");
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!user) return;
    api.get<HelpVideo[]>("/cms/help-videos")
      .then((r) => setVideos(r.data ?? []))
      .catch(() => setFetchError("Failed to load help videos."))
      .finally(() => setFetching(false));
  }, [user]);

  if (loading || !user) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0A1A12" }}>
        <div style={{ color: "rgba(245,242,234,0.4)", fontSize: 14 }}>Loading…</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0A1A12", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ width: "100%", maxWidth: 640, padding: "0 0 48px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px 4px" }}>
          <button onClick={() => router.back()} style={{ background: "rgba(0,200,117,0.1)", border: "1px solid rgba(0,200,117,0.2)", borderRadius: 12, width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
            <ArrowLeft size={18} color="#00C875" />
          </button>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#F5F2EA", lineHeight: 1.1 }}>Help & Tutorials</div>
            <div style={{ fontSize: 11, color: "rgba(245,242,234,0.5)", marginTop: 2 }}>How to deposit, withdraw, and more</div>
          </div>
        </div>

        <div style={{ padding: "20px 20px 0" }}>
          {fetching ? (
            <div style={{ color: "rgba(245,242,234,0.4)", fontSize: 13, textAlign: "center", padding: "40px 0" }}>Loading…</div>
          ) : fetchError ? (
            <div style={{ padding: "14px 16px", borderRadius: 14, background: "rgba(232,99,58,0.12)", color: "#E8633A", fontSize: 13, textAlign: "center" }}>
              {fetchError}
            </div>
          ) : videos.length === 0 ? (
            <div style={{ padding: "40px 20px", borderRadius: 20, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", textAlign: "center" }}>
              <PlayCircle size={32} style={{ color: "rgba(245,242,234,0.2)", margin: "0 auto 12px" }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: "#F5F2EA" }}>No tutorial videos yet</div>
              <div style={{ fontSize: 12, color: "rgba(245,242,234,0.4)", marginTop: 4 }}>Check back soon.</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {videos.map((v) => (
                <HelpVideoCard key={v.id} video={v} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
