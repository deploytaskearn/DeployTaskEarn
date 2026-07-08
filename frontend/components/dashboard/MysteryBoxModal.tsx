"use client";

import { useState, useEffect, useRef } from "react";
import { X, Clock } from "lucide-react";
import api from "@/lib/api";

interface Prize {
  id: string;
  label: string;
  rewardAmount: string;
  sortOrder: number;
}

interface MysteryInfo {
  prizes: Prize[];
  dailyLimit: number;
  playsToday: number;
  canPlay: boolean;
  secondsUntilReset: number;
}

interface OpenResult {
  prize: { id: string; label: string; rewardAmount: string };
  playsToday: number;
  playsRemaining: number;
}

const BOX_THEMES = [
  { lid: "#14532d", body: "#166534", ribbon: "#fbbf24", bow: "#fde68a", glow: "#4ade80", label: "Green" },
  { lid: "#1e3a8a", body: "#1d4ed8", ribbon: "#93c5fd", bow: "#bfdbfe", glow: "#60a5fa", label: "Blue" },
  { lid: "#78350f", body: "#b45309", ribbon: "#fbbf24", bow: "#fde68a", glow: "#fbbf24", label: "Gold", highlight: true },
  { lid: "#4c1d95", body: "#6d28d9", ribbon: "#c4b5fd", bow: "#ede9fe", glow: "#c084fc", label: "Purple" },
  { lid: "#7f1d1d", body: "#b91c1c", ribbon: "#fca5a5", bow: "#fee2e2", glow: "#f87171", label: "Red" },
];

function GiftBoxSVG({ theme, phase }: { theme: typeof BOX_THEMES[0]; phase: "idle" | "shaking" | "opening" | "revealed" }) {
  const lidUp = phase === "opening" || phase === "revealed";
  return (
    <svg viewBox="0 0 100 115" width="88" height="101" style={{ display: "block", overflow: "visible" }}>
      {/* Platform glow */}
      <ellipse cx="50" cy="112" rx="42" ry="9" fill={theme.glow} opacity="0.25" />
      <ellipse cx="50" cy="112" rx="34" ry="6" fill={theme.glow} opacity="0.2" />

      {/* Box body */}
      <rect x="8" y="50" width="84" height="58" rx="6" fill={theme.body} />
      {/* Body top shadow */}
      <rect x="8" y="50" width="84" height="12" rx="6" fill="black" opacity="0.2" />
      {/* Body shine */}
      <rect x="14" y="56" width="22" height="8" rx="3" fill="white" opacity="0.1" />

      {/* Ribbon vertical on body */}
      <rect x="42" y="50" width="16" height="58" fill={theme.ribbon} opacity="0.85" rx="2" />
      {/* Ribbon horizontal on body */}
      <rect x="8" y="65" width="84" height="16" fill={theme.ribbon} opacity="0.85" rx="2" />

      {/* Lid group */}
      <g style={{ transform: lidUp ? "translateY(-32px) rotate(-10deg)" : "translateY(0)", transformOrigin: "50px 36px", transition: lidUp ? "transform 0.4s cubic-bezier(0.34,1.56,0.64,1)" : "none" }}>
        {/* Lid shape */}
        <rect x="2" y="26" width="96" height="28" rx="6" fill={theme.lid} />
        {/* Lid top face */}
        <rect x="6" y="22" width="88" height="10" rx="4" fill={theme.lid} />
        {/* Lid shine */}
        <rect x="10" y="30" width="28" height="9" rx="3" fill="white" opacity="0.12" />
        {/* Lid shadow bottom */}
        <rect x="2" y="46" width="96" height="8" rx="3" fill="black" opacity="0.15" />

        {/* Ribbon on lid horizontal */}
        <rect x="2" y="32" width="96" height="14" fill={theme.ribbon} opacity="0.85" rx="2" />
        {/* Ribbon on lid vertical */}
        <rect x="42" y="22" width="16" height="32" fill={theme.ribbon} opacity="0.85" rx="2" />

        {/* Bow left loop */}
        <ellipse cx="28" cy="14" rx="24" ry="13" fill={theme.bow} transform="rotate(-18 28 14)" />
        <ellipse cx="28" cy="14" rx="16" ry="9" fill={theme.lid} opacity="0.3" transform="rotate(-18 28 14)" />
        {/* Bow right loop */}
        <ellipse cx="72" cy="14" rx="24" ry="13" fill={theme.bow} transform="rotate(18 72 14)" />
        <ellipse cx="72" cy="14" rx="16" ry="9" fill={theme.lid} opacity="0.3" transform="rotate(18 72 14)" />
        {/* Bow center */}
        <circle cx="50" cy="22" r="11" fill={theme.ribbon} />
        <circle cx="50" cy="22" r="7" fill={theme.bow} />
        <circle cx="50" cy="22" r="3" fill={theme.ribbon} />
      </g>
    </svg>
  );
}

