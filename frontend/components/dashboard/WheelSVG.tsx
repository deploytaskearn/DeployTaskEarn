"use client";

import { SpinSegment } from "@/lib/types";

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

export function WheelSVG({
  segments,
  rotation,
  spinning,
  gold,
  size = 340,
}: {
  segments: SpinSegment[];
  rotation: number;
  spinning: boolean;
  gold: boolean;
  size?: number;
}) {
  const N = segments.length || 12;
  const segAngle = 360 / N;
  const scale = size / 340;
  const cx = 170, cy = 170, R = 148, lightR = R + 15, numLights = 36;
  const ring = gold ? "#ffd700" : "#ffe066";
  const ringDim = gold ? "#b8860b" : "#c9a227";
  const stroke = gold ? "#ffd700" : "#f5d060";
  const border = gold ? "#7a5500" : "#8a6800";
  const inner = gold ? "#c8960c" : "#c9a227";
  const bg = gold ? "#0f0800" : "#071810";
  const centerFill = gold ? "#3a2200" : "#1a5c36";
  const centerIn = gold ? "#1e1000" : "#0d2a1a";
  const centerOut = gold ? "#0f0800" : "#071810";

  return (
    <svg width={size} height={size} viewBox="0 0 340 340" style={{
      display: "block",
      transform: `rotate(${rotation}deg)`,
      transition: spinning ? "transform 5s cubic-bezier(0.17,0.67,0.12,0.99)" : "none",
      willChange: "transform",
    }}>
      <circle cx={cx} cy={cy} r={R + 22} fill={bg} />
      <circle cx={cx} cy={cy} r={R + 20} fill="none" stroke={border} strokeWidth="3" />
      <circle cx={cx} cy={cy} r={R + 18} fill="none" stroke={stroke} strokeWidth="1" opacity="0.6" />
      <circle cx={cx} cy={cy} r={R + 10} fill="none" stroke={inner} strokeWidth="1.5" />
      {Array.from({ length: numLights }).map((_, i) => {
        const a = (i * (360 / numLights) - 90) * (Math.PI / 180);
        const x = cx + lightR * Math.cos(a), y = cy + lightR * Math.sin(a);
        const bright = i % 3 === 0;
        return (
          <circle key={i} cx={x} cy={y} r={bright ? 4.5 : 3}
            fill={bright ? ring : ringDim}
            style={bright ? { filter: `drop-shadow(0 0 3px ${ring})` } : undefined}
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
        const textColor = (rAmt >= 1000 || isBonus) ? ring : rAmt >= 50 ? "#d4f0c8" : "rgba(245,242,234,0.6)";
        return (
          <g key={seg.id ?? i}>
            <path d={`M ${cx} ${cy} L ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2} Z`}
              fill={seg.color} stroke={centerOut} strokeWidth="1.5" />
            {(rAmt >= 1000 || isBonus) && (
              <path d={`M ${cx} ${cy} L ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2} Z`}
                fill="none" stroke={inner} strokeWidth="1" opacity="0.5" />
            )}
            <g transform={`rotate(${textRot},${tx},${ty})`}>
              <text x={tx} y={ty - 11} textAnchor="middle" dominantBaseline="middle"
                fontSize={isBonus ? 15 : 14}>{segmentEmoji(seg)}</text>
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
        return <line key={i} x1={cx} y1={cy} x2={cx + R * Math.cos(a)} y2={cy + R * Math.sin(a)}
          stroke={centerOut} strokeWidth="2" />;
      })}
      <circle cx={cx} cy={cy} r={52} fill={centerOut} stroke={inner} strokeWidth="3" />
      <circle cx={cx} cy={cy} r={46} fill={centerIn} stroke={ring} strokeWidth="1" opacity="0.5" />
      <circle cx={cx} cy={cy} r={40} fill={centerFill} />
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize="13" fontWeight="900"
        fill="#fff" style={{ fontFamily: "system-ui,sans-serif", letterSpacing: 2 }}>SPIN</text>
    </svg>
  );
}
