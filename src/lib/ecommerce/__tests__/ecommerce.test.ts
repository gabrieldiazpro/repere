import { createHmac } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { getLatestAuditForBusiness } from '@/lib/db';
import type { AuditResult } from '@/lib/engine/types';
import type { AiTrafficSummary } from '@/lib/engine/types-v2';
import { getAiTraffic } from '@/lib/tracking';
import {
  importFromUrls,
  mergeProducts,
  normalizeProduct,
  parsePrice,
  productUrlsFromSitemap,
  productsFromShopifyJson,
} from '../catalog';
import { buildBuyingGuide, buildProductFaq, buildProductJsonLd, productJsonLdWarnings, TO_COMPLETE } from '../deliverables';
import { demoCatalog, withDemoProducts } from '../demo';
import type { Fetcher } from '../fetch';
import { buildMatcher, extractItems, matchProducts } from '../match';
import { buildPriceReport, extractPrices, extractRatings } from '../prices';
import { attributeOrders, demoRevenue, engineOfOrder, fromBeacon } from '../revenue';
import { buildRetailerReport, classifyEcomUrl } from '../retailers';
import {
  accessToken,
  buildAuthorizeUrl,
  connectWithCode,
  connectionStatus,
  decryptToken,
  missingPublishScopes,
  encryptToken,
  getConnection,
  normalizeShop,
  signState,
  toMinimalOrder,
  verifyCallbackHmac,
  verifyState,
} from '../shopify';
import { buildProductTracking } from '../tracking';
import type { Catalog, MinimalOrder } from '../types';

beforeAll(() => {
  (globalThis as { __repereDocsDir?: string }).__repereDocsDir = path.join(os.tmpdir(), `repere-ecom-test-${process.pid}`);
});

const catalog: Catalog = {
  businessId: 'b1',
  brand: 'Maison Sora',
  website: 'maison-sora.fr',
  updatedAt: '2026-01-01T00:00:00Z',
  products: [
    { id: 'onde', name: 'Shampoing solide « Onde »', category: 'shampoing solide', price: 12.9, aliases: ['Onde'], variants: [{ name: '75 g', price: 12.9 }, { name: 'Lot de 2', price: 23.9 }], rating: { value: 4.7, count: 214 }, source: 'manual', updatedAt: '' },
    { id: 'avoine', name: 'Shampoing solide Avoine douceur', category: 'shampoing solide', price: 13.9, source: 'manual', updatedAt: '' },
    { id: 'deo', name: 'Déodorant solide sans bicarbonate', category: 'déodorant solide', price: 9.9, source: 'manual', updatedAt: '' },
  ],
};

describe('correspondance des produits', () => {
  const m = buildMatcher('Maison Sora', catalog.products, ['Onde Douce', 'Atelier Brume']);

  it('reconnaît un produit, sa variante, et ignore une autre marque au nom proche', () => {
    expect(matchProducts('Maison Sora – shampoing solide Onde 75 g, très doux', m)[0]).toMatchObject({ productId: 'onde', variant: '75 g' });
    expect(matchProducts('Onde Douce – shampoing solide Ortie', m)).toEqual([]);
    expect(matchProducts('le shampoing solide Avoine douceur de Maison Sora', m)[0].productId).toBe('avoine');
    // fautes et pluriels
    expect(matchProducts('Maison Sora : déodorants solides sans bicarbonnate', m)[0]?.productId).toBe('deo');
  });

  it('classe les éléments d’une liste avec rang, marque et produit', () => {
    const text = 'Voici :\n\n1. **Atelier Brume – Shampoing solide Ortie** – efficace.\n2. **Maison Sora – Shampoing solide Onde** (12,90 €) – doux.\n3. **Onde Douce** – bio.\n\nBon choix.';
    const items = extractItems(text, m);
    expect(items.map((i) => [i.rank, i.brand, i.isClient])).toEqual([
      [1, 'Atelier Brume', false],
      [2, 'Maison Sora', true],
      [3, 'Onde Douce', false],
    ]);
    expect(items[0].product).toBe('Shampoing solide Ortie');
    expect(items[1].catalogId).toBe('onde');
  });
});

