/**
 * Produits WooCommerce par le connecteur WordPress (V8 ECOM) : faux WordPress (fakes.ts) + API WooCommerce v3
 * (`/wc/v3/products`, `slug`, `meta_data`, `description`) sur le même hôte, pages produit rendues depuis l'état.
 * Aucun réseau sortant.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { useMemoryJobs } from '@/lib/jobs/testing';
import { setPublishHttp } from '../http';
import { rulesWriter } from '../writer';
import { applyChangeSet, connectPlatform, createChangeSets, proposeChangeSet, revertChangeSet, validateChangeSet } from '../service';
import { looksLikeProduct } from '../connectors/woocommerce';
import type { Actor, ChangeSet, Finding } from '../types';
import type { PlanSite } from '../planner';
import { basicOk, html, isolateStore, localHttp, routePublicFetch, startFake, type Fake, type FakeHandler } from './helpers';
import { wordpressFake, type WpState } from './fakes';

isolateStore('woo');

const admin: Actor = { id: 'u-admin', role: 'owner' };
const ORIGIN = 'https://wp.test';
let fake: Fake;
let restore: () => void;
let wp: WpState;
let n = 0;
let biz = '';

interface WooState {
  enabled: boolean;
  acceptAppPassword: boolean;
  products: { id: number; slug: string; name: string; description: string; meta: { id: number; key: string; value: string }[] }[];
  calls: string[];
}
let woo: WooState;

function withWoo(base: FakeHandler): FakeHandler {
  return async (r) => {
    const path = r.path.replace(/^\/wp-json/, '');
    if (r.path.startsWith('/wp-json') && (path === '/' || path === '') && woo.enabled) {
      const res = await base(r);
      const b = res.body as { name: string; namespaces: string[] };
      return { body: { ...b, namespaces: [...b.namespaces, 'wc/store/v1', 'wc/v3'] } };
    }
    const prodPage = /^\/produit\/([^/]+)\/?$/.exec(r.path);
    if (prodPage && woo.enabled) {
      const p = woo.products.find((x) => x.slug === prodPage[1]);
      if (!p) return { status: 404, body: '<h1>404</h1>' };
      const t = p.meta.find((m) => m.key === '_yoast_wpseo_title')?.value;
      const d = p.meta.find((m) => m.key === '_yoast_wpseo_metadesc')?.value;
      return { body: html({ title: t || `${p.name} – Plomberie Martin`, description: d || undefined, body: `<h1>${p.name}</h1>${p.description}` }) };
    }
    if (!path.startsWith('/wc/v3')) return base(r);
    woo.calls.push(`${r.method} ${path}`);
    if (!woo.enabled) return { status: 404, body: { code: 'rest_no_route' } };
    if (!woo.acceptAppPassword || !basicOk(r.headers, wp.user, wp.pass)) return { status: 401, body: { code: 'woocommerce_rest_cannot_view', message: 'Désolé, vous ne pouvez pas lister les ressources.' } };
    const json = (p: WooState['products'][number]) => ({ id: p.id, slug: p.slug, name: p.name, permalink: `${ORIGIN}/produit/${p.slug}/`, description: p.description, meta_data: p.meta });
    if (path === '/wc/v3/products' && r.method === 'GET') {
      const slug = r.query.get('slug');
      return { body: woo.products.filter((p) => !slug || p.slug === slug).slice(0, Number(r.query.get('per_page') ?? 10)).map(json) };
    }
    const m = /^\/wc\/v3\/products\/(\d+)$/.exec(path);
    if (m) {
      const p = woo.products.find((x) => x.id === Number(m[1]));
      if (!p) return { status: 404, body: { code: 'woocommerce_rest_product_invalid_id' } };
      if (r.method === 'PUT') {
        const b = JSON.parse(r.body) as { description?: string; meta_data?: { key: string; value: string }[] };
        if (typeof b.description === 'string') p.description = b.description;
        for (const md of b.meta_data ?? []) {
          const cur = p.meta.find((x) => x.key === md.key);
          if (cur) cur.value = md.value;
          else p.meta.push({ id: 900 + p.meta.length, key: md.key, value: md.value });
        }
      }
      return { body: json(p) };
    }
    return { status: 404, body: { code: 'rest_no_route' } };
  };
}

const finding = (o: Partial<Finding> & Pick<Finding, 'id'>): Finding => ({ category: 'contenu', severity: 'high', title: o.id, why: '', fix: 'Corriger.', affected: [], affectedCount: 0, impact: 2, effort: 1, ...o });
const site = (b: string): PlanSite => ({
  businessId: b,
  origin: ORIGIN,
  name: 'Plomberie Martin',
  pages: [{ url: `${ORIGIN}/produit/chauffe-eau-200l/`, title: 'Chauffe-eau 200 L', h1: ['Chauffe-eau 200 L'], text: 'Chauffe-eau thermodynamique 200 litres, posé à Lyon. Garantie 5 ans.' }],
});
const connect = (b: string) => connectPlatform(b, 'wordpress', { config: { siteUrl: 'wp.test' }, credentials: { username: wp.user, password: 'abcd EFGH ijkl MNOP qrst UVWX' } }, admin);

async function cycle(cs: ChangeSet): Promise<ChangeSet> {
  await proposeChangeSet(biz, cs.id, admin);
  await validateChangeSet(biz, cs.id, admin);
  return applyChangeSet(biz, cs.id, admin);
}

beforeAll(async () => {
  fake = await startFake();
  setPublishHttp(localHttp(fake.port));
  restore = routePublicFetch(fake.port);
});
afterAll(async () => {
  setPublishHttp(null);
  restore();
  await fake.close();
});
beforeEach(() => {
  const f = wordpressFake();
  wp = f.state;
  woo = { enabled: true, acceptAppPassword: true, calls: [], products: [{ id: 51, slug: 'chauffe-eau-200l', name: 'Chauffe-eau 200 L', description: '<p>Chauffe-eau thermodynamique 200 litres, posé à Lyon. Garantie 5 ans.</p>', meta: [{ id: 1, key: '_wpcom_is_markdown', value: '1' }] }] };
  fake.hosts.set('wp.test', withWoo(f.handler));
  useMemoryJobs();
  biz = `woo-biz-${++n}`;
});

describe('WooCommerce — produits par le connecteur WordPress', () => {
  it('détection au test de connexion (lecture seule)', async () => {
    const r = await connect(biz);
    expect(r.test.ok).toBe(true);
    expect(r.test.detail).toMatch(/Produits WooCommerce pris en charge/);
    expect(r.test.info?.woocommerce).toBe('1');
    expect(woo.calls).toEqual(['GET /wc/v3/products']);
  });

  it('titre Yoast d’un produit : écrit dans meta_data, relu sur la page produit, retour arrière ; autres métas intactes', async () => {
    await connect(biz);
    const plan = await createChangeSets(biz, [finding({ id: 'seo.title.product', autoFix: { kind: 'meta.title', payload: { url: `${ORIGIN}/produit/chauffe-eau-200l/`, value: 'Chauffe-eau thermodynamique 200 L posé à Lyon | Plomberie Martin' } } })], site(biz), admin, { writer: rulesWriter });
    expect(plan.changeSets[0].platform).toBe('wordpress');
    const cs = await cycle(plan.changeSets[0]);
    expect(cs.status).toBe('verified');
    const p = woo.products[0];
    expect(p.meta.find((m) => m.key === '_yoast_wpseo_title')?.value).toMatch(/^Chauffe-eau thermodynamique/);
    expect(p.meta.find((m) => m.key === '_wpcom_is_markdown')?.value).toBe('1');
    expect(woo.calls).toContain('PUT /wc/v3/products/51');
    await revertChangeSet(biz, cs.id, admin);
    expect(p.meta.find((m) => m.key === '_yoast_wpseo_title')?.value).toBe('');
  });

  it('réécriture d’un passage de la description produit', async () => {
    await connect(biz);
    const plan = await createChangeSets(biz, [finding({ id: 'geo.rewrite', autoFix: { kind: 'rewrite', payload: { url: `${ORIGIN}/produit/chauffe-eau-200l/`, find: 'Garantie 5 ans.', replace: 'Garantie 5 ans, pose à Lyon.', mode: 'deterministe' } } })], site(biz), admin, { writer: rulesWriter });
    const cs = await cycle(plan.changeSets[0]);
    expect(cs.status).toBe('verified');
    expect(woo.products[0].description).toContain('Garantie 5 ans, pose à Lyon.');
  });

  it('API WooCommerce refusant le mot de passe d’application : produits non détectés, pages inchangées', async () => {
    woo.acceptAppPassword = false;
    const r = await connect(biz);
    expect(r.test.ok).toBe(true);
    expect(r.test.info?.woocommerce).toBe('0');
    expect(r.test.detail).not.toMatch(/WooCommerce/);
  });

  it('adresses produit typiques', () => {
    expect(looksLikeProduct('https://x.fr/produit/sac/')).toBe(true);
    expect(looksLikeProduct('https://x.fr/product/sac')).toBe(true);
    expect(looksLikeProduct('https://x.fr/contact/')).toBe(false);
  });
});
