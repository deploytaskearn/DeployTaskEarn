"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import api from "@/lib/api";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { useAuth } from "@/lib/auth-context";
import { WheelSVG } from "@/components/dashboard/WheelSVG";
import { SpinSegment, SpinInfo, GoldSpinResult, BuyGoldSpinResult } from "@/lib/types";

export default function GoldSpinPage() {
  const { user, loading } = useRequireAuth();
  const { refreshUser } = useAuth();
  const router = useRouter();

  const [goldSegments, setGoldSegments] = useState<SpinSegment[]>([]);
  const [goldSpinPrice, setGoldSpinPrice] = useState(500);
  const [walletBalance, setWalletBalance] = useState(0);
  const [goldCredits, setGoldCredits] = useState(0);
  const [fetchError, setFetchError] = useState("");

  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<GoldSpinResult | null>(null);
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState("");
  const prevRot = useRef(0);

  useEffect(() => {
    if (!user) return;
    api.get<SpinInfo>("/spin/info")
      .then(r => {
        setGoldSegments(r.data.goldSegments ?? []);
        setGoldSpinPrice(r.data.goldSpinPrice ?? 500);
        setWalletBalance(r.data.walletBalance ?? 0);
        setGoldCredits(r.data.goldCredits ?? 0);
      })
      .catch(() => setFetchError("Failed to load spin data."));
  }, [user]);

  const canAfford = walletBalance >= goldSpinPrice;
  const need = Math.max(0, goldSpinPrice - walletBalance);

  // Step 1: purchase a credit only — does NOT spin the wheel.
  async function handleBuy() {
    if (buying || spinning) return;
    if (!canAfford) {
      setError(`Rs ${need.toFixed(0)} more needed. Deposit to your wallet first.`);
      return;
    }
    setBuying(true);
    setError("");
    try {
      const res = await api.post<BuyGoldSpinResult>("/spin/buy-gold-spin");
      setWalletBalance(res.data.walletBalance ?? 0);
      setGoldCredits(res.data.goldCredits ?? 0);
      refreshUser();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Purchase failed.";
      setError(msg);
    } finally {
      setBuying(false);
    }
  }

  // Step 2: spins the wheel using a banked credit (from a purchase or a bonus win).
  async function handleSpinGold() {
    if (spinning || goldCredits <= 0) return;
    setError("");
    setResult(null);
    try {
      const res = await api.post<GoldSpinResult>("/spin/gold-spin");
      const { winnerIndex, totalSegments, segments } = res.data;
      if (segments?.length) setGoldSegments(segments);
      setSpinning(true);
      const segAngle = 360 / totalSegments;
      const toWinner = (360 - segAngle / 2) - winnerIndex * segAngle;
      // Base off the last full rotation (not the raw accumulated value) so each
      // spin's landing angle depends only on this spin's winner, not prior spins.
      const base = Math.floor(prevRot.current / 360) * 360;
      const finalRot = base + 1800 + toWinner;
      prevRot.current = finalRot;
      setRotation(finalRot);
      setTimeout(() => {
        setResult(res.data);
        setSpinning(false);
        setWalletBalance(res.data.walletBalance ?? 0);
        setGoldCredits(res.data.goldCredits ?? 0);
        // Sync the shared auth context too, so the dashboard's wallet card is
        // fresh the moment the user navigates back — no manual refresh needed.
        refreshUser();
      }, 5200);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Spin failed.";
      setError(msg);
      setSpinning(false);
    }
  }

  if (loading || !user) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f0800" }}>
        <div style={{ color: "rgba(255,215,0,0.4)", fontSize: 14 }}>Loading…</div>
      </div>
    );
  }

  const reward = result ? parseFloat(result.winner.rewardAmount) : 0;
  const displaySegs = goldSegments.length > 0 ? goldSegments : [];

  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(ellipse at 50% 10%, #2a1500 0%, #0f0800 50%, #050300 100%)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      overflowY: "auto",
    }}>
      {/* Sparkle stars */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 0 }}>
        {[8,15,5,30,20,40,60,10,12,25,70,45].map((top, i) => (
          <div key={i} style={{
            position: "absolute", top: `${top}%`, left: `${(i * 13 + 7) % 90}%`,
            width: 4 + (i % 4), height: 4 + (i % 4), borderRadius: "50%",
            background: "#ffd700", opacity: 0.35,
            animation: `sparkle ${2+(i%3)*0.5}s ${i*0.25}s ease-in-out infinite`,
            filter: "drop-shadow(0 0 4px #ffd700)"
          }} />
        ))}
      </div>

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 440, display: "flex", flexDirection: "column", alignItems: "center", padding: "0 0 48px" }}>

        {/* Header */}
        <div style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "16px 20px 4px" }}>
          <button onClick={() => router.back()} style={{ background: "rgba(255,215,0,0.1)", border: "1px solid rgba(255,215,0,0.2)", borderRadius: 12, width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
            <ArrowLeft size={18} color="#ffd700" />
          </button>
          <div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#ffd700", lineHeight: 1.1 }}>👑 Gold Spin</div>
            <div style={{ fontSize: 11, color: "rgba(255,215,0,0.5)", marginTop: 2 }}>Premium wheel · Big prizes!</div>
          </div>
        </div>

        {/* Prize chips */}
        {displaySegs.filter(s => parseFloat(s.rewardAmount) > 0).length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", padding: "10px 20px 0", width: "100%" }}>
            {displaySegs.filter(s => parseFloat(s.rewardAmount) > 0).slice(0, 8).map(s => (
              <span key={s.id} style={{ padding: "4px 12px", borderRadius: 99, fontSize: 12, fontWeight: 700, background: "rgba(255,215,0,0.12)", color: "#ffd700", border: "1px solid rgba(255,215,0,0.25)" }}>
                Rs {parseFloat(s.rewardAmount).toLocaleString()}
              </span>
            ))}
          </div>
        )}

        {/* Wheel */}
        <div style={{ position: "relative", width: 340, height: 340, margin: "16px auto 0" }}>
          {/* Pointer */}
          <div style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)", width: 0, height: 0, zIndex: 10, borderLeft: "14px solid transparent", borderRight: "14px solid transparent", borderTop: "28px solid #ffd700", filter: "drop-shadow(0 0 10px #ffd700)" }} />
          {displaySegs.length > 0 ? (
            <WheelSVG segments={displaySegs} rotation={rotation} spinning={spinning} gold={true} size={340} />
          ) : (
            <div style={{ width: 340, height: 340, borderRadius: "50%", background: "rgba(255,215,0,0.06)", border: "2px dashed rgba(255,215,0,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ textAlign: "center", color: "rgba(255,215,0,0.4)", fontSize: 13 }}>Wheel segments<br/>not configured yet</div>
            </div>
          )}
          {goldCredits > 0 && !spinning && (
            <button onClick={handleSpinGold} aria-label="Spin" style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 82, height: 82, borderRadius: "50%", background: "transparent", border: "none", cursor: "pointer", zIndex: 5 }} />
          )}
        </div>

        {/* Wallet balance + credits */}
        <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 99, background: "rgba(255,215,0,0.07)", border: "1px solid rgba(255,215,0,0.2)" }}>
          <span style={{ fontSize: 12, color: "rgba(255,215,0,0.5)" }}>Wallet balance:</span>
          <span style={{ fontSize: 18, fontWeight: 900, color: canAfford ? "#ffd700" : "#E8633A", fontFamily: "monospace" }}>
            Rs {walletBalance.toLocaleString()}
          </span>
        </div>

        {goldCredits > 0 && (
          <div style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: "#a0b8ff" }}>
            🎡 {goldCredits} gold spin{goldCredits > 1 ? "s" : ""} ready — tap the wheel to spin!
          </div>
        )}

        {/* Error */}
        {(error || fetchError) && (
          <div style={{ margin: "12px 20px 0", padding: "12px 16px", borderRadius: 14, background: "rgba(232,99,58,0.12)", color: "#E8633A", fontSize: 13, textAlign: "center", width: "calc(100% - 40px)" }}>
            {error || fetchError}
          </div>
        )}

        {/* Result card */}
        {result && (
          <div style={{ margin: "16px 20px 0", width: "calc(100% - 40px)", padding: "24px 20px", borderRadius: 24, textAlign: "center", background: reward > 0 ? "rgba(30,15,0,0.95)" : "rgba(10,5,0,0.95)", border: `2px solid ${reward > 0 ? "#ffd700" : "rgba(255,255,255,0.1)"}`, animation: "resultPop 0.5s cubic-bezier(0.22,1,0.36,1)" }}>
            {reward > 0 ? (
              <>
                <div style={{ fontSize: 40, marginBottom: 8 }}>🎉</div>
                <div style={{ fontSize: 32, fontWeight: 900, color: "#ffd700" }}>Rs {reward.toLocaleString()}</div>
                <div style={{ fontSize: 13, color: "rgba(255,215,0,0.6)", marginTop: 6 }}>Added to your wallet!</div>
                <div style={{ marginTop: 12, fontSize: 13, color: "rgba(255,215,0,0.5)" }}>
                  New balance: <span style={{ color: "#ffd700", fontWeight: 700 }}>Rs {walletBalance.toLocaleString()}</span>
                </div>
              </>
            ) : result.winner.segmentType === "BONUS_SPIN" ? (
              <>
                <div style={{ fontSize: 40, marginBottom: 8 }}>🎡</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#a0b8ff" }}>+1 Bonus Spin!</div>
                <div style={{ fontSize: 12, color: "rgba(160,184,255,0.7)", marginTop: 6 }}>1 free spin + 1 free gold spin added</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 36, marginBottom: 8 }}>😔</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#F5F2EA" }}>{result.winner.label}</div>
                <div style={{ fontSize: 12, color: "rgba(245,242,234,0.4)", marginTop: 6 }}>Better luck next time!</div>
              </>
            )}
          </div>
        )}

        {/* CTA */}
        <div style={{ width: "calc(100% - 40px)", marginTop: 16 }}>
          {spinning ? (
            <div style={{ width: "100%", padding: "18px 0", borderRadius: 18, background: "rgba(255,215,0,0.07)", border: "1px solid rgba(255,215,0,0.2)", textAlign: "center", fontSize: 16, fontWeight: 800, color: "#ffd700", letterSpacing: 1 }}>
              ✨ Spinning…
            </div>
          ) : goldCredits > 0 ? (
            <button
              onClick={handleSpinGold}
              disabled={displaySegs.length === 0}
              style={{
                width: "100%", padding: "18px 0", borderRadius: 18,
                background: "linear-gradient(90deg,#7a5500 0%,#ffd700 50%,#7a5500 100%)",
                border: "none", cursor: "pointer",
                fontSize: 17, fontWeight: 900, color: "#000",
                boxShadow: "0 6px 32px rgba(255,215,0,0.35)",
                letterSpacing: 0.5,
              }}
            >
              👑 Spin Now
            </button>
          ) : (
            <>
              <button
                onClick={handleBuy}
                disabled={!canAfford || buying || displaySegs.length === 0}
                style={{
                  width: "100%", padding: "18px 0", borderRadius: 18,
                  background: canAfford && displaySegs.length > 0
                    ? "linear-gradient(90deg,#7a5500 0%,#ffd700 50%,#7a5500 100%)"
                    : "rgba(255,255,255,0.07)",
                  border: "none", cursor: canAfford && displaySegs.length > 0 ? "pointer" : "default",
                  fontSize: 17, fontWeight: 900,
                  color: canAfford && displaySegs.length > 0 ? "#000" : "rgba(245,242,234,0.3)",
                  boxShadow: canAfford ? "0 6px 32px rgba(255,215,0,0.35)" : "none",
                  letterSpacing: 0.5,
                }}
              >
                {buying ? "Purchasing…" : result ? `👑 Buy Another — Rs ${goldSpinPrice.toLocaleString()}` : `👑 Buy Gold Spin — Rs ${goldSpinPrice.toLocaleString()}`}
              </button>
              {!canAfford && (
                <div style={{ marginTop: 10, fontSize: 12, color: "rgba(255,215,0,0.4)", textAlign: "center" }}>
                  Deposit Rs {need.toFixed(0)} more to unlock
                </div>
              )}
            </>
          )}
        </div>

        {/* Back button */}
        <button onClick={() => router.back()} style={{ marginTop: 20, padding: "10px 24px", borderRadius: 99, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer", fontSize: 13, color: "rgba(245,242,234,0.5)" }}>
          ← Back to Dashboard
        </button>

      </div>

      <style>{`
        @keyframes sparkle { 0%,100%{opacity:0.15;transform:scale(0.7)} 50%{opacity:0.6;transform:scale(1.3)} }
        @keyframes resultPop { from{opacity:0;transform:scale(0.85) translateY(12px)} to{opacity:1;transform:scale(1) translateY(0)} }
      `}</style>
    </div>
  );
}