describe('catalogue', () => {
  it('valide et normalise une saisie', () => {
    expect(normalizeProduct({ name: '' }, 'manual')).toEqual({ error: expect.any(String) });
    expect(normalizeProduct({ name: 'Savon', gtin: '12ab' }, 'manual')).toEqual({ error: expect.stringContaining('GTIN') });
    const p = normalizeProduct({ name: 'Savon <b>doux</b>', price: '1 234,50 €', gtin: '3770012345017', url: 'boutique.fr/products/savon', aliases: 'doux; savon doux' }, 'manual');
    expect(p).toMatchObject({ id: 'savon-b-doux-b', price: 1234.5, gtin: '3770012345017', url: 'https://boutique.fr/products/savon', aliases: ['doux', 'savon doux'], currency: 'EUR' });
    expect(parsePrice('12,9')).toBe(12.9);
    expect(parsePrice('abc')).toBeUndefined();
  });

  it('fusionne sans doublon (même id ou même URL)', () => {
    const a = normalizeProduct({ name: 'Savon A', url: 'https://x.fr/products/a' }, 'manual') as never;
    const b = normalizeProduct({ name: 'Savon A bis', url: 'https://x.fr/products/a', price: 3 }, 'url') as never;
    const r = mergeProducts([a], [b]);
    expect(r).toMatchObject({ added: 0, updated: 1 });
    expect(r.products[0]).toMatchObject({ id: 'savon-a', price: 3 });
  });

  it('lit le /products.json public d’une boutique Shopify', () => {
    const ps = productsFromShopifyJson(
      { products: [{ title: 'Bougie Figue', handle: 'bougie-figue', product_type: 'Bougie', vendor: 'X', variants: [{ title: '200 g', price: '24.00', barcode: '3770000000011' }, { title: '400 g', price: '39.00' }] }] },
      'https://x.fr',
    );
    expect(ps[0]).toMatchObject({ id: 'bougie-figue', url: 'https://x.fr/products/bougie-figue', price: 24, category: 'bougie', gtin: '3770000000011' });
    expect(ps[0].variants).toHaveLength(2);
  });

  it('importe des fiches et parcourt un index de sitemaps (récupération injectée)', async () => {
    const pages: Record<string, string> = {
      'https://x.fr/sitemap.xml': '<sitemapindex><sitemap><loc>https://x.fr/sitemap_pages.xml</loc></sitemap><sitemap><loc>https://x.fr/sitemap_products_1.xml</loc></sitemap></sitemapindex>',
      'https://x.fr/sitemap_products_1.xml': '<urlset><url><loc>https://x.fr/products/theiere</loc></url><url><loc>https://x.fr/pages/contact</loc></url></urlset>',
      'https://x.fr/sitemap_pages.xml': '<urlset><url><loc>https://x.fr/a-propos</loc></url></urlset>',
      'https://x.fr/products/theiere':
        '<html><head><script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Théière 1,2 L","gtin13":"3760000000017","offers":{"@type":"Offer","price":"89.00","priceCurrency":"EUR","availability":"https://schema.org/InStock"},"aggregateRating":{"@type":"AggregateRating","ratingValue":"4.7","reviewCount":"38"}}</script></head><body><h1>Théière</h1></body></html>',
    };
    const fetcher: Fetcher = async (url) => (pages[url] ? { url, status: 200, contentType: 'text/html', body: pages[url] } : null);
    const urls = await productUrlsFromSitemap('https://x.fr', fetcher);
    expect(urls).toEqual(['https://x.fr/products/theiere']);
    const r = await importFromUrls([...urls, 'https://x.fr/absente'], fetcher);
    expect(r.products[0]).toMatchObject({ name: 'Théière 1,2 L', price: 89, gtin: '3760000000017', availability: 'InStock', rating: { value: 4.7, count: 38 } });
    expect(r.errors).toHaveLength(1);
  });
});

describe('prix et notes cités', () => {
  it('extrait prix et notes, sans les seuils de livraison', () => {
    expect(extractPrices('Prix : 12,90 €, livraison offerte dès 39 € ; lot à 23.90 euros').map((p) => p.value)).toEqual([12.9, 23.9]);
    expect(extractRatings('noté 4,6/5 sur 1 200 avis')[0]).toMatchObject({ value: 4.6, count: 1200 });
    expect(extractRatings('8/10 (35 avis)')[0]).toMatchObject({ value: 4, count: 35 });
  });
});

