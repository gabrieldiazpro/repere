'use client';
// Carte schématique par zone (pas de fond de carte) : une case par zone sur une grille, colorée par taux de mention.
// Aucune case ne peut en chevaucher une autre. Clavier : chaque zone est un bouton ; le détail s'affiche à côté. Le tableau de l'écran reprend tout en texte.
import { useState } from 'react';
import { BAND_META, type MapPoint } from './logic';
import { InView } from '../v4/motion';

const pct = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)} %`);

/** Grille schématique des 20 arrondissements de Paris (colonne, ligne), proche de leur position réelle. */
const PARIS_GRID: Record<number, [number, number]> = {
  17: [1, 0], 18: [2, 0], 19: [3, 0],
  16: [0, 1], 8: [1, 1], 9: [2, 1], 10: [3, 1], 20: [4, 1],
  7: [1, 2], 1: [2, 2], 2: [3, 2], 3: [4, 2], 11: [5, 2],
  15: [0, 3], 6: [1, 3], 5: [2, 3], 4: [3, 3], 12: [4, 3],
  14: [1, 4], 13: [2, 4],
};

export interface Tile {
  zoneId: string;
  col: number;
  row: number;
}

/**
 * Place chaque zone sur une case d'une grille, sans chevauchement possible.
 * Arrondissements de Paris : grille fixe reconnaissable. Sinon : positions relatives (x, y) ramenées à la case
 * libre la plus proche, en plaçant d'abord la zone du commerce.
 */
export function tileLayout(points: { zoneId: string; label: string; x?: number; y?: number; cx?: number; cy?: number; home?: boolean }[]): { tiles: Tile[]; cols: number; rows: number } {
  const paris = points.map((p) => /^Paris\s+(\d{1,2})(?:er|e)$/.exec(p.label));
  if (points.length && paris.every((m) => m && PARIS_GRID[Number(m[1])])) {
    const tiles = points.map((p, i) => {
      const [col, row] = PARIS_GRID[Number(paris[i]![1])];
      return { zoneId: p.zoneId, col, row };
    });
    // Ne garder que les colonnes et lignes utilisées.
    const minC = Math.min(...tiles.map((t) => t.col));
    const minR = Math.min(...tiles.map((t) => t.row));
    const out = tiles.map((t) => ({ ...t, col: t.col - minC, row: t.row - minR }));
    return { tiles: out, cols: Math.max(...out.map((t) => t.col)) + 1, rows: Math.max(...out.map((t) => t.row)) + 1 };
  }
  const n = points.length;
  if (!n) return { tiles: [], cols: 0, rows: 0 };
  const cols = Math.max(1, Math.min(6, Math.ceil(Math.sqrt(n * 1.4))));
  const rows = Math.ceil(n / cols) + (n > 2 ? 1 : 0);
  const xs = points.map((p) => p.cx ?? p.x ?? 0);
  const ys = points.map((p) => p.cy ?? p.y ?? 0);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const norm = (v: number, a: number, b: number, size: number) => (b > a ? ((v - a) / (b - a)) * (size - 1) : (size - 1) / 2);
  const order = points.map((_, i) => i).sort((a, b) => Number(Boolean(points[b].home)) - Number(Boolean(points[a].home)));
  const taken = new Set<string>();
  const tiles: Tile[] = new Array(n);
  for (const i of order) {
    const tx = norm(xs[i], x0, x1, cols);
    const ty = norm(ys[i], y0, y1, rows);
    let best: [number, number] = [0, 0];
    let bestD = Infinity;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        if (taken.has(`${c},${r}`)) continue;
        const d = (c - tx) ** 2 + (r - ty) ** 2;
        if (d < bestD) [bestD, best] = [d, [c, r]];
      }
    taken.add(`${best[0]},${best[1]}`);
    tiles[i] = { zoneId: points[i].zoneId, col: best[0], row: best[1] };
  }
  const usedRows = [...new Set(tiles.map((t) => t.row))].sort((a, b) => a - b);
  const out = tiles.map((t) => ({ ...t, row: usedRows.indexOf(t.row) }));
  return { tiles: out, cols, rows: usedRows.length };
}

export function MapView({ points, businessName }: { points: MapPoint[]; businessName: string }) {
  const home = points.find((p) => p.home) ?? points[0];
  const [sel, setSel] = useState<string | null>(home?.zoneId ?? null);
  const cur = points.find((p) => p.zoneId === sel) ?? null;
  const { tiles, cols } = tileLayout(points);
  const at = new Map(tiles.map((t) => [t.zoneId, t]));
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start">
      <figure className="m-0">
        <InView className="v4-light">
        <div
          role="group"
          aria-label={`Carte schématique de visibilité de ${businessName} par zone`}
          className="rp-zonegrid"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, maxWidth: cols * 92 }}
        >
          {points.map((p) => {
            const t = at.get(p.zoneId)!;
            const h = home ? at.get(home.zoneId) : undefined;
            // Allumage quartier par quartier, en partant de votre zone.
            const k = h ? Math.abs(t.col - h.col) + Math.abs(t.row - h.row) : 0;
            const on = p.zoneId === sel;
            const m = BAND_META[p.band];
            return (
              <button
                key={p.zoneId}
                type="button"
                aria-pressed={on}
                aria-label={`${p.label}${p.home ? ' (votre zone)' : ''} : ${m.label}, ${pct(p.mentionRate)} des réponses`}
                onClick={() => setSel(p.zoneId)}
                className="rp-zone v4-light-cell"
                data-band={p.band}
                data-home={p.home ? 'true' : undefined}
                style={{ gridColumn: t.col + 1, gridRow: t.row + 1, ['--band' as string]: m.color, ['--band-ink' as string]: m.ink, ['--k' as string]: k * 2 }}
              >
                <span className="rp-zone-v rp-num">{p.mentionRate === null ? '–' : `${Math.round(p.mentionRate * 100)}`}</span>
                <span className="rp-zone-l">{shortLabel(p.label)}</span>
                {p.home && <span className="rp-zone-home">vous</span>}
              </button>
            );
          })}
        </div>
        </InView>
        <figcaption className="mt-3 text-center text-[12px] text-[var(--muted)]">
          Chiffre de chaque case : part des réponses qui vous citent, en %. Disposition schématique, pas une carte à l’échelle.
        </figcaption>
      </figure>

      <div aria-live="polite" className="rounded-xl border border-[var(--line)] p-4">
        {cur ? (
          <>
            <p className="text-[13px] text-[var(--muted)]">{cur.home ? 'Votre zone' : 'Zone sélectionnée'}</p>
            <p className="rp-display text-[20px]">{cur.label}</p>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-[14px]">
              <div>
                <dt className="text-[12px] text-[var(--muted)]">Taux de mention</dt>
                <dd className="rp-num font-semibold">{pct(cur.mentionRate)}</dd>
              </div>
              <div>
                <dt className="text-[12px] text-[var(--muted)]">Rang moyen quand cité</dt>
                <dd className="rp-num font-semibold">{cur.avgRank === null ? '—' : cur.avgRank.toLocaleString('fr-FR')}</dd>
              </div>
              <div>
                <dt className="text-[12px] text-[var(--muted)]">Réponses analysées</dt>
                <dd className="rp-num font-semibold">{cur.answers}</dd>
              </div>
              <div>
                <dt className="text-[12px] text-[var(--muted)]">Concurrent le plus cité</dt>
                <dd className="font-semibold">{cur.dominantCompetitor ? cur.dominantCompetitor.name : '—'}</dd>
              </div>
            </dl>
            <p className="mt-3 inline-flex items-center gap-2 text-[13px]">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: BAND_META[cur.band].color }} aria-hidden="true" />
              {BAND_META[cur.band].label}
            </p>
          </>
        ) : (
          <p className="text-[14px] text-[var(--muted)]">Choisissez une zone sur la carte.</p>
        )}
      </div>
    </div>
  );
}

/** « Paris 11e » → « 11e » ; « Toulouse, Capitole » → « Capitole » (la ville est dans le titre). */
export function shortLabel(label: string): string {
  const comma = label.split(', ');
  if (comma.length > 1) return comma.slice(1).join(', ');
  const m = /^\S+\s+(\d+(?:er|e))$/.exec(label);
  return m ? m[1] : label;
}
