/**
 * Module ECOMMERCE (docs/v3/missions/ECOMMERCE.md) : catalogue suivi, suivi par produit, revendeurs cités,
 * prix et avis cités, CA attribué aux IA, livrables (FAQ produit, guide d'achat, JSON-LD Product).
 * Couche de service utilisée par les routes /api/ecommerce/* (l'accès est vérifié par la route : requireBusiness).
 */
import type { BusinessRecord } from '@/lib/db';
import { getLatestAuditForBusiness } from '@/lib/db';
import type { AuditResult } from '@/lib/engine/types';
import type { BrandFactField } from '@/lib/engine/types-v2';
import { emptyCatalog, loadCatalog } from './catalog';
import { demoCatalog, isDemoEcom, withDemoProducts } from './demo';
import type { DeliverableCtx } from './deliverables';
import { buildPriceReport } from './prices';
import { buildRetailerReport } from './retailers';
import { attributeOrders, demoRevenue, emptyRevenue, fromBeacon, type RevenueCounters } from './revenue';
import { connectionStatus, fetchOrders } from './shopify';
import { buildProductTracking } from './tracking';
import type { Catalog, PriceReport, ProductTrackingReport, RetailerReport, RevenueReport } from './types';

export * from './types';
export * from './catalog';
export * from './match';
export * from './tracking';
export * from './retailers';
export * from './prices';
export * from './revenue';
export * from './deliverables';
export { demoCatalog, withDemoProducts, enrichDemoAnswer, isDemoEcom, DEMO_ECOM_ID, DEMO_PRODUCTS } from './demo';
export { shopifyEnabled, connectionStatus, normalizeShop, SHOPIFY_SCOPES, SHOPIFY_PUBLISH_SCOPES, requestedScopes, missingPublishScopes } from './shopify';

type Biz = Pick<BusinessRecord, 'id' | 'name' | 'website'> & { isDemo?: boolean };

/** Catalogue du commerce (démo : catalogue Maison Sora ; sinon document `ecom.catalog`, vide par défaut). */
export async function getCatalog(b: Biz): Promise<Catalog> {
  if (isDemoEcom(b.id)) return demoCatalog();
  return (await loadCatalog(b.id).catch(() => null)) ?? emptyCatalog(b.id, b.name, b.website);
}

/** Dernier audit (démo e-commerce : réponses complétées par des produits). */
export async function getEcomAudit(businessId: string): Promise<AuditResult | null> {
  const a = await getLatestAuditForBusiness(businessId).catch(() => null);
  if (!a) return null;
  return isDemoEcom(businessId) ? withDemoProducts(a) : a;
}

export async function getFactsMap(businessId: string): Promise<Partial<Record<BrandFactField, string>>> {
  try {
    const { getFacts } = await import('@/lib/facts');
    return (await getFacts(businessId)).facts ?? {};
  } catch {
    return {};
  }
}

export interface EcomContext {
  catalog: Catalog;
  audit: AuditResult | null;
  demo: boolean;
}

export async function loadContext(b: Biz): Promise<EcomContext> {
  const [catalog, audit] = await Promise.all([getCatalog(b), getEcomAudit(b.id)]);
  return { catalog, audit, demo: isDemoEcom(b.id) || Boolean(audit?.demo) };
}

export async function productTracking(b: Biz): Promise<ProductTrackingReport> {
  const c = await loadContext(b);
  return buildProductTracking(c.audit, c.catalog, { demo: c.demo });
}

export async function retailerReport(b: Biz): Promise<RetailerReport> {
  const c = await loadContext(b);
  return buildRetailerReport(c.audit, { businessId: b.id, brand: c.catalog.brand || b.name, website: c.catalog.website ?? b.website, demo: c.demo });
}

export async function priceReport(b: Biz, opts: { llm?: boolean } = {}): Promise<PriceReport> {
  const c = await loadContext(b);
  return buildPriceReport(buildProductTracking(c.audit, c.catalog, { demo: c.demo }), c.catalog, { llm: opts.llm && !c.demo });
}

export async function deliverableCtx(b: Biz, catalog: Catalog): Promise<DeliverableCtx> {
  return { brand: catalog.brand || b.name, website: catalog.website ?? b.website, facts: await getFactsMap(b.id) };
}

/** Compteurs de valeur de conversion écrits par le patch t.js (`track.daily`, clés `r.*`, `xc.other`, `xr.other`), sommés sur la période. */
async function revenueCounters(businessId: string, from: string, to: string): Promise<RevenueCounters | null> {
  const { listDocs } = await import('@/lib/store');
  const rows = await listDocs<Record<string, number>>('track.daily', { businessId, limit: 800 }).catch(() => []);
  const out: RevenueCounters = {};
  for (const r of rows) {
    const date = r.id.slice(businessId.length + 1);
    if (!r.id.startsWith(`${businessId}:`) || date < from || date > to) continue;
    for (const [k, v] of Object.entries(r.data)) if (k.startsWith('r.') || k === 'xc.other' || k === 'xr.other') out[k] = (out[k] ?? 0) + (Number(v) || 0);
  }
  return Object.keys(out).length ? out : null;
}

/** CA attribué aux IA sur `days` jours (Shopify si connecté, sinon t.js ; démo pour `demo-ecom`). */
export async function revenueReport(b: Biz, days = 30): Promise<RevenueReport> {
  const n = Math.min(Math.max(Math.floor(days) || 30, 1), 90);
  const { getAiTraffic } = await import('@/lib/tracking');
  const traffic = await getAiTraffic(b.id, n).catch(() => null);
  if (isDemoEcom(b.id) && traffic) return demoRevenue(traffic);
  const to = traffic?.to ?? new Date().toISOString().slice(0, 10);
  const from = traffic?.from ?? new Date(Date.now() - (n - 1) * 86_400_000).toISOString().slice(0, 10);
  const status = await connectionStatus(b.id);
  if (status.connected) {
    const orders = await fetchOrders(b.id, `${from}T00:00:00Z`).catch(() => null);
    if (orders) {
      const catalog = await getCatalog(b);
      const names: Record<string, string> = {};
      for (const p of catalog.products) if (p.url) try { names[new URL(p.url).pathname] = p.name; } catch { /* ignore */ }
      return attributeOrders({ businessId: b.id, from, to, orders, traffic, productNames: names });
    }
  }
  if (traffic) {
    const rep = fromBeacon(b.id, traffic, await revenueCounters(b.id, from, to));
    if (status.connected) rep.caveats.unshift('Connexion Shopify indisponible : reconnectez la boutique. Données t.js affichées.');
    return rep;
  }
  return emptyRevenue(b.id, from, to);
}
