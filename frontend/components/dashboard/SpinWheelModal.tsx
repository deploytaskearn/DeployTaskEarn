"use client";

import { useState, useEffect, useRef } from "react";
import { X, Ticket } from "lucide-react";
import api from "@/lib/api";
import { SpinSegment, SpinInfo } from "@/lib/types";

interface SpinResult {
  winner: { id: string; label: string; rewardAmount: string; segmentType: string };
  winnerIndex: number;
  totalSegments: number;
  extraSpinsRemaining: number;
}

interface Props {
  onClose: () => void;
  onWin: () => void;
}

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

function WheelSVG({ segments, rotation, spinning }: { segments: SpinSegment[]; rotation: number; spinning: boolean }) {
  const N = segments.length || 12;
  const segAngle = 360 / N;
  const cx = 170, cy = 170;
  const R = 148;
  const lightR = R + 15;
  const numLights = 36;

  return (
    <svg
      width={340} height={340} viewBox="0 0 340 340"
      style={{
        display: "block",
        transform: `rotate(${rotation}deg)`,
        transition: spinning ? "transform 5s cubic-bezier(0.17,0.67,0.12,0.99)" : "none",
        willChange: "transform",
      }}
    >
      {/* Outer shadow ring */}
      <circle cx={cx} cy={cy} r={R + 22} fill="#0a1f10" />

      {/* Gold border rings */}
      <circle cx={cx} cy={cy} r={R + 20} fill="none" stroke="#8a6800" strokeWidth="3" />
      <circle cx={cx} cy={cy} r={R + 18} fill="none" stroke="#f5d060" strokeWidth="1" opacity="0.6" />
      <circle cx={cx} cy={cy} r={R + 10} fill="none" stroke="#c9a227" strokeWidth="1.5" />

      {/* Light dots around ring */}
      {Array.from({ length: numLights }).map((_, i) => {
        const angle = (i * (360 / numLights) - 90) * (Math.PI / 180);
        const x = cx + lightR * Math.cos(angle);
        const y = cy + lightR * Math.sin(angle);
        const isBright = i % 3 === 0;
        return (
          <circle key={i} cx={x} cy={y} r={isBright ? 4.5 : 3}
            fill={isBright ? "#ffe066" : "#c9a227"}
            style={isBright ? { filter: "drop-shadow(0 0 3px #ffe066)" } : undefined}
          />
        );
      })}

      {/* Segments */}
      {segments.map((seg, i) => {
        const startAngle = (i * segAngle - 90) * (Math.PI / 180);
        const endAngle = ((i + 1) * segAngle - 90) * (Math.PI / 180);
        const x1 = cx + R * Math.cos(startAngle);
        const y1 = cy + R * Math.sin(startAngle);
        const x2 = cx + R * Math.cos(endAngle);
        const y2 = cy + R * Math.sin(endAngle);
        const midAngle = (i * segAngle + segAngle / 2 - 90) * (Math.PI / 180);
        const textR = R * 0.60;
        const tx = cx + textR * Math.cos(midAngle);
        const ty = cy + textR * Math.sin(midAngle);
        const textRot = i * segAngle + segAngle / 2;

        const rewardAmt = parseFloat(seg.rewardAmount);
        const isBonus = seg.segmentType === "BONUS_SPIN";
        const isJackpot = rewardAmt >= 1000;
        const isMedium = rewardAmt >= 50 && rewardAmt < 1000;
        const isNoPrize = rewardAmt === 0 && !isBonus;

        const textColor = isJackpot || isBonus
          ? "#ffe066"
          : isMedium
          ? "#d4f0c8"
          : isNoPrize
          ? "rgba(245,242,234,0.5)"
          : "#f0f0f0";

        const emoji = segmentEmoji(seg);
        const emojiSize = isBonus ? 14 : 13;
        const labelSize = seg.label.length > 7 ? 7.5 : 8.5;

        return (
          <g key={seg.id ?? i}>
            {/* Segment fill */}
            <path
              d={`M ${cx} ${cy} L ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2} Z`}
              fill={seg.color}
              stroke="#0a1f10"
              strokeWidth="1.5"
            />
            {/* Gold edge highlight for big prizes */}
            {(isJackpot || isBonus) && (
              <path
                d={`M ${cx} ${cy} L ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2} Z`}
                fill="none" stroke="#c9a227" strokeWidth="1" opacity="0.5"
              />
            )}
            {/* Text group */}
            <g transform={`rotate(${textRot},${tx},${ty})`}>
              {/* Emoji */}
              <text
                x={tx} y={ty - 9}
                textAnchor="middle" dominantBaseline="middle"
                fontSize={emojiSize}
              >
                {emoji}
              </text>
              {/* Label */}
              <text
                x={tx} y={ty + 5}
                textAnchor="middle" dominantBaseline="middle"
                fontSize={labelSize} fontWeight="800"
                fill={textColor}
                style={{ fontFamily: "system-ui, sans-serif" }}
              >
                {seg.label}
              </text>
            </g>
          </g>
        );
      })}

      {/* Divider lines */}
      {segments.map((_, i) => {
        const angle = (i * segAngle - 90) * (Math.PI / 180);
        const x = cx + R * Math.cos(angle);
        const y = cy + R * Math.sin(angle);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#0a1f10" strokeWidth="2" />;
      })}

      {/* Center cap */}
      <circle cx={cx} cy={cy} r={52} fill="#071810" stroke="#c9a227" strokeWidth="3" />
      <circle cx={cx} cy={cy} r={46} fill="#0d2a1a" stroke="#ffe066" strokeWidth="1" opacity="0.5" />
      <circle cx={cx} cy={cy} r={40} fill="#1a5c36" />
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle"
        fontSize="13" fontWeight="900" fill="#fff"
        style={{ fontFamily: "system-ui, sans-serif", letterSpacing: 2 }}>
        SPIN
      </text>
    </svg>
  );
}

