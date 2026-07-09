"use client";

import { useState, useEffect } from "react";
import { X, Clock } from "lucide-react";
import api from "@/lib/api";

interface Prize { id: string; label: string; rewardAmount: string; }

interface MysteryInfo {
  prizes: Prize[];
  canPlay: boolean;
  playsToday: number;
  secondsUntilReset: number;
  premiumPrizes: Prize[];
  premiumBoxPrice: number;
  walletBalance: number;
}

interface OpenResult {
  prize: { id: string; label: string; rewardAmount: string };
  secondsUntilReset: number;
}

interface PremiumResult {
  prize: { id: string; label: string; rewardAmount: string };
  walletBalance: number;
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
  const body = gold ? "#7c3aed" : "#1d4a2e";
  const lid  = gold ? "#4c1d95" : "#0d3a22";
  const rib  = gold ? "#c4b5fd" : "#4ade80";
  const bow  = gold ? "#ede9fe" : "#d1fae5";
  const glow = gold ? "rgba(168,85,247,0.4)" : "rgba(0,200,117,0.4)";
  const plat = gold ? "#a855f7" : "#00C875";
  return (
    <svg viewBox="0 0 160 180" width="180" height="202" style={{ display: "block", overflow: "visible", filter: `drop-shadow(0 0 24px ${glow})` }}>
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
  const [info, setInfo] = useState<MysteryInfo | null>(null);
  const [error, setError] = useState("");

  // Free box state
  const [canPlay, setCanPlay] = useState(false);
  const [freePhase, setFreePhase] = useState<BoxPhase>("idle");
  const [freeResult, setFreeResult] = useState<OpenResult | null>(null);
  const [secondsUntilReset, setSecondsUntilReset] = useState(0);
  const freeCountdown = useCountdown(secondsUntilReset);

  // Premium box state
  const [premPhase, setPremPhase] = useState<BoxPhase>("idle");
  const [premResult, setPremResult] = useState<PremiumResult | null>(null);
  const [premBuying, setPremBuying] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);

