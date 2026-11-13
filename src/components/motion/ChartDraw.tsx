"use client";

import { useEffect, useRef, useState } from "react";
import { observe } from "./lib";
import { useScene } from "./SceneContext";

/**
 * Courbe qui se trace (primitive 10) : tracé 900 ms, aire synchronisée, point final en léger rebond, annotation
 * qui tombe ensuite. Dans une scène : `play` ; seule : démarre à l'entrée à l'écran. État final rendu serveur.
 */
export function ChartDraw({
  values,
  max,
  width = 320,
  height = 110,
  marker,
  label,
  className = "",
  play,
}: {
  values: number[];
  max?: number;
  width?: number;
  height?: number;
  /** Index du repère vertical (ex. semaine où le travail a été fait). */
  marker?: number;
  label: string;
  className?: string;
  play?: boolean;
}) {
  const scene = useScene();
  const ref = useRef<SVGSVGElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    // Mouvement réduit : la courbe se trace quand même (tracé = sans déplacement).
    if (play !== undefined || !ref.current) return;
    const off = observe(ref.current, (e) => {
      if (e.isIntersecting) {
        setSeen(true);
        off();
      }
    }, { threshold: 0.5 });
    return off;
  }, [play]);

  const top = max ?? Math.max(...values) * 1.08;
  const step = width / Math.max(1, values.length - 1);
  const pts = values.map((v, i) => [i * step, height - (v / top) * height] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L${width} ${height} L0 ${height} Z`;
  const last = pts[pts.length - 1];
  const drawing = play !== undefined ? play && scene.playing : seen;

  return (
    <svg
      ref={ref}
      viewBox={`0 -6 ${width} ${height + 12}`}
      className={`h-auto w-full ${className}`}
      role="img"
      aria-label={label}
      data-drawing={drawing ? "" : undefined}
      style={play !== undefined && scene.playing && !play ? { visibility: "hidden" } : undefined}
    >
      {[0.25, 0.5, 0.75].map((g) => (
        <line key={g} x1="0" x2={width} y1={height * g} y2={height * g} stroke="#D5D9E4" strokeWidth="0.75" strokeDasharray="2 4" />
      ))}
      <path className="chart-area" d={area} fill="#3730A3" opacity="0.08" />
      <path className="chart-line" d={line} pathLength={1} fill="none" stroke="#3730A3" strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" />
      {marker !== undefined ? (
        <line className="chart-note" x1={step * marker} x2={step * marker} y1="0" y2={height} stroke="#F5A524" strokeWidth="1.5" />
      ) : null}
      <circle className="chart-dot" cx={last[0]} cy={last[1]} r="4" fill="#3730A3" stroke="#fff" strokeWidth="2" />
    </svg>
  );
}

export default ChartDraw;
