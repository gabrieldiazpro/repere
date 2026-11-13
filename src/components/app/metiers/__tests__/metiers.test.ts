import { describe, expect, it } from 'vitest';
import { buildLocalDemo, GBP_GROUP_LABEL, MAP_CAPS } from '@/lib/local';
import { buildProductTracking, demoCatalog, loadContext, retailerReport } from '@/lib/ecommerce';
import { productFromHtml } from '@/lib/siteaudit';
import type { LocalPost } from '@/lib/local/types';
import type { ProductReport } from '@/lib/siteaudit/types';
import {
  byStatus,
  copilotHref,
  demoProductHtml,
  engineRows,
  fmtEur,
  groupCriteria,
  mapPoints,
  mapQuota,
  nextPost,
  revenueCompare,
  scoresByProduct,
  scoreTone,
  summarize,
  taskHref,
  urlKey,
} from '../logic';
import { shortLabel, tileLayout } from '../MapView';
import { parseUrls } from '../ProduitsClient';
import { parseReviewInput } from '../ReviewLinkForm';
import { normalizeShopInput } from '../ShopifyConnect';
import { shopifyReturnStatus } from '../ShopifyReturn';
import { toForm, toManual } from '../GbpForm';

const NOW = new Date('2026-11-10T10:00:00Z');

describe('liens d’action', () => {
  it('tâche : href explicite, sinon id, sinon liste', () => {
    expect(taskHref({ href: '/app/x' })).toBe('/app/x');
    expect(taskHref({ id: 't_abc' })).toBe('/app/actions?t=t_abc');
    expect(taskHref(undefined)).toBe('/app/actions');
  });
  it('copilote : écran en contexte, question encodée et bornée dans q', () => {
    const h = copilotHref('a & b'.repeat(200));
    expect(h.startsWith('/app/copilote?context=local&q=a%20%26%20b')).toBe(true);
    expect(new URL(h, 'http://x').searchParams.get('q')!.length).toBe(300);
    expect(copilotHref('x', 'produits')).toBe('/app/copilote?context=produits&q=x');
  });
});

describe('fiche Google (démo Plomberie Martin)', () => {
  it('regroupe les critères sans en perdre, à corriger d’abord', async () => {
    const d = (await buildLocalDemo('demo', NOW))!;
    const groups = groupCriteria(d.gbp, GBP_GROUP_LABEL);
    expect(groups.reduce((n, g) => n + g.criteria.length, 0)).toBe(d.gbp.criteria.length);
    for (const g of groups) expect(byStatus(g.criteria)).toEqual(g.criteria);
    // familles les plus perdantes d'abord
    for (let i = 1; i < groups.length; i++) expect(groups[i - 1].max - groups[i - 1].points).toBeGreaterThanOrEqual(groups[i].max - groups[i].points);
    expect(groups[0].label).toBe(GBP_GROUP_LABEL[groups[0].group]);
  });

  it('formulaire ↔ saisie guidée : aller-retour fidèle', async () => {
    const { DEMO_MANUAL } = await import('@/lib/local');
    const m = toManual(toForm(DEMO_MANUAL));
    expect(m.reviewCount).toBe(14);
    expect(m.rating).toBe(4.3);
    expect(m.lastPostDaysAgo).toBeNull();
    expect(m.lastPhotoDaysAgo).toBe(240);
    expect(m.repliedOfLast).toEqual({ replied: 3, total: 10 });
    expect(m.descriptionLength).toBe(180);
    expect(m.secondaryCategories).toBeUndefined();
  });

  it('champ vide = inconnu (non évalué), virgule décimale acceptée', () => {
    const f = toForm({});
    const m = toManual({ ...f, rating: '4,8', photosCount: '', lastReviewDaysAgo: 'never' });
    expect(m.rating).toBe(4.8);
    expect(m.photosCount).toBeUndefined();
    expect(m.lastReviewDaysAgo).toBeNull();
  });
});

