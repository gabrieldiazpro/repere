/**
 * Détection des MARQUES et des PRODUITS cités dans une réponse d'IA (teardown 06, F2).
 * Déterministe, sans dépendance : normalisation du moteur, correspondance floue par jetons, gestion des variantes
 * (contenance, parfum, format), garde-fou de marque (un produit du client n'est reconnu que si la ligne ne parle
 * pas d'une AUTRE marque, ou si la marque du client y est nommée).
 */
import { jaroWinkler, norm, normName, splitSegments } from '@/lib/engine/detect';
import { escapeRe } from '@/lib/engine/util';
import type { CatalogProduct, RecommendedItem } from './types';

/** Mots vides ignorés dans les noms de produits. */
const STOP = new Set([
  'de', 'du', 'des', 'la', 'le', 'les', 'l', 'd', 'a', 'au', 'aux', 'et', 'en', 'pour', 'avec', 'un', 'une', 'the', 'of', 'and', 'by',
  'par', 'sur', 'son', 'sa', 'ses', 'notre', 'nos', 'votre', 'vos', 'ce', 'cet', 'cette', 'tres', 'plus', 'tout', 'tous',
]);
/** Contenances, formats et mentions de variante : retirées du nom de base, conservées comme variante. */
const SIZE_RE = /\b(\d+(?:[.,]\d+)?)\s?(g|gr|kg|ml|cl|l|oz|x\d+)\b/g;
const PACK_RE = /\b(lot de \d+|pack de \d+|duo|trio|coffret|recharge|format voyage|mini|maxi)\b/g;

/** Jetons significatifs d'un libellé (normalisé, sans mots vides ni contenances). */
export function tokens(s: string): string[] {
  return norm(s)
    .replace(SIZE_RE, ' ')
    .replace(PACK_RE, ' ')
    .split(' ')
    .filter((t) => t.length >= 2 && !STOP.has(t) && !/^\d+$/.test(t));
}

/** Variante lue dans un libellé (« 75 g », « lot de 2 »), ou null. */
export function variantOf(s: string): string | null {
  const n = norm(s);
  const m = new RegExp(SIZE_RE.source).exec(n) ?? new RegExp(PACK_RE.source).exec(n);
  return m ? m[0] : null;
}

function brandTokens(brand: string): Set<string> {
  return new Set([...tokens(brand), ...tokens(normName(brand))]);
}

