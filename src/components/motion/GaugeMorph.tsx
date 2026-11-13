"use client";

import { bandFor } from "@/components/site/score-bands";
import { counterValue } from "./lib";
import { useClock } from "./useClock";
import { useScene } from "./SceneContext";

const ARC = "M14 62 A48 48 0 0 1 110 62";

/**
 * Mini-jauge qui se calcule (primitive 9) : l'arc monte de 0 au score en 700 ms, la couleur change aux seuils
 * 40 et 70 avec un fondu, et le libellé bascule en « letter-reveal ». Hors lecture : valeur finale.
 */
export function GaugeMorph({
  score,
  play,
  duration = 700,
  size = 124,
  className = "",
}: {
  score: number;
  play?: boolean;
  duration?: number;
  size?: number;
  className?: string;
}) {
  const scene = useScene();
  const active = !!play && scene.playing; // se remplit aussi en mouvement réduit
  const t = useClock(active, duration);
  const v = !scene.playing ? score : active ? counterValue(0, score, t, duration) : 0;
  const band = bandFor(v);
  return (
    <div className={`inline-flex flex-col items-center ${className}`} style={{ width: size }}>
      <svg viewBox="0 0 124 70" width={size} height={Math.round(size * 0.565)} aria-hidden="true" className="overflow-visible">
        <path d={ARC} fill="none" stroke="#D5D9E4" strokeWidth="9" strokeLinecap="round" />
        <path
          d={ARC}
          fill="none"
          stroke={band.color}
          strokeWidth="9"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray="100 200"
          strokeDashoffset={100 - Math.max(v, 0.5)}
          style={{ transition: "stroke 150ms linear" }}
        />
        <text x="62" y="58" textAnchor="middle" fill="#1B1F2E" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 26, fontVariantNumeric: "tabular-nums" }}>
          {v}
        </text>
      </svg>
      <span
        key={band.label}
        className="letter-reveal mt-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[0.72rem] font-semibold"
        style={{ background: band.bg, color: band.ink }}
      >
        {band.label}
      </span>
    </div>
  );
}

export default GaugeMorph;
