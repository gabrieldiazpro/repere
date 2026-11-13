/**
 * Prix et avis cités par les IA comparés à la fiche réelle (livrable 4, teardown F4).
 * Règles d'extraction déterministes ; LLM facultatif (clé d'exécution) pour les éléments où les règles ne trouvent rien.
 * Les écarts de prix alimentent la vérification des faits (`FactCheckItem`, champ « prix »).
 */
import { PROVIDER_LABELS, type ProviderId } from '@/lib/engine/types';
import type { FactCheckItem } from '@/lib/engine/types-v2';
import type { CatalogProduct, Catalog, CompetitorPricePoint, PriceCheck, PriceClaim, PriceReport, ProductTrackingReport, RatingClaim, RecommendedItem } from './types';

/** Extrait lisible : retire le Markdown brut des réponses (gras, italique, code, puces et numéros de liste). */
export function plainQuote(text: string, max = 240): string {
  const t = text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/(^|\s)\*([^*\s][^*]*)\*(?=\s|[.,;:!?]|$)/g, '$1$2')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^\s*(?:[-*•]|\d+[.)])\s+/gm, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

/** Écart de prix toléré (arrondis, promotions courtes) : 3 %. Au-delà de 15 % : gravité haute. */
export const PRICE_TOLERANCE = 0.03;
export const RATING_TOLERANCE = 0.15;

const NOT_PRODUCT_PRICE = /(livraison|offerte?|frais de port|d[eè]s|minimum|abonnement|économie|r[ée]duction|remise|jusqu)\s*(?:de\s*|à\s*)?$/i;

/** Prix en euros lus dans un texte (« 12,90 € », « 12.90 euros », « €12,90 »). Exclut seuils de livraison et remises. */
export function extractPrices(text: string): PriceClaim[] {
  const out: PriceClaim[] = [];
  const re = /(?:€\s?(\d{1,4}(?:[.,]\d{1,2})?))|(\d{1,4}(?:[.,]\d{1,2})?)\s?(?:€|euros?\b|EUR\b)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const raw = m[1] ?? m[2];
    const before = text.slice(Math.max(0, m.index - 28), m.index);
    if (NOT_PRODUCT_PRICE.test(before.trim()) || /-\s*$|%\s*$/.test(before)) continue;
    const value = Number(raw.replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0) continue;
    out.push({ value, currency: 'EUR', raw: m[0].trim(), index: m.index });
  }
  return out;
}

/** Notes lues dans un texte (« 4,6/5 », « 4.6 sur 5 (312 avis) », « noté 4,6 étoiles sur 1 200 avis »). */
export function extractRatings(text: string): RatingClaim[] {
  const out: RatingClaim[] = [];
  const re = /(\d(?:[.,]\d{1,2})?)\s?(?:\/\s?(5|10)\b|sur\s(5|10)\b|étoiles?)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const value = Number(m[1].replace(',', '.'));
    const scale = Number(m[2] ?? m[3] ?? 5);
    if (!(value > 0 && value <= scale)) continue;
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 40);
    const c = /^\s*(?:\(|,|sur|selon|avec|pour)?\s*(?:plus de\s)?(\d{1,3}(?:[\s  .]\d{3})*|\d+)\s*avis/i.exec(after);
    const count = c ? Number(c[1].replace(/[\s  .]/g, '')) : null;
    out.push({ value: scale === 10 ? value / 2 : value, scale: 5, count, raw: (m[0] + (c ? c[0] : '')).trim(), index: m.index });
  }
  return out;
}

const fmtEur = (n: number) => `${n.toFixed(2).replace('.', ',')} €`;
const fmtRating = (n: number) => `${n.toFixed(1).replace('.', ',')}/5`;
const providerLabel = (p: string) => PROVIDER_LABELS[p as ProviderId] ?? p;

/** Le prix cité correspond-il au produit ou à l'une de ses variantes ? */
export function closestPrice(p: CatalogProduct, stated: number): number | null {
  const ref = [p.price, ...(p.variants ?? []).map((v) => v.price)].filter((x): x is number => typeof x === 'number' && x > 0);
  if (!ref.length) return null;
  return ref.reduce((best, x) => (Math.abs(x - stated) < Math.abs(best - stated) ? x : best), ref[0]);
}

