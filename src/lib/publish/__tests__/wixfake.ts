/**
 * Faux Wix : reproduit ce que la documentation officielle décrit (dev.wix.com, 15 nov. 2026) pour les API utilisées
 * par le connecteur — mêmes chemins, mêmes formes de réponse, mêmes codes d'erreur applicatifs — et rend les pages
 * publiques du site depuis l'état « publié » (relecture réelle). Aucun accès Internet.
 *
 * - Item SEO Tags : GET/PATCH /seo-metatags-server/v1/item-seo-tags/{type}/{id}, GET …/{type} (liste sans URL),
 *   POST …/reset-to-default ; brouillon ≠ publié pour STATIC_PAGE (`publish: true`), DRAFT_SAVED_NOT_PUBLISHED (428),
 *   LANGUAGE_NOT_SUPPORTED, TAG_TYPE_NOT_ALLOWED (custom sur title/script), INVALID_FIELD_MASK, ITEM_NOT_FOUND.
 * - Redirects : GET /seo-redirects-service/v1/redirects, POST /create-redirect (FROM_URL_EXISTS ; une redirection qui
 *   part de la cible est SUPPRIMÉE, pas chaînée), DELETE /redirects/{id}.
 * - Txt File Server : GET/PUT /promote-seo-robots-server/v2/robots|llms (`default`, `manuallyEdited`).
 * - Blog : GET /v3/posts/slugs/{slug} ; Stores (catalogue V3) : GET /stores/v3/products/slug/{slug}.
 * - OAuth : POST /oauth2/token (client_credentials).
 */
import type { FakeHandler, FakeReq, FakeRes } from './helpers';
import type { WixTag } from '../connectors/wix';

export interface WixItem {
  type: 'STATIC_PAGE' | 'BLOG_POST' | 'STORES_PRODUCT';
  id: string;
  path: string;
  slug?: string;
  /** balises propres : brouillon (lu par l'API) et publiées (rendues sur le site) */
  draft: WixTag[];
  live: WixTag[];
  defaults: { title: string; description?: string };
}

export interface WixState {
  site: string;
  siteId: string;
  apiKey: string;
  /** clé avec « Manage SEO Settings » */
  manage: boolean;
  /** base acceptée pour Item SEO Tags et les fichiers texte (pour tester le chemin alternatif documenté) */
  seoBase: string;
  txtBase: string;
  /** le site a-t-il déjà été publié une fois ? */
  published: boolean;
  /** catalogue Stores V1 : l'API V3 « slug » répond 404 */
  catalogV1: boolean;
  items: WixItem[];
  redirects: { id: string; from: string; to: string; options?: { groupRedirect?: boolean } }[];
  robots: { content: string; default: boolean };
  llms: { content: string; default: boolean; manuallyEdited: boolean };
  app: { clientId: string; secret: string; instanceId: string };
  tokensIssued: number;
  calls: string[];
  nextId: number;
}

const ROBOTS_DEFAULT = '# Wix robots.txt par défaut\nUser-agent: *\nAllow: /\nSitemap: https://ceramique.test/sitemap.xml\n';
const LLMS_DEFAULT = '# Atelier Terre\n\n> Site Wix (contenu généré par Wix).\n';
const err = (status: number, code: string, message = code): FakeRes => ({ status, body: { message, details: { applicationError: { code, description: message } } } });
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const lc = (s: unknown) => String(s ?? '').toLowerCase();
const samePath = (a: string, b: string) => (a.replace(/\/+$/, '') || '/') === (b.replace(/\/+$/, '') || '/');

