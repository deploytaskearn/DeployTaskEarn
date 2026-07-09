"use client";

import { useState, useEffect, useRef } from "react";
import { X, Clock, Ticket } from "lucide-react";
import api from "@/lib/api";
import { SpinSegment, SpinInfo, SpinResult, GoldSpinResult } from "@/lib/types";

// ── Themes ──────────────────────────────────────────────────────────────────
const FREE_THEME = {
  bg: "radial-gradient(ellipse at 50% 30%, #0d3a1a 0%, #04100a 70%)",
  ring: "#ffe066", ringDim: "#c9a227", stroke: "#f5d060",
  border: "#8a6800", inner: "#c9a227",
  centerFill: "#1a5c36", centerIn: "#0d2a1a", centerOut: "#071810",
  star: "#ffe066", pointer: "#ffe066",
  cta: "linear-gradient(90deg,#1a7a40 0%,#00C875 50%,#1a7a40 100%)",
  ctaShadow: "0 4px 24px rgba(0,200,117,0.3)",
  accent: "#00C875",
};
const GOLD_THEME = {
  bg: "radial-gradient(ellipse at 50% 30%, #1e0f00 0%, #0a0500 70%)",
  ring: "#ffd700", ringDim: "#b8860b", stroke: "#ffd700",
  border: "#7a5500", inner: "#c8960c",
  centerFill: "#3a2200", centerIn: "#1e1000", centerOut: "#0f0800",
  star: "#ffd700", pointer: "#ffd700",
  cta: "linear-gradient(90deg,#7a5500 0%,#c8960c 50%,#7a5500 100%)",
  ctaShadow: "0 4px 24px rgba(200,150,12,0.4)",
  accent: "#ffd700",
};

type Theme = typeof FREE_THEME;

function segmentEmoji(seg: SpinSegment): string {
  if (seg.segmentType === "BONUS_SPIN") return "🎡";
  const r = parseFloat(seg.rewardAmount);
  if (r >= 5000) return "💎";
  if (r >= 1000) return "💰";
  if (r >= 300) return "⭐";
  if (r >= 50) return "🪙";
  if (r > 0) return "💎";
  return "↻";
}

