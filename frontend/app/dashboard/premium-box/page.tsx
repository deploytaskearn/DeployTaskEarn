"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Clock } from "lucide-react";
import api from "@/lib/api";

interface Prize { id: string; label: string; rewardAmount: string; }
interface MysteryInfo {
  premiumPrizes: Prize[];
  premiumBoxPrice: number;
  walletBalance: number;
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
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

type BoxPhase = "idle" | "shaking" | "opening" | "revealed";

function BoxSVG({ phase }: { phase: BoxPhase }) {
  const lidUp = phase === "opening" || phase === "revealed";
  return (
    <svg viewBox="0 0 200 220" width="200" height="220" style={{ display: "block", overflow: "visible", filter: "drop-shadow(0 0 36px rgba(168,85,247,0.6))" }}>
      <ellipse cx="100" cy="212" rx="85" ry="16" fill="#a855f7" opacity="0.18" />
      <ellipse cx="100" cy="212" rx="60" ry="10" fill="#a855f7" opacity="0.12" />
      {/* Body */}
      <rect x="16" y="96" width="168" height="112" rx="12" fill="#2e1065" />
      <rect x="16" y="96" width="168" height="20" rx="12" fill="black" opacity="0.2" />
      <rect x="84" y="96" width="32" height="112" fill="#c4b5fd" opacity="0.8" rx="4" />
      <rect x="16" y="128" width="168" height="28" fill="#c4b5fd" opacity="0.8" rx="4" />
      {/* Lid */}
      <g style={{ transform: lidUp ? "translateY(-58px) rotate(-10deg)" : "translateY(0)", transformOrigin: "100px 68px", transition: lidUp ? "transform 0.5s cubic-bezier(0.34,1.56,0.64,1)" : "none" }}>
        <rect x="6"  y="50" width="188" height="52" rx="12" fill="#1e0c4e" />
        <rect x="10" y="42" width="180" height="18" rx="8"  fill="#1e0c4e" />
        <rect x="6"  y="88" width="188" height="14" rx="4"  fill="black" opacity="0.15" />
        <rect x="6"  y="62" width="188" height="28" fill="#c4b5fd" opacity="0.8" rx="4" />
        <rect x="84" y="42" width="32"  height="60" fill="#c4b5fd" opacity="0.8" rx="4" />
        {/* Bow left */}
        <ellipse cx="56"  cy="26" rx="48" ry="24" fill="#ede9fe" transform="rotate(-18 56 26)" />
        <ellipse cx="56"  cy="26" rx="32" ry="16" fill="#1e0c4e" opacity="0.28" transform="rotate(-18 56 26)" />
        {/* Bow right */}
        <ellipse cx="144" cy="26" rx="48" ry="24" fill="#ede9fe" transform="rotate(18 144 26)" />
        <ellipse cx="144" cy="26" rx="32" ry="16" fill="#1e0c4e" opacity="0.28" transform="rotate(18 144 26)" />
        {/* Knot */}
        <circle cx="100" cy="42" r="20" fill="#c4b5fd" />
        <circle cx="100" cy="42" r="13" fill="#ede9fe" />
        <circle cx="100" cy="42" r="6"  fill="#c4b5fd" />
      </g>
      {/* Stars */}
      {[{x:30,y:110},{x:160,y:130},{x:140,y:170},{x:40,y:175}].map((s,i) => (
        <text key={i} x={s.x} y={s.y} fontSize="14" fill="#c4b5fd" opacity="0.6">✦</text>
      ))}
    </svg>
  );
}

export default function PremiumBoxPage() {
  const router = useRouter();
  const [info, setInfo] = useState<MysteryInfo | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [phase, setPhase] = useState<BoxPhase>("idle");
  const [result, setResult] = useState<PremiumResult | null>(null);
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState("");

  const price = info?.premiumBoxPrice ?? 300;
  const canAfford = walletBalance >= price;
  const reward = result ? parseFloat(result.prize.rewardAmount) : 0;

  useEffect(() => {
    api.get<MysteryInfo>("/mystery/info")
      .then(r => {
        setInfo(r.data);
        setWalletBalance(r.data.walletBalance ?? 0);
      })
      .catch(() => setError("Failed to load. Please refresh."));
  }, []);

  async function handleOpen() {
    if (buying || phase !== "idle") return;
    if (!canAfford) {
      setError(`You need Rs ${price} in your wallet. Current: Rs ${walletBalance.toFixed(0)}.`);
      return;
    }
    setBuying(true);
    setPhase("shaking");
    setResult(null);
    setError("");
    try {
      const res = await api.post<PremiumResult>("/mystery/buy-premium");
      setTimeout(() => setPhase("opening"), 700);
      setTimeout(() => {
        setResult(res.data);
        setPhase("revealed");
        setWalletBalance(res.data.walletBalance ?? 0);
        setBuying(false);
      }, 1500);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed. Please try again.";
      setError(msg);
      setPhase("idle");
      setBuying(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", background: "radial-gradient(ellipse at 50% 10%, #1e0c4e 0%, #0d0820 45%, #050310 100%)" }}>

      {/* Sparkles */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 0 }}>
        {Array.from({ length: 16 }).map((_, i) => (
          <div key={i} style={{ position: "absolute", left: `${(i * 17 + 9) % 92}%`, top: `${(i * 21 + 7) % 88}%`, width: 3+(i%4), height: 3+(i%4), borderRadius: "50%", background: i % 3 === 0 ? "#c4b5fd" : "#a855f7", opacity: 0.25, animation: `sparkle ${2+(i%3)*0.6}s ${i*0.18}s ease-in-out infinite` }} />
        ))}
      </div>

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 440, display: "flex", flexDirection: "column", alignItems: "center", padding: "0 0 60px" }}>

        {/* Top bar */}
        <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px" }}>
          <button onClick={() => router.back()} style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 12, width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <ArrowLeft size={18} color="#F5F2EA" />
          </button>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#ede9fe" }}>👑 Premium Box</div>
            <div style={{ fontSize: 11, color: "rgba(196,181,253,0.6)", marginTop: 1 }}>Big prizes every time</div>
          </div>
          <div style={{ width: 38 }} />
        </div>

        {/* Wallet balance */}
        <div style={{ marginBottom: 4, padding: "6px 22px", borderRadius: 99, background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.3)", fontSize: 13, fontWeight: 700, color: canAfford ? "#c4b5fd" : "#E8633A" }}>
          Wallet: Rs {walletBalance.toFixed(0)}
        </div>

        {/* Error */}
        {error && (
          <div style={{ margin: "10px 20px 0", padding: "10px 16px", borderRadius: 12, background: "rgba(232,99,58,0.12)", color: "#E8633A", fontSize: 13, textAlign: "center", width: "calc(100% - 40px)" }}>
            {error}
          </div>
        )}

        {/* Box */}
        <div style={{ margin: "24px 0 8px", cursor: (canAfford && phase === "idle") ? "pointer" : "default", animation: phase === "shaking" ? "boxShake 0.6s ease" : "none", filter: canAfford ? "none" : "grayscale(0.4) opacity(0.7)" }} onClick={handleOpen}>
          <BoxSVG phase={phase} />
        </div>

        {/* Result */}
        {result && phase === "revealed" ? (
          <div style={{ marginTop: 8, padding: "24px 32px", borderRadius: 24, textAlign: "center", background: "rgba(20,5,50,0.97)", border: `2px solid ${reward > 0 ? "rgba(168,85,247,0.5)" : "rgba(255,255,255,0.1)"}`, animation: "resultPop 0.5s cubic-bezier(0.22,1,0.36,1)", width: "calc(100% - 40px)" }}>
            {reward > 0 ? (
              <>
                <div style={{ fontSize: 40, marginBottom: 8 }}>🎉</div>
                <div style={{ fontSize: 32, fontWeight: 900, color: "#a855f7" }}>Rs {reward.toLocaleString()}</div>
                <div style={{ fontSize: 14, color: "rgba(245,242,234,0.6)", marginTop: 6 }}>Added to your wallet!</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 36, marginBottom: 8 }}>😔</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#F5F2EA" }}>Better Luck Next Time!</div>
              </>
            )}
            <button onClick={() => { setResult(null); setPhase("idle"); }}
              style={{ marginTop: 16, padding: "10px 28px", borderRadius: 99, background: "linear-gradient(90deg,#7c3aed,#a855f7)", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 800, color: "#fff" }}>
              Open Again
            </button>
          </div>
        ) : (
          <>
            {/* Buy button */}
            <button onClick={handleOpen} disabled={!canAfford || buying || phase !== "idle"}
              style={{ marginTop: 8, padding: "16px 0", width: "calc(100% - 40px)", borderRadius: 16, border: "none", cursor: canAfford ? "pointer" : "default", background: canAfford ? "linear-gradient(90deg,#7c3aed,#a855f7,#7c3aed)" : "rgba(255,255,255,0.07)", color: canAfford ? "#fff" : "rgba(245,242,234,0.3)", fontSize: 15, fontWeight: 800, boxShadow: canAfford ? "0 4px 28px rgba(168,85,247,0.4)" : "none", transition: "opacity 0.2s" }}>
              {buying ? "Opening…" : `✨ Buy & Open — Rs ${price}`}
            </button>
            {!canAfford && (
              <div style={{ marginTop: 8, fontSize: 12, color: "rgba(245,242,234,0.4)", textAlign: "center" }}>
                Need Rs {Math.max(0, price - walletBalance).toFixed(0)} more to unlock
              </div>
            )}
          </>
        )}

        {/* Prize list */}
        {(info?.premiumPrizes?.length ?? 0) > 0 && (
          <div style={{ marginTop: 24, width: "calc(100% - 40px)", padding: "12px 16px", borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(168,85,247,0.15)" }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: "#a855f7", letterSpacing: 2, marginBottom: 9 }}>POSSIBLE PRIZES</div>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              {info!.premiumPrizes.map(p => (
                <span key={p.id} style={{ padding: "5px 11px", borderRadius: 9, fontSize: 12, fontWeight: 700, background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.25)", color: parseFloat(p.rewardAmount) > 0 ? "#c084fc" : "rgba(245,242,234,0.3)" }}>
                  {parseFloat(p.rewardAmount) > 0 ? `Rs ${parseFloat(p.rewardAmount).toLocaleString()}` : p.label}
                </span>
              ))}
            </div>
          </div>
        )}

      </div>

      <style>{`
        @keyframes sparkle { 0%,100%{opacity:0.1;transform:scale(0.8)} 50%{opacity:0.7;transform:scale(1.4)} }
        @keyframes boxShake {
          0%,100%{transform:translateX(0) rotate(0)}
          15%{transform:translateX(-9px) rotate(-6deg)}
          30%{transform:translateX(9px) rotate(6deg)}
          45%{transform:translateX(-6px) rotate(-3deg)}
          60%{transform:translateX(6px) rotate(3deg)}
          75%{transform:translateX(-3px) rotate(-1deg)}
        }
        @keyframes resultPop { from{opacity:0;transform:scale(0.8) translateY(12px)} to{opacity:1;transform:scale(1) translateY(0)} }
      `}</style>
    </div>
  );
}