/** Libellés sous lesquels un produit peut être cité : nom, alias, variantes, slug d'URL. */
export function productLabels(p: Pick<CatalogProduct, 'name' | 'aliases' | 'variants' | 'url'>): string[] {
  const out = new Set<string>([p.name, ...(p.aliases ?? [])]);
  for (const v of p.variants ?? []) if (v.name && tokens(v.name).length >= 2) out.add(v.name);
  if (p.url) {
    const slug = /\/products?\/([^/?#]+)/.exec(p.url)?.[1];
    if (slug) out.add(decodeURIComponent(slug).replace(/[-_]+/g, ' '));
  }
  return [...out].filter(Boolean);
}

export interface MatcherProduct {
  id: string;
  name: string;
  /** jetons de chaque libellé, sans les jetons de la marque */
  labels: string[][];
  /** jetons qui distinguent ce produit des autres produits du catalogue */
  distinctive: Set<string>;
}

export interface Matcher {
  brand: string;
  brandNorm: string;
  products: MatcherProduct[];
  /** marques connues (client + concurrents), triées de la plus longue à la plus courte */
  brands: string[];
}

/** Prépare la correspondance pour un catalogue. `brands` = marques concurrentes connues (audit, déclarées). */
export function buildMatcher(brand: string, products: CatalogProduct[], brands: string[] = []): Matcher {
  const bt = brandTokens(brand);
  const prepared = products.map((p) => ({
    id: p.id,
    name: p.name,
    labels: productLabels(p)
      .map((l) => tokens(l).filter((t) => !bt.has(t)))
      .filter((l) => l.length > 0),
  }));
  // fréquence des jetons dans le catalogue : un jeton présent dans un seul produit est distinctif
  const freq = new Map<string, number>();
  for (const p of prepared) for (const t of new Set(p.labels.flat())) freq.set(t, (freq.get(t) ?? 0) + 1);
  const many = prepared.length > 1;
  const out: MatcherProduct[] = prepared.map((p) => ({
    ...p,
    distinctive: new Set(p.labels.flat().filter((t) => !many || (freq.get(t) ?? 0) === 1)),
  }));
  const allBrands = [...new Set([brand, ...brands].map((b) => b.trim()).filter((b) => b.length >= 2))];
  allBrands.sort((a, b) => b.length - a.length);
  return { brand, brandNorm: normName(brand), products: out, brands: allBrands };
}

function tokenHit(t: string, segToks: string[]): boolean {
  if (segToks.includes(t)) return true;
  if (t.length < 5) return false;
  // pluriels, fautes légères (« bicarbonnate », « deodorants »)
  return segToks.some((s) => s.length >= 4 && Math.abs(s.length - t.length) <= 2 && jaroWinkler(s, t) >= 0.93);
}

/** Score de correspondance d'un libellé dans un segment (part des jetons retrouvés). */
export function labelScore(label: string[], segToks: string[]): number {
  if (!label.length) return 0;
  return label.filter((t) => tokenHit(t, segToks)).length / label.length;
}

/** Position (dans `text`) de la première occurrence d'une marque, ou -1. */
export function brandIndex(text: string, brand: string): number {
  const n = norm(text);
  const keys = [norm(brand), normName(brand)].filter((k) => k.length >= 3);
  let best = -1;
  for (const k of keys) {
    const m = new RegExp(`(^|\\s)${escapeRe(k)}(\\s|$)`).exec(n);
    if (m && (best < 0 || m.index < best)) best = m.index;
  }
  if (best < 0) {
    const c = norm(brand).replace(/\s+/g, '');
    if (c.length >= 6) best = n.replace(/\s+/g, '').indexOf(c);
  }
  return best;
}

/** Marques nommées dans un texte, dans l'ordre d'apparition (la plus longue gagne en cas de chevauchement). */
export function brandsIn(text: string, brands: string[]): string[] {
  const found: { b: string; i: number }[] = [];
  for (const b of brands) {
    const i = brandIndex(text, b);
    if (i < 0) continue;
    // « Onde Douce » contient « Onde » : on garde la plus longue
    if (found.some((f) => f.i <= i && normName(f.b).includes(normName(b)))) continue;
    found.push({ b, i });
  }
  return found.sort((a, b) => a.i - b.i).map((f) => f.b);
}

export interface ProductHit {
  productId: string;
  score: number;
  variant: string | null;
}

/**
 * Produits du catalogue reconnus dans un segment.
 * Règles : ≥ 75 % des jetons d'un libellé retrouvés, au moins un jeton distinctif quand le produit en a,
 * et garde-fou de marque (si une autre marque est nommée en tête, le client doit l'être aussi).
 */
export function matchProducts(segment: string, m: Matcher): ProductHit[] {
  const segToks = tokens(segment);
  if (!segToks.length || !m.products.length) return [];
  const named = brandsIn(segment, m.brands);
  const clientNamed = named.some((b) => normName(b) === m.brandNorm);
  const otherHead = named.length > 0 && normName(named[0]) !== m.brandNorm;
  if (otherHead && !clientNamed) return [];
  const hits: ProductHit[] = [];
  for (const p of m.products) {
    let best = 0;
    for (const l of p.labels) best = Math.max(best, labelScore(l, segToks));
    if (best < 0.75) continue;
    if (p.distinctive.size && ![...p.distinctive].some((t) => tokenHit(t, segToks))) continue;
    // produit à un seul jeton (« Onde ») : exige la marque du client dans le segment
    if (Math.max(...p.labels.map((l) => l.length)) === 1 && !clientNamed) continue;
    hits.push({ productId: p.id, score: Math.round(best * 100) / 100, variant: variantOf(segment) });
  }
  // deux produits proches (« shampoing solide » et « shampoing solide Onde ») : on garde les meilleurs scores
  const top = Math.max(0, ...hits.map((h) => h.score));
  return hits.filter((h) => h.score >= top - 0.01);
}

/** Libellé produit lu en tête d'un élément de liste (« **Atelier Brume – Shampoing Avoine** : … »). */
export function productLabelOf(segment: string, brand: string | null): string | null {
  const line = segment.split('\n')[0].replace(/^\s*(\d+[.)]|[-*•])\s+/, '').trim();
  const bold = /\*\*([^*]+)\*\*/.exec(line)?.[1];
  let head = (bold ?? line.split(/\s[–—:-]\s|:\s/)[0]).replace(/[*_`]/g, '').trim();
  if (!head || head.length > 90) return null;
  // « Marque – Produit » ou « Produit de Marque »
  if (brand) {
    const parts = head.split(/\s[–—-]\s|,\s/).map((s) => s.trim());
    const nonBrand = parts.filter((s) => brandIndex(s, brand) < 0 || tokens(s).length > tokens(brand).length);
    head = nonBrand.length ? nonBrand.join(' ') : head;
    const b = brandIndex(head, brand);
    if (b >= 0) head = head.replace(new RegExp(`\\s*(de|par|chez)?\\s*${escapeRe(brand)}\\s*`, 'i'), ' ').trim();
  }
  const t = tokens(head);
  if (!t.length || (brand && t.every((x) => brandTokens(brand).has(x)))) return null;
  return head.replace(/\s+/g, ' ').replace(/^[«"“]|[»"”]$/g, '').trim() || null;
}

/**
 * Éléments recommandés d'une réponse, dans l'ordre (rang = position dans la liste ; hors liste : ordre de première mention).
 * Un élément sans marque ni produit reconnu (intro, conseil) est ignoré.
 */
export function extractItems(text: string, m: Matcher): RecommendedItem[] {
  const segs = splitSegments(text);
  const listed = segs.filter((s) => s.listIndex !== null);
  const pool = listed.length ? listed : segs;
  const items: RecommendedItem[] = [];
  const seenBrands = new Set<string>();
  for (const s of pool) {
    const named = brandsIn(s.text, m.brands);
    const brand = named[0] ?? null;
    const hits = matchProducts(s.text, m);
    const isClient = hits.length > 0 || (brand !== null && normName(brand) === m.brandNorm);
    if (!brand && !hits.length) continue;
    // hors liste : une marque n'est classée qu'une fois (première mention)
    if (!listed.length && brand && seenBrands.has(brand) && !hits.length) continue;
    if (brand) seenBrands.add(brand);
    const label = productLabelOf(s.text, brand);
    const base = {
      rank: items.length + 1,
      brand,
      product: label,
      isClient,
      text: s.text.slice(0, 240),
      start: s.start,
    };
    if (hits.length) {
      items.push({ ...base, catalogId: hits[0].productId, matchScore: hits[0].score, ...(hits[0].variant ? { variant: hits[0].variant } : {}) });
    } else items.push(base);
  }
  return items;
}

/** Catégorie d'une question : la catégorie du catalogue dont les jetons y figurent le plus. */
export function categoryOfQuery(query: string, categories: string[]): string | null {
  const q = tokens(query);
  let best: { c: string; s: number } | null = null;
  for (const c of categories) {
    const ct = tokens(c);
    if (!ct.length) continue;
    const s = labelScore(ct, q);
    if (s >= 0.5 && (!best || s > best.s || (s === best.s && ct.length > tokens(best.c).length))) best = { c, s };
  }
  return best?.c ?? null;
}
