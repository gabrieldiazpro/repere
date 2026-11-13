// Tokens de marque (docs/01-marque.md) — copiés ici pour ne dépendre d'aucun autre module à l'exécution.
export const C = {
  primary: '#3730A3',
  primaryBg: '#ECEBFA',
  accent: '#F5A524',
  success: '#15803D',
  successBg: '#E7F5EC',
  successInk: '#166534',
  warning: '#B45309',
  warningBg: '#FDF1E3',
  warningInk: '#92400E',
  danger: '#B91C1C',
  dangerBg: '#FCEAEA',
  dangerInk: '#991B1B',
  ink: '#1B1F2E',
  muted: '#5A6275',
  line: '#D5D9E4',
  bg: '#F6F7FB',
  white: '#FFFFFF',
} as const;

export interface PdfBand { label: string; color: string; bg: string; ink: string; message: string }

/** Tranches de la jauge (docs/01-marque.md §3.6). Local au PDF : identique à scoreBand() du moteur. */
export function bandFor(score: number): PdfBand {
  if (score < 40) return { label: 'Invisible', color: C.danger, bg: C.dangerBg, ink: C.dangerInk, message: 'Les IA vous citent rarement.' };
  if (score < 70) return { label: 'Peu visible', color: C.warning, bg: C.warningBg, ink: C.warningInk, message: "Vous apparaissez parfois, mais d'autres passent avant vous." };
  return { label: 'Bien recommandé', color: C.success, bg: C.successBg, ink: C.successInk, message: 'Les IA vous recommandent régulièrement.' };
}