function WheelSVG({ segments, rotation, spinning, theme }: {
  segments: SpinSegment[];
  rotation: number;
  spinning: boolean;
  theme: Theme;
}) {
  const N = segments.length || 12;
  const segAngle = 360 / N;
  const cx = 170, cy = 170, R = 148, lightR = R + 15, numLights = 36;

  return (
    <svg width={340} height={340} viewBox="0 0 340 340" style={{
      display: "block",
      transform: `rotate(${rotation}deg)`,
      transition: spinning ? "transform 5s cubic-bezier(0.17,0.67,0.12,0.99)" : "none",
      willChange: "transform",
    }}>
      <circle cx={cx} cy={cy} r={R + 22} fill={theme.centerOut} />
      <circle cx={cx} cy={cy} r={R + 20} fill="none" stroke={theme.border} strokeWidth="3" />
      <circle cx={cx} cy={cy} r={R + 18} fill="none" stroke={theme.stroke} strokeWidth="1" opacity="0.6" />
      <circle cx={cx} cy={cy} r={R + 10} fill="none" stroke={theme.inner} strokeWidth="1.5" />
      {Array.from({ length: numLights }).map((_, i) => {
        const a = (i * (360 / numLights) - 90) * (Math.PI / 180);
        const x = cx + lightR * Math.cos(a), y = cy + lightR * Math.sin(a);
        const bright = i % 3 === 0;
        return (
          <circle key={i} cx={x} cy={y} r={bright ? 4.5 : 3}
            fill={bright ? theme.ring : theme.ringDim}
            style={bright ? { filter: `drop-shadow(0 0 3px ${theme.ring})` } : undefined}
          />
        );
      })}
      {segments.map((seg, i) => {
        const s = (i * segAngle - 90) * (Math.PI / 180);
        const e = ((i + 1) * segAngle - 90) * (Math.PI / 180);
        const x1 = cx + R * Math.cos(s), y1 = cy + R * Math.sin(s);
        const x2 = cx + R * Math.cos(e), y2 = cy + R * Math.sin(e);
        const mid = (i * segAngle + segAngle / 2 - 90) * (Math.PI / 180);
        const tr = R * 0.70;
        const tx = cx + tr * Math.cos(mid), ty = cy + tr * Math.sin(mid);
        const textRot = i * segAngle + segAngle / 2;
        const rAmt = parseFloat(seg.rewardAmount);
        const isBonus = seg.segmentType === "BONUS_SPIN";
        const textColor = (rAmt >= 1000 || isBonus) ? theme.ring : rAmt >= 50 ? "#d4f0c8" : "rgba(245,242,234,0.6)";
        return (
          <g key={seg.id ?? i}>
            <path d={`M ${cx} ${cy} L ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2} Z`} fill={seg.color} stroke={theme.centerOut} strokeWidth="1.5" />
            {(rAmt >= 1000 || isBonus) && (
              <path d={`M ${cx} ${cy} L ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2} Z`} fill="none" stroke={theme.inner} strokeWidth="1" opacity="0.5" />
            )}
            <g transform={`rotate(${textRot},${tx},${ty})`}>
              <text x={tx} y={ty - 11} textAnchor="middle" dominantBaseline="middle" fontSize={isBonus ? 15 : 14}>{segmentEmoji(seg)}</text>
              <text x={tx} y={ty + 7} textAnchor="middle" dominantBaseline="middle"
                fontSize={seg.label.length > 7 ? 9 : 10.5} fontWeight="800" fill={textColor}
                style={{ fontFamily: "system-ui, sans-serif" }}>
                {seg.label}
              </text>
            </g>
          </g>
        );
      })}
      {segments.map((_, i) => {
        const a = (i * segAngle - 90) * (Math.PI / 180);
        return <line key={i} x1={cx} y1={cy} x2={cx + R * Math.cos(a)} y2={cy + R * Math.sin(a)} stroke={theme.centerOut} strokeWidth="2" />;
      })}
      <circle cx={cx} cy={cy} r={52} fill={theme.centerOut} stroke={theme.inner} strokeWidth="3" />
      <circle cx={cx} cy={cy} r={46} fill={theme.centerIn} stroke={theme.ring} strokeWidth="1" opacity="0.5" />
      <circle cx={cx} cy={cy} r={40} fill={theme.centerFill} />
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize="13" fontWeight="900" fill="#fff"
        style={{ fontFamily: "system-ui,sans-serif", letterSpacing: 2 }}>SPIN</text>
    </svg>
  );
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
  return { secs, label: `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}` };
}

