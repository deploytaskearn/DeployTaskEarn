"use client";

import { useState, useEffect } from "react";
import { X, Clock, Crown } from "lucide-react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";

interface Prize { id: string; label: string; rewardAmount: string; }

interface MysteryInfo {
  prizes: Prize[];
  canPlay: boolean;
  playsToday: number;
  secondsUntilReset: number;
  freeMysteryBoxTestMode?: boolean;
  premiumPrizes: Prize[];
  premiumBoxPrice: number;
  walletBalance: number;
  freeBoxCoinCost?: number;
  userCoins?: number;
}

interface OpenResult {
  prize: { id: string; label: string; rewardAmount: string };
  secondsUntilReset: number;
  canPlayAgain?: boolean;
}

interface RedeemCoinsResult {
  prize: { id: string; label: string; rewardAmount: string };
  coins: number;
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

type BoxPhase = "idle" | "shaking" | "opening" | "revealed";

function BoxSVG({ phase, gold }: { phase: BoxPhase; gold: boolean }) {
  const lidUp = phase === "opening" || phase === "revealed";
  const body = gold ? "#4c1d95" : "#1d4a2e";
  const lid  = gold ? "#2e1065" : "#0d3a22";
  const rib  = gold ? "#c4b5fd" : "#4ade80";
  const bow  = gold ? "#ede9fe" : "#d1fae5";
  const glow = gold ? "rgba(168,85,247,0.5)" : "rgba(0,200,117,0.4)";
  const plat = gold ? "#a855f7" : "#00C875";
  return (
    <svg viewBox="0 0 160 180" width="160" height="180" style={{ display: "block", overflow: "visible", filter: `drop-shadow(0 0 24px ${glow})` }}>
      <ellipse cx="80" cy="174" rx="70" ry="14" fill={plat} opacity="0.18" />
      <ellipse cx="80" cy="174" rx="50" ry="9"  fill={plat} opacity="0.12" />
      <rect x="12" y="78" width="136" height="92" rx="10" fill={body} />
      <rect x="12" y="78" width="136" height="18" rx="10" fill="black" opacity="0.18" />
      <rect x="68" y="78" width="24"  height="92" fill={rib} opacity="0.8" rx="3" />
      <rect x="12" y="104" width="136" height="24" fill={rib} opacity="0.8" rx="3" />
      <g style={{ transform: lidUp ? "translateY(-48px) rotate(-8deg)" : "translateY(0)", transformOrigin: "80px 56px", transition: lidUp ? "transform 0.45s cubic-bezier(0.34,1.56,0.64,1)" : "none" }}>
        <rect x="4"  y="40" width="152" height="42" rx="10" fill={lid} />
        <rect x="8"  y="34" width="144" height="16" rx="6"  fill={lid} />
        <rect x="4"  y="72" width="152" height="10" rx="4"  fill="black" opacity="0.13" />
        <rect x="4"  y="50" width="152" height="22" fill={rib} opacity="0.8" rx="3" />
        <rect x="68" y="34" width="24"  height="50" fill={rib} opacity="0.8" rx="3" />
        <ellipse cx="44"  cy="22" rx="38" ry="20" fill={bow} transform="rotate(-20 44 22)" />
        <ellipse cx="44"  cy="22" rx="26" ry="13" fill={lid} opacity="0.28" transform="rotate(-20 44 22)" />
        <ellipse cx="116" cy="22" rx="38" ry="20" fill={bow} transform="rotate(20 116 22)" />
        <ellipse cx="116" cy="22" rx="26" ry="13" fill={lid} opacity="0.28" transform="rotate(20 116 22)" />
        <circle cx="80" cy="34" r="17" fill={rib} />
        <circle cx="80" cy="34" r="11" fill={bow} />
        <circle cx="80" cy="34" r="5"  fill={rib} />
      </g>
    </svg>
  );
}

export function MysteryBoxModal({ onClose, onWin }: { onClose: () => void; onWin: () => void }) {
  const router = useRouter();
  const [info, setInfo] = useState<MysteryInfo | null>(null);
  const [error, setError] = useState("");

  const [canPlay, setCanPlay] = useState(false);
  const [freePhase, setFreePhase] = useState<BoxPhase>("idle");
  const [freeResult, setFreeResult] = useState<OpenResult | null>(null);
  const [secondsUntilReset, setSecondsUntilReset] = useState(0);
  const freeCountdown = useCountdown(secondsUntilReset);
  const [walletBalance, setWalletBalance] = useState(0);
  const [redeeming, setRedeeming] = useState(false);

  useEffect(() => {
    api.get<MysteryInfo>("/mystery/info")
      .then(r => {
        setInfo(r.data);
        setCanPlay(r.data.canPlay);
        setSecondsUntilReset(r.data.secondsUntilReset);
        setWalletBalance(r.data.walletBalance ?? 0);
      })
      .catch(() => setError("Failed to load. Please try again."));
  }, []);

  const prizes = info?.prizes ?? [];
  const freeReward = freeResult ? parseFloat(freeResult.prize.rewardAmount) : 0;

  async function handleFreeOpen() {
    if (!canPlay || freePhase !== "idle") return;
    setFreePhase("shaking");
    setFreeResult(null);
    setError("");
    try {
      const res = await api.post<OpenResult>("/mystery/open");
      setTimeout(() => setFreePhase("opening"), 700);
      setTimeout(() => {
        setFreeResult(res.data);
        setFreePhase("revealed");
        setCanPlay(!!res.data.canPlayAgain);
        setSecondsUntilReset(res.data.secondsUntilReset ?? 0);
        if (parseFloat(res.data.prize.rewardAmount) > 0) onWin();
      }, 1500);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to open.";
      setError(msg);
      setFreePhase("idle");
    }
  }

  async function handleRedeemCoins() {
    if (freePhase !== "idle" || redeeming) return;
    setRedeeming(true);
    setFreePhase("shaking");
    setFreeResult(null);
    setError("");
    try {
      const res = await api.post<RedeemCoinsResult>("/mystery/redeem-coins/free");
      setTimeout(() => setFreePhase("opening"), 700);
      setTimeout(() => {
        setFreeResult({ prize: res.data.prize, secondsUntilReset: 0, canPlayAgain: canPlay });
        setFreePhase("revealed");
        setInfo((prev) => (prev ? { ...prev, userCoins: res.data.coins } : prev));
        setRedeeming(false);
        if (parseFloat(res.data.prize.rewardAmount) > 0) onWin();
      }, 1500);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Redeem failed.";
      setError(msg);
      setFreePhase("idle");
      setRedeeming(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "radial-gradient(ellipse at 50% 20%, #0d3a22 0%, #061a10 50%, #020d07 100%)", display: "flex", flexDirection: "column", alignItems: "center", overflowY: "auto" }}>

      {/* Sparkles */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 0 }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} style={{ position: "absolute", left: `${(i * 19 + 7) % 92}%`, top: `${(i * 23 + 5) % 88}%`, width: 4+(i%4), height: 4+(i%4), borderRadius: "50%", background: "#00C875", opacity: 0.3, animation: `sparkle ${2+(i%3)*0.5}s ${i*0.15}s ease-in-out infinite` }} />
        ))}
      </div>

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", alignItems: "center", paddingBottom: 40 }}>

        {/* Header */}
        <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px 0" }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#F5F2EA" }}>🎁 Mystery Box</div>
            <div style={{ fontSize: 12, color: "rgba(245,242,234,0.45)", marginTop: 2 }}>
              {info?.freeMysteryBoxTestMode ? "🧪 Testing mode — cooldown disabled" : "1 free box daily · buy premium anytime!"}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 12, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <X size={18} color="#F5F2EA" />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div style={{ margin: "10px 20px 0", padding: "10px 16px", borderRadius: 12, background: "rgba(232,99,58,0.12)", color: "#E8633A", fontSize: 13, textAlign: "center", width: "calc(100% - 40px)" }}>
            {error}
          </div>
        )}

        {/* ═══════════════ FREE BOX SECTION ═══════════════ */}
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, color: "#00C875", marginBottom: 8 }}>FREE DAILY BOX</div>

          <div style={{ marginBottom: 12, padding: "6px 20px", borderRadius: 99, background: "rgba(0,200,117,0.10)", border: "1px solid rgba(0,200,117,0.25)", fontSize: 12, fontWeight: 700, color: "#00C875" }}>
            {canPlay ? "🎁 Free Box Available!" : `⏰ Next box in ${freeCountdown.label}`}
          </div>

          <div style={{ cursor: (canPlay && freePhase === "idle") ? "pointer" : "default", animation: freePhase === "shaking" ? "boxShake 0.6s ease" : "none", filter: canPlay ? "drop-shadow(0 0 32px rgba(0,200,117,0.4))" : "grayscale(0.5) opacity(0.7)" }} onClick={handleFreeOpen}>
            <BoxSVG phase={freePhase} gold={false} />
          </div>

          {freePhase === "idle" && (
            <button onClick={handleFreeOpen} disabled={!canPlay}
              style={{ marginTop: 14, padding: "14px 0", width: 260, borderRadius: 99, border: "none", cursor: canPlay ? "pointer" : "default", background: canPlay ? "linear-gradient(90deg,#059a54,#00C875,#059a54)" : "rgba(255,255,255,0.07)", color: canPlay ? "#fff" : "rgba(245,242,234,0.3)", fontSize: 14, fontWeight: 800, boxShadow: canPlay ? "0 4px 24px rgba(0,200,117,0.3)" : "none" }}>
              {canPlay ? "🎁 Open Free Box" : "Come back tomorrow"}
            </button>
          )}
          {!canPlay && freeCountdown.secs > 0 && freePhase === "idle" && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
              <Clock size={13} color="rgba(245,242,234,0.4)" />
              <span style={{ fontSize: 13, fontWeight: 700, color: "#00C875", fontFamily: "monospace" }}>{freeCountdown.label}</span>
            </div>
          )}

          {freePhase === "idle" && (() => {
            const cost = info?.freeBoxCoinCost ?? 300;
            const coins = info?.userCoins ?? 0;
            const canAfford = coins >= cost;
            return (
              <button onClick={handleRedeemCoins} disabled={!canAfford}
                style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 99, background: canAfford ? "rgba(244,200,66,0.12)" : "rgba(255,255,255,0.05)", border: `1px solid ${canAfford ? "rgba(244,200,66,0.3)" : "rgba(255,255,255,0.08)"}`, cursor: canAfford ? "pointer" : "default" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: canAfford ? "#F4C842" : "rgba(245,242,234,0.35)" }}>
                  🪙 Or redeem {cost} coins to open now
                </span>
                <span style={{ fontSize: 10, color: "rgba(245,242,234,0.4)" }}>({coins} available)</span>
              </button>
            );
          })()}

          {freeResult && freePhase === "revealed" && (
            <div style={{ marginTop: 14, padding: "18px 28px", borderRadius: 20, textAlign: "center", maxWidth: 280, background: freeReward > 0 ? "rgba(5,25,12,0.95)" : "rgba(5,10,8,0.95)", border: `2px solid ${freeReward > 0 ? "rgba(0,200,117,0.4)" : "rgba(255,255,255,0.1)"}`, animation: "resultPop 0.5s cubic-bezier(0.22,1,0.36,1)" }}>
              {freeReward > 0 ? (
                <>
                  <div style={{ fontSize: 32, marginBottom: 6 }}>🎉</div>
                  <div style={{ fontSize: 26, fontWeight: 900, color: "#00C875" }}>Rs {freeReward.toLocaleString()}</div>
                  <div style={{ fontSize: 13, color: "rgba(245,242,234,0.6)", marginTop: 4 }}>Added to wallet!</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 28, marginBottom: 6 }}>😔</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#F5F2EA" }}>Better Luck Tomorrow!</div>
                  <div style={{ fontSize: 11, color: "rgba(245,242,234,0.4)", marginTop: 4 }}>Try Premium Box below for bigger prizes</div>
                </>
              )}
              {secondsUntilReset > 0 && (
                <div style={{ marginTop: 8, fontSize: 11, color: "rgba(245,242,234,0.4)" }}>
                  Next free box in <span style={{ fontFamily: "monospace", color: "#00C875", fontWeight: 700 }}>{freeCountdown.label}</span>
                </div>
              )}
            </div>
          )}

          {prizes.length > 0 && (
            <div style={{ width: "calc(100% - 40px)", marginTop: 14, padding: "10px 14px", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#00C875", letterSpacing: 2, marginBottom: 7 }}>FREE BOX PRIZES</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {prizes.map(p => (
                  <span key={p.id} style={{ padding: "4px 9px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: "rgba(0,200,117,0.10)", border: "1px solid rgba(0,200,117,0.2)", color: parseFloat(p.rewardAmount) > 0 ? "#00C875" : "rgba(245,242,234,0.3)" }}>
                    {parseFloat(p.rewardAmount) > 0 ? `Rs ${parseFloat(p.rewardAmount).toLocaleString()}` : p.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ═══════════════ PREMIUM BOX BANNER ═══════════════ */}
        <div style={{ width: "calc(100% - 40px)", margin: "20px 0 0" }}>
          <button
            onClick={() => { onClose(); router.push("/dashboard/premium-box"); }}
            style={{ width: "100%", padding: "18px 20px", borderRadius: 20, border: "1.5px solid rgba(168,85,247,0.4)", background: "rgba(20,5,50,0.85)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg,#7c3aed,#a855f7)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Crown size={22} color="#fff" />
              </div>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#ede9fe" }}>👑 Premium Box</div>
                <div style={{ fontSize: 11, color: "rgba(196,181,253,0.6)", marginTop: 2 }}>Rs {(info?.premiumBoxPrice ?? 500).toLocaleString()} · Win up to Rs 5,000</div>
              </div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#a855f7", whiteSpace: "nowrap" }}>Open →</div>
          </button>
        </div>

      </div>

      <style>{`
        @keyframes sparkle { 0%,100%{opacity:0.15;transform:scale(0.8)} 50%{opacity:0.8;transform:scale(1.3)} }
        @keyframes boxShake {
          0%,100%{transform:translateX(0) rotate(0)}
          15%{transform:translateX(-8px) rotate(-5deg)}
          30%{transform:translateX(8px) rotate(5deg)}
          45%{transform:translateX(-6px) rotate(-3deg)}
          60%{transform:translateX(6px) rotate(3deg)}
          75%{transform:translateX(-3px) rotate(-1deg)}
        }
        @keyframes resultPop { from{opacity:0;transform:scale(0.8) translateY(10px)} to{opacity:1;transform:scale(1) translateY(0)} }
      `}</style>
    </div>
  );
}
