/**
 * Faux Magento 2.4 : reproduit les routes REST du cœur utilisées par le connecteur (webapi.xml de Magento_Catalog et
 * Magento_Cms, relus le 22 nov. 2026) — mêmes chemins `/rest/<vue>/V1/…`, mêmes formes (custom_attributes, items de
 * searchCriteria, entrée de galerie `label`), 401 « The consumer isn't authorized… » pour un jeton refusé comme pour une
 * ressource non cochée, 400 pour une vue de magasin inconnue — et rend les pages publiques depuis l'état.
 *
 * L'authentification OAuth 1.0a (RFC 5849, HMAC-SHA256) est vérifiée par une implémentation propre au faux (et non par
 * les fonctions du connecteur). Le jeton seul (Bearer) n'est accepté que si `bearerEnabled` (réglage
 * `oauth/consumer/enable_integration_as_bearer`, désactivé par défaut depuis 2.4.4). Aucun accès Internet.
 */
import { createHmac } from 'node:crypto';
import { html, type FakeHandler, type FakeReq, type FakeRes } from './helpers';

export interface MAttr {
  attribute_code: string;
  value: unknown;
}
export interface MProductState {
  id: number;
  sku: string;
  name: string;
  attrs: Record<string, string>;
  media: { id: number; media_type: string; label: string | null; position: number; disabled: boolean; types: string[]; file: string }[];
}
export interface MagentoState {
  host: string;
  stores: string[];
  keys: { consumerKey: string; consumerSecret: string; accessToken: string; accessTokenSecret: string };
  bearerEnabled: boolean;
  /** ressources cochées dans l'intégration */
  acl: Set<'products' | 'categories' | 'cms' | 'catalog'>;
  products: MProductState[];
  categories: { id: number; name: string; attrs: Record<string, string> }[];
  cms: Record<string, unknown>[];
  calls: string[];
  nonces: Set<string>;
}

const K = (c: string) => c.repeat(32);
const enc = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
const unauthorized = (res: string): FakeRes => ({ status: 401, body: { message: "The consumer isn't authorized to access %resources.", parameters: { resources: res } } });

function verifyOAuth(st: MagentoState, r: FakeReq): boolean {
  const h = String(r.headers.authorization ?? '');
  if (!h.startsWith('OAuth ')) return false;
  const p: Record<string, string> = {};
  for (const part of h.slice(6).split(',')) {
    const m = /^\s*([a-z_]+)="([^"]*)"\s*$/.exec(part);
    if (m) p[m[1]] = decodeURIComponent(m[2]);
  }
  if (p.oauth_consumer_key !== st.keys.consumerKey || p.oauth_token !== st.keys.accessToken || p.oauth_signature_method !== 'HMAC-SHA256') return false;
  if (!p.oauth_nonce || st.nonces.has(p.oauth_nonce)) return false; // rejeu refusé
  st.nonces.add(p.oauth_nonce);
  const all: string[][] = Object.entries(p).filter(([k]) => k !== 'oauth_signature');
  r.query.forEach((v, k) => all.push([k, v]));
  const norm = all
    .map(([k, v]) => `${enc(k)}=${enc(v)}`)
    .sort()
    .join('&');
  const base = `${r.method}&${enc(`https://${r.host}${r.path}`)}&${enc(norm)}`;
  const sig = createHmac('sha256', `${enc(st.keys.consumerSecret)}&${enc(st.keys.accessTokenSecret)}`).update(base).digest('base64');
  return sig === p.oauth_signature;
}

const attrsOut = (a: Record<string, string>): MAttr[] => Object.entries(a).map(([attribute_code, value]) => ({ attribute_code, value }));
const merge = (target: Record<string, string>, list: unknown) => {
  for (const x of (Array.isArray(list) ? list : []) as MAttr[]) target[x.attribute_code] = x.value == null ? '' : String(x.value);
};

function filter(q: URLSearchParams): { field: string; value: string } | null {
  const field = q.get('searchCriteria[filterGroups][0][filters][0][field]');
  const value = q.get('searchCriteria[filterGroups][0][filters][0][value]');
  return field && value !== null ? { field, value } : null;
}

