/**
 * Chiffre d'affaires attribué aux IA (livrable 5, teardown F5) : commandes par moteur, panier moyen, conversion
 * comparée aux autres sources. Sources, dans l'ordre : Shopify (commandes + première visite), valeur de
 * conversion transmise par t.js (compteurs `r.<moteur>` en centimes, si le patch t.js est appliqué), démo
 * `demo-ecom` (dérivée des compteurs démo du module tracking, étiquetée).
 */
import type { AiEngine, AiTrafficSummary } from '@/lib/engine/types-v2';
import { classifyVisit } from '@/lib/tracking/classify';
import type { MinimalOrder, RevenueLine, RevenueReport, RevenueSource } from './types';

export const REVENUE_CAVEATS = [
  'Plancher mesuré : les applications mobiles des IA ne transmettent souvent aucun referrer, ces ventes apparaissent en « direct ».',
  'Le « direct » n’est jamais attribué à une IA. Google AI Overviews / AI Mode sont indiscernables de la recherche Google classique.',
  'Attribution à la première visite connue de l’acheteur (referrer ou utm_source), sans modèle multi-contact.',
];

const round2 = (n: number) => Math.round(n * 100) / 100;

export function line(orders: number, revenueEur: number, visits: number): RevenueLine {
  return {
    orders,
    revenueEur: round2(revenueEur),
    aov: orders ? round2(revenueEur / orders) : null,
    visits,
    conversionRate: visits > 0 ? Math.round((orders / visits) * 10000) / 10000 : null,
  };
}

/** utm_source lu dans l'URL d'arrivée quand Shopify ne l'a pas extrait. */
function utmFromLanding(landing: string | null): string | null {
  if (!landing) return null;
  try {
    return new URL(landing, 'https://x.invalid').searchParams.get('utm_source');
  } catch {
    return null;
  }
}

/** Moteur IA d'une commande (UTM puis referrer de la première visite), ou null. */
export function engineOfOrder(o: MinimalOrder): AiEngine | null {
  return classifyVisit(o.referrerUrl, o.utmSource ?? utmFromLanding(o.landingPage))?.engine ?? null;
}

function pathOf(landing: string | null): string | null {
  if (!landing) return null;
  try {
    return new URL(landing, 'https://x.invalid').pathname.slice(0, 120);
  } catch {
    return null;
  }
}

export interface AttributionInput {
  businessId: string;
  from: string;
  to: string;
  orders: MinimalOrder[];
  /** visites mesurées par t.js (dénominateur de conversion), facultatif */
  traffic?: AiTrafficSummary | null;
  productNames?: Record<string, string>;
}

/** Attribution des commandes Shopify. */
export function attributeOrders(i: AttributionInput): RevenueReport {
  const byEngine = new Map<AiEngine, { orders: number; revenue: number }>();
  const prod = new Map<string, { orders: number; revenue: number }>();
  let aiO = 0, aiR = 0, otherO = 0, otherR = 0;
  let foreign = 0;
  for (const o of i.orders) {
    if (o.currency && o.currency !== 'EUR') {
      foreign++;
      continue;
    }
    const e = engineOfOrder(o);
    if (!e) {
      otherO++;
      otherR += o.totalEur;
      continue;
    }
    aiO++;
    aiR += o.totalEur;
    const cur = byEngine.get(e) ?? { orders: 0, revenue: 0 };
    cur.orders++;
    cur.revenue += o.totalEur;
    byEngine.set(e, cur);
    const p = pathOf(o.landingPage);
    if (p) {
      const c = prod.get(p) ?? { orders: 0, revenue: 0 };
      c.orders++;
      c.revenue += o.totalEur;
      prod.set(p, c);
    }
  }
  const t = i.traffic;
  const aiVisits = t?.installed ? t.totals.aiVisits : 0;
  const allVisits = t?.installed ? t.days.reduce((a, d) => a + d.totalVisits, 0) : 0;
  const visitsOf = (e: AiEngine) => (t?.installed ? (t.totals.byEngine[e] ?? 0) : 0);
  const landingVisits = new Map((t?.topLandingPages ?? []).map((p) => [p.path, p.visits]));
  const caveats = [...REVENUE_CAVEATS];
  if (!t?.installed) caveats.push('Taux de conversion indisponible : installez le script de mesure (t.js) pour compter les visites.');
  if (foreign) caveats.push(`${foreign} commande(s) dans une autre devise que l’euro, non comptée(s).`);
  caveats.push('Shopify (accès read_orders) ne fournit que les 60 derniers jours de commandes.');
  const aiRevenueShare = aiR + otherR > 0 ? Math.round((aiR / (aiR + otherR)) * 1000) / 1000 : null;
  return {
    businessId: i.businessId,
    source: 'shopify',
    from: i.from,
    to: i.to,
    currency: 'EUR',
    ai: line(aiO, aiR, aiVisits),
    other: line(otherO, otherR, Math.max(0, allVisits - aiVisits)),
    byEngine: Object.fromEntries([...byEngine.entries()].map(([e, v]) => [e, line(v.orders, v.revenue, visitsOf(e))])),
    products: [...prod.entries()]
      .map(([path, v]) => ({ path, name: i.productNames?.[path] ?? path, visits: landingVisits.get(path) ?? 0, orders: v.orders, revenueEur: round2(v.revenue) }))
      .sort((a, b) => b.revenueEur - a.revenueEur)
      .slice(0, 10),
    aiRevenueShare,
    connected: { shopify: true, beacon: Boolean(t?.installed) },
    caveats,
    demo: false,
  };
}

