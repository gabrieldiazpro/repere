/**
 * Suivi par produit (livrable 2, teardown F2) : dans les réponses d'un audit, marques ET produits cités,
 * rang, présence des produits du client ; agrégats par produit, par catégorie et par question.
 */
import type { AuditResult, QuerySpec } from '@/lib/engine/types';
import { buildMatcher, categoryOfQuery, extractItems } from './match';
import type { AnswerProducts, Catalog, CategoryStat, ProductStat, ProductTrackingReport, QueryRow, RecommendedItem } from './types';

export const TRACKING_NOTES = [
  'Mesure faite par les API des IA : les carrousels « shopping » de leurs interfaces (tuiles produit, prix affichés) ne sont pas reproduits par ces API.',
  'Un produit est reconnu par correspondance floue sur son nom, ses alias, ses variantes et le nom de sa fiche ; ajoutez des alias si une IA le cite autrement.',
];

const r2 = (n: number) => Math.round(n * 1000) / 1000;
const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);

/** Marques à reconnaître : la marque, les concurrents de l'audit et les concurrents déclarés. */
export function knownBrands(audit: Pick<AuditResult, 'competitors' | 'input'> | null, extra: string[] = []): string[] {
  const set = new Set<string>(extra);
  for (const c of audit?.competitors ?? []) set.add(c.name);
  for (const c of (audit?.input as { knownCompetitors?: string[] } | undefined)?.knownCompetitors ?? []) set.add(c);
  return [...set].filter((b) => b && b.trim().length >= 2);
}

function labelOf(i: RecommendedItem): string {
  if (i.product && i.brand) return `${i.brand} – ${i.product}`;
  return i.product ?? i.brand ?? '?';
}

/** Questions de recommandation (les questions « marque » mesurent la perception, pas la recommandation). */
export function recoQueries(audit: Pick<AuditResult, 'queries'>): QuerySpec[] {
  return audit.queries.filter((q) => q.kind !== 'brand');
}

export function analyzeAnswers(audit: AuditResult, catalog: Catalog, extraBrands: string[] = []): AnswerProducts[] {
  const matcher = buildMatcher(catalog.brand, catalog.products, knownBrands(audit, extraBrands));
  const categories = [...new Set(catalog.products.map((p) => p.category).filter((c): c is string => Boolean(c)))];
  const qById = new Map(recoQueries(audit).map((q) => [q.id, q]));
  const out: AnswerProducts[] = [];
  for (const a of audit.answers) {
    const q = qById.get(a.queryId);
    if (!q || a.error || !a.text?.trim()) continue;
    const items = extractItems(a.text, matcher);
    const clientBrand = items.find((i) => i.isClient);
    const seen = new Set<string>();
    const clientProducts: { productId: string; rank: number }[] = [];
    for (const i of items) {
      if (i.catalogId && !seen.has(i.catalogId)) {
        seen.add(i.catalogId);
        clientProducts.push({ productId: i.catalogId, rank: i.rank });
      }
    }
    out.push({
      queryId: q.id,
      query: q.text,
      provider: a.provider,
      run: a.run,
      category: categoryOfQuery(`${q.text} ${q.theme ?? ''}`, categories),
      items,
      clientBrandRank: clientBrand?.rank ?? null,
      clientProducts,
      clientProductPresent: clientProducts.length > 0,
    });
  }
  return out;
}

