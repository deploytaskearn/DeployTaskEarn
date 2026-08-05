"use client";

import { Megaphone } from "lucide-react";
import { Announcement } from "@/lib/types";

export function AnnouncementCard({ announcement }: { announcement: Announcement }) {
  return (
    <div style={{ borderRadius: 20, overflow: "hidden", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
      {announcement.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={announcement.imageUrl} alt={announcement.title} style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", display: "block" }} />
      ) : (
        <div style={{ width: "100%", aspectRatio: "16/9", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,200,117,0.06)" }}>
          <Megaphone size={22} style={{ color: "rgba(0,200,117,0.4)" }} />
        </div>
      )}
      <div style={{ padding: "14px 18px" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#F5F2EA" }}>{announcement.title}</div>
        {announcement.description && (
          <div style={{ fontSize: 12, color: "rgba(245,242,234,0.5)", marginTop: 4, lineHeight: 1.5 }}>{announcement.description}</div>
        )}
      </div>
    </div>
  );
}
