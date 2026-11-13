/**
 * Faux serveurs reproduisant les API documentées (docs/v5/publication.md) — juste ce que les connecteurs utilisent,
 * avec les mêmes chemins, codes et formes de réponse ; + pages publiques rendues depuis l'état (relecture réelle).
 */
import { basicOk, html, type FakeHandler, type FakeReq, type FakeRes } from './helpers';

// ---------------------------------------------------------------------------
// WordPress (REST API + Yoast exposé ou Rank Math)
// ---------------------------------------------------------------------------
export interface WpPage {
  id: number;
  slug: string;
  link: string;
  title: string;
  content: string;
  meta: Record<string, string>;
}
export interface WpState {
  host: string;
  user: string;
  pass: string;
  plugin: 'yoast' | 'rankmath' | 'none';
  exposeMeta: boolean;
  caps: Record<string, boolean>;
  pages: WpPage[];
  media: { id: number; source_url: string; alt_text: string }[];
  /** clé « MÉTHODE chemin » → nombre d'échecs 500 à produire */
  failures: Map<string, number>;
  writes: number;
}

export function wordpressFake(host = 'wp.test'): { state: WpState; handler: FakeHandler } {
  const state: WpState = {
    host,
    user: 'editrice',
    pass: 'abcdEFGHijklMNOPqrstUVWX',
    plugin: 'yoast',
    exposeMeta: true,
    caps: { edit_pages: true, edit_posts: true, upload_files: true, unfiltered_html: true },
    pages: [
      { id: 7, slug: 'plombier-lyon', link: `https://${host}/plombier-lyon/`, title: 'Plombier Lyon', content: '<p>Plomberie Martin intervient à Lyon 3e pour les fuites et les chauffe-eau. Devis gratuit sous 24 heures.</p>', meta: { _yoast_wpseo_title: '', _yoast_wpseo_metadesc: '', _yoast_wpseo_canonical: '' } },
      { id: 2, slug: 'accueil', link: `https://${host}/`, title: 'Accueil', content: '<p>Bienvenue chez Plomberie Martin.</p><img src="https://wp.test/wp-content/uploads/2026/01/chauffe-eau-thermodynamique-300x200.jpg">', meta: { _yoast_wpseo_title: '', _yoast_wpseo_metadesc: '', _yoast_wpseo_canonical: '' } },
    ],
    media: [{ id: 41, source_url: `https://${host}/wp-content/uploads/2026/01/chauffe-eau-thermodynamique.jpg`, alt_text: '' }],
    failures: new Map(),
    writes: 0,
  };
  const metaKeys = () =>
    state.plugin === 'rankmath'
      ? { title: 'rank_math_title', desc: 'rank_math_description', canon: 'rank_math_canonical_url' }
      : { title: '_yoast_wpseo_title', desc: '_yoast_wpseo_metadesc', canon: '_yoast_wpseo_canonical' };
  const pageJson = (p: WpPage, edit: boolean) => ({
    id: p.id,
    slug: p.slug,
    link: p.link,
    type: 'page',
    title: edit ? { raw: p.title, rendered: p.title } : { rendered: p.title },
    content: edit ? { raw: p.content, rendered: p.content } : { rendered: p.content },
    ...(state.exposeMeta ? { meta: { ...p.meta } } : { meta: {} }),
  });
  const fail = (r: FakeReq): FakeRes | null => {
    const k = `${r.method} ${r.path}`;
    const n = state.failures.get(k) ?? 0;
    if (n > 0) {
      state.failures.set(k, n - 1);
      return { status: 500, body: { code: 'internal_server_error', message: 'Erreur' } };
    }
    return null;
  };
  const handler: FakeHandler = (r) => {
    const f = fail(r);
    if (f) return f;
    if (!r.path.startsWith('/wp-json')) {
      // Pages publiques rendues depuis l'état
      const p = state.pages.find((x) => new URL(x.link).pathname === (r.path.endsWith('/') ? r.path : `${r.path}/`) || (r.path === '/' && new URL(x.link).pathname === '/'));
      if (!p) return { status: 404, body: '<h1>404</h1>' };
      const k = metaKeys();
      return { body: html({ title: p.meta[k.title] || `${p.title} – Plomberie Martin`, description: p.meta[k.desc] || undefined, canonical: p.meta[k.canon] || p.link, body: p.content }) };
    }
    const path = r.path.replace(/^\/wp-json/, '') || '/';
    if (path === '/' || path === '') {
      const ns = ['wp/v2', ...(state.plugin === 'yoast' ? ['yoast/v1'] : state.plugin === 'rankmath' ? ['rankmath/v1'] : [])];
      return { body: { name: 'Plomberie Martin', namespaces: ns } };
    }
    if (!basicOk(r.headers, state.user, state.pass)) return { status: 401, body: { code: 'rest_not_logged_in', message: 'Vous n’êtes actuellement pas connecté.' } };
    if (path === '/wp/v2/users/me') return { body: { id: 3, name: 'Éditrice', capabilities: state.caps } };
    let m = /^\/wp\/v2\/(pages|posts)$/.exec(path);
    if (m && r.method === 'GET') {
      if (m[1] === 'posts') return { body: [] };
      const slug = r.query.get('slug');
      const list = slug ? state.pages.filter((p) => p.slug === slug) : state.pages.slice(0, Number(r.query.get('per_page') ?? 10));
      return { body: list.map((p) => pageJson(p, r.query.get('context') === 'edit')) };
    }
    m = /^\/wp\/v2\/pages\/(\d+)$/.exec(path);
    if (m) {
      const p = state.pages.find((x) => x.id === Number(m![1]));
      if (!p) return { status: 404, body: { code: 'rest_post_invalid_id' } };
      if (r.method === 'POST') {
        if (!state.caps.edit_pages) return { status: 403, body: { code: 'rest_cannot_edit' } };
        const b = JSON.parse(r.body) as { meta?: Record<string, string>; content?: string };
        if (b.meta) {
          for (const [k, v] of Object.entries(b.meta)) {
            if (!(k in p.meta) || !state.exposeMeta) return { status: 400, body: { code: 'rest_invalid_param' } };
            p.meta[k] = v;
          }
        }
        if (typeof b.content === 'string') p.content = state.caps.unfiltered_html ? b.content : b.content.replace(/<script[\s\S]*?<\/script>/gi, '');
        state.writes++;
      }
      return { body: pageJson(p, true) };
    }
    if (path === '/wp/v2/media' && r.method === 'GET') {
      const q = (r.query.get('search') ?? '').toLowerCase().replace(/\s+/g, '-');
      return { body: state.media.filter((x) => x.source_url.includes(q)).map((x) => ({ id: x.id, source_url: x.source_url })) };
    }
    m = /^\/wp\/v2\/media\/(\d+)$/.exec(path);
    if (m) {
      const x = state.media.find((y) => y.id === Number(m![1]));
      if (!x) return { status: 404, body: { code: 'rest_post_invalid_id' } };
      if (r.method === 'POST') {
        if (!state.caps.upload_files) return { status: 403, body: { code: 'rest_cannot_edit' } };
        x.alt_text = (JSON.parse(r.body) as { alt_text: string }).alt_text;
        // l'alt est repris dans le contenu des pages (comme le fait l'éditeur de blocs à l'enregistrement)
        for (const p of state.pages) p.content = p.content.replace(/<img src="([^"]*chauffe-eau-thermodynamique[^"]*)"[^>]*>/, `<img src="$1" alt="${x.alt_text}">`);
        state.writes++;
      }
      return { body: { id: x.id, source_url: x.source_url, alt_text: x.alt_text } };
    }
    if (path === '/rankmath/v1/updateMeta' && r.method === 'POST' && state.plugin === 'rankmath') {
      const b = JSON.parse(r.body) as { objectType: string; objectID: number; meta: Record<string, string> };
      const p = state.pages.find((x) => x.id === b.objectID);
      if (!p || b.objectType !== 'post') return { status: 400, body: { code: 'invalid' } };
      Object.assign(p.meta, b.meta);
      state.writes++;
      return { body: { slug: true, schemas: [] } };
    }
    return { status: 404, body: { code: 'rest_no_route' } };
  };
  return { state, handler };
}