export function SpinWheelModal({ onClose, onWin }: { onClose: () => void; onWin: () => void }) {
  const [info, setInfo] = useState<SpinInfo | null>(null);
  const [canSpin, setCanSpin] = useState(false);
  const [secondsUntilSpin, setSecondsUntilSpin] = useState(0);
  const [walletBalance, setWalletBalance] = useState(0);

  // Free spin state
  const [freeSpinning, setFreeSpinning] = useState(false);
  const [freeRotation, setFreeRotation] = useState(0);
  const [freeResult, setFreeResult] = useState<SpinResult | null>(null);
  const prevFreeRot = useRef(0);

  // Gold spin state
  const [goldSpinning, setGoldSpinning] = useState(false);
  const [goldRotation, setGoldRotation] = useState(0);
  const [goldResult, setGoldResult] = useState<GoldSpinResult | null>(null);
  const [goldBuying, setGoldBuying] = useState(false);
  const prevGoldRot = useRef(0);

  // Which wheel is visible
  const [activeWheel, setActiveWheel] = useState<"free" | "gold">("free");

  const [redeemCode, setRedeemCode] = useState("");
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [redeemMsg, setRedeemMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [error, setError] = useState("");

  const freeCountdown = useCountdown(secondsUntilSpin);

  useEffect(() => {
    api.get<SpinInfo>("/spin/info")
      .then(r => {
        setInfo(r.data);
        setCanSpin(r.data.canSpin);
        setSecondsUntilSpin(r.data.secondsUntilSpin ?? 0);
        setWalletBalance(r.data.walletBalance ?? 0);
      })
      .catch(() => setError("Failed to load spin data."));
  }, []);

  const segments = info?.segments ?? [];
  const goldSegments = info?.goldSegments ?? [];
  const goldSpinPrice = info?.goldSpinPrice ?? 100;
  const canAffordGold = walletBalance >= goldSpinPrice;

  const theme = activeWheel === "gold" ? GOLD_THEME : FREE_THEME;
  const currentSegments = activeWheel === "gold" ? goldSegments : segments;
  const currentRotation = activeWheel === "gold" ? goldRotation : freeRotation;
  const isSpinning = activeWheel === "gold" ? goldSpinning : freeSpinning;

  async function handleFreeSpin() {
    if (!canSpin || freeSpinning || goldSpinning) return;
    setFreeSpinning(true);
    setFreeResult(null);
    setError("");
    setActiveWheel("free");
    try {
      const res = await api.post<SpinResult>("/spin/spin");
      const { winnerIndex, totalSegments } = res.data;
      const segAngle = 360 / totalSegments;
      const toWinner = 337.5 - winnerIndex * segAngle;
      const finalRot = prevFreeRot.current + 1800 + toWinner;
      prevFreeRot.current = finalRot;
      setFreeRotation(finalRot);
      setTimeout(() => {
        setFreeResult(res.data);
        setFreeSpinning(false);
        setCanSpin(false);
        setSecondsUntilSpin(res.data.secondsUntilSpin ?? 0);
        if (parseFloat(res.data.winner.rewardAmount) > 0) onWin();
      }, 5200);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Spin failed.";
      setError(msg);
      setFreeSpinning(false);
    }
  }

  async function handleBuyGoldSpin() {
    if (goldBuying || goldSpinning || freeSpinning) return;
    if (!canAffordGold) {
      setError(`You need Rs ${goldSpinPrice} in your wallet. Current balance: Rs ${walletBalance.toFixed(0)}.`);
      return;
    }
    setGoldBuying(true);
    setGoldResult(null);
    setError("");
    setActiveWheel("gold");
    try {
      const res = await api.post<GoldSpinResult>("/spin/buy-gold-spin");
      const { winnerIndex, totalSegments } = res.data;
      setGoldSpinning(true);
      const segAngle = 360 / totalSegments;
      const toWinner = 337.5 - winnerIndex * segAngle;
      const finalRot = prevGoldRot.current + 1800 + toWinner;
      prevGoldRot.current = finalRot;
      setGoldRotation(finalRot);
      setTimeout(() => {
        setGoldResult(res.data);
        setGoldSpinning(false);
        setWalletBalance(res.data.walletBalance ?? 0);
        if (parseFloat(res.data.winner.rewardAmount) > 0) onWin();
        setGoldBuying(false);
      }, 5200);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Gold spin failed.";
      setError(msg);
      setGoldBuying(false);
      setGoldSpinning(false);
      setActiveWheel("free");
    }
  }

  async function handleRedeem(e: React.FormEvent) {
    e.preventDefault();
    if (!redeemCode.trim() || redeemLoading) return;
    setRedeemLoading(true);
    setRedeemMsg(null);
    try {
      const r = await api.post<{ reward: number; message: string }>("/spin/redeem", { code: redeemCode.trim() });
      setRedeemMsg({ ok: true, text: r.data.message });
      setRedeemCode("");
      onWin();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Invalid code.";
      setRedeemMsg({ ok: false, text: msg });
    } finally {
      setRedeemLoading(false);
    }
  }

  const freeReward = freeResult ? parseFloat(freeResult.winner.rewardAmount) : 0;
  const goldReward = goldResult ? parseFloat(goldResult.winner.rewardAmount) : 0;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, background: theme.bg, display: "flex", flexDirection: "column", alignItems: "center", overflowY: "auto", transition: "background 0.5s ease" }}>

      {/* Sparkles */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 0 }}>
        {[8, 15, 5, 30, 20, 40, 60, 10, 12, 25].map((top, i) => (
          <div key={i} style={{
            position: "absolute", top: `${top}%`, left: `${(i * 17 + 5) % 85}%`,
            width: 5 + (i % 4), height: 5 + (i % 4), borderRadius: "50%",
            background: theme.star, opacity: 0.6,
            animation: `sparkle ${2.5 + (i % 3) * 0.4}s ${i * 0.3}s ease-in-out infinite`,
            filter: `drop-shadow(0 0 3px ${theme.star})`,
          }} />
        ))}
      </div>

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", alignItems: "center", paddingBottom: 40 }}>

        {/* Header */}
        <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px 8px" }}>
          <div>
            <div style={{ fontSize: 26, fontWeight: 900, color: "#F5F2EA" }}>
              {activeWheel === "gold" ? "👑 Gold Spin" : "🎡 Lucky Wheel"}
            </div>
            <div style={{ fontSize: 12, color: "rgba(245,242,234,0.5)", marginTop: 2 }}>
              {activeWheel === "gold"
                ? `Win up to Rs 10,000! (Rs ${goldSpinPrice} per spin)`
                : "1 free spin daily — win up to Rs 5,000!"}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 12, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
            <X size={18} color="#F5F2EA" />
          </button>
        </div>

        {/* Tab switcher */}
        <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
          <button onClick={() => setActiveWheel("free")}
            style={{
              padding: "6px 18px", borderRadius: 99, fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer",
              background: activeWheel === "free" ? "#00C875" : "rgba(255,255,255,0.08)",
              color: activeWheel === "free" ? "#000" : "rgba(245,242,234,0.5)",
            }}>
            🎡 Free Spin
          </button>
          <button onClick={() => !goldSpinning && !freeSpinning && setActiveWheel("gold")}
            style={{
              padding: "6px 18px", borderRadius: 99, fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer",
              background: activeWheel === "gold" ? "#ffd700" : "rgba(255,255,255,0.08)",
              color: activeWheel === "gold" ? "#000" : "rgba(245,242,234,0.5)",
            }}>
            👑 Gold Spin
          </button>
        </div>

        {/* Error */}
        {error && (
          <div style={{ marginBottom: 8, padding: "10px 16px", borderRadius: 12, background: "rgba(232,99,58,0.12)", color: "#E8633A", fontSize: 13, textAlign: "center", maxWidth: 320 }}>
            {error}
          </div>
        )}

        {/* Wheel */}
        <div style={{ position: "relative", width: 340, height: 340, marginTop: 4 }}>
          {/* Pointer */}
          <div style={{
            position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)",
            width: 0, height: 0, zIndex: 10,
            borderLeft: "14px solid transparent", borderRight: "14px solid transparent",
            borderTop: `28px solid ${theme.pointer}`,
            filter: `drop-shadow(0 0 8px ${theme.pointer})`,
          }} />
          <WheelSVG segments={currentSegments} rotation={currentRotation} spinning={isSpinning} theme={theme} />
          {activeWheel === "free" && canSpin && !freeSpinning && (
            <button onClick={handleFreeSpin} aria-label="Spin"
              style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 82, height: 82, borderRadius: "50%", background: "transparent", border: "none", cursor: "pointer", zIndex: 5 }} />
          )}
        </div>

        {/* FREE SPIN section */}
        {activeWheel === "free" && (
          <>
            {!freeResult && !freeSpinning && (
              <button onClick={handleFreeSpin} disabled={!canSpin}
                style={{
                  marginTop: 16, padding: "14px 0", width: 280, borderRadius: 99,
                  background: canSpin ? FREE_THEME.cta : "rgba(255,255,255,0.08)",
                  border: "none", cursor: canSpin ? "pointer" : "default",
                  fontSize: 15, fontWeight: 800,
                  color: canSpin ? "#fff" : "rgba(245,242,234,0.35)",
                  boxShadow: canSpin ? FREE_THEME.ctaShadow : "none",
                }}>
                {canSpin ? "🎁 Spin & Win!" : "Come back tomorrow!"}
              </button>
            )}

            {!canSpin && freeCountdown.secs > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, padding: "8px 18px", borderRadius: 99, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <Clock size={14} color="rgba(245,242,234,0.5)" />
                <span style={{ fontSize: 11, color: "rgba(245,242,234,0.5)" }}>Next free spin in</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: "#ffe066", fontFamily: "monospace" }}>{freeCountdown.label}</span>
              </div>
            )}

            {freeResult && (
              <div style={{
                marginTop: 14, padding: "18px 28px", borderRadius: 20, textAlign: "center", maxWidth: 300,
                background: freeReward > 0 ? "rgba(5,25,12,0.95)" : "rgba(5,10,8,0.95)",
                border: `2px solid ${freeReward > 0 ? FREE_THEME.ring : "rgba(255,255,255,0.1)"}`,
                animation: "resultPop 0.5s cubic-bezier(0.22,1,0.36,1)",
              }}>
                {freeReward > 0 ? (
                  <>
                    <div style={{ fontSize: 32, marginBottom: 6 }}>🎉</div>
                    <div style={{ fontSize: 26, fontWeight: 900, color: "#ffe066" }}>Rs {freeReward.toLocaleString()}</div>
                    <div style={{ fontSize: 13, color: "rgba(245,242,234,0.6)", marginTop: 4 }}>Added to your wallet!</div>
                  </>
                ) : freeResult.winner.segmentType === "BONUS_SPIN" ? (
                  <>
                    <div style={{ fontSize: 32, marginBottom: 6 }}>🎡</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "#a0b8ff" }}>+1 Bonus Spin!</div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 28, marginBottom: 6 }}>😔</div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: "#F5F2EA" }}>{freeResult.winner.label}</div>
                    <div style={{ fontSize: 12, color: "rgba(245,242,234,0.4)", marginTop: 4 }}>Better luck next time!</div>
                  </>
                )}
              </div>
            )}
          </>
        )}

        {/* GOLD SPIN section */}
        {activeWheel === "gold" && (
          <>
            {/* Prize preview chips */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", marginTop: 10, maxWidth: 340, padding: "0 20px" }}>
              {goldSegments.filter(s => parseFloat(s.rewardAmount) > 0).slice(0, 6).map(s => (
                <span key={s.id} style={{ padding: "4px 10px", borderRadius: 99, fontSize: 11, fontWeight: 700, background: "rgba(255,215,0,0.12)", color: "#ffd700", border: "1px solid rgba(255,215,0,0.25)" }}>
                  Rs {parseFloat(s.rewardAmount).toLocaleString()}
                </span>
              ))}
            </div>

            {!goldResult && !goldSpinning && (
              <>
                <div style={{ marginTop: 10, fontSize: 12, color: "rgba(245,242,234,0.4)", textAlign: "center" }}>
                  Wallet balance: <span style={{ color: "#ffd700", fontWeight: 700 }}>Rs {walletBalance.toFixed(0)}</span>
                </div>
                <button onClick={handleBuyGoldSpin} disabled={!canAffordGold || goldBuying}
                  style={{
                    marginTop: 10, padding: "14px 0", width: 280, borderRadius: 99,
                    background: canAffordGold ? GOLD_THEME.cta : "rgba(255,255,255,0.08)",
                    border: "none", cursor: canAffordGold ? "pointer" : "default",
                    fontSize: 15, fontWeight: 800,
                    color: canAffordGold ? "#000" : "rgba(245,242,234,0.35)",
                    boxShadow: canAffordGold ? GOLD_THEME.ctaShadow : "none",
                  }}>
                  {goldBuying ? "Spinning…" : `👑 Buy & Spin (Rs ${goldSpinPrice})`}
                </button>
                {!canAffordGold && (
                  <div style={{ marginTop: 8, fontSize: 11, color: "rgba(245,242,234,0.4)", textAlign: "center" }}>
                    Need Rs {goldSpinPrice - walletBalance > 0 ? (goldSpinPrice - walletBalance).toFixed(0) : 0} more. Deposit to unlock.
                  </div>
                )}
              </>
            )}

            {goldResult && (
              <div style={{
                marginTop: 14, padding: "20px 28px", borderRadius: 20, textAlign: "center", maxWidth: 300,
                background: goldReward > 0 ? "rgba(30,15,0,0.95)" : "rgba(10,5,0,0.95)",
                border: `2px solid ${goldReward > 0 ? "#ffd700" : "rgba(255,255,255,0.1)"}`,
                animation: "resultPop 0.5s cubic-bezier(0.22,1,0.36,1)",
              }}>
                {goldReward > 0 ? (
                  <>
                    <div style={{ fontSize: 32, marginBottom: 6 }}>🎉</div>
                    <div style={{ fontSize: 26, fontWeight: 900, color: "#ffd700" }}>Rs {goldReward.toLocaleString()}</div>
                    <div style={{ fontSize: 13, color: "rgba(245,242,234,0.6)", marginTop: 4 }}>Added to your wallet!</div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 28, marginBottom: 6 }}>😔</div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: "#F5F2EA" }}>{goldResult.winner.label}</div>
                    <div style={{ fontSize: 12, color: "rgba(245,242,234,0.4)", marginTop: 4 }}>Better luck next time!</div>
                  </>
                )}
                <button onClick={() => { setGoldResult(null); setWalletBalance(goldResult.walletBalance ?? walletBalance); }}
                  style={{ marginTop: 14, padding: "8px 20px", borderRadius: 99, background: GOLD_THEME.cta, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, color: "#000" }}>
                  Spin Again
                </button>
              </div>
            )}
          </>
        )}

        {/* Redeem code */}
        <div style={{ marginTop: 24, width: "calc(100% - 40px)", maxWidth: 340, padding: "16px 18px", borderRadius: 18, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <Ticket size={14} color={theme.accent} />
            <span style={{ fontSize: 13, fontWeight: 700, color: "#F5F2EA" }}>Redeem Code</span>
          </div>
          {redeemMsg && (
            <div style={{ padding: "9px 12px", borderRadius: 10, marginBottom: 10, fontSize: 12, background: redeemMsg.ok ? "rgba(0,200,117,0.1)" : "rgba(232,99,58,0.1)", color: redeemMsg.ok ? "#00C875" : "#E8633A", border: `1px solid ${redeemMsg.ok ? "rgba(0,200,117,0.3)" : "rgba(232,99,58,0.3)"}` }}>
              {redeemMsg.text}
            </div>
          )}
          <form onSubmit={handleRedeem} style={{ display: "flex", gap: 8 }}>
            <input value={redeemCode} onChange={e => setRedeemCode(e.target.value.toUpperCase())} placeholder="Enter code…"
              style={{ flex: 1, padding: "9px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#F5F2EA", fontSize: 12, outline: "none", fontFamily: "monospace", letterSpacing: 1 }} />
            <button type="submit" disabled={redeemLoading || !redeemCode.trim()}
              style={{ padding: "9px 14px", borderRadius: 10, background: theme.accent, color: "#000", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, opacity: redeemLoading || !redeemCode.trim() ? 0.5 : 1 }}>
              {redeemLoading ? "…" : "Claim"}
            </button>
          </form>
        </div>

      </div>

      <style>{`
        @keyframes sparkle {
          0%,100% { opacity:0.2; transform:scale(0.8); }
          50% { opacity:1; transform:scale(1.2); }
        }
        @keyframes resultPop {
          from { opacity:0; transform:scale(0.8) translateY(10px); }
          to   { opacity:1; transform:scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}
