"use client";

import { useEffect, useRef, useState } from "react";
import { bandFor, clampScore } from "./score-bands";

export type ScoreGaugeProps = {
  score: number;
  size?: number;
  range?: { low: number; high: number };
  /** Afficher la pastille de tranche sous la jauge (par défaut : oui). */
  showLabel?: boolean;
  /** Animer à l'apparition (par défaut : oui ; joué aussi en mouvement réduit : c'est un compteur, pas un déplacement). */
  animate?: boolean;
  className?: string;
};

const ARC = "M20 100 A80 80 0 0 1 180 100";
const DURATION = 1200;

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

/** Point sur l'arc pour une valeur 0–100 (centre 100,100, rayon r). */
function pointAt(v: number, r: number) {
  const a = Math.PI - (v / 100) * Math.PI;
  return { x: 100 + r * Math.cos(a), y: 100 - r * Math.sin(a) };
}

export function ScoreGauge({ score, size = 240, range, showLabel = true, animate = true, className = "" }: ScoreGaugeProps) {
  const target = clampScore(score);
  const band = bandFor(target);
  const [value, setValue] = useState(target);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    // V4 : le compteur se joue aussi en mouvement réduit (ce n'est pas un déplacement).
    if (!animate || !el || typeof IntersectionObserver === "undefined") {
      setValue(target);
      return;
    }
    setValue(0);
    let raf = 0;
    let started = false;
    const run = () => {
      const t0 = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - t0) / DURATION);
        setValue(Math.round(easeOutCubic(p) * target));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(
      (entries) => {
        if (!started && entries.some((e) => e.isIntersecting)) {
          started = true;
          io.disconnect();
          run();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [target, animate]);

  const low = range ? clampScore(Math.min(range.low, range.high)) : null;
  const high = range ? clampScore(Math.max(range.low, range.high)) : null;
  const shownBand = bandFor(value);
  const label = `Score ${target} sur 100, ${band.label}${
    low !== null && high !== null ? `, fourchette estimée de ${low} à ${high}` : ""
  }`;
  const height = Math.round(size * 0.6);

  return (
    <div ref={ref} className={`inline-flex flex-col items-center ${className}`} style={{ width: size, maxWidth: "100%" }}>
      <svg
        viewBox="0 0 200 120"
        width={size}
        height={height}
        role="img"
        aria-label={label}
        className="h-auto w-full overflow-visible"
      >
        <title>{label}</title>
        {/* Piste */}
        <path d={ARC} fill="none" stroke="#D5D9E4" strokeWidth="14" strokeLinecap="round" />
        {/* Repères de tranches 40 et 70 */}
        {[40, 70].map((v) => {
          const a = pointAt(v, 70);
          const b = pointAt(v, 90);
          return <line key={v} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#FFFFFF" strokeWidth="2.5" />;
        })}
        {/* Valeur */}
        <path
          d={ARC}
          fill="none"
          stroke={shownBand.color}
          strokeWidth="14"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray="100 200"
          strokeDashoffset={100 - Math.max(value, 0.5)}
          style={{ transition: "stroke 300ms ease" }}
        />
        {/* Fourchette (arc extérieur fin) */}
        {low !== null && high !== null ? (
          <g>
            <path
              d="M6 100 A94 94 0 0 1 194 100"
              fill="none"
              stroke={band.color}
              strokeOpacity="0.45"
              strokeWidth="4"
              strokeLinecap="round"
              pathLength={100}
              strokeDasharray={`${Math.max(high - low, 0.6)} 200`}
              strokeDashoffset={-low}
            />
          </g>
        ) : null}
        <text
          x="100"
          y="88"
          textAnchor="middle"
          fill="#1B1F2E"
          style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 46, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.03em" }}
        >
          {value}
        </text>
        <text x="100" y="108" textAnchor="middle" fill="#5A6275" style={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 500 }}>
          sur 100
        </text>
      </svg>
      {showLabel ? (
        <div className="mt-2 flex flex-col items-center gap-1 text-center">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-sm font-semibold leading-6"
            style={{ background: band.bg, color: band.ink }}
          >
            <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: band.color }} />
            {band.label}
          </span>
          {low !== null && high !== null ? (
            <span className="tabular text-sm text-muted">
              Fourchette estimée : {low} à {high}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default ScoreGauge;