export function wixFake(site = 'ceramique.test'): { state: WixState; api: FakeHandler; site: FakeHandler } {
  const state: WixState = {
    site,
    siteId: '3ecba886-4267-41ee-be56-0242ac120002',
    apiKey: ['IST', 'eyJraWQiOiJQb3pIX2FDMiIsImFsZyI6IlJTMjU2In0', 'faux-jeton-de-test-0123456789'].join('.'),
    manage: true,
    seoBase: '/seo-metatags-server/v1',
    txtBase: '/promote-seo-robots-server/v2',
    published: true,
    catalogV1: false,
    items: [
      { type: 'STATIC_PAGE', id: 'c1dmp', path: '/', draft: [{ type: 'meta', props: { property: 'og:image', content: `https://${site}/og.jpg` }, custom: true }], live: [{ type: 'meta', props: { property: 'og:image', content: `https://${site}/og.jpg` }, custom: true }], defaults: { title: 'Accueil | Atelier Terre' } },
      { type: 'STATIC_PAGE', id: 'ddgf4', path: '/atelier', draft: [], live: [], defaults: { title: 'Atelier | Atelier Terre' } },
      { type: 'BLOG_POST', id: 'b7a1c0de-0000-4000-8000-000000000001', path: '/post/emailler-un-bol', slug: 'emailler-un-bol', draft: [], live: [], defaults: { title: 'Émailler un bol | Atelier Terre' } },
      { type: 'STORES_PRODUCT', id: 'p3c2d1e0-0000-4000-8000-000000000002', path: '/product-page/bol-gres', slug: 'bol-gres', draft: [], live: [], defaults: { title: 'Bol en grès | Atelier Terre' } },
    ],
    redirects: [],
    robots: { content: ROBOTS_DEFAULT, default: true },
    llms: { content: LLMS_DEFAULT, default: true, manuallyEdited: false },
    app: { clientId: '11111111-2222-4333-8444-555555555555', secret: 'secret-app-de-test', instanceId: '99999999-8888-4777-8666-555555555555' },
    tokensIssued: 0,
    calls: [],
    nextId: 1,
  };
  const tokens = new Set<string>();

  const itemJson = (it: WixItem, full: boolean) => ({
    id: `${it.type}:${it.id}`,
    itemType: it.type,
    itemId: it.id,
    tags: it.draft,
    hasOverride: it.draft.length > 0,
    ...(full
      ? {
          resolvedTags: [
            { tag: it.draft.find((t) => t.type === 'title') ?? { type: 'title', children: it.defaults.title }, source: it.draft.some((t) => t.type === 'title') ? 'TAG_SOURCE_ITEM' : 'TAG_SOURCE_DEFAULT_PATTERN' },
            { tag: { type: 'link', props: { rel: 'canonical', href: `https://${site}${it.path === '/' ? '' : it.path}` } }, source: 'TAG_SOURCE_DEFAULT_PATTERN' },
          ],
        }
      : {}),
    publishStatus: it.type === 'STATIC_PAGE' ? 'PUBLISH_STATUS_UNSPECIFIED' : 'PUBLISH_STATUS_PUBLISHED',
    origin: 'ORIGIN_UNSPECIFIED',
  });

  const authed = (r: FakeReq): 'ok' | FakeRes => {
    const a = String(r.headers.authorization ?? '');
    if (tokens.has(a)) return 'ok';
    if (a !== state.apiKey) return { status: 401, body: { message: 'Unauthorized' } };
    if (r.headers['wix-site-id'] !== state.siteId) return err(428, '', 'Site GUID is missing.');
    return 'ok';
  };
  const needManage = (): FakeRes | null => (state.manage ? null : { status: 403, body: { message: 'Permission denied', details: {} } });

  const api: FakeHandler = (r) => {
    state.calls.push(`${r.method} ${r.path}${r.query.toString() ? `?${r.query}` : ''}`);
    if (r.path === '/oauth2/token' && r.method === 'POST') {
      const b = JSON.parse(r.body || '{}') as Record<string, string>;
      if (b.grant_type !== 'client_credentials' || b.client_id !== state.app.clientId || b.client_secret !== state.app.secret || b.instance_id !== state.app.instanceId) return { status: 400, body: { error: 'invalid_client' } };
      const t = `OauthNG.JWS.faux-${++state.tokensIssued}`;
      tokens.add(t);
      return { body: { access_token: t, token_type: 'Bearer', expires_in: 14400 } };
    }
    const auth = authed(r);
    if (auth !== 'ok') return auth;

    // --- Item SEO Tags -----------------------------------------------------
    if (r.path.startsWith(`${state.seoBase}/item-seo-tags/`)) {
      const rest = r.path.slice(`${state.seoBase}/item-seo-tags/`.length).split('/').map(decodeURIComponent);
      const [type, id, action] = rest;
      if (!['STATIC_PAGE', 'BLOG_POST', 'STORES_PRODUCT', 'EVENTS_PAGE'].includes(type)) return err(400, 'UNSUPPORTED_ITEM_TYPE');
      if (!id && r.method === 'GET') {
        const all = state.items.filter((x) => x.type === type);
        const limit = Number(r.query.get('paging.limit') ?? 50);
        const start = Number(r.query.get('paging.cursor') ?? 0);
        const page = all.slice(start, start + limit);
        const hasNext = start + limit < all.length;
        return { body: { itemSeoTags: page.map((x) => itemJson(x, false)), pagingMetadata: { count: page.length, hasNext, ...(hasNext ? { cursors: { next: String(start + limit) } } : { cursors: {} }) } } };
      }
      const it = state.items.find((x) => x.type === type && x.id === id);
      if (!it) return err(404, 'ITEM_NOT_FOUND');
      if (r.method === 'GET' && !action) return { body: { itemSeoTags: itemJson(it, true) } };
      if (r.method === 'POST' && action === 'reset-to-default') {
        const m = needManage();
        if (m) return m;
        it.draft = [];
        it.live = [];
        return { body: { itemSeoTags: itemJson(it, true) } };
      }
      if (r.method === 'PATCH' && !action) {
        const m = needManage();
        if (m) return m;
        const b = JSON.parse(r.body || '{}') as { itemSeoTags?: { tags?: WixTag[]; language?: string }; fieldMask?: string; publish?: boolean };
        if (!b.fieldMask || !String(b.fieldMask).split(',').every((f) => ['tags', 'focusKeywords'].includes(f.trim()))) return err(400, 'INVALID_FIELD_MASK');
        if (b.itemSeoTags?.language) return err(400, 'LANGUAGE_NOT_SUPPORTED');
        const tags = b.itemSeoTags?.tags ?? [];
        if (tags.length > 100) return err(400, 'INVALID_TAGS');
        for (const t of tags) {
          if (t.custom && (t.type === 'title' || t.type === 'script')) return err(400, 'TAG_TYPE_NOT_ALLOWED');
          if (t.type === 'script') {
            try {
              JSON.parse(t.children ?? '');
            } catch {
              return err(400, 'INVALID_TAGS');
            }
          }
        }
        it.draft = tags.map((t) => ({ ...t }));
        if (it.type !== 'STATIC_PAGE') it.live = it.draft.map((t) => ({ ...t }));
        else if (b.publish) {
          if (!state.published) return { status: 428, body: { message: 'Draft saved, not published', details: { applicationError: { code: 'DRAFT_SAVED_NOT_PUBLISHED', data: { draftSaved: true, savedItemIds: [it.id] } } } } };
          it.live = it.draft.map((t) => ({ ...t }));
        }
        return { body: { itemSeoTags: { ...itemJson(it, false), tags: it.draft } } };
      }
      return { status: 404, body: { message: 'Not Found' } };
    }

    // --- Blog / Stores -----------------------------------------------------
    let m = /^\/v3\/posts\/slugs\/(.+)$/.exec(r.path);
    if (m && r.method === 'GET') {
      const it = state.items.find((x) => x.type === 'BLOG_POST' && x.slug === decodeURIComponent(m![1]));
      return it ? { body: { post: { id: it.id, slug: it.slug, title: it.defaults.title } } } : { status: 404, body: { message: 'post not found', details: {} } };
    }
    m = /^\/stores\/v3\/products\/slug\/(.+)$/.exec(r.path);
    if (m && r.method === 'GET') {
      if (state.catalogV1) return { status: 404, body: { message: 'Not Found' } }; // site en catalogue V1
      const it = state.items.find((x) => x.type === 'STORES_PRODUCT' && x.slug === decodeURIComponent(m![1]));
      return it ? { body: { product: { id: it.id, slug: it.slug, name: it.defaults.title } } } : { status: 404, body: { message: 'product not found', details: {} } };
    }

    // --- Redirects ---------------------------------------------------------
    if (r.path === '/seo-redirects-service/v1/redirects' && r.method === 'GET') return { body: { redirects: state.redirects } };
    if (r.path === '/seo-redirects-service/v1/create-redirect' && r.method === 'POST') {
      const mm = needManage();
      if (mm) return mm;
      const b = JSON.parse(r.body || '{}') as { redirect?: { from?: string; to?: string; options?: { groupRedirect?: boolean } } };
      const red = b.redirect;
      if (!red?.from || !red.to || samePath(red.from, '/')) return { status: 400, body: { message: 'invalid', details: { validationError: { fieldViolations: [{ field: 'redirect.from' }] } } } };
      if (state.redirects.some((x) => samePath(x.from, red.from!))) return err(409, 'FROM_URL_EXISTS');
      state.redirects = state.redirects.filter((x) => !samePath(x.from, red.to!)); // résolution de boucle : supprimée
      const created = { id: `red-${state.nextId++}`, from: red.from, to: red.to, ...(red.options ? { options: red.options } : {}) };
      state.redirects.push(created);
      return { body: { redirect: created } };
    }
    m = /^\/seo-redirects-service\/v1\/redirects\/([^/]+)$/.exec(r.path);
    if (m && r.method === 'DELETE') {
      const mm = needManage();
      if (mm) return mm;
      const before = state.redirects.length;
      state.redirects = state.redirects.filter((x) => x.id !== m![1]);
      return before === state.redirects.length ? { status: 404, body: { message: 'Not Found' } } : { body: {} };
    }

    // --- Txt File Server ---------------------------------------------------
    m = new RegExp(`^${state.txtBase.replace(/\//g, '\\/')}\\/(robots|llms)$`).exec(r.path);
    if (m) {
      const isLlms = m[1] === 'llms';
      if (isLlms || r.method === 'PUT') {
        const mm = needManage(); // GET llms exige « Manage SEO Settings » (documentation)
        if (mm) return mm;
      }
      const key = isLlms ? 'llmsTxt' : 'robotsTxt';
      if (r.method === 'GET') return { body: { [key]: { ...(isLlms ? state.llms : state.robots), subdomain: r.query.get('subdomain') ?? 'www' } } };
      if (r.method === 'PUT') {
        const b = JSON.parse(r.body || '{}') as Record<string, { content?: string; default?: boolean; manuallyEdited?: boolean } | undefined>;
        const f = b[key] ?? {};
        if (isLlms && state.llms.manuallyEdited && !f.manuallyEdited) return { status: 428, body: { message: 'FAILED_PRECONDITION', details: {} } };
        if (isLlms) state.llms = { content: f.default ? LLMS_DEFAULT : (f.content ?? ''), default: Boolean(f.default), manuallyEdited: Boolean(f.manuallyEdited) };
        else state.robots = { content: f.default ? ROBOTS_DEFAULT : (f.content ?? ''), default: Boolean(f.default) };
        return { body: { [key]: isLlms ? state.llms : state.robots } };
      }
    }
    return { status: 404, body: { message: 'Not Found' } };
  };

  // --- Site public (rendu depuis les balises publiées) -----------------------
  const siteHandler: FakeHandler = (r): FakeRes => {
    if (r.path === '/robots.txt') return { headers: { 'content-type': 'text/plain' }, body: state.robots.content };
    if (r.path === '/llms.txt') return { headers: { 'content-type': 'text/plain' }, body: state.llms.content };
    const red = state.redirects.find((x) => samePath(x.from, r.path));
    if (red) return { status: 301, headers: { location: `https://${site}${red.to}` }, body: '' };
    const it = state.items.find((x) => samePath(x.path, r.path));
    if (!it) return { status: 404, body: '<h1>404</h1>' };
    const find = (pred: (t: WixTag) => boolean) => it.live.find((t) => !t.disabled && pred(t));
    const title = find((t) => t.type === 'title')?.children ?? it.defaults.title;
    const desc = find((t) => t.type === 'meta' && lc(t.props?.name) === 'description')?.props?.content ?? it.defaults.description;
    const robots = find((t) => t.type === 'meta' && lc(t.props?.name) === 'robots')?.props?.content;
    const canon = find((t) => t.type === 'link' && lc(t.props?.rel) === 'canonical')?.props?.href ?? `https://${site}${it.path === '/' ? '' : it.path}`;
    const scripts = it.live.filter((t) => t.type === 'script' && !t.disabled).map((t) => `<script type="application/ld+json">${t.children}</script>`);
    const head = `<title>${esc(title)}</title>${desc ? `<meta name="description" content="${esc(desc)}">` : ''}${robots ? `<meta name="robots" content="${esc(robots)}">` : ''}<link rel="canonical" href="${canon}">${scripts.join('')}`;
    return { body: `<!doctype html><html lang="fr"><head>${head}</head><body><main><h1>${esc(it.defaults.title.split(' | ')[0])}</h1><p>Atelier Terre, céramiste à Nantes : bols et tasses en grès, émaillés à la main.</p></main></body></html>` };
  };

  return { state, api, site: siteHandler };
}
