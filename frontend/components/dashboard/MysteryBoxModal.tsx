"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import api from "@/lib/api";

interface Prize {
  id: string;
  label: string;
  rewardAmount: string;
}

interface MysteryInfo {
  prizes: Prize[];
  isPremium: boolean;
  dailyLimit: number;
  playsToday: number;
  canPlay: boolean;
  secondsUntilReset: number;
  hasPlan: boolean;
}

interface OpenResult {
  prize: { id: string; label: string; rewardAmount: string };
  playsToday: number;
  playsRemaining: number;
  secondsUntilReset: number;
  hasPlan: boolean;
  isPremium: boolean;
}

function useCountdown(initial: number) {
  const [secs, setSecs] = useState(initial);
  useEffect(() => {
    setSecs(initial);
    if (initial <= 0) return;
    const t = setInterval(() => setSecs(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [initial]);
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60;
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

function BoxSVG({ phase, premium }: { phase: "idle" | "shaking" | "opening" | "revealed"; premium: boolean }) {
  const lidUp = phase === "opening" || phase === "revealed";
  const bodyColor = premium ? "#7c3aed" : "#1d4a2e";
  const lidColor = premium ? "#4c1d95" : "#0d3a22";
  const ribbonColor = premium ? "#c4b5fd" : "#4ade80";
  const bowColor = premium ? "#ede9fe" : "#d1fae5";
  const glowColor = premium ? "rgba(168,85,247,0.4)" : "rgba(0,200,117,0.4)";
  const platformColor = premium ? "#a855f7" : "#00C875";

  return (
    <svg viewBox="0 0 160 180" width="180" height="202" style={{ display: "block", overflow: "visible", filter: `drop-shadow(0 0 24px ${glowColor})` }}>
      <ellipse cx="80" cy="174" rx="70" ry="14" fill={platformColor} opacity="0.18" />
      <ellipse cx="80" cy="174" rx="50" ry="9" fill={platformColor} opacity="0.12" />
      <rect x="12" y="78" width="136" height="92" rx="10" fill={bodyColor} />
      <rect x="12" y="78" width="136" height="18" rx="10" fill="black" opacity="0.18" />
      <rect x="68" y="78" width="24" height="92" fill={ribbonColor} opacity="0.8" rx="3" />
      <rect x="12" y="104" width="136" height="24" fill={ribbonColor} opacity="0.8" rx="3" />
      <g style={{
        transform: lidUp ? "translateY(-48px) rotate(-8deg)" : "translateY(0)",
        transformOrigin: "80px 56px",
        transition: lidUp ? "transform 0.45s cubic-bezier(0.34,1.56,0.64,1)" : "none"
      }}>
        <rect x="4" y="40" width="152" height="42" rx="10" fill={lidColor} />
        <rect x="8" y="34" width="144" height="16" rx="6" fill={lidColor} />
        <rect x="4" y="72" width="152" height="10" rx="4" fill="black" opacity="0.13" />
        <rect x="4" y="50" width="152" height="22" fill={ribbonColor} opacity="0.8" rx="3" />
        <rect x="68" y="34" width="24" height="50" fill={ribbonColor} opacity="0.8" rx="3" />
        <ellipse cx="44" cy="22" rx="38" ry="20" fill={bowColor} transform="rotate(-20 44 22)" />
        <ellipse cx="44" cy="22" rx="26" ry="13" fill={lidColor} opacity="0.28" transform="rotate(-20 44 22)" />
        <ellipse cx="116" cy="22" rx="38" ry="20" fill={bowColor} transform="rotate(20 116 22)" />
        <ellipse cx="116" cy="22" rx="26" ry="13" fill={lidColor} opacity="0.28" transform="rotate(20 116 22)" />
        <circle cx="80" cy="34" r="17" fill={ribbonColor} />
        <circle cx="80" cy="34" r="11" fill={bowColor} />
        <circle cx="80" cy="34" r="5" fill={ribbonColor} />
      </g>
    </svg>
  );
}

export function MysteryBoxModal({ onClose, onWin }: { onClose: () => void; onWin: () => void }) {
  const [info, setInfo] = useState<MysteryInfo | null>(null);
  const [phase, setPhase] = useState<"idle" | "shaking" | "opening" | "revealed">("idle");
  const [result, setResult] = useState<OpenResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [canPlay, setCanPlay] = useState(false);
  const [secondsUntilReset, setSecondsUntilReset] = useState(0);
  const [hasPlan, setHasPlan] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const countdown = useCountdown(secondsUntilReset);

  useEffect(() => {
    api.get<MysteryInfo>("/mystery/info")
      .then(r => {
        setInfo(r.data);
        setCanPlay(r.data.canPlay);
        setSecondsUntilReset(r.data.secondsUntilReset);
        setHasPlan(r.data.hasPlan ?? false);
        setIsPremium(r.data.isPremium ?? false);
      })
      .catch(() => setError("Failed to load. Please try again."));
  }, []);

  async function handleOpen() {
    if (!canPlay || loading || phase !== "idle") return;
    setLoading(true);
    setError("");
    setPhase("shaking");
    try {
      const res = await api.post<OpenResult>("/mystery/open");
      setTimeout(() => setPhase("opening"), 700);
      setTimeout(() => {
        setResult(res.data);
        setPhase("revealed");
        setCanPlay(false);
        setSecondsUntilReset(res.data.secondsUntilReset ?? 0);
        setHasPlan(res.data.hasPlan ?? false);
        setIsPremium(res.data.isPremium ?? false);
        if (parseFloat(res.data.prize.rewardAmount) > 0) onWin();
        setLoading(false);
      }, 1500);
    } catch (err: unknown) {
      const apiErr = (err as { response?: { data?: { error?: string } } });
      setError(apiErr?.response?.data?.error || "Failed to open box.");
      setPhase("idle");
      setLoading(false);
    }
  }

  const prizes = info?.prizes ?? [];
  const isWin = result ? parseFloat(result.prize.rewardAmount) > 0 : false;

  const accent = isPremium ? "#a855f7" : "#00C875";
  const accentDim = isPremium ? "rgba(168,85,247,0.15)" : "rgba(0,200,117,0.12)";
  const accentBorder = isPremium ? "rgba(168,85,247,0.3)" : "rgba(0,200,117,0.25)";
  const bg = isPremium
    ? "radial-gradient(ellipse at 50% 20%, #2e1065 0%, #0d0520 50%, #050210 100%)"
    : "radial-gradient(ellipse at 50% 20%, #0d3a22 0%, #061a10 50%, #020d07 100%)";

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, background: bg, display: "flex", flexDirection: "column", alignItems: "center", overflowY: "auto" }}>

      {/* Background sparkles */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 0 }}>
        {Array.from({ length: 14 }).map((_, i) => (
          <div key={i} style={{
            position: "absolute",
            left: `${(i * 19 + 7) % 92}%`, top: `${(i * 23 + 5) % 88}%`,
            width: 4 + (i % 4), height: 4 + (i % 4),
            borderRadius: "50%", background: accent, opacity: 0.35,
            animation: `sparkle ${2 + (i % 3) * 0.5}s ${i * 0.15}s ease-in-out infinite`,
          }} />
        ))}
      </div>

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", alignItems: "center", paddingBottom: 40 }}>

        {/* Header */}
        <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px 0" }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#F5F2EA" }}>
              {isPremium ? "👑 Premium Box" : "🎁 Mystery Box"}
            </div>
            <div style={{ fontSize: 12, color: "rgba(245,242,234,0.45)", marginTop: 2 }}>
              {isPremium ? "Daily premium prizes for plan holders!" : "Open once — win cash prizes!"}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 12, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <X size={18} color="#F5F2EA" />
          </button>
        </div>

        {/* Status chip */}
        <div style={{ marginTop: 14, padding: "6px 20px", borderRadius: 99, background: accentDim, border: `1px solid ${accentBorder}`, fontSize: 12, fontWeight: 700, color: accent }}>
          {canPlay
            ? (isPremium ? "👑 Premium Box Ready!" : "🎁 Free Box Available!")
            : hasPlan ? `⏰ Next box in ${countdown}`
            : "Used — activate a plan for daily boxes"}
        </div>

        {error && (
          <div style={{ margin: "10px 20px 0", padding: "10px 16px", borderRadius: 12, background: "rgba(232,99,58,0.12)", color: "#E8633A", fontSize: 13, textAlign: "center", width: "calc(100% - 40px)" }}>
            {error}
          </div>
        )}

        {/* The Box */}
        <div style={{ marginTop: 24, position: "relative" }}>
          <div style={{
            cursor: canPlay && phase === "idle" ? "pointer" : "default",
            animation: phase === "shaking" ? "boxShake 0.6s ease" : "none",
            filter: canPlay
              ? `drop-shadow(0 0 32px ${isPremium ? "rgba(168,85,247,0.5)" : "rgba(0,200,117,0.4)"})`
              : "grayscale(0.5) opacity(0.7)",
          }} onClick={handleOpen}>
            <BoxSVG phase={phase} premium={isPremium} />
          </div>

          {result && phase === "revealed" && (
            <div style={{
              position: "absolute", top: -60, left: "50%", transform: "translateX(-50%)",
              padding: "10px 24px", borderRadius: 99, whiteSpace: "nowrap",
              background: isWin ? accentDim : "rgba(255,255,255,0.08)",
              border: `1px solid ${isWin ? accentBorder : "rgba(255,255,255,0.15)"}`,
              fontSize: 18, fontWeight: 900,
              color: isWin ? accent : "rgba(245,242,234,0.5)",
              animation: "resultPop 0.4s cubic-bezier(0.22,1,0.36,1)",
            }}>
              {isWin ? `🎉 Rs ${parseFloat(result.prize.rewardAmount).toLocaleString()}` : `😔 ${result.prize.label}`}
            </div>
          )}
        </div>

        {/* Open button */}
        {!result && (
          <button onClick={handleOpen} disabled={!canPlay || loading || phase !== "idle"}
            style={{
              marginTop: 24, padding: "14px 0", width: 260, borderRadius: 99, border: "none",
              cursor: canPlay && phase === "idle" ? "pointer" : "default",
              background: canPlay && phase === "idle"
                ? isPremium
                  ? "linear-gradient(90deg, #7c3aed, #a855f7, #7c3aed)"
                  : "linear-gradient(90deg, #059a54, #00C875, #059a54)"
                : "rgba(255,255,255,0.07)",
              color: canPlay && phase === "idle" ? "#fff" : "rgba(245,242,234,0.3)",
              fontSize: 15, fontWeight: 800,
              boxShadow: canPlay && phase === "idle" ? `0 4px 24px ${isPremium ? "rgba(168,85,247,0.4)" : "rgba(0,200,117,0.3)"}` : "none",
            }}>
            {phase === "shaking" || phase === "opening" ? "Opening…"
              : canPlay ? (isPremium ? "✨ Open Premium Box" : "🎁 Open Mystery Box")
              : "Come back tomorrow"}
          </button>
        )}

        {/* No-plan upgrade nudge */}
        {!canPlay && !hasPlan && (
          <div style={{ marginTop: 16, padding: "14px 20px", borderRadius: 16, background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.2)", textAlign: "center", width: "calc(100% - 40px)" }}>
            <div style={{ fontSize: 14, color: "#a855f7", fontWeight: 800, marginBottom: 4 }}>🎁 Free box used!</div>
            <div style={{ fontSize: 12, color: "rgba(245,242,234,0.55)", lineHeight: 1.5 }}>
              Activate a plan to unlock a <strong style={{ color: "#c084fc" }}>Premium Mystery Box</strong> every day — prizes up to <strong style={{ color: "#c084fc" }}>Rs 5,000!</strong>
            </div>
          </div>
        )}

        {/* Result card */}
        {result && (
          <div style={{
            marginTop: 20, padding: "20px 28px", borderRadius: 20, textAlign: "center",
            width: "calc(100% - 40px)",
            background: isWin
              ? `rgba(${isPremium ? "20,5,50" : "5,25,12"},0.95)`
              : "rgba(10,5,20,0.95)",
            border: `2px solid ${isWin ? accentBorder : "rgba(255,255,255,0.1)"}`,
            animation: "resultPop 0.5s cubic-bezier(0.22,1,0.36,1)",
          }}>
            {isWin ? (
              <>
                <div style={{ fontSize: 40, marginBottom: 8 }}>🎉</div>
                <div style={{ fontSize: 30, fontWeight: 900, color: accent, marginBottom: 4 }}>
                  Rs {parseFloat(result.prize.rewardAmount).toLocaleString()}
                </div>
                <div style={{ fontSize: 13, color: "rgba(245,242,234,0.6)" }}>Added to your wallet!</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 36, marginBottom: 8 }}>😔</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#F5F2EA", marginBottom: 4 }}>Better Luck Next Time!</div>
                <div style={{ fontSize: 12, color: "rgba(245,242,234,0.4)" }}>
                  {hasPlan ? "Come back tomorrow for another chance!" : "Get a plan for daily premium boxes!"}
                </div>
              </>
            )}
            {hasPlan && secondsUntilReset > 0 && (
              <div style={{ marginTop: 12, fontSize: 12, color: "rgba(245,242,234,0.4)" }}>
                Next box in <span style={{ fontFamily: "monospace", color: accent, fontWeight: 700 }}>{countdown}</span>
              </div>
            )}
          </div>
        )}

        {/* Prize list */}
        {prizes.length > 0 && (
          <div style={{ width: "calc(100% - 40px)", marginTop: 20, padding: "14px 16px", borderRadius: 16, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: accent, letterSpacing: 2, marginBottom: 10 }}>
              {isPremium ? "PREMIUM REWARDS" : "POSSIBLE REWARDS"}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {prizes.map(p => (
                <div key={p.id} style={{
                  padding: "7px 12px", borderRadius: 10,
                  background: accentDim, border: `1px solid ${accentBorder}`,
                  fontSize: 11, fontWeight: 700,
                  color: parseFloat(p.rewardAmount) > 0 ? accent : "rgba(245,242,234,0.3)",
                }}>
                  {parseFloat(p.rewardAmount) > 0 ? `Rs ${parseFloat(p.rewardAmount).toLocaleString()}` : p.label}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes sparkle {
          0%,100% { opacity:0.15; transform:scale(0.8); }
          50% { opacity:0.8; transform:scale(1.3); }
        }
        @keyframes boxShake {
          0%,100% { transform:translateX(0) rotate(0); }
          15% { transform:translateX(-8px) rotate(-5deg); }
          30% { transform:translateX(8px) rotate(5deg); }
          45% { transform:translateX(-6px) rotate(-3deg); }
          60% { transform:translateX(6px) rotate(3deg); }
          75% { transform:translateX(-3px) rotate(-1deg); }
        }
        @keyframes resultPop {
          from { opacity:0; transform:scale(0.8) translateY(10px); }
          to   { opacity:1; transform:scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}
