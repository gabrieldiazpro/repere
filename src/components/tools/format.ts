/**
 * Formats français pour l'affichage des outils : « 12,90 € », « ± 14 points ». Les fonctions d'AUDIT-SITE
 * renvoient les valeurs brutes du balisage (« 12.90 », « EUR ») : on ne les reformate qu'à l'affichage.
 */
const CURRENCY_SYMBOL: Record<string, string> = { EUR: '€', USD: '$', GBP: '£', CHF: 'CHF' };

function toNumber(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** 12.9 → « 12,90 € » (espace insécable avant le symbole). */
export function formatEuros(v: number | string, currency = 'EUR'): string {
  return formatPrice(v, currency) ?? String(v);
}

/** Prix et devise lus dans une fiche → « 12,90 € » ; devise inconnue gardée en code (« 12,90 SEK »). */
export function formatPrice(v: number | string | null | undefined, currency?: string | null): string | null {
  const n = toNumber(v);
  if (n === null) return v ? String(v) : null;
  const amount = n.toFixed(2).replace('.', ',');
  const withThousands = amount.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const code = (currency ?? 'EUR').trim().toUpperCase();
  return `${withThousands} ${CURRENCY_SYMBOL[code] ?? code}`;
}

/** Marge d'erreur arrondie à l'entier, au format français : 13.7 → « ± 14 points ». */
export function formatMargin(v: number | null | undefined): string | null {
  if (v === null || v === undefined || !Number.isFinite(v)) return null;
  return `± ${Math.round(v)} point${Math.round(v) > 1 ? 's' : ''}`;
}

/**
 * Réécrit les montants bruts d'un texte de diagnostic (« 12.90 EUR », « JSON-LD 12.9 ») au format français.
 * Ne touche qu'aux nombres suivis d'une devise ISO, pour ne pas abîmer les versions, dimensions ou GTIN.
 */
export function frenchPrices(text: string): string {
  return text.replace(/(\d+(?:[.,]\d+)?)\s?(EUR|USD|GBP|CHF)\b/g, (_m, n: string, cur: string) => formatPrice(n, cur) ?? _m);
}