describe('démo Maison Sora (demo-ecom)', () => {
  let audit: AuditResult;
  beforeAll(async () => {
    audit = withDemoProducts((await getLatestAuditForBusiness('demo-ecom')) as AuditResult);
  });

  it('suit produits et catégories', () => {
    const t = buildProductTracking(audit, demoCatalog());
    expect(t.demo).toBe(true);
    expect(t.answersAnalyzed).toBeGreaterThan(10);
    const onde = t.products.find((p) => p.productId === 'shampoing-solide-onde')!;
    expect(onde.appearances).toBeGreaterThan(0);
    expect(onde.visibility).toBeGreaterThan(0);
    expect(onde.visibility).toBeLessThanOrEqual(1);
    expect(t.categories.map((c) => c.category)).toEqual(expect.arrayContaining(['shampoing solide', 'déodorant solide']));
    const sh = t.categories.find((c) => c.category === 'shampoing solide')!;
    expect(sh.topBrands.length).toBeGreaterThan(2);
    expect(sh.topProducts[0].label).toMatch(/–/);
    // le soin visage n'est demandé dans aucune question : 0 réponse éligible
    expect(t.products.find((p) => p.productId === 'soin-visage-solide')!.answers).toBe(0);
  });

  it('détecte l’erreur de prix volontaire et l’expose à la vérification des faits', async () => {
    const t = buildProductTracking(audit, demoCatalog());
    const r = await buildPriceReport(t, demoCatalog());
    const wrong = r.checks.filter((c) => c.verdict === 'faux');
    expect(wrong.length).toBeGreaterThan(0);
    expect(wrong.every((c) => c.provider === 'perplexity' && c.stated === 14.9 && c.expected === 12.9)).toBe(true);
    expect(r.factItems[0]).toMatchObject({ field: 'prix', verdict: 'faux', provider: 'perplexity' });
    expect(r.checks.some((c) => c.kind === 'note' && c.verdict === 'correct')).toBe(true);
    expect(r.products.find((p) => p.productId === 'shampoing-solide-onde')!.alerts.join(' ')).toMatch(/14,90/);
  });

  it('classe les sources : marque, marketplace, revendeur, comparatif', () => {
    const r = buildRetailerReport(audit, { businessId: 'demo-ecom', brand: 'Maison Sora', website: 'maison-sora.fr', demo: true });
    expect(r.citations).toBeGreaterThan(0);
    expect(r.answersWithSources).toBeGreaterThan(0);
    expect(r.thirdPartyShare).toBeGreaterThanOrEqual(0);
    expect(r.thirdPartyShare).toBeLessThanOrEqual(1);
    const sum = Object.values(r.byKind).reduce((a, b) => a + (b?.share ?? 0), 0);
    expect(sum).toBeCloseTo(1, 1);
    expect(r.notes.join(' ')).toMatch(/gemini/i);
    expect(classifyEcomUrl('https://www.amazon.fr/s?k=x', { brand: 'Maison Sora' }).kind).toBe('marketplace');
    expect(classifyEcomUrl('https://www.sephora.fr/shop/x', { brand: 'Maison Sora' }).kind).toBe('retailer');
    expect(classifyEcomUrl('https://maison-sora.fr/products/onde', { brand: 'Maison Sora', website: 'maison-sora.fr' }).kind).toBe('brand');
    expect(classifyEcomUrl('https://www.idealo.fr/prechcat.html', { brand: 'Maison Sora' }).kind).toBe('comparison');
  });

  it('CA démo dérivé du trafic démo, comparé aux autres sources', async () => {
    const t = await getAiTraffic('demo-ecom', 30);
    const r = demoRevenue(t);
    expect(r.demo).toBe(true);
    expect(r.source).toBe('demo');
    expect(r.ai.orders).toBe(t.commerce?.orders);
    expect(r.ai.revenueEur).toBeCloseTo(t.commerce?.revenueEur ?? 0, 1);
    expect(r.other.conversionRate).toBeGreaterThan(0);
    expect(r.aiRevenueShare).toBeGreaterThan(0);
    expect(r.aiRevenueShare).toBeLessThan(1);
    expect(r.caveats[0]).toMatch(/démonstration/);
  });

  it('répartition démo par IA cohérente : commandes entières, aucun CA sans commande, sommes = totaux', async () => {
    const r = demoRevenue(await getAiTraffic('demo-ecom', 30));
    const lines = Object.values(r.byEngine);
    expect(lines.length).toBeGreaterThan(1);
    for (const l of lines) {
      expect(Number.isInteger(l.orders)).toBe(true);
      expect(l.orders).toBeGreaterThanOrEqual(0);
      if (l.orders === 0) expect(l.revenueEur).toBe(0);
      expect(l.revenueEur).toBeGreaterThanOrEqual(0);
    }
    expect(lines.reduce((a, l) => a + l.orders, 0)).toBe(r.ai.orders);
    expect(lines.reduce((a, l) => a + l.revenueEur, 0)).toBeCloseTo(r.ai.revenueEur, 2);
  });
});

