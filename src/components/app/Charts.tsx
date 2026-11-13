import { bandFor } from './tokens';

/** Jauge circulaire : nombre + libellé + couleur (jamais la couleur seule). */
export function ScoreRing({ score, size = 120, showBand = true }: { score: number; size?: number; showBand?: boolean }) {
  const b = bandFor(score);
  const stroke = Math.round(size * 0.08);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const arc = 0.75;
  const val = Math.max(0, Math.min(100, score)) / 100;
  return (
    <div className="relative inline-flex flex-col items-center" style={{ width: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Score ${Math.round(score)} sur 100, ${b.label}`}>
        <g transform={`rotate(135 ${size / 2} ${size / 2})`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--chart-grid)" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${c * arc} ${c}`} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={b.color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${c * arc * val} ${c}`} />
        </g>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden="true">
        <span className="rp-display rp-num" style={{ fontSize: size * 0.3 }}>{Math.round(score)}</span>
        <span className="text-[11px] text-[var(--muted)]">sur 100</span>
      </div>
      {showBand && (
        <span className="-mt-2 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[12px] font-semibold" style={{ background: b.bg, color: b.ink }}>
          <span aria-hidden="true">{b.icon}</span> {b.label}
        </span>
      )}
    </div>
  );
}

/** Mini-courbe sans axes (tendance). */
export function Sparkline({ values, width = 120, height = 32, color = 'var(--primary)', label }: { values: number[]; width?: number; height?: number; color?: string; label: string }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1e-9, max - min);
  const pts = values.map((v, i) => [2 + (i / (values.length - 1)) * (width - 6), 3 + (1 - (v - min) / span) * (height - 6)]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const last = pts.at(-1)!;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label={label} className="block">
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="3" fill="var(--accent)" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

export function Delta({ value, suffix = '', invert = false, label }: { value: number; suffix?: string; invert?: boolean; label?: string }) {
  const good = invert ? value < 0 : value > 0;
  const bad = invert ? value > 0 : value < 0;
  const cls = good ? 'rp-chip-success' : bad ? 'rp-chip-danger' : '';
  return (
    <span className={`rp-chip rp-num ${cls}`}>
      <span aria-hidden="true">{value > 0 ? '↑' : value < 0 ? '↓' : '→'}</span>
      {value > 0 ? '+' : value < 0 ? '−' : ''}
      {Math.abs(value)}
      {suffix}
      <span className="sr-only">{label ?? (value > 0 ? ' en hausse' : value < 0 ? ' en baisse' : ' stable')}</span>
    </span>
  );
}

/** Barre horizontale SVG (0–max) ; le libellé et la valeur sont en HTML autour. */
export function HBar({ value, max, color = 'var(--primary)', track = true, height = 10 }: { value: number; max: number; color?: string; track?: boolean; height?: number }) {
  const v = Math.max(0, Math.min(1, max ? value / max : 0));
  return (
    <svg width="100%" height={height} viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true" className="block">
      {track && <rect x="0" y="0" width="100" height="10" rx="0" fill="var(--chart-track)" />}
      <rect x="0" y="0" width={Math.max(v * 100, v > 0 ? 1.2 : 0)} height="10" fill={color} className="v4-hbar" />
    </svg>
  );
}

/** Graphique en barres SVG par catégorie (libellés HTML pour rester lisibles à toutes les tailles). */
export function CategoryBars({ rows, total, title }: { rows: { label: string; value: number; color?: string; note?: string }[]; total: number; title: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <figure className="m-0" aria-label={title}>
      <ul className="flex flex-col gap-2.5">
        {rows.map((r) => (
          <li key={r.label} className="grid grid-cols-[minmax(96px,34%)_1fr_auto] items-center gap-3 text-[13px]">
            <span className="truncate">{r.label}</span>
            <span className="overflow-hidden rounded-[3px]">
              <HBar value={r.value} max={max} color={r.color} />
            </span>
            <span className="rp-num w-[78px] text-right">
              <strong className="font-semibold">{Math.round((r.value / Math.max(1, total)) * 100)} %</strong>
              <span className="text-[var(--muted)]"> · {r.value}</span>
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

/** Barre de répartition (sentiment) avec libellés. */
export function SplitBar({ parts }: { parts: { label: string; value: number; color: string; ink: string }[] }) {
  const sum = parts.reduce((s, p) => s + p.value, 0) || 1;
  let x = 0;
  return (
    <div>
      <svg width="100%" height="12" viewBox="0 0 100 12" preserveAspectRatio="none" aria-hidden="true" className="block overflow-hidden rounded-full">
        {parts.map((p) => {
          const w = (p.value / sum) * 100;
          const r = <rect key={p.label} x={x} y="0" width={w} height="12" fill={p.color} />;
          x += w;
          return r;
        })}
      </svg>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} aria-hidden="true" />
            {p.label} <strong className="rp-num" style={{ color: p.ink }}>{Math.round((p.value / sum) * 100)} %</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}
