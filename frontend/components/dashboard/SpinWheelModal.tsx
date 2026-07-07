"use client";

import { useState, useEffect, useRef } from "react";
import { X, Gift, Ticket } from "lucide-react";
import api from "@/lib/api";
import { SpinSegment, SpinInfo, SpinResult } from "@/lib/types";

interface Props {
  onClose: () => void;
  onWin: () => void;
}

export function SpinWheelModal({ onClose, onWin }: Props) {
  const [info, setInfo] = useState<SpinInfo | null>(null);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [redeemCode, setRedeemCode] = useState("");
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [redeemMsg, setRedeemMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [error, setError] = useState("");
  const prevRotRef = useRef(0);

  useEffect(() => {
    api.get<SpinInfo>("/spin/info")
      .then(r => setInfo(r.data))
      .catch(() => setError("Failed to load spin data."));
  }, []);

  async function handleSpin() {
    if (!info?.canSpin || spinning || result) return;
    setSpinning(true);
    setError("");
    try {
      const r = await api.post<SpinResult>("/spin/spin");
      const { winnerIndex, totalSegments } = r.data;

      const segAngle = 360 / totalSegments;
      // Rotate clockwise so winnerIndex segment stops at top pointer
      const toWinner = 337.5 - winnerIndex * segAngle;
      const finalRotation = prevRotRef.current + 1800 + toWinner;
      prevRotRef.current = finalRotation;
      setRotation(finalRotation);

      setTimeout(() => {
        setResult(r.data);
        setSpinning(false);
        if (parseFloat(r.data.winner.rewardAmount) > 0) onWin();
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
  const N = segments.length || 8;
  const segAngle = 360 / N;
  const R = 130;
  const cx = 150;
  const cy = 150;

  const reward = result ? parseFloat(result.winner.rewardAmount) : 0;
  const isWin = reward > 0;

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 100, background: "#080f0b", display: "flex", flexDirection: "column", overflowY: "auto" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", paddingBottom: 32 }}>

        {/* Header */}
        <div style={{ width: "100%", maxWidth: 480, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Gift size={20} color="#00C875" />
            <span style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, color: "#F5F2EA" }}>Lucky Wheel</span>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.07)", border: "none", borderRadius: 12, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <X size={18} color="#F5F2EA" />
          </button>
        </div>

        {/* Subtitle */}
        <p style={{ fontSize: 13, color: "rgba(245,242,234,0.45)", marginBottom: 20, textAlign: "center" }}>
          {info?.canSpin
            ? "1 free spin per day — spin to win up to Rs 5,000!"
            : "Come back tomorrow for your next free spin!"}
        </p>

        {/* Wheel area */}
        <div style={{ position: "relative", width: 300, height: 300 }}>

          {/* Pointer */}
          <div style={{
            position: "absolute", top: -16, left: "50%", transform: "translateX(-50%)",
            width: 0, height: 0, zIndex: 10,
            borderLeft: "12px solid transparent",
            borderRight: "12px solid transparent",
            borderTop: "26px solid #00C875",
            filter: "drop-shadow(0 0 8px rgba(0,200,117,0.8))",
          }} />

          {/* Outer glow ring */}
          <div style={{
            position: "absolute", inset: -4, borderRadius: "50%",
            boxShadow: spinning
              ? "0 0 0 2px rgba(0,200,117,0.6), 0 0 30px rgba(0,200,117,0.25)"
              : "0 0 0 2px rgba(0,200,117,0.25)",
            transition: "box-shadow 0.3s ease",
            pointerEvents: "none",
          }} />

          {/* Rotating SVG wheel */}
          <svg
            width={300}
            height={300}
            viewBox="0 0 300 300"
            style={{
              display: "block",
              transform: `rotate(${rotation}deg)`,
              transition: spinning ? "transform 5s cubic-bezier(0.17, 0.67, 0.12, 0.99)" : "none",
              willChange: "transform",
            }}
          >
            {/* Gold border ring */}
            <circle cx={cx} cy={cy} r={R + 6} fill="none" stroke="#00C875" strokeWidth="1.5" opacity="0.4" />
            <circle cx={cx} cy={cy} r={R + 3} fill="#0a1f14" />

            {segments.map((seg, i) => {
              const startAngle = (i * segAngle - 90) * (Math.PI / 180);
              const endAngle = ((i + 1) * segAngle - 90) * (Math.PI / 180);
              const x1 = cx + R * Math.cos(startAngle);
              const y1 = cy + R * Math.sin(startAngle);
              const x2 = cx + R * Math.cos(endAngle);
              const y2 = cy + R * Math.sin(endAngle);
              const midAngle = (i * segAngle + segAngle / 2 - 90) * (Math.PI / 180);
              const tr = R * 0.64;
              const tx = cx + tr * Math.cos(midAngle);
              const ty = cy + tr * Math.sin(midAngle);
              const textRot = i * segAngle + segAngle / 2;
              const rewardAmt = parseFloat(seg.rewardAmount);
              const isGold = rewardAmt >= 500;
              const isSmallPrize = rewardAmt > 0 && rewardAmt < 500;
              const textColor = isGold ? "#F4C842" : isSmallPrize ? "#a8ffda" : "rgba(245,242,234,0.75)";

              const parts = seg.label.split(" ");
              const line1 = parts.length > 2 ? parts.slice(0, 2).join(" ") : seg.label;
              const line2 = parts.length > 2 ? parts.slice(2).join(" ") : null;

              return (
                <g key={seg.id}>
                  <path
                    d={`M ${cx} ${cy} L ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2} Z`}
                    fill={seg.color}
                    stroke="#080f0b"
                    strokeWidth="2"
                  />
                  {/* Subtle radial highlight at edge */}
                  {isGold && (
                    <path
                      d={`M ${cx} ${cy} L ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2} Z`}
                      fill="none"
                      stroke="#F4C842"
                      strokeWidth="1"
                      opacity="0.35"
                    />
                  )}
                  <text
                    x={tx}
                    y={ty}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={rewardAmt >= 1000 ? 8.5 : 9.5}
                    fontWeight="700"
                    fill={textColor}
                    style={{ fontFamily: "var(--font-mono, monospace)" }}
                    transform={`rotate(${textRot}, ${tx}, ${ty})`}
                  >
                    {line2 ? (
                      <>
                        <tspan x={tx} dy="-5">{line1}</tspan>
                        <tspan x={tx} dy="12">{line2}</tspan>
                      </>
                    ) : seg.label}
                  </text>
                </g>
              );
            })}

            {/* Divider lines */}
            {segments.map((_, i) => {
              const angle = (i * segAngle - 90) * (Math.PI / 180);
              const x = cx + R * Math.cos(angle);
              const y = cy + R * Math.sin(angle);
              return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#080f0b" strokeWidth="2" />;
            })}

            {/* Center cap */}
            <circle cx={cx} cy={cy} r={42} fill="#0a1f14" stroke="#00C875" strokeWidth="2.5" />
            <circle cx={cx} cy={cy} r={35} fill="#00C875" />
            <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle"
              fontSize="11" fontWeight="900" fill="#000"
              style={{ fontFamily: "var(--font-display, sans-serif)", letterSpacing: 1 }}>
              SPIN
            </text>
          </svg>

          {/* Clickable SPIN overlay button */}
          {info?.canSpin && !spinning && !result && (
            <button
              onClick={handleSpin}
              style={{
                position: "absolute", top: "50%", left: "50%",
                transform: "translate(-50%, -50%)",
                width: 72, height: 72, borderRadius: "50%",
                background: "transparent", border: "none",
                cursor: "pointer", zIndex: 5,
              }}
              aria-label="Spin the wheel"
            />
          )}
        </div>

        {/* Error */}
        {error && (
          <div style={{ marginTop: 16, padding: "10px 18px", borderRadius: 12, background: "rgba(232,99,58,0.12)", color: "#E8633A", fontSize: 13, textAlign: "center", maxWidth: 320 }}>
            {error}
          </div>
        )}

        {/* Result display */}
        {result && (
          <div style={{
            marginTop: 20, padding: "18px 24px", borderRadius: 20, textAlign: "center",
            background: isWin ? "rgba(0,200,117,0.1)" : "rgba(255,255,255,0.05)",
            border: `1.5px solid ${isWin ? "rgba(0,200,117,0.4)" : "rgba(255,255,255,0.1)"}`,
            maxWidth: 280,
            animation: "spinResultPop 0.5s cubic-bezier(0.22, 1, 0.36, 1)",
          }}>
            {isWin ? (
              <>
                <div style={{ fontSize: 28, marginBottom: 4 }}>🎉</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#00C875", marginBottom: 4 }}>
                  Rs {parseFloat(result.winner.rewardAmount).toLocaleString()}
                </div>
                <div style={{ fontSize: 13, color: "rgba(245,242,234,0.6)" }}>Added to your wallet!</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 24, marginBottom: 4 }}>😔</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: "#F5F2EA", marginBottom: 4 }}>
                  {result.winner.label}
                </div>
                <div style={{ fontSize: 12, color: "rgba(245,242,234,0.45)" }}>Better luck next time!</div>
              </>
            )}
            <div style={{ fontSize: 11, color: "rgba(245,242,234,0.3)", marginTop: 10 }}>Next spin available tomorrow</div>
          </div>
        )}

        {/* Spin CTA below wheel when can spin and not yet spun */}
        {info?.canSpin && !spinning && !result && (
          <button
            onClick={handleSpin}
            style={{
              marginTop: 20, padding: "14px 48px", borderRadius: 50,
              background: "linear-gradient(135deg, #00C875, #00a862)",
              border: "none", cursor: "pointer",
              fontSize: 15, fontWeight: 800, color: "#000",
              boxShadow: "0 4px 20px rgba(0,200,117,0.35)",
            }}
          >
            Spin Now!
          </button>
        )}

        {spinning && (
          <div style={{ marginTop: 20, fontSize: 13, color: "#00C875", animation: "spinResultPop 0.4s ease" }}>
            Spinning...
          </div>
        )}

        {!info?.canSpin && !result && (
          <div style={{ marginTop: 16, padding: "12px 20px", borderRadius: 14, background: "rgba(244,200,66,0.08)", border: "1px solid rgba(244,200,66,0.2)", fontSize: 13, color: "#F4C842", textAlign: "center" }}>
            You&apos;ve already spun today. Come back tomorrow!
          </div>
        )}

        {/* Redeem code section */}
        <div style={{
          marginTop: 28, width: "100%", maxWidth: 320,
          padding: "18px 20px", borderRadius: 20,
          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <Ticket size={15} color="#00C875" />
            <span style={{ fontSize: 14, fontWeight: 700, color: "#F5F2EA" }}>Redeem Code</span>
          </div>
          <p style={{ fontSize: 12, color: "rgba(245,242,234,0.45)", marginBottom: 14 }}>
            Have a special code? Enter it below to claim your reward.
          </p>
          {redeemMsg && (
            <div style={{
              padding: "10px 14px", borderRadius: 10, marginBottom: 12, fontSize: 13,
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
                flex: 1, padding: "10px 14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.06)", color: "#F5F2EA", fontSize: 13,
                outline: "none", fontFamily: "var(--font-mono, monospace)", letterSpacing: 1,
              }}
            />
            <button
              type="submit"
              disabled={redeemLoading || !redeemCode.trim()}
              style={{
                padding: "10px 16px", borderRadius: 12, background: "#00C875", color: "#000",
                border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700,
                opacity: redeemLoading || !redeemCode.trim() ? 0.5 : 1,
              }}
            >
              {redeemLoading ? "…" : "Claim"}
            </button>
          </form>
        </div>

      </div>

      <style>{`
        @keyframes spinResultPop {
          from { opacity: 0; transform: scale(0.85); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
