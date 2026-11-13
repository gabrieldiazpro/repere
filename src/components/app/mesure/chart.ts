// Aides de courbes sans dépendance serveur (importables par les composants clients).

// ---------------------------------------------------------------------------
// Repères (annotations) sur une courbe
// ---------------------------------------------------------------------------

/** Place chaque repère sur la mesure la plus proche qui le suit (ou la dernière), libellés regroupés. */
export function markersFor(dates: readonly string[], notes: readonly { date: string; label: string }[]): { index: number; label: string }[] {
  if (!dates.length) return [];
  const t = dates.map((d) => new Date(d).getTime());
  const first = t[0];
  const byIdx = new Map<number, string[]>();
  for (const n of notes) {
    const x = new Date(`${n.date.slice(0, 10)}T12:00:00Z`).getTime();
    if (!Number.isFinite(x) || x < first - 31 * 86_400_000) continue;
    let idx = t.findIndex((y) => y >= x);
    if (idx < 0) idx = t.length - 1;
    byIdx.set(idx, [...(byIdx.get(idx) ?? []), n.label]);
  }
  return [...byIdx.entries()].sort((a, b) => a[0] - b[0]).map(([index, labels]) => ({ index, label: labels.join(' · ') }));
}

/** Couleur d'intensité d'une cellule de matrice (0–1) : pourcentage de mélange avec la couleur primaire. */
export function heat(rate: number): number {
  if (!Number.isFinite(rate) || rate <= 0) return 0;
  return Math.round(8 + Math.min(1, rate) * 62);
}