export function magentoFake(host = 'boutique.test'): { state: MagentoState; handler: FakeHandler } {
  const state: MagentoState = {
    host,
    stores: ['default', 'fr', 'all'],
    keys: { consumerKey: K('a'), consumerSecret: K('b'), accessToken: K('c'), accessTokenSecret: K('d') },
    bearerEnabled: false,
    acl: new Set(['products', 'categories', 'cms', 'catalog']),
    products: [
      {
        id: 1,
        sku: 'SAC-01',
        name: 'Sac cabas en cuir noir',
        attrs: { url_key: 'sac-cabas-cuir-noir', meta_title: '', meta_description: '', meta_keyword: 'sac, cuir', description: '<p>Sac cabas en cuir pleine fleur, cousu à Limoges. Doublure en coton.</p>' },
        media: [{ id: 11, media_type: 'image', label: null, position: 1, disabled: false, types: ['image', 'small_image'], file: '/s/a/sac-cabas-noir.jpg' }],
      },
      { id: 2, sku: 'POR-02', name: 'Porte-cartes', attrs: { url_key: 'porte-cartes', meta_title: 'Porte-cartes', meta_description: '' }, media: [] },
    ],
    categories: [{ id: 4, name: 'Sacs', attrs: { url_key: 'sacs', url_path: 'femme/sacs', meta_title: '', meta_description: '', meta_keywords: '', description: '<p>Nos sacs en cuir.</p>' } }],
    cms: [
      { id: 2, identifier: 'home', title: 'Accueil', content: '<p>Maroquinerie artisanale à Limoges.</p>', meta_title: '', meta_description: '', meta_keywords: '', active: true, page_layout: '1column', creation_time: '2026-01-02 10:00:00', update_time: '2026-01-02 10:00:00' },
      { id: 5, identifier: 'livraison', title: 'Livraison', content: '<p>Livraison en 48 heures en France.</p>', meta_title: '', meta_description: '', meta_keywords: '', active: true, page_layout: '1column', creation_time: '2026-01-02 10:00:00', update_time: '2026-01-02 10:00:00' },
    ],
    calls: [],
    nonces: new Set(),
  };

  const page = (p: { title: string; desc?: string; body: string }): FakeRes => ({ body: html({ title: p.title, description: p.desc || undefined, body: p.body }) });

  const handler: FakeHandler = (r) => {
    const m = /^\/rest\/([^/]+)\/V1(\/.*)$/.exec(r.path);
    if (!m) {
      // Pages publiques
      const path = r.path.replace(/^\/fr(?=\/)/, '');
      const prod = state.products.find((p) => path === `/${p.attrs.url_key}.html`);
      if (prod) {
        const imgs = prod.media.map((x) => `<img src="https://${host}/media/catalog/product/cache/9f1e/${x.file.replace(/^\//, '')}" alt="${(x.label ?? '').replace(/"/g, '&quot;')}">`).join('');
        return page({ title: prod.attrs.meta_title || prod.name, desc: prod.attrs.meta_description, body: `<h1>${prod.name}</h1>${prod.attrs.description ?? ''}${imgs}` });
      }
      const cat = state.categories.find((c) => path === `/${c.attrs.url_path}.html`);
      if (cat) return page({ title: cat.attrs.meta_title || cat.name, desc: cat.attrs.meta_description, body: `<h1>${cat.name}</h1>${cat.attrs.description ?? ''}` });
      const cms = state.cms.find((c) => (path === '/' && c.identifier === 'home') || path === `/${String(c.identifier)}`);
      if (cms) return page({ title: String(cms.meta_title || cms.title), desc: String(cms.meta_description ?? ''), body: String(cms.content ?? '') });
      return { status: 404, body: '<h1>404</h1>' };
    }
    const [, store, api] = m;
    state.calls.push(`${r.method} ${api}`);
    const auth = String(r.headers.authorization ?? '');
    const ok = auth.startsWith('Bearer ') ? state.bearerEnabled && auth.slice(7) === state.keys.accessToken : verifyOAuth(state, r);
    const need = (res: 'products' | 'categories' | 'cms' | 'catalog', name: string): FakeRes | null => (!ok || !state.acl.has(res) ? unauthorized(name) : null);
    if (!state.stores.includes(store)) return { status: 400, body: { message: "The store that was requested wasn't found. Verify the store and try again." } };
    let body: Record<string, unknown> = {};
    try {
      body = r.body ? (JSON.parse(r.body) as Record<string, unknown>) : {};
    } catch {
      return { status: 400, body: { message: 'Decoding error.' } };
    }

    // Produits
    let x: RegExpExecArray | null;
    if (api === '/products' && r.method === 'GET') {
      const d = need('products', 'Magento_Catalog::products');
      if (d) return d;
      const f = filter(r.query);
      const items = state.products.filter((p) => !f || (f.field === 'sku' ? p.sku : p.attrs[f.field]) === f.value);
      return { body: { items: items.map((p) => ({ id: p.id, sku: p.sku, name: p.name, custom_attributes: attrsOut(p.attrs) })), total_count: items.length } };
    }
    if ((x = /^\/products\/([^/]+)\/media$/.exec(api)) && r.method === 'GET') {
      const d = need('products', 'Magento_Catalog::products');
      if (d) return d;
      const p = state.products.find((y) => y.sku === decodeURIComponent(x![1]));
      return p ? { body: p.media } : { status: 404, body: { message: "The product that was requested doesn't exist. Verify the product and try again." } };
    }
    if ((x = /^\/products\/([^/]+)\/media\/(\d+)$/.exec(api))) {
      const p = state.products.find((y) => y.sku === decodeURIComponent(x![1]));
      const e = p?.media.find((y) => y.id === Number(x![2]));
      if (r.method === 'GET') {
        const d = need('products', 'Magento_Catalog::attributes_attributes');
        if (d) return d;
        return e ? { body: e } : { status: 404, body: { message: 'No image with the provided ID was found. Verify the ID and try again.' } };
      }
      if (r.method === 'PUT') {
        const d = need('catalog', 'Magento_Catalog::catalog');
        if (d) return d;
        const entry = body.entry as Record<string, unknown> | undefined;
        if (!e || !entry || entry.file !== e.file) return { status: 400, body: { message: 'The image content is invalid.' } };
        e.label = entry.label == null ? null : String(entry.label);
        return { body: 'true', headers: { 'content-type': 'application/json' } };
      }
    }
    if ((x = /^\/products\/([^/]+)$/.exec(api))) {
      const d = need('products', 'Magento_Catalog::products');
      if (d) return d;
      const p = state.products.find((y) => y.sku === decodeURIComponent(x![1]));
      if (!p) return { status: 404, body: { message: "The product that was requested doesn't exist. Verify the product and try again." } };
      if (r.method === 'PUT') merge(p.attrs, (body.product as { custom_attributes?: unknown })?.custom_attributes);
      return { body: { id: p.id, sku: p.sku, name: p.name, custom_attributes: attrsOut(p.attrs) } };
    }
    // Catégories
    if (api === '/categories/list') {
      const d = need('categories', 'Magento_Catalog::categories');
      if (d) return d;
      const f = filter(r.query);
      const items = state.categories.filter((c) => !f || c.attrs[f.field] === f.value);
      return { body: { items: items.map((c) => ({ id: c.id, name: c.name, custom_attributes: attrsOut(c.attrs) })), total_count: items.length } };
    }
    if ((x = /^\/categories\/(\d+)$/.exec(api))) {
      const d = need('categories', 'Magento_Catalog::categories');
      if (d) return d;
      const c = state.categories.find((y) => y.id === Number(x![1]));
      if (!c) return { status: 404, body: { message: 'No such entity with id = %fieldValue' } };
      if (r.method === 'PUT') merge(c.attrs, (body.category as { custom_attributes?: unknown })?.custom_attributes);
      return { body: { id: c.id, name: c.name, custom_attributes: attrsOut(c.attrs) } };
    }
    // Pages CMS
    if (api === '/cmsPage/search') {
      const d = need('cms', 'Magento_Cms::page');
      if (d) return d;
      const f = filter(r.query);
      const items = state.cms.filter((c) => !f || String(c[f.field]) === f.value);
      return { body: { items, total_count: items.length } };
    }
    if ((x = /^\/cmsPage\/(\d+)$/.exec(api))) {
      const d = need('cms', r.method === 'PUT' ? 'Magento_Cms::save' : 'Magento_Cms::page');
      if (d) return d;
      const i = state.cms.findIndex((y) => y.id === Number(x![1]));
      if (i < 0) return { status: 404, body: { message: 'The CMS page with the "%1" ID doesn\'t exist.' } };
      if (r.method === 'PUT') {
        // Comme certaines versions : un PUT remplace la page (les champs absents sont vidés).
        const pg = (body.page ?? {}) as Record<string, unknown>;
        state.cms[i] = { id: state.cms[i].id, identifier: pg.identifier ?? '', title: pg.title ?? '', content: pg.content ?? '', meta_title: pg.meta_title ?? '', meta_description: pg.meta_description ?? '', meta_keywords: pg.meta_keywords ?? '', active: pg.active ?? false, page_layout: pg.page_layout ?? '', creation_time: state.cms[i].creation_time, update_time: '2026-11-22 12:00:00' };
      }
      return { body: state.cms[i] };
    }
    return { status: 404, body: { message: 'Request does not match any route.' } };
  };
  return { state, handler };
}
