'use client';

import { useInView } from '@/components/motion/useInView';

/**
 * Mini-courbe qui se trace à l'entrée à l'écran (aussi en mouvement réduit : tracé sans déplacement).
 * Couleur = currentColor (marque par défaut via .ui-stat-spark). Rendu serveur : courbe complète.
 * <Sparkline values={[52, 55, 61]} label="Score : 52, 55, 61" />
 */
export function Sparkline({
  values,
  width = 96,
  height = 32,
  area = true,
  label,
  className = '',
}: {
  values: number[];
  width?: number;
  height?: number;
  area?: boolean;
  label: string;
  className?: string;
}) {
  const [ref, inView] = useInView<SVGSVGElement>(0.5);
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1e-9, max - min);
  const pts = values.map((v, i) => [3 + (i / (values.length - 1)) * (width - 8), 4 + (1 - (v - min) / span) * (height - 8)] as const);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label={label}
      className={`ui-spark block overflow-visible ${className}`}
      data-draw={inView ? '' : undefined}
    >
      {area ? <path className="ui-spark-area chart-area" d={`${d} L${last[0]} ${height} L${pts[0][0]} ${height} Z`} fill="currentColor" /> : null}
      <path className="ui-spark-line" d={d} pathLength={1} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle className="ui-spark-dot" cx={last[0]} cy={last[1]} r="3.5" fill="var(--accent)" stroke="var(--surface)" strokeWidth="1.5" />
    </svg>
  );
}

export default Sparkline;