export interface LlmClaims {
  /** index d'élément → prix, note, nombre d'avis */
  [key: string]: { price?: number | null; rating?: number | null; reviews?: number | null };
}

/** Extraction LLM facultative (sans clé : null). Ne sert qu'aux éléments où les règles n'ont rien trouvé. */
export async function llmExtractClaims(texts: string[]): Promise<LlmClaims | null> {
  if (!texts.length) return null;
  try {
    const { complete, llmAvailable, parseJsonObject, underDailyCap } = await import('@/lib/execution/llm');
    if (!llmAvailable() || !(await underDailyCap())) return null;
    const prompt = [
      'Pour chaque extrait numéroté, relevez le prix (en euros), la note sur 5 et le nombre d’avis CITÉS dans le texte.',
      'N’inventez rien : null si l’information n’est pas écrite. Répondez en JSON : {"0":{"price":12.9,"rating":4.6,"reviews":312},…}.',
      ...texts.map((t, i) => `[${i}] ${t.slice(0, 400)}`),
    ].join('\n');
    const raw = await complete({ system: 'Vous extrayez des données factuelles, sans jamais en inventer.', prompt, json: true, maxTokens: 600 });
    return parseJsonObject<LlmClaims>(raw);
  } catch {
    return null;
  }
}

/** Clé d'une erreur : IA × produit × type × valeur citée (une erreur répétée par passage n'est comptée qu'une fois). */
export const errorKey = (c: Pick<PriceCheck, 'provider' | 'productId' | 'kind' | 'stated'>) => `${c.provider}|${c.productId}|${c.kind}|${c.stated}`;