describe('extraits et libellés e-commerce', () => {
  it('plainQuote retire le Markdown brut', async () => {
    const { plainQuote } = await import('../prices');
    expect(plainQuote('1. **Maison Sora – Shampoing solide** : 12,90 €, *très* doux.')).toBe('Maison Sora – Shampoing solide : 12,90 €, très doux.');
    expect(plainQuote('x'.repeat(300)).length).toBeLessThanOrEqual(240);
  });
});

describe('CA attribué aux IA', () => {
  const o = (id: string, total: number, ref: string | null, utm: string | null = null, landing: string | null = null): MinimalOrder => ({ id, createdAt: '2026-11-01T10:00:00Z', totalEur: total, currency: 'EUR', referrerUrl: ref, landingPage: landing, utmSource: utm, utmMedium: null, sourceName: 'web' });

  it('attribue par referrer puis UTM (y compris dans l’URL d’arrivée), jamais le direct', () => {
    expect(engineOfOrder(o('1', 10, 'https://chatgpt.com/'))).toBe('chatgpt');
    expect(engineOfOrder(o('2', 10, null, null, '/products/onde?utm_source=chatgpt.com'))).toBe('chatgpt');
    expect(engineOfOrder(o('3', 10, null))).toBeNull();
    const r = attributeOrders({
      businessId: 'b1', from: '2026-10-10', to: '2026-11-08',
      orders: [o('1', 30, 'https://chatgpt.com/', null, 'https://x.fr/products/onde'), o('2', 50, 'https://www.perplexity.ai/search'), o('3', 20, 'https://www.google.com/'), o('4', 100, null), { ...o('5', 99, 'https://chatgpt.com/'), currency: 'USD' }],
      productNames: { '/products/onde': 'Onde' },
    });
    expect(r.ai).toMatchObject({ orders: 2, revenueEur: 80, aov: 40, conversionRate: null });
    expect(r.other).toMatchObject({ orders: 2, revenueEur: 120 });
    expect(r.byEngine.chatgpt?.orders).toBe(1);
    expect(r.products[0]).toMatchObject({ path: '/products/onde', name: 'Onde', orders: 1 });
    expect(r.aiRevenueShare).toBe(0.4);
    expect(r.caveats.join(' ')).toMatch(/autre devise/);
  });

  it('t.js seul : conversions, CA si la valeur est transmise', () => {
    const t: AiTrafficSummary = {
      businessId: 'b1', from: '2026-11-01', to: '2026-11-02', installed: true, demo: false, topLandingPages: [],
      days: [{ date: '2026-11-01', visits: { chatgpt: 40 }, conversions: { chatgpt: 2 }, totalVisits: 1000, bots: {} }],
      totals: { aiVisits: 40, aiShare: 0.04, conversions: 2, byEngine: { chatgpt: 40 } },
    };
    const without = fromBeacon('b1', t, null);
    expect(without.ai).toMatchObject({ orders: 2, revenueEur: 0, conversionRate: 0.05 });
    expect(without.caveats.join(' ')).toMatch(/Valeur des commandes non transmise/);
    const withValue = fromBeacon('b1', t, { 'r.chatgpt': 6400, 'xc.other': 15, 'xr.other': 45000 });
    expect(withValue.ai).toMatchObject({ revenueEur: 64, aov: 32 });
    expect(withValue.other).toMatchObject({ orders: 15, revenueEur: 450 });
    expect(withValue.aiRevenueShare).toBeCloseTo(64 / 514, 3);
  });
});

