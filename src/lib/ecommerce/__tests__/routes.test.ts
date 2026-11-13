import os from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import * as catalogRoute from '@/app/api/ecommerce/catalog/route';
import * as deliverablesRoute from '@/app/api/ecommerce/deliverables/route';
import * as pricesRoute from '@/app/api/ecommerce/prices/route';
import * as productsRoute from '@/app/api/ecommerce/products/route';
import * as retailersRoute from '@/app/api/ecommerce/retailers/route';
import * as revenueRoute from '@/app/api/ecommerce/revenue/route';
import * as shopifyRoute from '@/app/api/ecommerce/shopify/route';
import * as shopifyStart from '@/app/api/ecommerce/shopify/start/route';
import * as shopifyCallback from '@/app/api/ecommerce/shopify/callback/route';

beforeAll(() => {
  (globalThis as { __repereDocsDir?: string }).__repereDocsDir = path.join(os.tmpdir(), `repere-ecom-routes-${process.pid}`);
});

const U = 'http://localhost/api/ecommerce';
const get = (p: string) => new Request(`${U}${p}`, { headers: { 'x-forwarded-for': '10.1.2.3' } });
const post = (p: string, body: unknown) =>
  new Request(`${U}${p}`, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.1.2.3' } });

describe('routes /api/ecommerce (compte démo demo-ecom)', () => {
  it('lit catalogue, suivi produit, revendeurs, prix et CA', async () => {
    const cat = await (await catalogRoute.GET(get('/catalog?businessId=demo-ecom'))).json();
    expect(cat).toMatchObject({ ok: true, demo: true, shopify: { enabled: false, connected: false } });
    expect(cat.catalog.products.length).toBe(4);

    const prod = await (await productsRoute.GET(get('/products?businessId=demo-ecom'))).json();
    expect(prod.ok).toBe(true);
    expect(prod.report.answers).toEqual([]);
    expect(prod.report.products[0].visibility).toBeGreaterThan(0);

    const ret = await (await retailersRoute.GET(get('/retailers?businessId=demo-ecom'))).json();
    expect(ret.report.citations).toBeGreaterThan(0);

    const pr = await (await pricesRoute.GET(get('/prices?businessId=demo-ecom'))).json();
    expect(pr.report.errors).toBeGreaterThan(0);

    const rev = await (await revenueRoute.GET(get('/revenue?businessId=demo-ecom&days=30'))).json();
    expect(rev.report).toMatchObject({ source: 'demo', demo: true });
  });

  it('génère les livrables sans clé', async () => {
    const j = await (await deliverablesRoute.POST(post('/deliverables', { businessId: 'demo-ecom', kind: 'jsonld', productId: 'shampoing-solide-onde' }))).json();
    expect(j.jsonld['@type']).toBe('Product');
    const f = await (await deliverablesRoute.POST(post('/deliverables', { businessId: 'demo-ecom', kind: 'faq', productId: 'shampoing-solide-onde', llm: true }))).json();
    expect(f.faq.llm).toBe(false);
    expect(f.faq.items.some((i: { a: string }) => i.a.includes('Retours gratuits'))).toBe(true);
    const g = await (await deliverablesRoute.POST(post('/deliverables', { businessId: 'demo-ecom', kind: 'guide', category: 'déodorant solide' }))).json();
    expect(g.guide.markdown).toMatch(/^# Comment choisir/);
    const bad = await deliverablesRoute.POST(post('/deliverables', { businessId: 'demo-ecom', kind: 'faq', productId: 'inconnu' }));
    expect(bad.status).toBe(404);
  });

  it('refuse toute écriture sur le compte démo et valide les entrées', async () => {
    const w = await catalogRoute.POST(post('/catalog', { businessId: 'demo-ecom', product: { name: 'Test' } }));
    expect(w.status).toBe(403);
    const d = await catalogRoute.DELETE(new Request(`${U}/catalog?businessId=demo-ecom&productId=shampoing-solide-onde`, { method: 'DELETE' }));
    expect(d.status).toBe(403);
    expect((await productsRoute.GET(get('/products?businessId=../x'))).status).toBe(400);
    expect((await shopifyRoute.DELETE(new Request(`${U}/shopify?businessId=demo-ecom`, { method: 'DELETE' }))).status).toBe(403);
  });

  it('connecteur Shopify désactivé sans clé (503)', async () => {
    expect((await shopifyStart.POST(post('/shopify/start', { businessId: 'demo-ecom', shop: 'x' }))).status).toBe(503);
    expect((await shopifyCallback.GET(get('/shopify/callback?shop=x.myshopify.com'))).status).toBe(503);
  });
});