export function SpinWheelModal({ onClose, onWin }: Props) {
  const [info, setInfo] = useState<SpinInfo | null>(null);
  const [extraSpins, setExtraSpins] = useState(0);
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
      })
      .catch(() => setError("Failed to load spin data."));
  }

  useEffect(() => { loadInfo(); }, []);

  async function handleSpin() {
    if (!canSpin || spinning) return;
    setSpinning(true);
    setError("");
    setResult(null);
    try {
      const res = await api.post<SpinResult>("/spin/spin");
      const { winnerIndex, totalSegments, extraSpinsRemaining } = res.data;
      const segAngle = 360 / totalSegments;
      const toWinner = 337.5 - winnerIndex * segAngle;
      const finalRot = prevRotRef.current + 1800 + toWinner;
      prevRotRef.current = finalRot;
      setRotation(finalRot);

      setTimeout(() => {
        setResult(res.data);
        setSpinning(false);
        setCanSpin(extraSpinsRemaining > 0);
        setExtraSpins(extraSpinsRemaining);
        const reward = parseFloat(res.data.winner.rewardAmount);
        if (reward > 0) onWin();
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

  const segments = info?.segments ?? [];
  const reward = result ? parseFloat(result.winner.rewardAmount) : 0;
  const isWin = reward > 0;
  const isBonusSpin = result?.winner.segmentType === "BONUS_SPIN";

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "radial-gradient(ellipse at 50% 30%, #0d3a1a 0%, #04100a 70%)",
      display: "flex", flexDirection: "column", alignItems: "center",
      overflowY: "auto",
    }}>
      {/* Stars background */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 0 }}>
        {[
          { top: "8%", left: "12%", size: 6, delay: 0 },
          { top: "15%", right: "10%", size: 8, delay: 0.5 },
          { top: "5%", left: "55%", size: 5, delay: 1 },
          { bottom: "30%", left: "5%", size: 7, delay: 1.5 },
          { bottom: "20%", right: "8%", size: 6, delay: 0.8 },
          { top: "40%", left: "3%", size: 5, delay: 2 },
          { top: "60%", right: "4%", size: 7, delay: 0.3 },
          { bottom: "10%", left: "20%", size: 5, delay: 1.2 },
          { bottom: "12%", right: "25%", size: 6, delay: 0.7 },
          { top: "25%", left: "80%", size: 4, delay: 1.8 },
        ].map((s, i) => (
          <div key={i} style={{
            position: "absolute", ...s,
            width: s.size, height: s.size,
            background: "#ffe066", borderRadius: "50%",
            animation: `sparkle 2.5s ${s.delay}s ease-in-out infinite`,
            filter: "drop-shadow(0 0 3px #ffe066)",
          }} />
        ))}
      </div>

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", alignItems: "center", paddingBottom: 40 }}>

        {/* Header */}
        <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px 8px" }}>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 800, color: "#F5F2EA", lineHeight: 1.1 }}>Lucky Wheel</div>
            <div style={{ fontSize: 12, color: "rgba(245,242,234,0.5)", marginTop: 2 }}>
              1 free spin per day — spin to win up to{" "}
              <span style={{ color: "#ffe066", fontWeight: 700 }}>Rs 5,000!</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 12, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
            <X size={18} color="#F5F2EA" />
          </button>
        </div>

        {/* Extra spins badge */}
        {extraSpins > 0 && (
          <div style={{ marginBottom: 8, padding: "6px 16px", borderRadius: 99, background: "rgba(0,200,117,0.15)", border: "1px solid rgba(0,200,117,0.3)", fontSize: 12, color: "#00C875", fontWeight: 700 }}>
            🎡 You have {extraSpins} bonus spin{extraSpins > 1 ? "s" : ""}!
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
            borderTop: "28px solid #ffe066",
            filter: "drop-shadow(0 0 8px #ffe066)",
          }} />

          <WheelSVG segments={segments} rotation={rotation} spinning={spinning} />

          {/* Invisible center click target when spinnable */}
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
            background: isBonusSpin ? "rgba(13,21,48,0.95)" : isWin ? "rgba(0,30,15,0.95)" : "rgba(5,15,10,0.95)",
            border: `2px solid ${isBonusSpin ? "#4466ff" : isWin ? "#ffe066" : "rgba(255,255,255,0.1)"}`,
            boxShadow: isWin ? "0 0 30px rgba(255,224,102,0.2)" : isBonusSpin ? "0 0 20px rgba(68,102,255,0.2)" : "none",
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
                <div style={{ fontSize: 26, fontWeight: 900, color: "#ffe066", marginBottom: 4 }}>
                  Rs {reward.toLocaleString()}
                </div>
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
                background: "#00C875", border: "none", cursor: "pointer",
                fontSize: 13, fontWeight: 800, color: "#000",
              }}>
                Spin Again! ({extraSpins} left)
              </button>
            )}
          </div>
        )}

        {/* CTA button */}
        {!result && (
          <button onClick={handleSpin} disabled={!canSpin || spinning}
            style={{
              marginTop: 20, padding: "14px 0", width: 280, borderRadius: 99,
              background: canSpin && !spinning
                ? "linear-gradient(90deg, #1a7a40 0%, #00C875 50%, #1a7a40 100%)"
                : "rgba(255,255,255,0.08)",
              border: canSpin && !spinning ? "none" : "1px solid rgba(255,255,255,0.1)",
              cursor: canSpin && !spinning ? "pointer" : "default",
              fontSize: 15, fontWeight: 800,
              color: canSpin && !spinning ? "#fff" : "rgba(245,242,234,0.35)",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              boxShadow: canSpin && !spinning ? "0 4px 24px rgba(0,200,117,0.3)" : "none",
            }}>
            <span style={{ fontSize: 18 }}>🎁</span>
            {spinning ? "Spinning…" : canSpin ? "Spin & Win Exciting Rewards!" : "Come back tomorrow!"}
          </button>
        )}

        {/* Bottom marquee-style text */}
        {!result && (
          <div style={{ marginTop: 10, fontSize: 12, color: "rgba(245,242,234,0.3)", letterSpacing: 2 }}>
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
            <Ticket size={14} color="#00C875" />
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
                padding: "9px 14px", borderRadius: 10, background: "#00C875",
                color: "#000", border: "none", cursor: "pointer",
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
          0%, 100% { opacity: 0.2; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        @keyframes resultPop {
          from { opacity: 0; transform: scale(0.8) translateY(10px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}
