"use client";

import { useState, useEffect, useRef } from "react";
import { X, Ticket } from "lucide-react";
import api from "@/lib/api";
import { SpinSegment, SpinInfo } from "@/lib/types";

type Tier = "normal" | "silver" | "gold";

interface SpinResult {
  winner: { id: string; label: string; rewardAmount: string; segmentType: string };
  winnerIndex: number;
  totalSegments: number;
  extraSpinsRemaining: number;
  spinsRemaining: number;
  tier: Tier;
}

interface Props {
  onClose: () => void;
  onWin: () => void;
}

const TIER_THEME = {
  normal: {
    bg:         "radial-gradient(ellipse at 50% 30%, #0d3a1a 0%, #04100a 70%)",
    ringBright: "#ffe066",
    ringDim:    "#c9a227",
    ringStroke: "#f5d060",
    borderRing: "#8a6800",
    innerRing:  "#c9a227",
    centerFill: "#1a5c36",
    centerInner:"#0d2a1a",
    centerOuter:"#071810",
    starColor:  "#ffe066",
    ctaBg:      "linear-gradient(90deg,#1a7a40 0%,#00C875 50%,#1a7a40 100%)",
    ctaShadow:  "0 4px 24px rgba(0,200,117,0.3)",
    badgeBg:    null,
    badgeColor: null,
    badgeText:  null,
    spinLabel:  "#00C875",
    pointerColor: "#ffe066",
  },
  silver: {
    bg:         "radial-gradient(ellipse at 50% 30%, #12162a 0%, #070914 70%)",
    ringBright: "#e0e0f0",
    ringDim:    "#9090b0",
    ringStroke: "#c8c8e0",
    borderRing: "#505080",
    innerRing:  "#8080a0",
    centerFill: "#1c1f3a",
    centerInner:"#0f1228",
    centerOuter:"#080a18",
    starColor:  "#b0b0d0",
    ctaBg:      "linear-gradient(90deg,#22265a 0%,#4a4eaa 50%,#22265a 100%)",
    ctaShadow:  "0 4px 24px rgba(80,80,200,0.3)",
    badgeBg:    "linear-gradient(135deg,#8080a0,#c8c8e0,#8080a0)",
    badgeColor: "#050820",
    badgeText:  "⚪ SILVER",
    spinLabel:  "#c8c8e0",
    pointerColor: "#c8c8e0",
  },
  gold: {
    bg:         "radial-gradient(ellipse at 50% 30%, #1e0f00 0%, #0a0500 70%)",
    ringBright: "#ffd700",
    ringDim:    "#b8860b",
    ringStroke: "#ffd700",
    borderRing: "#7a5500",
    innerRing:  "#c8960c",
    centerFill: "#3a2200",
    centerInner:"#1e1000",
    centerOuter:"#0f0800",
    starColor:  "#ffd700",
    ctaBg:      "linear-gradient(90deg,#7a5500 0%,#c8960c 50%,#7a5500 100%)",
    ctaShadow:  "0 4px 24px rgba(200,150,12,0.4)",
    badgeBg:    "linear-gradient(135deg,#b8860b,#ffd700,#b8860b)",
    badgeColor: "#0f0800",
    badgeText:  "👑 GOLD",
    spinLabel:  "#ffd700",
    pointerColor: "#ffd700",
  },
};

function segmentEmoji(seg: SpinSegment): string {
  if (seg.segmentType === "BONUS_SPIN") return "🎡";
  const r = parseFloat(seg.rewardAmount);
  if (r >= 1000) return "💰";
  if (r >= 300) return "⭐";
  if (r >= 50) return "🪙";
  if (r > 0) return "💎";
  const l = seg.label.toLowerCase();
  if (l.includes("sorry")) return "😔";
  if (l.includes("luck")) return "🍀";
  return "↻";
}

