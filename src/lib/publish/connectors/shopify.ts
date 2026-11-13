/**
 * Connecteur Shopify (Admin GraphQL, docs/v5/publication.md § Shopify).
 * Jeton : celui de l'OAuth existant (src/lib/ecommerce/shopify.ts, chiffré, rafraîchi) — à ré-autoriser avec les
 * portées d'écriture — ou un jeton d'app personnalisée saisi par le marchand (`shpat_…`, chiffré par connections.ts).
 * - Produits : `productUpdate(product: { id, seo })`, `descriptionHtml` ;
 * - Pages, articles, collections : métachamps `global.title_tag` / `global.description_tag` (`metafieldsSet`, suppression
 *   par `metafieldsDelete` pour rétablir « absent ») ; corps des pages et articles ;
 * - Redirections : `urlRedirectCreate` / `urlRedirectUpdate` / `urlRedirectDelete` ;
 * - Thème (robots.txt.liquid, llms.txt.liquid) : `themeFilesUpsert` / `themeFilesDelete`, seulement avec
 *   `SHOPIFY_THEME_WRITE=1` (exemption Shopify obtenue).
 */
import { accessToken, apiVersion, normalizeShop } from '@/lib/ecommerce/shopify';
import { parseJson, statusError } from '../http';
import { PublishError, type Change, type ChangeKind, type ConnectInput, type ConnectorContext, type PublishConnector, type ResourceRef, type TestResult } from '../types';

const THEME_FILES: Partial<Record<ChangeKind, string>> = { 'robots.txt': 'templates/robots.txt.liquid', 'llms.txt': 'templates/llms.txt.liquid' };
const META_FIELD: Partial<Record<ChangeKind, 'title_tag' | 'description_tag'>> = { 'meta.title': 'title_tag', 'meta.description': 'description_tag' };
const OWNER_QUERY: Record<string, string> = { page: 'page', article: 'article', collection: 'collection', product: 'product' };

export const themeWriteEnabled = () => process.env.SHOPIFY_THEME_WRITE === '1';

async function token(ctx: ConnectorContext): Promise<string> {
  if (ctx.credentials.token) return ctx.credentials.token;
  const t = await accessToken(ctx.businessId).catch(() => null);
  if (!t || t.shop !== ctx.config.shop) throw new PublishError(401, 'Connexion Shopify expirée : reconnectez la boutique.', 'auth');
  return t.token;
}

export async function shopifyGraphql<T>(ctx: ConnectorContext, query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await ctx.http({
    method: 'POST',
    url: `https://${ctx.config.shop}/admin/api/${apiVersion()}/graphql.json`,
    headers: { 'content-type': 'application/json', 'x-shopify-access-token': await token(ctx) },
    body: JSON.stringify({ query, variables }),
  });
  if (res.status !== 200) throw statusError(res, 'Shopify');
  const j = parseJson<{ data?: T; errors?: { message?: string; extensions?: { code?: string } }[] }>(res, 'Shopify');
  if (j.errors?.length) {
    const denied = j.errors.some((e) => e.extensions?.code === 'ACCESS_DENIED');
    throw new PublishError(denied ? 403 : 502, denied ? 'Shopify : droits insuffisants (ré-autorisez Repéré avec les droits d’écriture).' : 'Shopify a refusé la requête.', denied ? 'forbidden' : 'upstream');
  }
  if (!j.data) throw new PublishError(502, 'Shopify : réponse sans données.');
  return j.data;
}

function userErrors(payload: { userErrors?: { message: string }[] } | null | undefined, what: string): void {
  const errs = payload?.userErrors ?? [];
  if (errs.length) throw new PublishError(422, `${what} : ${errs.map((e) => e.message).join(' ; ').slice(0, 300)}`, 'user_error');
}

function pathOf(change: Change): string {
  try {
    return new URL(change.target.url ?? '').pathname.replace(/\/+$/, '') || '/';
  } catch {
    return '';
  }
}

