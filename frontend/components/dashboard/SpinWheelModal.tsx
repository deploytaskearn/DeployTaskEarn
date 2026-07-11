"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { X, Clock, Ticket, Crown } from "lucide-react";
import api from "@/lib/api";
import { SpinSegment, SpinInfo, SpinResult } from "@/lib/types";
import { WheelSVG } from "@/components/dashboard/WheelSVG";

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
  const router = useRouter();
  const [info, setInfo] = useState<SpinInfo | null>(null);
  const [canSpin, setCanSpin] = useState(false);
  const [secondsUntilSpin, setSecondsUntilSpin] = useState(0);
  const [walletBalance, setWalletBalance] = useState(0);

  const [freeSpinning, setFreeSpinning] = useState(false);
  const [freeRotation, setFreeRotation] = useState(0);
  const [freeResult, setFreeResult] = useState<SpinResult | null>(null);
  const prevFreeRot = useRef(0);

  const [redeemCode, setRedeemCode] = useState("");
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [redeemMsg, setRedeemMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [error, setError] = useState("");

  const freeCountdown = useCountdown(secondsUntilSpin);

  const goldSpinPrice = info?.goldSpinPrice ?? 500;

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

  const segments: SpinSegment[] = info?.segments ?? [];
  const freeReward = freeResult ? parseFloat(freeResult.winner.rewardAmount) : 0;

  async function handleFreeSpin() {
    if (!canSpin || freeSpinning) return;
    setFreeSpinning(true);
    setFreeResult(null);
    setError("");
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

  function goToGoldSpin() {
    onClose();
    router.push("/dashboard/gold-spin");
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "radial-gradient(ellipse at 50% 20%, #0d3a1a 0%, #04100a 70%)", display: "flex", flexDirection: "column", alignItems: "center", overflowY: "auto" }}>

      {/* Stars */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 0 }}>
        {[8,15,5,30,20,40,60,10,12,25].map((top, i) => (
          <div key={i} style={{ position: "absolute", top: `${top}%`, left: `${(i * 17 + 5) % 85}%`, width: 5+(i%4), height: 5+(i%4), borderRadius: "50%", background: "#ffe066", opacity: 0.5, animation: `sparkle ${2.5+(i%3)*0.4}s ${i*0.3}s ease-in-out infinite`, filter: "drop-shadow(0 0 3px #ffe066)" }} />
        ))}
      </div>

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", alignItems: "center", paddingBottom: 40 }}>

        {/* Header */}
        <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px 8px" }}>
          <div>
            <div style={{ fontSize: 26, fontWeight: 900, color: "#F5F2EA" }}>🎡 Lucky Wheel</div>
            <div style={{ fontSize: 12, color: "rgba(245,242,234,0.5)", marginTop: 2 }}>1 free spin daily!</div>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 12, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
            <X size={18} color="#F5F2EA" />
          </button>
        </div>

        {error && (
          <div style={{ margin: "0 20px 8px", padding: "10px 16px", borderRadius: 12, background: "rgba(232,99,58,0.12)", color: "#E8633A", fontSize: 13, textAlign: "center", width: "calc(100% - 40px)" }}>
            {error}
          </div>
        )}

        {/* ─── FREE SPIN ─── */}
        <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, color: "#00C875", marginBottom: 6, marginTop: 4 }}>FREE SPIN</div>

          <div style={{ position: "relative", width: 340, height: 340 }}>
            <div style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)", width: 0, height: 0, zIndex: 10, borderLeft: "14px solid transparent", borderRight: "14px solid transparent", borderTop: "28px solid #ffe066", filter: "drop-shadow(0 0 8px #ffe066)" }} />
            <WheelSVG segments={segments} rotation={freeRotation} spinning={freeSpinning} gold={false} size={340} />
            {canSpin && !freeSpinning && (
              <button onClick={handleFreeSpin} aria-label="Spin" style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 82, height: 82, borderRadius: "50%", background: "transparent", border: "none", cursor: "pointer", zIndex: 5 }} />
            )}
          </div>

          {!freeResult && !freeSpinning && (
            <button onClick={handleFreeSpin} disabled={!canSpin}
              style={{ marginTop: 12, padding: "14px 0", width: 280, borderRadius: 99, background: canSpin ? "linear-gradient(90deg,#1a7a40 0%,#00C875 50%,#1a7a40 100%)" : "rgba(255,255,255,0.08)", border: "none", cursor: canSpin ? "pointer" : "default", fontSize: 15, fontWeight: 800, color: canSpin ? "#fff" : "rgba(245,242,234,0.35)", boxShadow: canSpin ? "0 4px 24px rgba(0,200,117,0.3)" : "none" }}>
              {canSpin ? "🎁 Spin & Win!" : "Come back tomorrow!"}
            </button>
          )}

          {!canSpin && freeCountdown.secs > 0 && !freeSpinning && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, padding: "8px 18px", borderRadius: 99, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <Clock size={14} color="rgba(245,242,234,0.5)" />
              <span style={{ fontSize: 11, color: "rgba(245,242,234,0.5)" }}>Next free spin in</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: "#ffe066", fontFamily: "monospace" }}>{freeCountdown.label}</span>
            </div>
          )}

          {freeResult && (
            <div style={{ marginTop: 12, padding: "18px 28px", borderRadius: 20, textAlign: "center", maxWidth: 300, background: freeReward > 0 ? "rgba(5,25,12,0.95)" : "rgba(5,10,8,0.95)", border: `2px solid ${freeReward > 0 ? "#ffe066" : "rgba(255,255,255,0.1)"}`, animation: "resultPop 0.5s cubic-bezier(0.22,1,0.36,1)" }}>
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
                  <div style={{ fontSize: 12, color: "rgba(245,242,234,0.4)", marginTop: 4 }}>Try Gold Spin for bigger prizes!</div>
                </>
              )}
            </div>
          )}
        </div>

        {/* ─── GOLD SPIN BANNER ─── */}
        <button
          onClick={goToGoldSpin}
          style={{
            marginTop: 20,
            width: "calc(100% - 40px)",
            padding: "18px 20px",
            borderRadius: 20,
            background: "linear-gradient(135deg, #1e0f00 0%, #3a2200 50%, #1e0f00 100%)",
            border: "1.5px solid rgba(255,215,0,0.4)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            boxShadow: "0 4px 24px rgba(255,215,0,0.15)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 46, height: 46, borderRadius: 14, background: "rgba(255,215,0,0.12)", border: "1px solid rgba(255,215,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Crown size={22} color="#ffd700" />
            </div>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 15, fontWeight: 900, color: "#ffd700" }}>👑 Gold Spin</div>
              <div style={{ fontSize: 11, color: "rgba(255,215,0,0.55)", marginTop: 2 }}>
                Rs {goldSpinPrice.toLocaleString()} · Prizes up to Rs 10,000
              </div>
              <div style={{ fontSize: 10, color: "rgba(255,215,0,0.4)", marginTop: 1 }}>
                Wallet: Rs {walletBalance.toLocaleString()}
              </div>
            </div>
          </div>
          <div style={{ fontSize: 22, color: "#ffd700", flexShrink: 0 }}>›</div>
        </button>

        {/* ─── REDEEM CODE ─── */}
        <div style={{ marginTop: 16, width: "calc(100% - 40px)", padding: "16px 18px", borderRadius: 18, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <Ticket size={14} color="#00C875" />
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
              style={{ padding: "9px 14px", borderRadius: 10, background: "#00C875", color: "#000", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, opacity: redeemLoading || !redeemCode.trim() ? 0.5 : 1 }}>
              {redeemLoading ? "…" : "Claim"}
            </button>
          </form>
        </div>

      </div>

      <style>{`
        @keyframes sparkle { 0%,100%{opacity:0.2;transform:scale(0.8)} 50%{opacity:1;transform:scale(1.2)} }
        @keyframes resultPop { from{opacity:0;transform:scale(0.8) translateY(10px)} to{opacity:1;transform:scale(1) translateY(0)} }
      `}</style>
    </div>
  );
}
