'use client';

import { useMemo } from 'react';
import s from './analysis.module.css';
import { MAP_H, MAP_W, layoutMap } from './mapLayout';

/**
 * Mini-carte du site qui se dessine à mesure que l'exploration avance (vraies URL reçues du flux).
 * Les traits se tracent, les points apparaissent en fondu ; le point en cours de lecture est ambre.
 */
export function SiteMap({ urls, current, fetched }: { urls: string[]; current?: string; fetched: number }) {
  const nodes = useMemo(() => layoutMap(urls), [urls]);
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  let currentKey = '';
  try {
    currentKey = current ? new URL(current).pathname.replace(/\/+$/, '') || '/' : '';
  } catch {
    /* adresse illisible */
  }
  const hubs = nodes.filter((n) => n.level === 1);
  return (
    <svg className={s.map} viewBox={`0 0 ${MAP_W} ${MAP_H}`} role="img" aria-label={`Carte du site : ${fetched} pages lues, ${hubs.length} sections`}>
      <g>
        {nodes.map((n) => {
          const p = n.parent ? byId.get(n.parent) : undefined;
          if (!p) return null;
          return <line key={`e-${n.id}`} className={s.mapEdge} x1={p.x} y1={p.y} x2={n.x} y2={n.y} pathLength={1} />;
        })}
      </g>
      <g>
        {nodes.map((n) => {
          const r = n.level === 0 ? 9 : n.level === 1 ? 6 : 3.6;
          const cur = n.id === currentKey;
          return (
            <g key={`n-${n.id}`}>
              {cur ? <circle className={s.mapHalo} cx={n.x} cy={n.y} r={r + 6} /> : null}
              <circle className={s.mapNode} data-level={n.level} data-current={cur ? '' : undefined} cx={n.x} cy={n.y} r={r} />
            </g>
          );
        })}
      </g>
      <g aria-hidden="true">
        {hubs.slice(0, 8).map((n) => {
          const right = n.x >= MAP_W / 2;
          return (
            <text key={`l-${n.id}`} className={s.mapLabel} x={n.x + (right ? 10 : -10)} y={n.y - 8} textAnchor={right ? 'start' : 'end'}>
              {n.id.length > 18 ? `${n.id.slice(0, 17)}…` : n.id}
            </text>
          );
        })}
      </g>
    </svg>
  );
}

export default SiteMap;