function useCountdown(initial: number) {
  const [secs, setSecs] = useState(initial);
  useEffect(() => {
    if (secs <= 0) return;
    const t = setInterval(() => setSecs(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function MysteryBoxModal({ onClose, onWin }: { onClose: () => void; onWin: () => void }) {
  const [info, setInfo] = useState<MysteryInfo | null>(null);
  const [playsToday, setPlaysToday] = useState(0);
  const [playsRemaining, setPlaysRemaining] = useState(0);
  const [selectedBox, setSelectedBox] = useState<number | null>(null);
  const [phase, setPhase] = useState<"idle" | "shaking" | "opening" | "revealed">("idle");
  const [result, setResult] = useState<OpenResult | null>(null);
  const [error, setError] = useState("");
  const resultRef = useRef<OpenResult | null>(null);
  const countdown = useCountdown(info?.secondsUntilReset ?? 0);

  useEffect(() => {
    api.get<MysteryInfo>("/mystery/info")
      .then(r => {
        setInfo(r.data);
        setPlaysToday(r.data.playsToday);
        setPlaysRemaining(r.data.dailyLimit - r.data.playsToday);
      })
      .catch(() => setError("Failed to load game data."));
  }, []);

  const dailyLimit = info?.dailyLimit ?? 5;
  const canPlay = playsToday < dailyLimit;

  async function handleBoxClick(boxIdx: number) {
    if (!canPlay || selectedBox !== null) return;
    setSelectedBox(boxIdx);
    setPhase("shaking");
    setError("");

    try {
      const res = await api.post<OpenResult>("/mystery/open");
      resultRef.current = res.data;
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to open box.";
      setError(msg);
      setSelectedBox(null);
      setPhase("idle");
      return;
    }

    setTimeout(() => setPhase("opening"), 600);
    setTimeout(() => {
      const r = resultRef.current!;
      setResult(r);
      setPlaysToday(r.playsToday);
      setPlaysRemaining(r.playsRemaining);
      setPhase("revealed");
      if (parseFloat(r.prize.rewardAmount) > 0) onWin();
    }, 1400);
  }

  function handlePlayAgain() {
    setSelectedBox(null);
    setPhase("idle");
    setResult(null);
    resultRef.current = null;
  }

  const prizes = info?.prizes ?? [];
  const isWin = result ? parseFloat(result.prize.rewardAmount) > 0 : false;

  // confetti colors
  const confettiColors = ["#fbbf24", "#f472b6", "#60a5fa", "#4ade80", "#f87171", "#c084fc"];

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100, overflow: "auto",
      background: "radial-gradient(ellipse at 50% 0%, #1e0a4a 0%, #0d0520 50%, #050210 100%)",
    }}>
      {/* Confetti particles */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 0 }}>
        {Array.from({ length: 18 }).map((_, i) => {
          const color = confettiColors[i % confettiColors.length];
          const size = 4 + (i % 4);
          const shape = i % 3 === 0 ? "50%" : i % 3 === 1 ? "2px" : "0%";
          return (
            <div key={i} style={{
              position: "absolute",
              left: `${(i * 17 + 5) % 95}%`,
              top: `${(i * 23 + 10) % 85}%`,
              width: size, height: size * (i % 2 === 0 ? 2 : 1),
              background: color, borderRadius: shape,
              opacity: 0.6,
              animation: `confettiFall ${2 + (i % 3)}s ${i * 0.2}s ease-in-out infinite alternate`,
            }} />
          );
        })}
      </div>

      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", minHeight: "100%", paddingBottom: 32 }}>

        {/* Top bar */}
        <div style={{ width: "100%", maxWidth: 480, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px 0" }}>
          {/* Balance-like: plays counter */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 12, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}>
            <span style={{ fontSize: 18 }}>🎁</span>
            <div>
              <div style={{ fontSize: 10, color: "rgba(245,242,234,0.5)", lineHeight: 1 }}>Daily Chances</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#fbbf24", lineHeight: 1.2 }}>{playsToday} / {dailyLimit}</div>
            </div>
          </div>

          {/* Countdown */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 12, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}>
            <Clock size={16} color="rgba(245,242,234,0.5)" />
            <div>
              <div style={{ fontSize: 10, color: "rgba(245,242,234,0.5)", lineHeight: 1 }}>Resets in</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#F5F2EA", lineHeight: 1.2, fontFamily: "var(--font-mono, monospace)" }}>{countdown}</div>
            </div>
          </div>

          {/* Close */}
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 12, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
            <X size={18} color="#F5F2EA" />
          </button>
        </div>

        {/* Title */}
        <div style={{ textAlign: "center", marginTop: 18, marginBottom: 4 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 36, fontWeight: 900, lineHeight: 1, background: "linear-gradient(180deg, #fde68a 0%, #fbbf24 60%, #f59e0b 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", filter: "drop-shadow(0 2px 8px rgba(251,191,36,0.4))" }}>
            MYSTERY
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 44, fontWeight: 900, lineHeight: 1, color: "#F5F2EA", filter: "drop-shadow(0 2px 12px rgba(255,255,255,0.2))" }}>
            BOX
          </div>
          {/* Stars */}
          <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 4 }}>
            <span style={{ fontSize: 20 }}>⭐</span>
            <span style={{ fontSize: 16, color: "rgba(245,242,234,0.3)" }}>·</span>
            <span style={{ fontSize: 20 }}>⭐</span>
          </div>
        </div>

        {/* Subtitle banner */}
        <div style={{ margin: "12px 0 8px", padding: "8px 24px", borderRadius: 99, background: "linear-gradient(90deg, #7c3aed, #a855f7)", fontSize: 12, fontWeight: 800, color: "#fff", letterSpacing: 1.5, textAlign: "center" }}>
          CHOOSE A BOX &amp; WIN EXCITING REWARDS
        </div>

        {/* Error */}
        {error && (
          <div style={{ margin: "8px 20px", padding: "10px 16px", borderRadius: 12, background: "rgba(232,99,58,0.12)", color: "#E8633A", fontSize: 13, textAlign: "center" }}>
            {error}
          </div>
        )}

        {/* No more plays */}
        {!canPlay && !result && (
          <div style={{ margin: "8px 20px", padding: "12px 20px", borderRadius: 14, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)", color: "#fbbf24", fontSize: 13, textAlign: "center", fontWeight: 600 }}>
            🎁 All chances used! Come back tomorrow.
          </div>
        )}

        {/* Gift boxes */}
        <div style={{ display: "flex", gap: 10, padding: "8px 16px", overflowX: "auto", width: "100%", maxWidth: 480, justifyContent: "center", flexWrap: "nowrap" }}>
          {BOX_THEMES.map((theme, i) => {
            const isSelected = selectedBox === i;
            const isOther = selectedBox !== null && !isSelected;
            const boxPhase = isSelected ? phase : "idle";

            return (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, flexShrink: 0 }}>
                {/* Prize reveal above box */}
                <div style={{
                  height: 36, display: "flex", alignItems: "center", justifyContent: "center",
                  opacity: isSelected && phase === "revealed" ? 1 : 0,
                  transform: isSelected && phase === "revealed" ? "scale(1) translateY(0)" : "scale(0.5) translateY(8px)",
                  transition: "all 0.4s cubic-bezier(0.22,1,0.36,1)",
                }}>
                  {result && isSelected && (
                    <div style={{
                      padding: "4px 12px", borderRadius: 99,
                      background: isWin ? "rgba(251,191,36,0.2)" : "rgba(255,255,255,0.1)",
                      border: `1px solid ${isWin ? "rgba(251,191,36,0.5)" : "rgba(255,255,255,0.15)"}`,
                      fontSize: 13, fontWeight: 800,
                      color: isWin ? "#fbbf24" : "rgba(245,242,234,0.6)",
                      whiteSpace: "nowrap",
                    }}>
                      {isWin ? `+Rs ${parseFloat(result.prize.rewardAmount).toLocaleString()}` : result.prize.label}
                    </div>
                  )}
                </div>

                {/* Box */}
                <div
                  onClick={() => handleBoxClick(i)}
                  style={{
                    cursor: canPlay && selectedBox === null ? "pointer" : "default",
                    opacity: isOther ? 0.35 : 1,
                    transition: "opacity 0.3s ease, transform 0.15s ease",
                    transform: isOther ? "scale(0.88)" : isSelected && (phase === "opening" || phase === "revealed") ? "scale(1.08)" : "scale(1)",
                    filter: isSelected ? `drop-shadow(0 0 16px ${theme.glow}) drop-shadow(0 0 32px ${theme.glow}40)` : theme.highlight ? `drop-shadow(0 0 12px ${theme.glow}60)` : `drop-shadow(0 0 6px ${theme.glow}30)`,
                    animation: isSelected && phase === "shaking" ? "boxShake 0.5s ease" : "none",
                  }}
                >
                  <GiftBoxSVG theme={theme} phase={boxPhase} />
                </div>

                {/* Choose button */}
                <button
                  onClick={() => handleBoxClick(i)}
                  disabled={!canPlay || selectedBox !== null}
                  style={{
                    padding: "8px 14px", borderRadius: 10, border: "none",
                    background: canPlay && selectedBox === null
                      ? `linear-gradient(135deg, ${theme.glow}cc, ${theme.glow})`
                      : "rgba(255,255,255,0.08)",
                    color: canPlay && selectedBox === null ? "#000" : "rgba(245,242,234,0.3)",
                    fontSize: 11, fontWeight: 800, cursor: canPlay && selectedBox === null ? "pointer" : "default",
                    letterSpacing: 1, minWidth: 72,
                    boxShadow: canPlay && selectedBox === null ? `0 4px 12px ${theme.glow}50` : "none",
                    transition: "all 0.2s ease",
                  }}
                >
                  CHOOSE
                </button>
              </div>
            );
          })}
        </div>

        {/* Result card */}
        {result && (
          <div style={{
            margin: "8px 20px", padding: "16px 24px", borderRadius: 20, textAlign: "center",
            background: isWin ? "rgba(20,5,50,0.95)" : "rgba(10,5,30,0.95)",
            border: `2px solid ${isWin ? "#fbbf24" : "rgba(255,255,255,0.1)"}`,
            boxShadow: isWin ? "0 0 40px rgba(251,191,36,0.2)" : "none",
            animation: "resultPop 0.5s cubic-bezier(0.22,1,0.36,1)",
            maxWidth: 340,
          }}>
            {isWin ? (
              <>
                <div style={{ fontSize: 28, marginBottom: 6 }}>🎉</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: "#fbbf24", marginBottom: 4 }}>
                  Rs {parseFloat(result.prize.rewardAmount).toLocaleString()}
                </div>
                <div style={{ fontSize: 13, color: "rgba(245,242,234,0.6)", marginBottom: 4 }}>Added to your wallet!</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 26, marginBottom: 6 }}>😔</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#F5F2EA", marginBottom: 4 }}>Better Luck Next Time!</div>
              </>
            )}
            <div style={{ fontSize: 11, color: "rgba(245,242,234,0.35)", marginBottom: playsRemaining > 0 ? 12 : 0 }}>
              {playsRemaining} chance{playsRemaining !== 1 ? "s" : ""} remaining today
            </div>
            {playsRemaining > 0 && (
              <button onClick={handlePlayAgain} style={{
                padding: "9px 24px", borderRadius: 99, border: "none", cursor: "pointer",
                background: "linear-gradient(90deg, #7c3aed, #a855f7)",
                color: "#fff", fontSize: 13, fontWeight: 800,
              }}>
                Open Another Box!
              </button>
            )}
          </div>
        )}

        {/* Bottom section */}
        <div style={{ width: "100%", maxWidth: 480, padding: "0 16px", marginTop: 8, display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Possible rewards */}
          <div style={{ padding: "14px 16px", borderRadius: 16, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#a855f7" }} />
              <span style={{ fontSize: 11, fontWeight: 800, color: "#a855f7", letterSpacing: 2 }}>POSSIBLE REWARDS</span>
              <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#a855f7" }} />
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {prizes.map(p => (
                <div key={p.id} style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                  padding: "10px 12px", borderRadius: 12,
                  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
                  minWidth: 60,
                }}>
                  <span style={{ fontSize: 20 }}>{parseFloat(p.rewardAmount) > 0 ? "🪙" : "🎁"}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: parseFloat(p.rewardAmount) > 0 ? "#fbbf24" : "rgba(245,242,234,0.4)", textAlign: "center", lineHeight: 1.2 }}>
                    {parseFloat(p.rewardAmount) > 0 ? `Rs ${parseFloat(p.rewardAmount).toLocaleString()}` : p.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* How to play */}
          <div style={{ padding: "14px 16px", borderRadius: 16, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#a855f7", letterSpacing: 2, marginBottom: 10 }}>HOW TO PLAY</div>
            {[
              "Click on any box to select it.",
              "One box contains a surprise reward.",
              "Win cash instantly to your balance.",
            ].map((step, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: i < 2 ? 8 : 0 }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#7c3aed", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 11, fontWeight: 800, color: "#fff" }}>
                  {i + 1}
                </div>
                <span style={{ fontSize: 12, color: "rgba(245,242,234,0.6)", lineHeight: 1.5 }}>{step}</span>
              </div>
            ))}
          </div>

          {/* Fair game banner */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "12px", borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <span style={{ fontSize: 18 }}>🛡️</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#4ade80" }}>100% FAIR GAME</div>
              <div style={{ fontSize: 11, color: "rgba(245,242,234,0.4)" }}>Every Box has an Equal Chance to Win!</div>
            </div>
          </div>
        </div>

      </div>

      <style>{`
        @keyframes boxShake {
          0%, 100% { transform: translateX(0) rotate(0deg); }
          15% { transform: translateX(-6px) rotate(-4deg); }
          30% { transform: translateX(6px) rotate(4deg); }
          45% { transform: translateX(-5px) rotate(-3deg); }
          60% { transform: translateX(5px) rotate(3deg); }
          75% { transform: translateX(-3px) rotate(-2deg); }
        }
        @keyframes confettiFall {
          from { transform: translateY(-8px) rotate(-10deg); opacity: 0.4; }
          to   { transform: translateY(8px) rotate(10deg); opacity: 0.8; }
        }
        @keyframes resultPop {
          from { opacity: 0; transform: scale(0.8) translateY(12px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}