describe('carte par zone', () => {
  it('points alignés sur les zones, résumé cohérent', async () => {
    const d = (await buildLocalDemo('demo', NOW))!;
    const pts = mapPoints(d.map);
    expect(pts).toHaveLength(d.map.zones.length);
    expect(pts.filter((p) => p.home)).toHaveLength(1);
    const s = summarize(d.map.zones);
    expect(s.zones).toBe(d.map.zones.length);
    expect(s.covered).toBeLessThanOrEqual(s.zones);
    if (s.bestZone && s.worstZone) expect(s.bestZone.mentionRate!).toBeGreaterThanOrEqual(s.worstZone.mentionRate!);
  });
  it('plafonds : démo jamais relancée, quota mensuel respecté', () => {
    expect(mapQuota(MAP_CAPS.demo, 0, true).canRun).toBe(false);
    expect(mapQuota(MAP_CAPS.decouverte, 0, false)).toMatchObject({ canRun: true, remaining: 1 });
    expect(mapQuota(MAP_CAPS.decouverte, 1, false).canRun).toBe(false);
    expect(mapQuota(MAP_CAPS.essentiel, 1, false).remaining).toBe(1);
  });
  it('libellés courts sur la carte', () => {
    expect(shortLabel('Paris 11e')).toBe('11e');
    expect(shortLabel('Lyon 1er')).toBe('1er');
    expect(shortLabel('Toulouse, Capitole')).toBe('Capitole');
    expect(shortLabel('Nord')).toBe('Nord');
  });
  it('carte en grille : jamais deux zones sur la même case', () => {
    const paris = [1, 4, 5, 6, 11, 12, 20, 3, 9, 10, 2, 13].map((n) => ({ zoneId: `z${n}`, label: `Paris ${n}${n === 1 ? 'er' : 'e'}` }));
    const a = tileLayout(paris);
    expect(new Set(a.tiles.map((t) => `${t.col},${t.row}`)).size).toBe(paris.length);
    expect(a.tiles.every((t) => t.col >= 0 && t.row >= 0 && t.col < a.cols && t.row < a.rows)).toBe(true);
    // Même position (cas dégénéré) : toujours des cases distinctes, la zone du commerce au centre.
    const same = Array.from({ length: 9 }, (_, i) => ({ zoneId: `q${i}`, label: `Quartier ${i}`, x: 50, y: 50, home: i === 4 }));
    const b = tileLayout(same);
    expect(new Set(b.tiles.map((t) => `${t.col},${t.row}`)).size).toBe(9);
    expect(tileLayout([]).tiles).toEqual([]);
  });
});

describe('avis et posts', () => {
  it('prochain post : le plus proche non publié', () => {
    const p = (date: string, status: LocalPost['status']) => ({ id: date, date, status }) as LocalPost;
    expect(nextPost([p('2026-11-01', 'planned'), p('2026-11-12', 'planned'), p('2026-11-19', 'planned')], NOW)?.id).toBe('2026-11-12');
    expect(nextPost([p('2026-11-12', 'published')], NOW)).toBeNull();
    expect(nextPost([p('2026-11-01', 'planned')], NOW)?.id).toBe('2026-11-01');
  });
  it('lien d’avis : lien https, Place ID brut ou dans un lien Maps', () => {
    expect(parseReviewInput('https://g.page/r/abc123/review')).toEqual({ reviewUrl: 'https://g.page/r/abc123/review' });
    expect(parseReviewInput('ChIJN1t_tDeuEmsRUsoyG83frY4')).toEqual({ placeId: 'ChIJN1t_tDeuEmsRUsoyG83frY4' });
    expect(parseReviewInput('https://www.google.com/maps/search/?api=1&query_place_id=ChIJN1t_tDeuEmsRUsoyG83frY4')).toEqual({ placeId: 'ChIJN1t_tDeuEmsRUsoyG83frY4' });
    expect(parseReviewInput('http://g.page/r/x')).toBeNull();
    expect(parseReviewInput('12345678901')).toBeNull();
  });
});

