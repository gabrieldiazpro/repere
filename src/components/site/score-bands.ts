// Tranches de score (docs/01-marque.md §3.6, contrat 00b). Fallback local au cas où le moteur n'est pas encore disponible.
export const SCORE_BANDS = [
  { min: 0, max: 39, label: "Invisible", message: "Les IA vous citent rarement.", color: "#B91C1C", bg: "#FCEAEA", ink: "#991B1B" },
  { min: 40, max: 69, label: "Peu visible", message: "Vous apparaissez parfois, mais d'autres passent avant vous.", color: "#B45309", bg: "#FDF1E3", ink: "#92400E" },
  { min: 70, max: 100, label: "Bien recommandé", message: "Les IA vous recommandent régulièrement.", color: "#15803D", bg: "#E7F5EC", ink: "#166534" },
] as const;

export type ScoreBandInfo = (typeof SCORE_BANDS)[number];

export function clampScore(s: number) {
  if (!Number.isFinite(s)) return 0;
  return Math.max(0, Math.min(100, Math.round(s)));
}

export function bandFor(score: number): ScoreBandInfo {
  const s = clampScore(score);
  return SCORE_BANDS.find((b) => s >= b.min && s <= b.max) ?? SCORE_BANDS[0];
}