export function buildProductTracking(audit: AuditResult | null, catalog: Catalog, opts: { extraBrands?: string[]; demo?: boolean } = {}): ProductTrackingReport {
  const notes = [...TRACKING_NOTES];
  if (!audit) {
    return { businessId: catalog.businessId, auditId: null, measuredAt: null, answersAnalyzed: 0, products: [], categories: [], queries: [], answers: [], demo: Boolean(opts.demo), notes: ['Aucun audit disponible : lancez une première mesure.', ...notes] };
  }
  if (!catalog.products.length) notes.unshift('Catalogue vide : seules les marques citées sont suivies. Ajoutez vos produits phares.');
  const answers = analyzeAnswers(audit, catalog, opts.extraBrands);

  // Par produit
  const products: ProductStat[] = catalog.products.map((p) => {
    const eligible = answers.filter((a) => !p.category || !a.category || a.category === p.category);
    const ranks: number[] = [];
    const byProvider: ProductStat['byProvider'] = {};
    const queries = new Set<string>();
    const instead = new Map<string, { label: string; brand: string | null; count: number }>();
    let first = 0;
    for (const a of eligible) {
      const bp = (byProvider[a.provider] ??= { answers: 0, appearances: 0 });
      bp.answers++;
      const hit = a.clientProducts.find((c) => c.productId === p.id);
      if (hit) {
        bp.appearances++;
        ranks.push(hit.rank);
        queries.add(a.queryId);
        if (hit.rank === 1) first++;
      } else {
        for (const i of a.items.filter((x) => !x.isClient).slice(0, 3)) {
          const label = labelOf(i);
          const cur = instead.get(label) ?? { label, brand: i.brand, count: 0 };
          cur.count++;
          instead.set(label, cur);
        }
      }
    }
    const n = eligible.length;
    return {
      productId: p.id,
      name: p.name,
      category: p.category ?? null,
      answers: n,
      appearances: ranks.length,
      visibility: n ? r2(ranks.length / n) : 0,
      firstPlace: first,
      firstPlaceRate: n ? r2(first / n) : 0,
      avgRank: avg(ranks),
      queries: [...queries],
      byProvider,
      recommendedInstead: [...instead.values()].sort((a, b) => b.count - a.count).slice(0, 5),
    };
  });
  products.sort((a, b) => b.visibility - a.visibility || a.name.localeCompare(b.name));

  // Par catégorie (catégories du catalogue + « Autres questions »)
  const cats = new Map<string, AnswerProducts[]>();
  for (const a of answers) {
    const k = a.category ?? 'autres questions';
    cats.set(k, [...(cats.get(k) ?? []), a]);
  }
  const categories: CategoryStat[] = [...cats.entries()].map(([category, as]) => {
    const brandCount = new Map<string, { brand: string; count: number; isClient: boolean }>();
    const prod = new Map<string, { label: string; brand: string | null; ranks: number[] }>();
    let items = 0, clientItems = 0;
    for (const a of as) {
      const seenBrands = new Set<string>();
      for (const i of a.items) {
        items++;
        if (i.catalogId) clientItems++;
        const b = i.isClient ? catalog.brand : i.brand;
        if (b && !seenBrands.has(b)) {
          seenBrands.add(b);
          const cur = brandCount.get(b) ?? { brand: b, count: 0, isClient: i.isClient };
          cur.count++;
          brandCount.set(b, cur);
        }
        if (i.product) {
          const label = labelOf(i);
          const cur = prod.get(label) ?? { label, brand: i.brand, ranks: [] };
          cur.ranks.push(i.rank);
          prod.set(label, cur);
        }
      }
    }
    return {
      category,
      answers: as.length,
      clientBrandAnswers: as.filter((a) => a.clientBrandRank !== null).length,
      clientProductAnswers: as.filter((a) => a.clientProductPresent).length,
      shareOfItems: items ? r2(clientItems / items) : 0,
      topBrands: [...brandCount.values()]
        .sort((a, b) => b.count - a.count)
        .slice(0, 8)
        .map((b) => ({ ...b, share: r2(b.count / as.length) })),
      topProducts: [...prod.values()]
        .sort((a, b) => b.ranks.length - a.ranks.length || (avg(a.ranks) ?? 99) - (avg(b.ranks) ?? 99))
        .slice(0, 8)
        .map((p) => ({ label: p.label, brand: p.brand, count: p.ranks.length, avgRank: avg(p.ranks) ?? 0 })),
    };
  });
  categories.sort((a, b) => b.answers - a.answers);

  // Par question
  const qRows = new Map<string, AnswerProducts[]>();
  for (const a of answers) qRows.set(a.queryId, [...(qRows.get(a.queryId) ?? []), a]);
  const queries: QueryRow[] = [...qRows.entries()].map(([queryId, as]) => {
    const rec = new Map<string, { label: string; brand: string | null; isClient: boolean; ranks: number[] }>();
    for (const a of as)
      for (const i of a.items) {
        const label = i.isClient && !i.product ? catalog.brand : labelOf(i);
        const cur = rec.get(label) ?? { label, brand: i.isClient ? catalog.brand : i.brand, isClient: i.isClient, ranks: [] };
        cur.ranks.push(i.rank);
        rec.set(label, cur);
      }
    const clientRanks = as.flatMap((a) => (a.clientBrandRank !== null ? [a.clientBrandRank] : []));
    return {
      queryId,
      query: as[0].query,
      category: as[0].category,
      answers: as.length,
      clientProductAnswers: as.filter((a) => a.clientProductPresent).length,
      clientBrandAnswers: clientRanks.length,
      bestClientRank: clientRanks.length ? Math.min(...clientRanks) : null,
      recommended: [...rec.values()]
        .sort((a, b) => b.ranks.length - a.ranks.length || (avg(a.ranks) ?? 99) - (avg(b.ranks) ?? 99))
        .slice(0, 10)
        .map((r) => ({ label: r.label, brand: r.brand, isClient: r.isClient, count: r.ranks.length, avgRank: avg(r.ranks) ?? 0 })),
    };
  });

  return {
    businessId: catalog.businessId,
    auditId: audit.id,
    measuredAt: audit.measuredAt ?? audit.createdAt,
    answersAnalyzed: answers.length,
    products,
    categories,
    queries,
    answers,
    demo: Boolean(opts.demo ?? audit.demo),
    notes,
  };
}