describe('produits (démo Maison Sora)', () => {
  it('score de fiche démo : vrai audit, sans champ inventé', () => {
    const cat = demoCatalog();
    for (const p of cat.products) {
      const r = productFromHtml(demoProductHtml(p, cat.brand), p.url ?? null);
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(100);
      expect(r.product.name).toBe(p.name);
      if (!p.rating) expect(r.product.ratingValue).toBeUndefined();
      // livraison et retours ne figurent pas au catalogue : ils restent des manques
      expect(r.product.hasShipping).toBe(false);
    }
  });
  it('HTML démo échappé', () => {
    const html = demoProductHtml({ id: 'x', name: 'A <b>"B"</b>', source: 'demo', updatedAt: '' }, 'M');
    expect(html).not.toContain('<b>');
  });
  it('dernier audit par produit, URL normalisées', () => {
    const rep = (score: number) => ({ score, fixes: [], missing: [], url: null }) as unknown as ProductReport;
    const s = scoresByProduct(
      [{ id: 'a', url: 'https://www.shop.fr/p/a/' }, { id: 'b', url: 'https://shop.fr/p/b' }, { id: 'c' }],
      [
        { url: 'https://shop.fr/p/a', createdAt: '2026-11-01', product: rep(40) },
        { url: 'shop.fr/p/a', createdAt: '2026-11-05', product: rep(70) },
        { url: 'https://shop.fr/p/b', createdAt: '2026-11-02', product: null },
      ],
    );
    expect(s.a.score).toBe(70);
    expect(s.b).toBeUndefined();
    expect(s.c).toBeUndefined();
    expect(urlKey('https://WWW.Shop.fr/x/')).toBe('shop.fr/x');
  });
  it('suivi produit démo : chaque produit du catalogue a sa ligne', async () => {
    const c = await loadContext({ id: 'demo-ecom', name: 'Maison Sora', website: 'https://maison-sora.fr' });
    const t = buildProductTracking(c.audit, c.catalog, { demo: true });
    expect(t.answersAnalyzed).toBeGreaterThan(0);
    expect(t.products.map((p) => p.productId).sort()).toEqual(c.catalog.products.map((p) => p.id).sort());
  });
  it('revendeurs démo : parts cohérentes', async () => {
    const r = await retailerReport({ id: 'demo-ecom', name: 'Maison Sora', website: 'https://maison-sora.fr' });
    const sum = Object.values(r.byKind).reduce((n, k) => n + (k?.share ?? 0), 0);
    if (r.citations) expect(sum).toBeCloseTo(1, 1);
    expect(r.thirdPartyShare).toBeGreaterThanOrEqual(0);
    expect(r.thirdPartyShare).toBeLessThanOrEqual(1);
  });
  it('ajout par URL : http(s) seulement, sans doublon, plafonné', () => {
    expect(parseUrls('https://a.fr/p/1\nhttps://a.fr/p/1, ftp://x.fr javascript:alert(1) http://b.fr/q')).toEqual(['https://a.fr/p/1', 'http://b.fr/q']);
    expect(parseUrls(Array.from({ length: 40 }, (_, i) => `https://a.fr/${i}`).join('\n'))).toHaveLength(30);
  });
  it('tonalité des scores', () => {
    expect(scoreTone(80)).toBe('success');
    expect(scoreTone(60)).toBe('warning');
    expect(scoreTone(10)).toBe('danger');
  });
});

describe('ventes', () => {
  const line = (orders: number, revenueEur: number, visits: number, aov: number | null, conversionRate: number | null) => ({ orders, revenueEur, visits, aov, conversionRate });
  it('comparaison IA / autres : multiplicateurs, null si non mesurable', () => {
    expect(revenueCompare({ ai: line(4, 160, 100, 40, 0.04), other: line(20, 400, 2000, 20, 0.01) })).toEqual({ conversion: 4, aov: 2 });
    expect(revenueCompare({ ai: line(0, 0, 0, null, null), other: line(1, 10, 10, 10, 0.1) })).toEqual({ conversion: null, aov: null });
  });
  it('lignes par IA : vides retirées, triées par CA', () => {
    const rows = engineRows({ chatgpt: line(2, 50, 10, 25, 0.2), perplexity: line(3, 90, 12, 30, 0.25), gemini: line(0, 0, 0, null, null) });
    expect(rows.map((r) => r.engine)).toEqual(['perplexity', 'chatgpt']);
  });
  it('montants en euros à la française', () => {
    expect(fmtEur(1234.5)).toBe('1 234,50 €');
    expect(fmtEur(12)).toBe('12 €');
    expect(fmtEur(null)).toBe('—');
  });
  it('Shopify : adresse de boutique et statut de retour', () => {
    expect(normalizeShopInput('Ma-Boutique')).toBe('ma-boutique.myshopify.com');
    expect(normalizeShopInput('https://ma-boutique.myshopify.com/admin')).toBe('ma-boutique.myshopify.com');
    expect(normalizeShopInput('evil.com')).toBeNull();
    expect(shopifyReturnStatus('connected')).toBe('connected');
    expect(shopifyReturnStatus('error')).toBe('error');
    expect(shopifyReturnStatus('<script>')).toBeNull();
  });
});