// ---------------------------------------------------------------------------
// Shopify (Admin GraphQL)
// ---------------------------------------------------------------------------
export interface ShopState {
  shop: string;
  token: string;
  scopes: string[];
  products: { id: string; handle: string; title: string; seoTitle: string | null; seoDescription: string | null; descriptionHtml: string }[];
  pages: { id: string; handle: string; title: string; body: string; metafields: Record<string, string> }[];
  redirects: { id: string; path: string; target: string }[];
  nextId: number;
  calls: string[];
}

export function shopifyFake(shop = 'boutique-test.myshopify.com'): { state: ShopState; handler: FakeHandler } {
  const state: ShopState = {
    shop,
    token: ['shpat', '0123456789abcdef0123456789abcdef'].join('_') /* faux jeton */,
    scopes: ['read_products', 'write_products', 'write_content', 'write_online_store_navigation'],
    products: [{ id: 'gid://shopify/Product/1', handle: 'creme-solaire', title: 'Crème solaire bio SPF 50', seoTitle: null, seoDescription: null, descriptionHtml: '<p>Crème minérale, 50 ml.</p>' }],
    pages: [{ id: 'gid://shopify/Page/9', handle: 'a-propos', title: 'À propos', body: '<p>Maison Sora fabrique ses crèmes à Nantes.</p>', metafields: {} }],
    redirects: [],
    nextId: 100,
    calls: [],
  };
  const handler: FakeHandler = (r) => {
    if (r.path === '/products/creme-solaire') {
      const p = state.products[0];
      return { body: html({ title: p.seoTitle ?? `${p.title} – Maison Sora`, description: p.seoDescription ?? undefined, body: p.descriptionHtml }) };
    }
    if (r.path === '/pages/a-propos') {
      const p = state.pages[0];
      return { body: html({ title: p.metafields.title_tag ?? `${p.title} – Maison Sora`, description: p.metafields.description_tag, body: p.body }) };
    }
    const red = state.redirects.find((x) => x.path === r.path);
    if (red && r.method === 'GET') return { status: 301, headers: { location: `https://${shop}${red.target}` }, body: '' };
    if (!/^\/admin\/api\/\d{4}-\d{2}\/graphql\.json$/.test(r.path) || r.method !== 'POST') return { status: 404, body: 'Not Found' };
    if (r.headers['x-shopify-access-token'] !== state.token) return { status: 401, body: { errors: '[API] Invalid API key or access token (unrecognized login or wrong password)' } };
    const { query, variables: v } = JSON.parse(r.body) as { query: string; variables: Record<string, unknown> };
    const q = query.replace(/\s+/g, ' ');
    const op = /(?:mutation|query)[^{]*\{\s*(?:r:\s*)?(\w+)/.exec(q)?.[1] ?? '';
    state.calls.push(op);
    const denied = (scope: string) => (!state.scopes.includes(scope) ? { body: { errors: [{ message: 'Access denied', extensions: { code: 'ACCESS_DENIED' } }] } } : null);
    switch (op) {
      case 'shop':
        return { body: { data: { shop: { name: 'Maison Sora' }, currentAppInstallation: { accessScopes: state.scopes.map((handle) => ({ handle })) } } } };
      case 'productByIdentifier': {
        const p = state.products.find((x) => x.handle === (v.h as string));
        return { body: { data: { r: p ? { id: p.id } : null } } };
      }
      case 'pages': {
        const h = String(v.q ?? '').replace(/^handle:/, '');
        return { body: { data: { r: { nodes: state.pages.filter((x) => x.handle === h).map((x) => ({ id: x.id, handle: x.handle })) } } } };
      }
      case 'product': {
        const p = state.products.find((x) => x.id === v.id);
        if (q.includes('descriptionHtml')) return { body: { data: { r: p ? { descriptionHtml: p.descriptionHtml } : null } } };
        return { body: { data: { r: p ? { seo: { title: p.seoTitle, description: p.seoDescription } } : null } } };
      }
      case 'page': {
        const p = state.pages.find((x) => x.id === v.id);
        if (q.includes('metafield(')) return { body: { data: { r: p ? { metafield: p.metafields[v.k as string] !== undefined ? { value: p.metafields[v.k as string] } : null } : null } } };
        return { body: { data: { r: p ? { body: p.body } : null } } };
      }
      case 'productUpdate': {
        const d = denied('write_products');
        if (d) return d;
        const input = v.p as { id: string; seo?: { title?: string; description?: string }; descriptionHtml?: string };
        const p = state.products.find((x) => x.id === input.id);
        if (!p) return { body: { data: { productUpdate: { product: null, userErrors: [{ message: 'Product does not exist' }] } } } };
        if (input.seo?.title !== undefined) p.seoTitle = input.seo.title || null;
        if (input.seo?.description !== undefined) p.seoDescription = input.seo.description || null;
        if (input.descriptionHtml !== undefined) p.descriptionHtml = input.descriptionHtml;
        return { body: { data: { productUpdate: { product: { id: p.id }, userErrors: [] } } } };
      }
      case 'metafieldsSet': {
        const d = denied('write_content');
        if (d) return d;
        const list = v.m as { ownerId: string; namespace: string; key: string; type: string; value: string }[];
        if (list.length > 25) return { body: { data: { metafieldsSet: { metafields: null, userErrors: [{ message: 'Exceeded the maximum metafields input limit of 25.' }] } } } };
        for (const m of list) {
          const p = state.pages.find((x) => x.id === m.ownerId);
          if (!p || m.namespace !== 'global' || m.type !== 'single_line_text_field') return { body: { data: { metafieldsSet: { metafields: null, userErrors: [{ message: 'Owner does not exist' }] } } } };
          p.metafields[m.key] = m.value;
        }
        return { body: { data: { metafieldsSet: { metafields: list.map((_, i) => ({ id: `gid://shopify/Metafield/${i}` })), userErrors: [] } } } };
      }
      case 'metafieldsDelete': {
        for (const m of v.m as { ownerId: string; key: string }[]) {
          const p = state.pages.find((x) => x.id === m.ownerId);
          if (p) delete p.metafields[m.key];
        }
        return { body: { data: { metafieldsDelete: { deletedMetafields: [], userErrors: [] } } } };
      }
      case 'urlRedirects': {
        const path = String(v.q ?? '').replace(/^path:/, '');
        return { body: { data: { urlRedirects: { nodes: state.redirects.filter((x) => x.path === path) } } } };
      }
      case 'urlRedirect': {
        const x = state.redirects.find((y) => y.id === v.id);
        return { body: { data: { urlRedirect: x ? { target: x.target } : null } } };
      }
      case 'urlRedirectCreate': {
        const d = denied('write_online_store_navigation');
        if (d) return d;
        const inp = v.r as { path: string; target: string };
        if (state.redirects.some((x) => x.path === inp.path)) return { body: { data: { urlRedirectCreate: { urlRedirect: null, userErrors: [{ message: 'Path has already been taken' }] } } } };
        const x = { id: `gid://shopify/UrlRedirect/${state.nextId++}`, ...inp };
        state.redirects.push(x);
        return { body: { data: { urlRedirectCreate: { urlRedirect: { id: x.id }, userErrors: [] } } } };
      }
      case 'urlRedirectUpdate': {
        const x = state.redirects.find((y) => y.id === v.id);
        if (x) x.target = (v.r as { target: string }).target;
        return { body: { data: { urlRedirectUpdate: { urlRedirect: x ? { id: x.id } : null, userErrors: x ? [] : [{ message: 'not found' }] } } } };
      }
      case 'urlRedirectDelete': {
        const n = state.redirects.length;
        state.redirects = state.redirects.filter((y) => y.id !== v.id);
        return { body: { data: { urlRedirectDelete: { deletedUrlRedirectId: v.id, userErrors: n === state.redirects.length ? [{ message: 'not found' }] : [] } } } };
      }
      default:
        return { body: { errors: [{ message: `Field '${op}' doesn't exist` }] } };
    }
  };
  return { state, handler };
}

// ---------------------------------------------------------------------------
// Webflow (Data API v2)
// ---------------------------------------------------------------------------
export interface WfState {
  siteId: string;
  token: string;
  pages: { id: string; title: string; slug: string; publishedPath: string; collectionId: string | null; seo: { title: string; description: string } }[];
  published: { title: string; description: string }[];
  publishCount: number;
  lastPublishAt: number;
}

export function webflowFake(): { state: WfState; handler: FakeHandler } {
  const state: WfState = {
    siteId: '5f0c8c9e1c9d440000e8d8c3',
    token: 'wf_0123456789abcdef0123456789abcdef',
    pages: [
      { id: '6f0000000000000000000001', title: 'Accueil', slug: '', publishedPath: '/', collectionId: null, seo: { title: 'Accueil', description: '' } },
      { id: '6f0000000000000000000002', title: 'Tarifs', slug: 'tarifs', publishedPath: '/tarifs', collectionId: null, seo: { title: 'Tarifs', description: '' } },
    ],
    published: [],
    publishCount: 0,
    lastPublishAt: 0,
  };
  // Version publique = état au dernier « publish » (comme Webflow).
  let live = state.pages.map((p) => ({ ...p, seo: { ...p.seo } }));
  const handler: FakeHandler = (r) => {
    if (r.host === 'studio-wf.test') {
      const p = live.find((x) => x.publishedPath === r.path);
      return p ? { body: html({ title: p.seo.title, description: p.seo.description || undefined, body: '<p>Studio graphique à Bordeaux.</p>' }) } : { status: 404, body: '' };
    }
    if (r.headers.authorization !== `Bearer ${state.token}`) return { status: 401, body: { code: 'not_authorized', message: 'Request not authorized' } };
    if (r.path === `/v2/sites/${state.siteId}`) return { body: { id: state.siteId, displayName: 'Studio WF', customDomains: [{ id: 'dom1', url: 'studio-wf.test' }] } };
    if (r.path === `/v2/sites/${state.siteId}/pages`) {
      const off = Number(r.query.get('offset') ?? 0);
      const lim = Number(r.query.get('limit') ?? 100);
      return { body: { pages: state.pages.slice(off, off + lim), pagination: { total: state.pages.length, offset: off, limit: lim } } };
    }
    if (r.path === `/v2/sites/${state.siteId}/publish` && r.method === 'POST') {
      if (Date.now() - state.lastPublishAt < 60_000 && state.publishCount > 0 && process.env.WF_STRICT_RATE === '1') return { status: 429, body: { code: 'too_many_requests' } };
      const b = JSON.parse(r.body) as { customDomains?: string[]; publishToWebflowSubdomain?: boolean };
      if (!b.customDomains?.length && !b.publishToWebflowSubdomain) return { status: 400, body: { code: 'validation_error' } };
      state.publishCount++;
      state.lastPublishAt = Date.now();
      live = state.pages.map((p) => ({ ...p, seo: { ...p.seo } }));
      return { status: 202, body: { customDomains: b.customDomains ?? [], publishToWebflowSubdomain: Boolean(b.publishToWebflowSubdomain) } };
    }
    const m = /^\/v2\/pages\/([a-f0-9]{24})$/.exec(r.path);
    if (m) {
      const p = state.pages.find((x) => x.id === m[1]);
      if (!p) return { status: 404, body: { code: 'resource_not_found' } };
      if (r.method === 'PUT') {
        const b = JSON.parse(r.body) as { seo?: { title?: string; description?: string } };
        if (b.seo) p.seo = { title: b.seo.title ?? '', description: b.seo.description ?? '' };
      }
      return { body: p };
    }
    return { status: 404, body: { code: 'route_not_found' } };
  };
  return { state, handler };
}

// ---------------------------------------------------------------------------
// PrestaShop (webservice : lecture JSON, écriture XML)
// ---------------------------------------------------------------------------
export interface PsState {
  apiKey: string;
  patchSupported: boolean;
  products: Record<string, { meta_title: Record<string, string>; meta_description: Record<string, string>; name: string }>;
  puts: number;
  patches: number;
}

export function prestashopFake(host = 'boutique-ps.test'): { state: PsState; handler: FakeHandler } {
  const state: PsState = {
    apiKey: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ012345',
    patchSupported: true,
    products: { '12': { name: 'Mug personnalisable', meta_title: { '1': 'Customizable mug', '2': '' }, meta_description: { '1': '', '2': '' } } },
    puts: 0,
    patches: 0,
  };
  const langJson = (o: Record<string, string>) => Object.entries(o).map(([id, value]) => ({ id, value }));
  const xmlOf = (id: string) => {
    const p = state.products[id];
    const lang = (f: string, o: Record<string, string>) => `<${f}>${Object.entries(o).map(([l, v]) => `<language id="${l}" xlink:href="https://${host}/api/languages/${l}"><![CDATA[${v}]]></language>`).join('')}</${f}>`;
    return `<?xml version="1.0" encoding="UTF-8"?>\n<prestashop xmlns:xlink="http://www.w3.org/1999/xlink"><product><id><![CDATA[${id}]]></id><manufacturer_name><![CDATA[Sora]]></manufacturer_name><quantity><![CDATA[3]]></quantity>${lang('meta_title', p.meta_title)}${lang('meta_description', p.meta_description)}<name><language id="1"><![CDATA[${p.name}]]></language></name></product></prestashop>`;
  };
  const parseLang = (xml: string, field: string): Record<string, string> | null => {
    const node = new RegExp(`<${field}>([\\s\\S]*?)</${field}>`).exec(xml)?.[1];
    if (node === undefined) return null;
    const out: Record<string, string> = {};
    for (const m of node.matchAll(/<language id="(\d+)"[^>]*>(?:<!\[CDATA\[([\s\S]*?)\]\]>)?<\/language>/g)) out[m[1]] = m[2] ?? '';
    return out;
  };
  const handler: FakeHandler = (r) => {
    if (r.path === '/mugs/12-mug-personnalisable.html') {
      const p = state.products['12'];
      return { body: html({ title: p.meta_title['1'] || p.name, description: p.meta_description['1'] || undefined, body: '<p>Mug en céramique blanche, 33 cl, personnalisable.</p>' }) };
    }
    if (!r.path.startsWith('/api/')) return { status: 404, body: '' };
    if (!basicOk(r.headers, state.apiKey, '')) return { status: 401, body: { errors: [{ code: 17, message: 'Authentication key is empty' }] } };
    if (r.path === '/api/products' && r.method === 'GET') return { body: { products: Object.keys(state.products).map((id) => ({ id: Number(id) })) } };
    const m = /^\/api\/products\/(\d+)$/.exec(r.path);
    if (!m || !state.products[m[1]]) return { status: 404, body: { errors: [{ code: 87, message: 'Invalid ID' }] } };
    const id = m[1];
    const p = state.products[id];
    if (r.method === 'GET') {
      if (r.query.get('output_format') === 'JSON') {
        const obj = { id: Number(id), name: langJson({ '1': p.name }), meta_title: langJson(p.meta_title), meta_description: langJson(p.meta_description) };
        return r.query.get('display') === 'full' ? { body: { products: [obj] } } : { body: { product: obj } };
      }
      return { headers: { 'content-type': 'text/xml;charset=utf-8' }, body: xmlOf(id) };
    }
    if (r.method === 'PATCH' && !state.patchSupported) return { status: 405, body: { errors: [{ code: 2, message: 'Method Not Allowed' }] } };
    if (r.method === 'PATCH' || r.method === 'PUT') {
      if (r.body.trim().startsWith('{')) return { status: 400, body: { errors: [{ code: 127, message: 'XML error' }] } };
      if (r.method === 'PUT' && /<manufacturer_name>|<quantity>/.test(r.body)) return { status: 400, body: { errors: [{ code: 135, message: 'parameter "quantity" not writable' }] } };
      for (const f of ['meta_title', 'meta_description'] as const) {
        const v = parseLang(r.body, f);
        if (v) p[f] = { ...(r.method === 'PUT' ? {} : p[f]), ...v };
      }
      r.method === 'PUT' ? state.puts++ : state.patches++;
      return { headers: { 'content-type': 'text/xml' }, body: xmlOf(id) };
    }
    return { status: 405, body: '' };
  };
  return { state, handler };
}

// ---------------------------------------------------------------------------
// Google Business Profile (Business Information API v1)
// ---------------------------------------------------------------------------
export interface GbpState {
  token: string;
  location: { name: string; title: string; profile: { description: string }; regularHours: unknown };
}

export function gbpFake(): { state: GbpState; handler: FakeHandler } {
  const state: GbpState = {
    token: 'ya29.test-token-0123456789abcdef',
    location: { name: 'locations/1234567890', title: 'Plomberie Martin', profile: { description: '' }, regularHours: { periods: [{ openDay: 'MONDAY', closeDay: 'MONDAY', openTime: { hours: 8 }, closeTime: { hours: 18 } }] } },
  };
  const handler: FakeHandler = (r) => {
    if (r.headers.authorization !== `Bearer ${state.token}`) return { status: 401, body: { error: { code: 401, status: 'UNAUTHENTICATED' } } };
    if (r.path !== `/v1/${state.location.name}`) return { status: 404, body: { error: { code: 404 } } };
    if (r.method === 'GET') return { body: state.location };
    if (r.method === 'PATCH') {
      const mask = r.query.get('updateMask');
      if (!mask) return { status: 400, body: { error: { code: 400, message: 'updateMask required' } } };
      const b = JSON.parse(r.body) as { profile?: { description: string }; regularHours?: unknown };
      if (mask === 'profile.description') state.location.profile.description = b.profile?.description ?? '';
      if (mask === 'regularHours') state.location.regularHours = b.regularHours;
      return { body: state.location };
    }
    return { status: 405, body: {} };
  };
  return { state, handler };
}
