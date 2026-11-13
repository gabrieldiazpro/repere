'use client';

import { useEffect, useId, useRef, useState } from 'react';

export interface Series {
  name: string;
  color: string;
  values: (number | null)[];
  /** série du client : trait épais */
  emphasis?: boolean;
}

function fmt(v: number, mode: 'pct' | 'int' | 'dec') {
  if (mode === 'pct') return `${Math.round(v * 100)} %`;
  if (mode === 'dec') return v.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
  return Math.round(v).toLocaleString('fr-FR');
}

function niceMax(v: number, mode: 'pct' | 'int' | 'dec') {
  if (v <= 0) return mode === 'pct' ? 0.1 : 1;
  if (mode === 'pct') return Math.min(1, Math.ceil((v * 100) / 5) * 5 / 100 + 0.0);
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * p;
}

function useWidth<T extends HTMLElement>(initial = 640) {
  const ref = useRef<T>(null);
  const [w, setW] = useState(initial);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/**
 * Courbes SVG multi-séries : grille, survol avec infobulle, légende cliquable (mise en avant),
 * repères verticaux (actions, incidents). Tableau de données accessible en alternative.
 */
export function LineChart({
  series,
  labels,
  mode = 'int',
  height = 220,
  markers = [],
  title,
  tickEvery,
}: {
  series: Series[];
  labels: string[];
  mode?: 'pct' | 'int' | 'dec';
  height?: number;
  markers?: { index: number; label: string }[];
  title: string;
  tickEvery?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const uid = useId();
  const n = labels.length;
  const pad = { l: 40, r: 12, t: 12, b: 26 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  const max = niceMax(Math.max(0, ...all) * 1.05, mode);
  const x = (i: number) => pad.l + (n <= 1 ? w / 2 : (i / (n - 1)) * w);
  const y = (v: number) => pad.t + (1 - v / max) * h;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((k) => k * max);
  const every = tickEvery ?? Math.max(1, Math.ceil(n / Math.max(2, Math.floor(w / 72))));
  const path = (vals: (number | null)[]) => {
    let d = '';
    let pen = false;
    vals.forEach((v, i) => {
      if (v === null) {
        pen = false;
        return;
      }
      d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  };
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    const i = Math.round(((px - pad.l) / w) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };
  const ordered = [...series].sort((a, b) => Number(!!a.emphasis) - Number(!!b.emphasis));
  const tipLeft = hover !== null ? Math.min(Math.max(x(hover) + 10, 8), width - 190) : 0;

  return (
    <figure className="m-0">
      <div ref={ref} className="relative w-full">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-labelledby={`${uid}-t`}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
          className="block touch-pan-y select-none"
        >
          <title id={`${uid}-t`}>{title}</title>
          {ticks.map((t, i) => (
            <g key={i}>
              <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} stroke={i ? 'var(--chart-grid)' : 'var(--chart-axis)'} />
              <text x={pad.l - 8} y={y(t) + 4} fontSize="11" fill="var(--muted)" textAnchor="end" className="rp-num">
                {fmt(t, mode)}
              </text>
            </g>
          ))}
          {labels.map((l, i) =>
            i === 0 || i === n - 1 || (i % every === 0 && n - 1 - i >= every * 0.6) ? (
              <text key={i} x={x(i)} y={height - 8} fontSize="11" fill="var(--muted)" textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>
                {l}
              </text>
            ) : null,
          )}
          {markers.map((m, i) => (
            <g key={i}>
              <line x1={x(m.index)} x2={x(m.index)} y1={pad.t} y2={pad.t + h} stroke="var(--accent)" strokeWidth="1.5" strokeDasharray="3 3" />
              <circle cx={x(m.index)} cy={pad.t + 3} r="3.5" fill="var(--accent)" />
            </g>
          ))}
          {ordered.map((s) => {
            const dim = focus !== null && focus !== s.name;
            const lastIdx = s.values.map((v, i) => (v === null ? -1 : i)).filter((i) => i >= 0).at(-1);
            return (
              <g key={s.name} opacity={dim ? 0.18 : 1}>
                <path d={path(s.values)} pathLength={1} className="v4-line" fill="none" stroke={s.color} strokeWidth={s.emphasis ? 3 : 1.75} strokeLinejoin="round" strokeLinecap="round" />
                {lastIdx !== undefined && (
                  <circle cx={x(lastIdx)} cy={y(s.values[lastIdx] as number)} r={s.emphasis ? 4.5 : 3} fill={s.emphasis ? 'var(--accent)' : 'var(--surface)'} stroke={s.color} strokeWidth="2" />
                )}
              </g>
            );
          })}
          {hover !== null && (
            <g pointerEvents="none">
              <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + h} stroke="var(--ink)" strokeOpacity="0.25" />
              {series.map((s) =>
                s.values[hover] === null ? null : <circle key={s.name} cx={x(hover)} cy={y(s.values[hover] as number)} r="3.5" fill={s.color} stroke="var(--surface)" strokeWidth="1.5" />,
              )}
            </g>
          )}
        </svg>
        {hover !== null && (
          <div
            className="pointer-events-none absolute top-2 z-10 w-[180px] rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[12px] shadow-[0_8px_24px_-12px_rgba(27,31,46,0.35)]"
            style={{ left: tipLeft }}
            aria-hidden="true"
          >
            <p className="mb-1 font-semibold">{labels[hover]}</p>
            {[...series]
              .filter((s) => s.values[hover] !== null)
              .sort((a, b) => (b.values[hover] as number) - (a.values[hover] as number))
              .slice(0, 7)
              .map((s) => (
                <p key={s.name} className="flex items-center gap-1.5">
                  <span className="h-2 w-2 flex-none rounded-full" style={{ background: s.color }} />
                  <span className={`flex-1 truncate ${s.emphasis ? 'font-semibold' : ''}`}>{s.name}</span>
                  <span className="rp-num">{fmt(s.values[hover] as number, mode)}</span>
                </p>
              ))}
            {markers.filter((m) => m.index === hover).map((m) => (
              <p key={m.label} className="mt-1 border-t border-[var(--hair)] pt-1 text-[var(--warning-ink)]">{m.label}</p>
            ))}
          </div>
        )}
      </div>
      <figcaption className="mt-2 flex flex-wrap gap-x-1 gap-y-1">
        {series.map((s) => (
          <button
            key={s.name}
            type="button"
            aria-pressed={focus === s.name}
            onClick={() => setFocus(focus === s.name ? null : s.name)}
            className={`inline-flex min-h-[30px] items-center gap-1.5 rounded-md px-2 text-[12px] ${focus === s.name ? 'bg-[var(--bg)] font-semibold' : 'text-[var(--muted)] hover:bg-[var(--bg)]'}`}
          >
            <span className="inline-block h-[3px] w-3.5 rounded-full" style={{ background: s.color, height: s.emphasis ? 4 : 3 }} />
            <span className={s.emphasis ? 'font-semibold text-[var(--ink)]' : ''}>{s.name}</span>
          </button>
        ))}
        {markers.length > 0 && (
          <span className="inline-flex min-h-[30px] items-center gap-1.5 px-2 text-[12px] text-[var(--muted)]">
            <span className="inline-block h-3 border-l-2 border-dashed border-[var(--accent)]" /> Repères
          </span>
        )}
      </figcaption>
      <details className="mt-1">
        <summary className="inline-flex min-h-[30px] items-center px-2 text-[12px] text-[var(--muted)] underline-offset-2 hover:underline">Voir les données</summary>
        <div className="rp-scroll mt-1 max-h-64">
          <table className="rp-table text-[12px]">
            <thead>
              <tr>
                <th scope="col">Période</th>
                {series.map((s) => (
                  <th key={s.name} scope="col" className="num">{s.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {labels.map((l, i) => (
                <tr key={i}>
                  <th scope="row" className="font-normal">{l}</th>
                  {series.map((s) => (
                    <td key={s.name} className="num">{s.values[i] === null ? '—' : fmt(s.values[i] as number, mode)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