describe('connecteur Shopify', () => {
  it('valide la boutique, l’état signé et le HMAC du retour', () => {
    expect(normalizeShop('Ma-Boutique')).toBe('ma-boutique.myshopify.com');
    expect(normalizeShop('https://ma-boutique.myshopify.com/admin')).toBe('ma-boutique.myshopify.com');
    expect(normalizeShop('ma-boutique.myshopify.com.attacker.example')).toBeNull();
    const state = signState('b1', 'x.myshopify.com', 'nonce123');
    expect(verifyState(state, 'nonce123')).toEqual({ businessId: 'b1', shop: 'x.myshopify.com' });
    expect(verifyState(state, 'autre')).toBeNull();
    expect(verifyState(state, 'nonce123', 600_000, Date.now() + 700_000)).toBeNull();
    const params = new URLSearchParams({ code: 'abc', shop: 'x.myshopify.com', state, timestamp: '1700000000' });
    const msg = [...params.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${k}=${v}`).join('&');
    params.set('hmac', createHmac('sha256', 'secret-test').update(msg).digest('hex'));
    expect(verifyCallbackHmac(params, 'secret-test')).toBe(true);
    params.set('code', 'modifie');
    expect(verifyCallbackHmac(params, 'secret-test')).toBe(false);
    expect(decryptToken(encryptToken('shpat_123'))).toBe('shpat_123');
  });

  it('échange le code (jeton expirant), chiffre au repos et rafraîchit avant expiration', async () => {
    process.env.SHOPIFY_CLIENT_ID = 'cid';
    process.env.SHOPIFY_CLIENT_SECRET = 'csecret';
    const bodies: string[] = [];
    const f = (async (_url: string, init?: RequestInit) => {
      bodies.push(String(init?.body));
      const refresh = String(init?.body).includes('grant_type=refresh_token');
      return new Response(JSON.stringify({ access_token: refresh ? 'shpat_new' : 'shpat_1', scope: 'read_products,read_orders', expires_in: refresh ? 3600 : 30, refresh_token: 'shprt_1', refresh_token_expires_in: 7776000 }), { status: 200 });
    }) as typeof fetch;
    await connectWithCode('shop-biz', 'x.myshopify.com', 'code1', f);
    expect(bodies[0]).toContain('expiring=1');
    const stored = await getConnection('shop-biz');
    expect(stored?.accessToken).not.toContain('shpat');
    const tok = await accessToken('shop-biz', f);
    expect(tok).toEqual({ shop: 'x.myshopify.com', token: 'shpat_new' });
    expect(bodies[1]).toContain('grant_type=refresh_token');
    delete process.env.SHOPIFY_CLIENT_ID;
    delete process.env.SHOPIFY_CLIENT_SECRET;
  });

  it('V5 : demande les droits d’écriture de l’agent de publication sans casser une connexion en lecture', async () => {
    process.env.SHOPIFY_CLIENT_ID = 'cid';
    process.env.SHOPIFY_CLIENT_SECRET = 'csecret';
    const scope = new URL(buildAuthorizeUrl('x.myshopify.com', 'st')).searchParams.get('scope')!.split(',');
    expect(scope).toEqual(['read_products', 'read_orders', 'write_products', 'write_content', 'write_online_store_navigation']);
    process.env.SHOPIFY_THEME_WRITE = '1';
    expect(new URL(buildAuthorizeUrl('x.myshopify.com', 'st')).searchParams.get('scope')).toContain('write_themes');
    delete process.env.SHOPIFY_THEME_WRITE;
    // Boutique autorisée avant V5 (lecture seule) : toujours connectée, ré-autorisation signalée.
    const old = (async () => new Response(JSON.stringify({ access_token: 'shpat_old', scope: 'read_products,read_orders' }), { status: 200 })) as unknown as typeof fetch;
    await connectWithCode('shop-v4', 'v4.myshopify.com', 'c', old);
    expect(await connectionStatus('shop-v4')).toMatchObject({ connected: true, missingPublishScopes: ['write_products', 'write_content', 'write_online_store_navigation'] });
    // Nouvelle autorisation : Shopify renvoie write_* (qui inclut read_*) → acceptée, rien ne manque.
    const v5 = (async () => new Response(JSON.stringify({ access_token: 'shpat_v5', scope: 'write_products,read_orders,write_content,write_online_store_navigation' }), { status: 200 })) as unknown as typeof fetch;
    await connectWithCode('shop-v5', 'v5.myshopify.com', 'c', v5);
    expect((await connectionStatus('shop-v5')).missingPublishScopes).toEqual([]);
    expect(missingPublishScopes('')).toHaveLength(3);
    delete process.env.SHOPIFY_CLIENT_ID;
    delete process.env.SHOPIFY_CLIENT_SECRET;
  });

  it('réduit une commande au strict nécessaire', () => {
    const m = toMinimalOrder({
      id: 'gid://shopify/Order/42', createdAt: '2026-11-01T00:00:00Z', currentTotalPriceSet: { shopMoney: { amount: '38.70', currencyCode: 'EUR' } },
      customerJourneySummary: { firstVisit: { referrerUrl: 'https://chatgpt.com/', landingPage: '/products/onde?utm_source=chatgpt.com', utmParameters: { source: 'chatgpt.com', medium: null } } },
    });
    expect(m).toMatchObject({ id: '42', totalEur: 38.7, referrerUrl: 'https://chatgpt.com/', utmSource: 'chatgpt.com' });
    expect(Object.keys(m)).not.toContain('email');
  });
});

describe('livrables', () => {
  const p = demoCatalog().products[0];
  it('JSON-LD Product complet (GTIN, offre agrégée, note réelle)', () => {
    const j = buildProductJsonLd(p, { brand: 'Maison Sora', website: 'maison-sora.fr' });
    expect(j).toMatchObject({ '@type': 'Product', gtin13: '3770012345017', offers: { '@type': 'AggregateOffer', lowPrice: '12.90', highPrice: '23.90' }, aggregateRating: { ratingValue: 4.7, reviewCount: 214 } });
    const bare = buildProductJsonLd({ id: 'x', name: 'X', source: 'manual', updatedAt: '' }, { brand: 'B' });
    expect(bare.aggregateRating).toBeUndefined();
    expect(productJsonLdWarnings(bare).length).toBeGreaterThanOrEqual(4);
  });

  it('FAQ produit : rien d’inventé, les manques sont signalés et non publiés', async () => {
    const faq = await buildProductFaq(p, { brand: 'Maison Sora', facts: { livraison: 'Offerte dès 39 €' } });
    expect(faq.llm).toBe(false);
    expect(faq.items.some((i) => i.toComplete && i.a.startsWith(TO_COMPLETE))).toBe(true);
    const ld = faq.jsonLd as { mainEntity: { acceptedAnswer: { text: string } }[] };
    expect(ld.mainEntity.length).toBe(faq.items.filter((i) => !i.toComplete).length);
    expect(JSON.stringify(ld)).not.toContain(TO_COMPLETE);
    expect(faq.items.map((i) => i.a).join(' ')).toContain('12,90 €');
  });

  it('guide d’achat : questions réellement posées et marques citées', async () => {
    const audit = withDemoProducts((await getLatestAuditForBusiness('demo-ecom')) as AuditResult);
    const t = buildProductTracking(audit, demoCatalog());
    const g = await buildBuyingGuide('shampoing solide', demoCatalog().products, { brand: 'Maison Sora' }, t);
    expect(g.title).toBe('Comment choisir un shampoing solide ?');
    expect(g.questions.length).toBeGreaterThan(0);
    expect(g.markdown).toContain('Shampoing solide « Onde »');
    expect(g.markdown).toContain('Les autres marques souvent citées');
  });
});