/** Erreurs (« faux ») dédoublonnées par IA, produit et valeur, dans l'ordre d'apparition. */
export function uniqueErrors(checks: PriceCheck[]): PriceCheck[] {
  const seen = new Set<string>();
  return checks.filter((c) => {
    if (c.verdict !== 'faux') return false;
    const k = errorKey(c);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

interface ItemCtx {
  item: RecommendedItem;
  provider: string;
  queryId: string;
  prices: PriceClaim[];
  ratings: RatingClaim[];
}

export async function buildPriceReport(tracking: ProductTrackingReport, catalog: Catalog, opts: { llm?: boolean } = {}): Promise<PriceReport> {
  const byId = new Map(catalog.products.map((p) => [p.id, p]));
  const ctxs: ItemCtx[] = [];
  for (const a of tracking.answers)
    for (const item of a.items) ctxs.push({ item, provider: a.provider, queryId: a.queryId, prices: extractPrices(item.text), ratings: extractRatings(item.text) });

  let llmUsed = false;
  if (opts.llm) {
    const missing = ctxs.filter((c) => !c.prices.length && !c.ratings.length && /€|euro|avis|\/5|étoile/i.test(c.item.text));
    const res = await llmExtractClaims(missing.map((c) => c.item.text));
    if (res) {
      llmUsed = true;
      missing.forEach((c, i) => {
        const r = res[String(i)];
        if (!r) return;
        if (typeof r.price === 'number' && r.price > 0) c.prices.push({ value: r.price, currency: 'EUR', raw: fmtEur(r.price), index: 0 });
        if (typeof r.rating === 'number' && r.rating > 0 && r.rating <= 5)
          c.ratings.push({ value: r.rating, scale: 5, count: typeof r.reviews === 'number' ? r.reviews : null, raw: fmtRating(r.rating), index: 0 });
      });
    }
  }

  const checks: PriceCheck[] = [];
  const competitorsByCat = new Map<string, CompetitorPricePoint[]>();
  const catOfQuery = new Map(tracking.answers.map((a) => [a.queryId, a.category ?? '']));
  for (const c of ctxs) {
    const quote = plainQuote(c.item.text);
    if (c.item.catalogId) {
      const p = byId.get(c.item.catalogId);
      if (!p) continue;
      for (const pr of c.prices.slice(0, 1)) {
        const expected = closestPrice(p, pr.value);
        const delta = expected ? Math.round(((pr.value - expected) / expected) * 1000) / 1000 : null;
        checks.push({
          productId: p.id, productName: p.name, provider: c.provider, queryId: c.queryId, kind: 'prix',
          stated: pr.value, expected, delta,
          verdict: delta === null ? 'non_verifiable' : Math.abs(delta) <= PRICE_TOLERANCE ? 'correct' : 'faux',
          quote,
        });
      }
      for (const rt of c.ratings.slice(0, 1)) {
        const expected = p.rating?.value ?? null;
        const delta = expected ? Math.round((rt.value - expected) * 100) / 100 : null;
        checks.push({
          productId: p.id, productName: p.name, provider: c.provider, queryId: c.queryId, kind: 'note',
          stated: rt.value, expected, delta,
          verdict: delta === null ? 'non_verifiable' : Math.abs(delta) <= RATING_TOLERANCE ? 'correct' : 'faux',
          quote, statedCount: rt.count, expectedCount: p.rating?.count ?? null,
        });
      }
    } else if (!c.item.isClient && (c.prices.length || c.ratings.length)) {
      const cat = catOfQuery.get(c.queryId) ?? '';
      const list = competitorsByCat.get(cat) ?? [];
      list.push({
        brand: c.item.brand,
        label: c.item.product && c.item.brand ? `${c.item.brand} – ${c.item.product}` : (c.item.product ?? c.item.brand ?? '?'),
        provider: c.provider, queryId: c.queryId,
        price: c.prices[0]?.value ?? null, rating: c.ratings[0]?.value ?? null, reviews: c.ratings[0]?.count ?? null,
      });
      competitorsByCat.set(cat, list);
    }
  }

  // Une même erreur (même IA, même produit, même valeur) répétée dans plusieurs réponses ne compte qu'une fois.
  const wrong = uniqueErrors(checks);
  const factItems: FactCheckItem[] = wrong
    .filter((c) => c.kind === 'prix' && c.expected !== null)
    .map((c) => ({
      field: 'prix',
      expected: `${c.productName} : ${fmtEur(c.expected as number)}`,
      stated: `${c.productName} : ${fmtEur(c.stated)}`,
      provider: c.provider as ProviderId,
      quote: c.quote,
      verdict: 'faux',
      severity: Math.abs(c.delta ?? 0) >= 0.15 ? 'haute' : 'moyenne',
      source: 'catalogue',
    }));

  const median = (xs: number[]) => {
    if (!xs.length) return null;
    const s = [...xs].sort((a, b) => a - b);
    return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
  };

  const products: PriceReport['products'] = catalog.products.map((p) => {
    const mine = checks.filter((c) => c.productId === p.id);
    const comps = (p.category ? (competitorsByCat.get(p.category) ?? []) : [...competitorsByCat.values()].flat()).slice(0, 20);
    const alerts: string[] = [];
    for (const c of uniqueErrors(mine)) {
      alerts.push(
        c.kind === 'prix'
          ? `${providerLabel(c.provider)} cite ${fmtEur(c.stated)} au lieu de ${fmtEur(c.expected as number)}.`
          : `${providerLabel(c.provider)} cite une note de ${fmtRating(c.stated)} au lieu de ${fmtRating(c.expected as number)}.`,
      );
    }
    const compReviews = median(comps.map((c) => c.reviews).filter((x): x is number => typeof x === 'number'));
    if (p.rating && compReviews && compReviews >= 2 * p.rating.count)
      alerts.push(`Les produits concurrents cités affichent environ ${Math.round(compReviews)} avis, contre ${p.rating.count} pour le vôtre : un déficit d’avis peut expliquer une place plus basse.`);
    const compPrice = median(comps.map((c) => c.price).filter((x): x is number => typeof x === 'number'));
    if (p.price && compPrice && p.price > compPrice * 1.3)
      alerts.push(`Prix médian des concurrents cités : ${fmtEur(compPrice)} (vous : ${fmtEur(p.price)}). Mettez en avant ce qui justifie l’écart (contenance, durée d’usage, fabrication).`);
    return {
      productId: p.id,
      name: p.name,
      price: p.price ?? null,
      rating: p.rating?.value ?? null,
      reviews: p.rating?.count ?? null,
      citedPrices: mine.filter((c) => c.kind === 'prix').map((c) => c.stated),
      citedRatings: mine.filter((c) => c.kind === 'note').map((c) => c.stated),
      competitors: comps,
      alerts,
    };
  });

  return {
    businessId: catalog.businessId,
    checks,
    errors: wrong.length,
    factItems,
    products,
    llm: llmUsed,
    demo: tracking.demo,
  };
}
