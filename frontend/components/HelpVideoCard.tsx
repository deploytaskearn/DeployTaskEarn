"use client";

import { PlayCircle } from "lucide-react";
import { HelpVideo } from "@/lib/types";
import { getYouTubeEmbedUrl } from "@/lib/youtube";

export function HelpVideoCard({ video }: { video: HelpVideo }) {
  const embedUrl = getYouTubeEmbedUrl(video.videoUrl);
  return (
    <div style={{ borderRadius: 20, overflow: "hidden", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
      {embedUrl ? (
        <div style={{ aspectRatio: "16/9", background: "#000" }}>
          <iframe
            src={embedUrl}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{ width: "100%", height: "100%", border: "none" }}
          />
        </div>
      ) : (
        <a href={video.videoUrl} target="_blank" rel="noopener noreferrer"
          style={{ display: "flex", alignItems: "center", justifyContent: "center", aspectRatio: "16/9", background: "rgba(0,200,117,0.06)", color: "#00C875", fontSize: 13, gap: 8 }}>
          <PlayCircle size={20} /> Watch video
        </a>
      )}
      <div style={{ padding: "14px 18px" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#F5F2EA" }}>{video.title}</div>
        {video.description && (
          <div style={{ fontSize: 12, color: "rgba(245,242,234,0.5)", marginTop: 4, lineHeight: 1.5 }}>{video.description}</div>
        )}
      </div>
    </div>
  );
}