  // Which box is active
  const [activeBox, setActiveBox] = useState<"free" | "premium">("free");

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
  const premiumPrizes = info?.premiumPrizes ?? [];
  const premiumBoxPrice = info?.premiumBoxPrice ?? 50;
  const canAffordPremium = walletBalance >= premiumBoxPrice;

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
        setCanPlay(false);
        setSecondsUntilReset(res.data.secondsUntilReset ?? 0);
        if (parseFloat(res.data.prize.rewardAmount) > 0) onWin();
      }, 1500);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to open.";
      setError(msg);
      setFreePhase("idle");
    }
  }

  async function handlePremiumOpen() {
    if (premBuying || premPhase !== "idle") return;
    if (!canAffordPremium) {
      setError(`You need Rs ${premiumBoxPrice} in your wallet. Current: Rs ${walletBalance.toFixed(0)}.`);
      return;
    }
    setPremBuying(true);
    setPremPhase("shaking");
    setPremResult(null);
    setError("");
    try {
      const res = await api.post<PremiumResult>("/mystery/buy-premium");
      setTimeout(() => setPremPhase("opening"), 700);
      setTimeout(() => {
        setPremResult(res.data);
        setPremPhase("revealed");
        setWalletBalance(res.data.walletBalance ?? 0);
        if (parseFloat(res.data.prize.rewardAmount) > 0) onWin();
        setPremBuying(false);
      }, 1500);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed.";
      setError(msg);
      setPremPhase("idle");
      setPremBuying(false);
    }
  }

  const isGold = activeBox === "premium";
  const accent = isGold ? "#a855f7" : "#00C875";
  const accentDim = isGold ? "rgba(168,85,247,0.12)" : "rgba(0,200,117,0.10)";
  const accentBorder = isGold ? "rgba(168,85,247,0.3)" : "rgba(0,200,117,0.25)";
  const bg = isGold
    ? "radial-gradient(ellipse at 50% 20%, #2e1065 0%, #0d0520 50%, #050210 100%)"
    : "radial-gradient(ellipse at 50% 20%, #0d3a22 0%, #061a10 50%, #020d07 100%)";

  const activePhase  = isGold ? premPhase  : freePhase;
  const activeResult = isGold ? premResult : freeResult;
  const activeReward = activeResult ? parseFloat(activeResult.prize.rewardAmount) : 0;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, background: bg, display: "flex", flexDirection: "column", alignItems: "center", overflowY: "auto", transition: "background 0.4s ease" }}>

      {/* Sparkles */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 0 }}>
        {Array.from({ length: 14 }).map((_, i) => (
          <div key={i} style={{ position: "absolute", left: `${(i * 19 + 7) % 92}%`, top: `${(i * 23 + 5) % 88}%`, width: 4 + (i % 4), height: 4 + (i % 4), borderRadius: "50%", background: accent, opacity: 0.3, animation: `sparkle ${2 + (i % 3) * 0.5}s ${i * 0.15}s ease-in-out infinite` }} />
        ))}
      </div>

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", alignItems: "center", paddingBottom: 40 }}>

        {/* Header */}
        <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px 0" }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#F5F2EA" }}>
              {isGold ? "👑 Premium Box" : "🎁 Mystery Box"}
            </div>
            <div style={{ fontSize: 12, color: "rgba(245,242,234,0.45)", marginTop: 2 }}>
              {isGold ? `Win up to Rs 5,000! (Rs ${premiumBoxPrice} per open)` : "1 free box daily — win cash prizes!"}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 12, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <X size={18} color="#F5F2EA" />
          </button>
        </div>

        {/* Tab switcher */}
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button onClick={() => setActiveBox("free")}
            style={{ padding: "6px 18px", borderRadius: 99, fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer", background: activeBox === "free" ? "#00C875" : "rgba(255,255,255,0.08)", color: activeBox === "free" ? "#000" : "rgba(245,242,234,0.5)" }}>
            🎁 Free Box
          </button>
          <button onClick={() => !(freePhase !== "idle") && !(premPhase !== "idle") && setActiveBox("premium")}
            style={{ padding: "6px 18px", borderRadius: 99, fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer", background: activeBox === "premium" ? "#a855f7" : "rgba(255,255,255,0.08)", color: activeBox === "premium" ? "#fff" : "rgba(245,242,234,0.5)" }}>
            👑 Premium Box
          </button>
        </div>

        {/* Error */}
        {error && (
          <div style={{ margin: "10px 20px 0", padding: "10px 16px", borderRadius: 12, background: "rgba(232,99,58,0.12)", color: "#E8633A", fontSize: 13, textAlign: "center", width: "calc(100% - 40px)" }}>
            {error}
          </div>
        )}

        {/* Status chip */}
        <div style={{ marginTop: 12, padding: "6px 20px", borderRadius: 99, background: accentDim, border: `1px solid ${accentBorder}`, fontSize: 12, fontWeight: 700, color: accent }}>
          {isGold
            ? `Wallet: Rs ${walletBalance.toFixed(0)}`
            : canPlay ? "🎁 Free Box Available!" : `⏰ Next free box in ${freeCountdown.label}`}
        </div>

        {/* The Box */}
        <div style={{ marginTop: 20, position: "relative" }}>
          <div style={{
            cursor: ((isGold && canAffordPremium && premPhase === "idle") || (!isGold && canPlay && freePhase === "idle")) ? "pointer" : "default",
            animation: activePhase === "shaking" ? "boxShake 0.6s ease" : "none",
            filter: ((isGold && canAffordPremium) || (!isGold && canPlay)) ? `drop-shadow(0 0 32px ${isGold ? "rgba(168,85,247,0.5)" : "rgba(0,200,117,0.4)"})` : "grayscale(0.5) opacity(0.7)",
          }} onClick={isGold ? handlePremiumOpen : handleFreeOpen}>
            <BoxSVG phase={activePhase} gold={isGold} />
          </div>

          {/* Prize reveal */}
          {activeResult && activePhase === "revealed" && (
            <div style={{
              position: "absolute", top: -60, left: "50%", transform: "translateX(-50%)",
              padding: "10px 24px", borderRadius: 99, whiteSpace: "nowrap",
              background: activeReward > 0 ? accentDim : "rgba(255,255,255,0.08)",
              border: `1px solid ${activeReward > 0 ? accentBorder : "rgba(255,255,255,0.15)"}`,
              fontSize: 18, fontWeight: 900,
              color: activeReward > 0 ? accent : "rgba(245,242,234,0.5)",
              animation: "resultPop 0.4s cubic-bezier(0.22,1,0.36,1)",
            }}>
              {activeReward > 0 ? `🎉 Rs ${activeReward.toLocaleString()}` : `😔 ${activeResult.prize.label}`}
            </div>
          )}
        </div>

        {/* FREE BOX controls */}
        {!isGold && (
          <>
            {freePhase === "idle" && (
              <button onClick={handleFreeOpen} disabled={!canPlay}
                style={{
                  marginTop: 20, padding: "14px 0", width: 260, borderRadius: 99, border: "none",
                  cursor: canPlay ? "pointer" : "default",
                  background: canPlay ? "linear-gradient(90deg,#059a54,#00C875,#059a54)" : "rgba(255,255,255,0.07)",
                  color: canPlay ? "#fff" : "rgba(245,242,234,0.3)",
                  fontSize: 15, fontWeight: 800,
                  boxShadow: canPlay ? "0 4px 24px rgba(0,200,117,0.3)" : "none",
                }}>
                {canPlay ? "🎁 Open Free Box" : "Come back tomorrow"}
              </button>
            )}
            {!canPlay && freeCountdown.secs > 0 && freePhase === "idle" && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
                <Clock size={13} color="rgba(245,242,234,0.4)" />
                <span style={{ fontSize: 13, fontWeight: 700, color: "#00C875", fontFamily: "monospace" }}>{freeCountdown.label}</span>
              </div>
            )}
            {freeResult && freePhase === "revealed" && (
              <div style={{ marginTop: 16, padding: "20px 28px", borderRadius: 20, textAlign: "center", width: "calc(100% - 40px)", background: activeReward > 0 ? "rgba(5,25,12,0.95)" : "rgba(5,10,8,0.95)", border: `2px solid ${activeReward > 0 ? "rgba(0,200,117,0.4)" : "rgba(255,255,255,0.1)"}`, animation: "resultPop 0.5s cubic-bezier(0.22,1,0.36,1)" }}>
                {activeReward > 0 ? (
                  <>
                    <div style={{ fontSize: 36, marginBottom: 6 }}>🎉</div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: "#00C875" }}>Rs {activeReward.toLocaleString()}</div>
                    <div style={{ fontSize: 13, color: "rgba(245,242,234,0.6)", marginTop: 4 }}>Added to your wallet!</div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 32, marginBottom: 6 }}>😔</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "#F5F2EA" }}>Better Luck Tomorrow!</div>
                    <div style={{ fontSize: 12, color: "rgba(245,242,234,0.4)", marginTop: 4 }}>Try the Premium Box for bigger prizes</div>
                  </>
                )}
                {secondsUntilReset > 0 && (
                  <div style={{ marginTop: 10, fontSize: 12, color: "rgba(245,242,234,0.4)" }}>
                    Next free box in <span style={{ fontFamily: "monospace", color: "#00C875", fontWeight: 700 }}>{freeCountdown.label}</span>
                  </div>
                )}
              </div>
            )}
            {/* Free prize list */}
            {prizes.length > 0 && (
              <div style={{ width: "calc(100% - 40px)", marginTop: 16, padding: "12px 16px", borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: "#00C875", letterSpacing: 2, marginBottom: 8 }}>FREE BOX PRIZES</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {prizes.map(p => (
                    <span key={p.id} style={{ padding: "5px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: "rgba(0,200,117,0.10)", border: "1px solid rgba(0,200,117,0.2)", color: parseFloat(p.rewardAmount) > 0 ? "#00C875" : "rgba(245,242,234,0.3)" }}>
                      {parseFloat(p.rewardAmount) > 0 ? `Rs ${parseFloat(p.rewardAmount).toLocaleString()}` : p.label}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* PREMIUM BOX controls */}
        {isGold && (
          <>
            {premPhase === "idle" && (
              <>
                <button onClick={handlePremiumOpen} disabled={!canAffordPremium || premBuying}
                  style={{
                    marginTop: 20, padding: "14px 0", width: 260, borderRadius: 99, border: "none",
                    cursor: canAffordPremium ? "pointer" : "default",
                    background: canAffordPremium ? "linear-gradient(90deg,#7c3aed,#a855f7,#7c3aed)" : "rgba(255,255,255,0.07)",
                    color: canAffordPremium ? "#fff" : "rgba(245,242,234,0.3)",
                    fontSize: 15, fontWeight: 800,
                    boxShadow: canAffordPremium ? "0 4px 24px rgba(168,85,247,0.35)" : "none",
                  }}>
                  {premBuying ? "Opening…" : `✨ Buy & Open (Rs ${premiumBoxPrice})`}
                </button>
                {!canAffordPremium && (
                  <div style={{ marginTop: 8, fontSize: 11, color: "rgba(245,242,234,0.4)", textAlign: "center" }}>
                    Need Rs {Math.max(0, premiumBoxPrice - walletBalance).toFixed(0)} more. Deposit to unlock.
                  </div>
                )}
              </>
            )}
            {premResult && premPhase === "revealed" && (
              <div style={{ marginTop: 16, padding: "20px 28px", borderRadius: 20, textAlign: "center", width: "calc(100% - 40px)", background: activeReward > 0 ? "rgba(20,5,50,0.95)" : "rgba(10,5,20,0.95)", border: `2px solid ${activeReward > 0 ? "rgba(168,85,247,0.4)" : "rgba(255,255,255,0.1)"}`, animation: "resultPop 0.5s cubic-bezier(0.22,1,0.36,1)" }}>
                {activeReward > 0 ? (
                  <>
                    <div style={{ fontSize: 36, marginBottom: 6 }}>🎉</div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: "#a855f7" }}>Rs {activeReward.toLocaleString()}</div>
                    <div style={{ fontSize: 13, color: "rgba(245,242,234,0.6)", marginTop: 4 }}>Added to your wallet!</div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 32, marginBottom: 6 }}>😔</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "#F5F2EA" }}>Better Luck Next Time!</div>
                    <div style={{ fontSize: 12, color: "rgba(245,242,234,0.4)", marginTop: 4 }}>Try again for a chance at Rs 5,000!</div>
                  </>
                )}
                <button onClick={() => { setPremResult(null); setPremPhase("idle"); }}
                  style={{ marginTop: 14, padding: "8px 20px", borderRadius: 99, background: "linear-gradient(90deg,#7c3aed,#a855f7)", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, color: "#fff" }}>
                  Open Again
                </button>
              </div>
            )}
            {/* Premium prize list */}
            {premiumPrizes.length > 0 && (
              <div style={{ width: "calc(100% - 40px)", marginTop: 16, padding: "12px 16px", borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: "#a855f7", letterSpacing: 2, marginBottom: 8 }}>PREMIUM PRIZES</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {premiumPrizes.map(p => (
                    <span key={p.id} style={{ padding: "5px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.25)", color: parseFloat(p.rewardAmount) > 0 ? "#c084fc" : "rgba(245,242,234,0.3)" }}>
                      {parseFloat(p.rewardAmount) > 0 ? `Rs ${parseFloat(p.rewardAmount).toLocaleString()}` : p.label}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

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