/** /products/<h>, /collections/<h>, /pages/<h>, /blogs/<b>/<h> (préfixe de langue Markets toléré). */
export function shopifyPath(path: string): { type: ResourceRef['type']; handle: string } | null {
  const p = path.replace(/^\/[a-z]{2}(?:-[a-z]{2})?(?=\/)/i, '');
  let m = /^\/(?:collections\/[^/]+\/)?products\/([^/?#]+)$/.exec(p);
  if (m) return { type: 'product', handle: decodeURIComponent(m[1]) };
  m = /^\/collections\/([^/?#]+)$/.exec(p);
  if (m) return { type: 'collection', handle: decodeURIComponent(m[1]) };
  m = /^\/pages\/([^/?#]+)$/.exec(p);
  if (m) return { type: 'page', handle: decodeURIComponent(m[1]) };
  m = /^\/blogs\/[^/]+\/([^/?#]+)$/.exec(p);
  if (m) return { type: 'article', handle: decodeURIComponent(m[1]) };
  return null;
}

async function mainThemeId(ctx: ConnectorContext): Promise<string> {
  const d = await shopifyGraphql<{ themes: { nodes: { id: string }[] } }>(ctx, `query { themes(first: 1, roles: [MAIN]) { nodes { id } } }`);
  const id = d.themes.nodes[0]?.id;
  if (!id) throw new PublishError(404, 'Thème publié introuvable.');
  return id;
}

async function readThemeFile(ctx: ConnectorContext, filename: string): Promise<string | null> {
  const d = await shopifyGraphql<{ themes: { nodes: { files: { nodes: { filename: string; body?: { content?: string } }[] } }[] } }>(
    ctx,
    `query($f: [String!]) { themes(first: 1, roles: [MAIN]) { nodes { files(filenames: $f, first: 1) { nodes { filename body { ... on OnlineStoreThemeFileBodyText { content } } } } } } }`,
    { f: [filename] },
  );
  const file = d.themes.nodes[0]?.files.nodes.find((f) => f.filename === filename);
  return file ? (file.body?.content ?? '') : null;
}

const BODY_FIELD: Record<string, string> = { product: 'descriptionHtml', page: 'body', article: 'body' };

export const shopifyConnector: PublishConnector = {
  platform: 'shopify',
  kinds: ['meta.title', 'meta.description', 'redirect', 'rewrite', 'robots.txt', 'llms.txt'],

  connect(input: ConnectInput): ConnectInput {
    const shop = normalizeShop(input.config.shop ?? '');
    if (!shop) throw new PublishError(400, 'Boutique Shopify invalide (ex. ma-boutique.myshopify.com).');
    const t = String(input.credentials.token ?? '').trim();
    if (t && !/^shp(at|ca|ss)_[A-Za-z0-9]{20,}$/.test(t)) throw new PublishError(400, 'Jeton d’accès Shopify invalide (il commence par shpat_).');
    return { config: { shop }, credentials: t ? { token: t } : {} };
  },

  async test(ctx): Promise<TestResult> {
    const d = await shopifyGraphql<{ shop: { name: string }; currentAppInstallation: { accessScopes: { handle: string }[] } }>(
      ctx,
      `query { shop { name } currentAppInstallation { accessScopes { handle } } }`,
    );
    const scopes = new Set(d.currentAppInstallation.accessScopes.map((s) => s.handle));
    const caps: ChangeKind[] = [];
    if (scopes.has('write_products') || scopes.has('write_content')) caps.push('meta.title', 'meta.description', 'rewrite');
    if (scopes.has('write_online_store_navigation')) caps.push('redirect');
    if (scopes.has('write_themes') && themeWriteEnabled()) caps.push('robots.txt', 'llms.txt');
    const missing = ['write_products', 'write_content', 'write_online_store_navigation'].filter((s) => !scopes.has(s));
    return {
      ok: caps.length > 0,
      detail: caps.length
        ? `Connecté à « ${d.shop.name} ».${missing.length ? ` Droits manquants pour aller plus loin : ${missing.join(', ')}.` : ''}`
        : 'La boutique est connectée en lecture seule : ré-autorisez Repéré avec les droits d’écriture.',
      capabilities: caps,
      info: { shopName: d.shop.name },
    };
  },

  async locate(ctx, change): Promise<ResourceRef> {
    if (change.target.resource?.id) return change.target.resource;
    if (change.kind === 'redirect') {
      const path = change.target.path ?? '';
      const d = await shopifyGraphql<{ urlRedirects: { nodes: { id: string; path: string }[] } }>(ctx, `query($q: String) { urlRedirects(first: 5, query: $q) { nodes { id path } } }`, { q: `path:${path}` });
      const hit = d.urlRedirects.nodes.find((r) => r.path === path);
      return { type: 'redirect', ...(hit ? { id: hit.id } : {}) };
    }
    if (THEME_FILES[change.kind]) return { type: 'file', id: THEME_FILES[change.kind] };
    const p = shopifyPath(pathOf(change));
    if (!p) throw new PublishError(422, 'Cette page Shopify ne se modifie pas par l’API (page d’accueil ou modèle de thème) : utilisez l’export.', 'unsupported');
    let id: string | undefined;
    if (p.type === 'product' || p.type === 'collection') {
      const field = p.type === 'product' ? 'productByIdentifier' : 'collectionByIdentifier';
      const d = await shopifyGraphql<Record<string, { id: string } | null>>(ctx, `query($h: String!) { r: ${field}(identifier: { handle: $h }) { id } }`, { h: p.handle });
      id = d.r?.id;
    } else {
      const list = p.type === 'page' ? 'pages' : 'articles';
      const d = await shopifyGraphql<Record<string, { nodes: { id: string; handle: string }[] }>>(ctx, `query($q: String) { r: ${list}(first: 5, query: $q) { nodes { id handle } } }`, { q: `handle:${p.handle}` });
      id = d.r.nodes.find((n) => n.handle === p.handle)?.id;
    }
    if (!id) throw new PublishError(404, 'Ressource Shopify introuvable.', 'not_found');
    return { type: p.type, id, extra: { handle: p.handle } };
  },

  async read(ctx, change): Promise<string | null> {
    const ref = await shopifyConnector.locate(ctx, change);
    if (ref.type === 'redirect') {
      if (!ref.id) return null;
      const d = await shopifyGraphql<{ urlRedirect: { target: string } | null }>(ctx, `query($id: ID!) { urlRedirect(id: $id) { target } }`, { id: ref.id });
      return d.urlRedirect?.target ?? null;
    }
    if (ref.type === 'file') return readThemeFile(ctx, ref.id ?? '');
    const owner = OWNER_QUERY[ref.type];
    if (change.kind === 'rewrite') {
      const f = BODY_FIELD[ref.type];
      if (!f) throw new PublishError(422, 'Réécriture non disponible pour ce type de page.', 'unsupported');
      const d = await shopifyGraphql<{ r: Record<string, string | null> | null }>(ctx, `query($id: ID!) { r: ${owner}(id: $id) { ${f} } }`, { id: ref.id });
      return d.r?.[f] ?? '';
    }
    if (ref.type === 'product') {
      const d = await shopifyGraphql<{ r: { seo: { title: string | null; description: string | null } } | null }>(ctx, `query($id: ID!) { r: product(id: $id) { seo { title description } } }`, { id: ref.id });
      return (change.kind === 'meta.title' ? d.r?.seo.title : d.r?.seo.description) ?? '';
    }
    const key = META_FIELD[change.kind];
    if (!key) throw new PublishError(422, 'Modification non disponible sur Shopify.', 'unsupported');
    const d = await shopifyGraphql<{ r: { metafield: { value: string } | null } | null }>(ctx, `query($id: ID!, $k: String!) { r: ${owner}(id: $id) { metafield(namespace: "global", key: $k) { value } } }`, { id: ref.id, k: key });
    return d.r?.metafield?.value ?? null;
  },

  async apply(ctx, change) {
    return write(ctx, change, change.after, 'apply');
  },

  async revert(ctx, change) {
    await write(ctx, change, change.before, 'revert');
  },
};

async function write(ctx: ConnectorContext, change: Change, value: string | null, mode: 'apply' | 'revert'): Promise<{ remoteRef?: string }> {
  const ref = await shopifyConnector.locate(ctx, change);
  if (ref.type === 'redirect') {
    const path = change.target.path ?? '';
    const existing = ref.id ?? change.remoteRef;
    if (value === null) {
      if (!existing) return {};
      const d = await shopifyGraphql<{ urlRedirectDelete: { userErrors: { message: string }[] } }>(ctx, `mutation($id: ID!) { urlRedirectDelete(id: $id) { deletedUrlRedirectId userErrors { message } } }`, { id: existing });
      userErrors(d.urlRedirectDelete, 'Suppression de la redirection');
      return {};
    }
    if (existing) {
      const d = await shopifyGraphql<{ urlRedirectUpdate: { userErrors: { message: string }[] } }>(ctx, `mutation($id: ID!, $r: UrlRedirectInput!) { urlRedirectUpdate(id: $id, urlRedirect: $r) { urlRedirect { id } userErrors { message } } }`, { id: existing, r: { path, target: value } });
      userErrors(d.urlRedirectUpdate, 'Redirection');
      return { remoteRef: existing };
    }
    const d = await shopifyGraphql<{ urlRedirectCreate: { urlRedirect: { id: string } | null; userErrors: { message: string }[] } }>(ctx, `mutation($r: UrlRedirectInput!) { urlRedirectCreate(urlRedirect: $r) { urlRedirect { id } userErrors { message } } }`, { r: { path, target: value } });
    userErrors(d.urlRedirectCreate, 'Redirection');
    return mode === 'apply' && d.urlRedirectCreate.urlRedirect ? { remoteRef: d.urlRedirectCreate.urlRedirect.id } : {};
  }
  if (ref.type === 'file') {
    if (!themeWriteEnabled()) throw new PublishError(422, 'Modification du thème non autorisée (exemption Shopify requise) : utilisez l’export.', 'unsupported');
    const themeId = await mainThemeId(ctx);
    if (value === null) {
      const d = await shopifyGraphql<{ themeFilesDelete: { userErrors: { message: string }[] } }>(ctx, `mutation($t: ID!, $f: [String!]!) { themeFilesDelete(themeId: $t, files: $f) { deletedThemeFiles { filename } userErrors { message } } }`, { t: themeId, f: [ref.id] });
      userErrors(d.themeFilesDelete, 'Fichier du thème');
      return {};
    }
    const d = await shopifyGraphql<{ themeFilesUpsert: { userErrors: { message: string }[] } }>(
      ctx,
      `mutation($t: ID!, $files: [OnlineStoreThemeFilesUpsertFileInput!]!) { themeFilesUpsert(themeId: $t, files: $files) { upsertedThemeFiles { filename } userErrors { message } } }`,
      { t: themeId, files: [{ filename: ref.id, body: { type: 'TEXT', value } }] },
    );
    userErrors(d.themeFilesUpsert, 'Fichier du thème');
    return {};
  }
  if (change.kind === 'rewrite') {
    const v = value ?? '';
    if (ref.type === 'product') {
      const d = await shopifyGraphql<{ productUpdate: { userErrors: { message: string }[] } }>(ctx, `mutation($p: ProductUpdateInput!) { productUpdate(product: $p) { product { id } userErrors { message } } }`, { p: { id: ref.id, descriptionHtml: v } });
      userErrors(d.productUpdate, 'Produit');
    } else if (ref.type === 'page') {
      const d = await shopifyGraphql<{ pageUpdate: { userErrors: { message: string }[] } }>(ctx, `mutation($id: ID!, $p: PageUpdateInput!) { pageUpdate(id: $id, page: $p) { page { id } userErrors { message } } }`, { id: ref.id, p: { body: v } });
      userErrors(d.pageUpdate, 'Page');
    } else if (ref.type === 'article') {
      const d = await shopifyGraphql<{ articleUpdate: { userErrors: { message: string }[] } }>(ctx, `mutation($id: ID!, $a: ArticleUpdateInput!) { articleUpdate(id: $id, article: $a) { article { id } userErrors { message } } }`, { id: ref.id, a: { body: v } });
      userErrors(d.articleUpdate, 'Article');
    } else throw new PublishError(422, 'Réécriture non disponible pour ce type de page.', 'unsupported');
    return {};
  }
  if (ref.type === 'product') {
    const seo = change.kind === 'meta.title' ? { title: value ?? '' } : { description: value ?? '' };
    const d = await shopifyGraphql<{ productUpdate: { userErrors: { message: string }[] } }>(ctx, `mutation($p: ProductUpdateInput!) { productUpdate(product: $p) { product { id } userErrors { message } } }`, { p: { id: ref.id, seo } });
    userErrors(d.productUpdate, 'Produit');
    return {};
  }
  const key = META_FIELD[change.kind];
  if (!key) throw new PublishError(422, 'Modification non disponible sur Shopify.', 'unsupported');
  if (value === null) {
    const d = await shopifyGraphql<{ metafieldsDelete: { userErrors: { message: string }[] } }>(ctx, `mutation($m: [MetafieldIdentifierInput!]!) { metafieldsDelete(metafields: $m) { deletedMetafields { key } userErrors { message } } }`, { m: [{ ownerId: ref.id, namespace: 'global', key }] });
    userErrors(d.metafieldsDelete, 'Métachamp SEO');
    return {};
  }
  const d = await shopifyGraphql<{ metafieldsSet: { userErrors: { message: string }[] } }>(
    ctx,
    `mutation($m: [MetafieldsSetInput!]!) { metafieldsSet(metafields: $m) { metafields { id } userErrors { message } } }`,
    { m: [{ ownerId: ref.id, namespace: 'global', key, type: 'single_line_text_field', value }] },
  );
  userErrors(d.metafieldsSet, 'Métachamp SEO');
  return {};
}