/** Compteurs de valeur de conversion (`r.<moteur>` en centimes ; `xc.other` / `xr.other` = commandes et centimes des autres sources) écrits par le patch t.js. */
export type RevenueCounters = Record<string, number>;

/** Rapport depuis t.js seul : conversions par moteur ; CA si la valeur de conversion est transmise. */
export function fromBeacon(businessId: string, t: AiTrafficSummary, revenueCents: RevenueCounters | null): RevenueReport {
  const caveats = [...REVENUE_CAVEATS];
  const hasValue = Boolean(revenueCents && Object.keys(revenueCents).some((k) => k.startsWith('r.')));
  if (!hasValue) caveats.push('Valeur des commandes non transmise : passez le montant à repere("conversion", "commande", montant) ou connectez Shopify.');
  const convBy = new Map<AiEngine, number>();
  for (const d of t.days) for (const [e, n] of Object.entries(d.conversions)) convBy.set(e as AiEngine, (convBy.get(e as AiEngine) ?? 0) + (n ?? 0));
  const eur = (k: string) => (revenueCents?.[k] ?? 0) / 100;
  const byEngine: RevenueReport['byEngine'] = {};
  let aiO = 0, aiR = 0;
  for (const [e, n] of convBy) {
    aiO += n;
    aiR += eur(`r.${e}`);
    byEngine[e] = line(n, eur(`r.${e}`), t.totals.byEngine[e] ?? 0);
  }
  const allVisits = t.days.reduce((a, d) => a + d.totalVisits, 0);
  const otherOrders = revenueCents?.['xc.other'] ?? 0;
  const otherR = eur('xr.other');
  if (!otherOrders) caveats.push('Commandes des autres sources non mesurées par t.js : comparaison de conversion indisponible sans Shopify.');
  return {
    businessId,
    source: t.installed ? 'beacon' : 'none',
    from: t.from,
    to: t.to,
    currency: 'EUR',
    ai: line(aiO, aiR, t.totals.aiVisits),
    other: otherOrders ? line(otherOrders, otherR, Math.max(0, allVisits - t.totals.aiVisits)) : { orders: 0, revenueEur: 0, aov: null, visits: Math.max(0, allVisits - t.totals.aiVisits), conversionRate: null },
    byEngine,
    products: [],
    aiRevenueShare: hasValue && aiR + otherR > 0 && otherOrders ? Math.round((aiR / (aiR + otherR)) * 1000) / 1000 : null,
    connected: { shopify: false, beacon: t.installed },
    caveats,
    demo: t.demo,
  };
}

/** Démo `demo-ecom` (Maison Sora) : CA IA issu du résumé démo du tracking ; autres sources à taux et panier fixés (étiquetés). */
export const DEMO_OTHER = { conversionRate: 0.016, aov: 29.4 };

export function demoRevenue(t: AiTrafficSummary): RevenueReport {
  const c = t.commerce;
  const allVisits = t.days.reduce((a, d) => a + d.totalVisits, 0);
  const otherVisits = Math.max(0, allVisits - t.totals.aiVisits);
  const otherOrders = Math.round(otherVisits * DEMO_OTHER.conversionRate);
  const otherRevenue = otherOrders * DEMO_OTHER.aov;
  const aiR = c?.revenueEur ?? 0;
  const byEngine: RevenueReport['byEngine'] = {};
  for (const [e, v] of Object.entries(c?.byEngine ?? {}) as [AiEngine, { orders: number; revenueEur: number }][]) byEngine[e] = line(v.orders, v.revenueEur, t.totals.byEngine[e] ?? 0);
  return {
    businessId: t.businessId,
    source: 'demo',
    from: t.from,
    to: t.to,
    currency: 'EUR',
    ai: line(c?.orders ?? 0, aiR, t.totals.aiVisits),
    other: line(otherOrders, otherRevenue, otherVisits),
    byEngine,
    products: c?.products ?? [],
    aiRevenueShare: aiR + otherRevenue > 0 ? Math.round((aiR / (aiR + otherRevenue)) * 1000) / 1000 : null,
    connected: { shopify: false, beacon: true },
    caveats: ['Données de démonstration (boutique fictive Maison Sora).', ...REVENUE_CAVEATS],
    demo: true,
  };
}

export function emptyRevenue(businessId: string, from: string, to: string, source: RevenueSource = 'none'): RevenueReport {
  const z = line(0, 0, 0);
  return { businessId, source, from, to, currency: 'EUR', ai: z, other: z, byEngine: {}, products: [], aiRevenueShare: null, connected: { shopify: false, beacon: false }, caveats: [...REVENUE_CAVEATS], demo: false };
}