function WheelSVG({
  segments, rotation, spinning, theme,
}: {
  segments: SpinSegment[];
  rotation: number;
  spinning: boolean;
  theme: typeof TIER_THEME["normal"];
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
      <circle cx={cx} cy={cy} r={R + 22} fill={theme.centerOuter} />
      <circle cx={cx} cy={cy} r={R + 20} fill="none" stroke={theme.borderRing} strokeWidth="3" />
      <circle cx={cx} cy={cy} r={R + 18} fill="none" stroke={theme.ringStroke} strokeWidth="1" opacity="0.6" />
      <circle cx={cx} cy={cy} r={R + 10} fill="none" stroke={theme.innerRing} strokeWidth="1.5" />

      {/* Ring lights */}
      {Array.from({ length: numLights }).map((_, i) => {
        const angle = (i * (360 / numLights) - 90) * (Math.PI / 180);
        const x = cx + lightR * Math.cos(angle);
        const y = cy + lightR * Math.sin(angle);
        const bright = i % 3 === 0;
        return (
          <circle key={i} cx={x} cy={y} r={bright ? 4.5 : 3}
            fill={bright ? theme.ringBright : theme.ringDim}
            style={bright ? { filter: `drop-shadow(0 0 3px ${theme.ringBright})` } : undefined}
          />
        );
      })}

      {segments.map((seg, i) => {
        const startAngle = (i * segAngle - 90) * (Math.PI / 180);
        const endAngle   = ((i + 1) * segAngle - 90) * (Math.PI / 180);
        const x1 = cx + R * Math.cos(startAngle), y1 = cy + R * Math.sin(startAngle);
        const x2 = cx + R * Math.cos(endAngle),   y2 = cy + R * Math.sin(endAngle);
        const midAngle = (i * segAngle + segAngle / 2 - 90) * (Math.PI / 180);
        const textR = R * 0.60;
        const tx = cx + textR * Math.cos(midAngle), ty = cy + textR * Math.sin(midAngle);
        const textRot = i * segAngle + segAngle / 2;
        const rewardAmt = parseFloat(seg.rewardAmount);
        const isBonus = seg.segmentType === "BONUS_SPIN";
        const isJackpot = rewardAmt >= 1000;
        const isMedium = rewardAmt >= 50 && rewardAmt < 1000;
        const isNoPrize = rewardAmt === 0 && !isBonus;
        const textColor = isJackpot || isBonus ? theme.ringBright : isMedium ? "#d4f0c8" : isNoPrize ? "rgba(245,242,234,0.5)" : "#f0f0f0";
        const emoji = segmentEmoji(seg);

        return (
          <g key={seg.id ?? i}>
            <path d={`M ${cx} ${cy} L ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2} Z`} fill={seg.color} stroke={theme.centerOuter} strokeWidth="1.5" />
            {(isJackpot || isBonus) && (
              <path d={`M ${cx} ${cy} L ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2} Z`} fill="none" stroke={theme.innerRing} strokeWidth="1" opacity="0.5" />
            )}
            <g transform={`rotate(${textRot},${tx},${ty})`}>
              <text x={tx} y={ty - 9} textAnchor="middle" dominantBaseline="middle" fontSize={isBonus ? 14 : 13}>{emoji}</text>
              <text x={tx} y={ty + 5} textAnchor="middle" dominantBaseline="middle"
                fontSize={seg.label.length > 7 ? 7.5 : 8.5} fontWeight="800" fill={textColor}
                style={{ fontFamily: "system-ui, sans-serif" }}>
                {seg.label}
              </text>
            </g>
          </g>
        );
      })}

      {segments.map((_, i) => {
        const angle = (i * segAngle - 90) * (Math.PI / 180);
        return <line key={i} x1={cx} y1={cy} x2={cx + R * Math.cos(angle)} y2={cy + R * Math.sin(angle)} stroke={theme.centerOuter} strokeWidth="2" />;
      })}

      {/* Center cap */}
      <circle cx={cx} cy={cy} r={52} fill={theme.centerOuter} stroke={theme.innerRing} strokeWidth="3" />
      <circle cx={cx} cy={cy} r={46} fill={theme.centerInner} stroke={theme.ringBright} strokeWidth="1" opacity="0.5" />
      <circle cx={cx} cy={cy} r={40} fill={theme.centerFill} />
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle"
        fontSize="13" fontWeight="900" fill="#fff"
        style={{ fontFamily: "system-ui,sans-serif", letterSpacing: 2 }}>
        SPIN
      </text>
    </svg>
  );
}

