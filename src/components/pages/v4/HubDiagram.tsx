/**
 * Repéré au centre, ses intégrations autour : trait plein qui se trace = disponible, pointillé = en préparation.
 * L'état vient de la page (état réel). Formes génériques, aucun logo. Composant serveur.
 */
import type { CSSProperties } from "react";
import s from "./v4.module.css";

export type HubItem = { id: string; label: string; ok: boolean };

export function HubDiagram({ items, label }: { items: HubItem[]; label: string }) {
  const cx = 260;
  const cy = 150;
  const n = items.length;
  return (
    <figure data-reveal="" className={s.hub}>
      <svg viewBox="0 0 520 300" className={s.diagram} role="img" aria-label={label}>
        {items.map((it, i) => {
          const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
          const x = cx + Math.cos(a) * 118;
          const y = cy + Math.sin(a) * 112;
          const anchor = Math.abs(x - cx) < 20 ? "middle" : x > cx ? "start" : "end";
          const tx = anchor === "middle" ? x : x + (x > cx ? 14 : -14);
          const ty = anchor === "middle" ? (y < cy ? y - 16 : y + 26) : y + 5;
          const dl = { ["--d" as string]: `${200 + i * 110}ms` } as CSSProperties;
          return (
            <g key={it.id}>
              {it.ok ? (
                <path d={`M${cx} ${cy} L${x.toFixed(1)} ${y.toFixed(1)}`} pathLength={1} className={s.draw} style={dl} stroke="var(--color-primary)" strokeWidth="2" fill="none" />
              ) : (
                <path d={`M${cx} ${cy} L${x.toFixed(1)} ${y.toFixed(1)}`} className={s.pop} style={dl} stroke="var(--color-warning)" strokeWidth="1.6" strokeDasharray="4 5" fill="none" />
              )}
              <g className={s.pop} style={{ ["--d" as string]: `${500 + i * 110}ms` } as CSSProperties}>
                <circle cx={x} cy={y} r="9" fill={it.ok ? "var(--color-success)" : "#fff"} stroke={it.ok ? "var(--color-success)" : "var(--color-warning)"} strokeWidth="2" />
                {it.ok ? <path d={`M${x - 4} ${y} l3 3 l5 -6`} stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /> : <circle cx={x} cy={y} r="2.5" fill="var(--color-warning)" />}
                <text x={tx} y={ty} textAnchor={anchor} className={s.hubText}>
                  {it.label}
                </text>
              </g>
            </g>
          );
        })}
        <circle cx={cx} cy={cy} r="38" fill="var(--color-primary-deep)" />
        <circle cx={cx} cy={cy} r="38" fill="none" stroke="var(--color-primary-bg)" strokeWidth="6" />
        <text x={cx} y={cy + 6} textAnchor="middle" className={s.hubCenter}>
          Repéré
        </text>
      </svg>
      <figcaption className={s.hubLegend}>
        <span>
          <i className={s.hubOk} aria-hidden="true" /> Disponible
        </span>
        <span>
          <i className={s.hubSoon} aria-hidden="true" /> En préparation
        </span>
      </figcaption>
    </figure>
  );
}

export default HubDiagram;
