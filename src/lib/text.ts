/**
 * Typographie française des textes GÉNÉRÉS (titres de tâches, alertes, digest) : espace insécable avant « : ; ! ? »
 * et à l'intérieur des guillemets, pour qu'aucun signe ne se retrouve seul en début de ligne sur mobile.
 */
const NBSP = ' ';

export function frSpaces(s: string): string {
  if (!s) return s;
  return s
    .replace(/[ \t]+([:;!?»])/g, `${NBSP}$1`)
    .replace(/«[ \t]+/g, `«${NBSP}`)
    .replace(/(\d)[ \t]+(€|%|min\b|h\b|j\b)/g, `$1${NBSP}$2`)
    .replace(/(\S)([;!?»])(?=\s|$)/g, (m, a: string, b: string) => (a === NBSP || /[;!?»]/.test(a) ? m : `${a}${NBSP}${b}`));
}

/** Pluriel simple : plural(2, 'information fausse', 'informations fausses') → « 2 informations fausses ». */
export function plural(n: number, one: string, many: string): string {
  return `${n} ${Math.abs(n) > 1 ? many : one}`;
}

/** Marge d'erreur arrondie à l'entier, en français : 13.7 → « ± 14 pts » (jamais « 13.7 »). Unité « pts » ou vide. */
export function fmtMargin(v: number, unit: 'pts' | 'points' | '' = 'pts'): string {
  const n = Math.round(Math.abs(Number(v) || 0));
  if (!unit) return `± ${n}`;
  const u = unit === 'pts' ? (n > 1 ? 'pts' : 'pt') : n > 1 ? 'points' : 'point';
  return `± ${n} ${u}`;
}

/** Nombre au format français (virgule décimale, espace des milliers) : 1234.5 → « 1 234,5 ». */
export function frNum(v: number, maxDigits = 1): string {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: maxDigits }).format(Number(v) || 0).replace(/[\u202f\u00a0]/g, ' ');
}

/** Écart signé en points, arrondi à l'entier : +3, −2, 0 → « +3 pts », « −2 pts », « 0 pt ». */
export function fmtPts(v: number): string {
  const n = Math.round(Number(v) || 0);
  return `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n)} pt${Math.abs(n) >= 2 ? 's' : ''}`;
}
