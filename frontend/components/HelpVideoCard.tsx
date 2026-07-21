"use client";

import { PlayCircle } from "lucide-react";
import { HelpVideo } from "@/lib/types";
import { getYouTubeEmbedUrl, getYouTubeThumbnailUrl } from "@/lib/youtube";

const VIDEO_FILE_PATTERN = /\.(mp4|webm|mov|ogg|m4v)(\?|$)/i;

// Compact square thumbnail for tight grids (e.g. 3-up on the dashboard home).
// Opens the video in a lightbox via onClick — never navigates away.
export function HelpVideoThumb({ video, onClick }: { video: HelpVideo; onClick: () => void }) {
  const thumbUrl = getYouTubeThumbnailUrl(video.videoUrl);
  const isUploadedFile = !thumbUrl && VIDEO_FILE_PATTERN.test(video.videoUrl);
  return (
    <button onClick={onClick} style={{ display: "flex", flexDirection: "column", textAlign: "left", background: "none", border: "none", padding: 0, cursor: "pointer", width: "100%", minWidth: 0 }}>
      <div style={{ position: "relative", width: "100%", aspectRatio: "1/1", borderRadius: 14, overflow: "hidden", background: "#0a1a12", border: "1px solid rgba(255,255,255,0.08)" }}>
        {thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbUrl} alt={video.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : isUploadedFile ? (
          <video src={video.videoUrl} muted preload="metadata" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,200,117,0.06)" }}>
            <PlayCircle size={22} style={{ color: "rgba(0,200,117,0.4)" }} />
          </div>
        )}
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.28)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <PlayCircle size={20} style={{ color: "#fff" }} />
          </div>
        </div>
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(245,242,234,0.75)", marginTop: 6, lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const, overflow: "hidden" }}>
        {video.title}
      </div>
    </button>
  );
}

export function HelpVideoCard({ video }: { video: HelpVideo }) {
  const embedUrl = getYouTubeEmbedUrl(video.videoUrl);
  const isUploadedFile = !embedUrl && VIDEO_FILE_PATTERN.test(video.videoUrl);
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
      ) : isUploadedFile ? (
        <div style={{ aspectRatio: "16/9", background: "#000" }}>
          <video src={video.videoUrl} controls playsInline style={{ width: "100%", height: "100%" }} />
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