export function SpinWheelModal({ onClose, onWin }: Props) {
  const [info, setInfo] = useState<SpinInfo | null>(null);
  const [extraSpins, setExtraSpins] = useState(0);
  const [spinsRemaining, setSpinsRemaining] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [redeemCode, setRedeemCode] = useState("");
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [redeemMsg, setRedeemMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [error, setError] = useState("");
  const [canSpin, setCanSpin] = useState(false);
  const prevRotRef = useRef(0);

  function loadInfo() {
    api.get<SpinInfo>("/spin/info")
      .then(r => {
        setInfo(r.data);
        setCanSpin(r.data.canSpin);
        setExtraSpins(r.data.extraSpins);
        setSpinsRemaining(r.data.spinsRemaining);
      })
      .catch(() => setError("Failed to load spin data."));
  }
  useEffect(() => { loadInfo(); }, []);

  const tier: Tier = info?.tier ?? "normal";
  const theme = TIER_THEME[tier];
  const dailyLimit = info?.dailyLimit ?? 1;
  const multiplier = info?.multiplier ?? 1;
  const segments = info?.segments ?? [];

  async function handleSpin() {
    if (!canSpin || spinning) return;
    setSpinning(true);
    setError("");
    setResult(null);
    try {
      const res = await api.post<SpinResult>("/spin/spin");
      const { winnerIndex, totalSegments, extraSpinsRemaining, spinsRemaining: sr } = res.data;
      const segAngle = 360 / totalSegments;
      const toWinner = 337.5 - winnerIndex * segAngle;
      const finalRot = prevRotRef.current + 1800 + toWinner;
      prevRotRef.current = finalRot;
      setRotation(finalRot);
      setTimeout(() => {
        setResult(res.data);
        setSpinning(false);
        setExtraSpins(extraSpinsRemaining);
        setSpinsRemaining(sr);
        setCanSpin(sr > 0 || extraSpinsRemaining > 0);
        if (parseFloat(res.data.winner.rewardAmount) > 0) onWin();
      }, 5200);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Spin failed.";
      setError(msg);
      setSpinning(false);
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

  const reward = result ? parseFloat(result.winner.rewardAmount) : 0;
  const isWin = reward > 0;
  const isBonusSpin = result?.winner.segmentType === "BONUS_SPIN";

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: theme.bg,
      display: "flex", flexDirection: "column", alignItems: "center",
      overflowY: "auto",
      transition: "background 0.5s ease",
    }}>
      {/* Sparkle particles */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 0 }}>
        {[
          { top: "8%",  left: "12%",  size: 6, delay: 0 },
          { top: "15%", right: "10%", size: 8, delay: 0.5 },
          { top: "5%",  left: "55%",  size: 5, delay: 1 },
          { bottom: "30%", left: "5%", size: 7, delay: 1.5 },
          { bottom: "20%", right: "8%", size: 6, delay: 0.8 },
          { top: "40%", left: "3%",   size: 5, delay: 2 },
          { top: "60%", right: "4%",  size: 7, delay: 0.3 },
          { bottom: "10%", left: "20%", size: 5, delay: 1.2 },
          { bottom: "12%", right: "25%", size: 6, delay: 0.7 },
          { top: "25%", left: "80%",  size: 4, delay: 1.8 },
        ].map((s, i) => (
          <div key={i} style={{
            position: "absolute", ...s,
            width: s.size, height: s.size,
            background: theme.starColor, borderRadius: "50%",
            animation: `sparkle 2.5s ${s.delay}s ease-in-out infinite`,
            filter: `drop-shadow(0 0 3px ${theme.starColor})`,
          }} />
        ))}
      </div>

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", alignItems: "center", paddingBottom: 40 }}>

        {/* Header */}
        <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px 8px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 800, color: "#F5F2EA", lineHeight: 1.1 }}>
                Lucky Wheel
              </span>
              {/* Tier badge */}
              {theme.badgeText && (
                <span style={{
                  padding: "3px 12px", borderRadius: 99, fontSize: 11, fontWeight: 900,
                  background: theme.badgeBg ?? "transparent",
                  color: theme.badgeColor ?? "#fff",
                  letterSpacing: 1.5,
                  boxShadow: `0 2px 8px ${theme.ringBright}60`,
                }}>
                  {theme.badgeText}
                </span>
              )}
            </div>
            <div style={{ fontSize: 12, color: "rgba(245,242,234,0.5)", marginTop: 2 }}>
              {dailyLimit} free spin{dailyLimit > 1 ? "s" : ""}/day · up to{" "}
              <span style={{ color: theme.ringBright, fontWeight: 700 }}>
                Rs {(5000 * multiplier).toLocaleString()}!
              </span>
              {multiplier > 1 && (
                <span style={{ marginLeft: 6, padding: "1px 7px", borderRadius: 99, background: `${theme.ringBright}22`, color: theme.ringBright, fontSize: 10, fontWeight: 800 }}>
                  {multiplier}x REWARDS
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 12, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
            <X size={18} color="#F5F2EA" />
          </button>
        </div>

        {/* Spins counter */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          {Array.from({ length: dailyLimit }).map((_, i) => (
            <div key={i} style={{
              width: 10, height: 10, borderRadius: "50%",
              background: i < (dailyLimit - spinsRemaining) ? "rgba(255,255,255,0.15)" : theme.ringBright,
              boxShadow: i < (dailyLimit - spinsRemaining) ? "none" : `0 0 6px ${theme.ringBright}`,
              transition: "all 0.3s ease",
            }} />
          ))}
          <span style={{ fontSize: 11, color: "rgba(245,242,234,0.4)", marginLeft: 4 }}>
            {spinsRemaining} spin{spinsRemaining !== 1 ? "s" : ""} left today
          </span>
        </div>

        {/* Bonus spins badge */}
        {extraSpins > 0 && (
          <div style={{ marginBottom: 8, padding: "6px 16px", borderRadius: 99, background: "rgba(68,102,255,0.15)", border: "1px solid rgba(68,102,255,0.3)", fontSize: 12, color: "#a0b8ff", fontWeight: 700 }}>
            🎡 {extraSpins} bonus spin{extraSpins > 1 ? "s" : ""} available!
          </div>
        )}

        {/* Wheel */}
        <div style={{ position: "relative", width: 340, height: 340, marginTop: 8 }}>
          {/* Pointer */}
          <div style={{
            position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)",
            width: 0, height: 0, zIndex: 10,
            borderLeft: "14px solid transparent",
            borderRight: "14px solid transparent",
            borderTop: `28px solid ${theme.pointerColor}`,
            filter: `drop-shadow(0 0 8px ${theme.pointerColor})`,
          }} />
          <WheelSVG segments={segments} rotation={rotation} spinning={spinning} theme={theme} />
          {canSpin && !spinning && (
            <button onClick={handleSpin} aria-label="Spin"
              style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 82, height: 82, borderRadius: "50%", background: "transparent", border: "none", cursor: "pointer", zIndex: 5 }} />
          )}
        </div>

        {/* Error */}
        {error && (
          <div style={{ marginTop: 12, padding: "10px 16px", borderRadius: 12, background: "rgba(232,99,58,0.12)", color: "#E8633A", fontSize: 13, textAlign: "center", maxWidth: 300 }}>
            {error}
          </div>
        )}

        {/* Result */}
        {result && (
          <div style={{
            marginTop: 16, padding: "18px 28px", borderRadius: 20, textAlign: "center", maxWidth: 300,
            background: isBonusSpin ? "rgba(13,21,48,0.95)" : isWin ? `${theme.centerOuter}f0` : "rgba(5,15,10,0.95)",
            border: `2px solid ${isBonusSpin ? "#4466ff" : isWin ? theme.ringBright : "rgba(255,255,255,0.1)"}`,
            boxShadow: isWin ? `0 0 30px ${theme.ringBright}30` : isBonusSpin ? "0 0 20px rgba(68,102,255,0.2)" : "none",
            animation: "resultPop 0.5s cubic-bezier(0.22,1,0.36,1)",
          }}>
            {isBonusSpin ? (
              <>
                <div style={{ fontSize: 32, marginBottom: 6 }}>🎡</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#a0b8ff", marginBottom: 4 }}>+1 Bonus Spin!</div>
                <div style={{ fontSize: 13, color: "rgba(160,184,255,0.7)" }}>Spin again right now!</div>
              </>
            ) : isWin ? (
              <>
                <div style={{ fontSize: 32, marginBottom: 6 }}>🎉</div>
                <div style={{ fontSize: 26, fontWeight: 900, color: theme.ringBright, marginBottom: 4 }}>
                  Rs {reward.toLocaleString()}
                </div>
                {multiplier > 1 && (
                  <div style={{ fontSize: 11, color: theme.ringDim, marginBottom: 4 }}>
                    {multiplier}x reward applied!
                  </div>
                )}
                <div style={{ fontSize: 13, color: "rgba(245,242,234,0.7)" }}>Added to your wallet!</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 28, marginBottom: 6 }}>😔</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: "#F5F2EA", marginBottom: 4 }}>{result.winner.label}</div>
                <div style={{ fontSize: 12, color: "rgba(245,242,234,0.4)" }}>Better luck next time!</div>
              </>
            )}
            {canSpin && (
              <button onClick={handleSpin} style={{
                marginTop: 14, padding: "10px 28px", borderRadius: 99,
                background: theme.ctaBg, border: "none", cursor: "pointer",
                fontSize: 13, fontWeight: 800, color: "#fff",
                boxShadow: theme.ctaShadow,
              }}>
                Spin Again! ({extraSpins > 0 ? `${extraSpins} bonus` : `${spinsRemaining} left`})
              </button>
            )}
          </div>
        )}

        {/* CTA */}
        {!result && (
          <button onClick={handleSpin} disabled={!canSpin || spinning}
            style={{
              marginTop: 20, padding: "14px 0", width: 280, borderRadius: 99,
              background: canSpin && !spinning ? theme.ctaBg : "rgba(255,255,255,0.08)",
              border: canSpin && !spinning ? "none" : "1px solid rgba(255,255,255,0.1)",
              cursor: canSpin && !spinning ? "pointer" : "default",
              fontSize: 15, fontWeight: 800,
              color: canSpin && !spinning ? "#fff" : "rgba(245,242,234,0.35)",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              boxShadow: canSpin && !spinning ? theme.ctaShadow : "none",
            }}>
            <span style={{ fontSize: 18 }}>🎁</span>
            {spinning ? "Spinning…" : canSpin ? "Spin & Win Exciting Rewards!" : "Come back tomorrow!"}
          </button>
        )}

        {!result && (
          <div style={{ marginTop: 10, fontSize: 12, color: `${theme.ringBright}50`, letterSpacing: 2 }}>
            ✦ Spin Daily &nbsp;·&nbsp; Win Big! ✦
          </div>
        )}

        {/* Redeem code */}
        <div style={{
          marginTop: 24, width: "calc(100% - 40px)", maxWidth: 340,
          padding: "16px 18px", borderRadius: 18,
          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <Ticket size={14} color={theme.spinLabel} />
            <span style={{ fontSize: 13, fontWeight: 700, color: "#F5F2EA" }}>Redeem Code</span>
          </div>
          {redeemMsg && (
            <div style={{
              padding: "9px 12px", borderRadius: 10, marginBottom: 10, fontSize: 12,
              background: redeemMsg.ok ? "rgba(0,200,117,0.1)" : "rgba(232,99,58,0.1)",
              color: redeemMsg.ok ? "#00C875" : "#E8633A",
              border: `1px solid ${redeemMsg.ok ? "rgba(0,200,117,0.3)" : "rgba(232,99,58,0.3)"}`,
            }}>
              {redeemMsg.text}
            </div>
          )}
          <form onSubmit={handleRedeem} style={{ display: "flex", gap: 8 }}>
            <input
              value={redeemCode}
              onChange={e => setRedeemCode(e.target.value.toUpperCase())}
              placeholder="Enter code…"
              style={{
                flex: 1, padding: "9px 12px", borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.06)", color: "#F5F2EA",
                fontSize: 12, outline: "none",
                fontFamily: "var(--font-mono, monospace)", letterSpacing: 1,
              }}
            />
            <button type="submit" disabled={redeemLoading || !redeemCode.trim()}
              style={{
                padding: "9px 14px", borderRadius: 10, background: theme.spinLabel,
                color: tier === "normal" ? "#000" : "#000", border: "none", cursor: "pointer",
                fontSize: 12, fontWeight: 700,
                opacity: redeemLoading || !redeemCode.trim() ? 0.5 : 1,
              }}>
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
