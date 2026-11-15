/**
 * Connecteur Wix (REST, https://www.wixapis.com) — recherche du 15 nov. 2026, docs/v5/publication.md § Wix.
 *
 * Authentification (docs : « REST API Authentication », « About API Keys ») :
 * - clé API de compte (mode par défaut, sans app Repéré) : créée par le propriétaire du site dans SON compte Wix, portée
 *   « Manage SEO Settings » (+ lecture Blog / Produits), accès limité à ce site ; en-têtes `Authorization: <clé>` et
 *   `wix-site-id: <id du site>`. « Site-level calls only work with keys generated from the account that owns the site. »
 * - app Wix (OAuth `client_credentials`) : `POST /oauth2/token` { client_id, client_secret, instance_id } → jeton de 4 h.
 *   Nécessite une app Repéré créée dans le Wix Dev Center (WIX_APP_ID / WIX_APP_SECRET) et installée sur le site
 *   (lien d'installation d'une app non listée : pas d'examen App Market). Désactivé tant que l'app n'est pas configurée.
 *
 * Ce que l'API permet (et que ce connecteur fait) :
 * - balises SEO d'un élément (page statique, article de blog, produit Wix Stores) : Item SEO Tags API —
 *   titre, méta-description, URL canonique, meta robots, données structurées (`script` application/ld+json).
 *   « Setting `tags` replaces the item's tags in full » : on relit toujours la liste complète avant d'écrire.
 *   Pages statiques : `publish: true` (sinon seul le brouillon change). Langue principale uniquement.
 * - redirections 301 : SEO Redirects API (pas de mise à jour : suppression puis recréation ; on refuse d'écrire si une
 *   redirection existante partirait de la cible, car Wix la supprimerait sans chaîner).
 * - robots.txt et llms.txt : Txt File Server API (`default: true` pour revenir au contenu Wix).
 * Ce qui reste guidé (export + instructions dans l'éditeur Wix) : textes alternatifs (l'API Media Manager ne modifie que
 * le fichier de la médiathèque, pas l'image placée sur la page), FAQ visible, réécriture de texte, plan du site (généré
 * par Wix).
 *
 * Deux chemins figurent dans la documentation officielle pour certaines API (schéma vs exemple curl) : on essaie le
 * chemin du schéma, puis l'autre seulement sur un 404 sans code d'erreur applicatif Wix.
 */
import { normalizeSiteUrl, parseJson, statusError } from '../http';
import { PublishError, type Change, type ChangeKind, type ChangePatch, type ConnectInput, type ConnectorContext, type HttpResponse, type PublishConnector, type ResourceRef, type TestResult } from '../types';

export const WIX_API = 'https://www.wixapis.com';
export const WIX_PATHS = {
  seoTags: ['/seo-metatags-server/v1/item-seo-tags', '/promote/seo/v1/item-seo-tags'],
  redirects: ['/seo-redirects-service/v1'],
  txt: ['/promote-seo-robots-server/v2', '/promote-seo-txt-file-server/v2'],
  blogBySlug: ['/v3/posts/slugs/'],
  productBySlug: ['/stores/v3/products/slug/'],
  token: '/oauth2/token',
} as const;

export const WIX_KINDS: readonly ChangeKind[] = ['meta.title', 'meta.description', 'canonical', 'meta.robots', 'jsonld', 'redirect', 'robots.txt', 'llms.txt'];
/** Ce que l'agent prépare en export guidé sur Wix (pas d'écriture par l'API documentée). */
export const WIX_GUIDED: readonly ChangeKind[] = ['image.alt', 'faq', 'rewrite', 'sitemap.xml'];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const wixAppConfigured = () => Boolean(process.env.WIX_APP_ID && process.env.WIX_APP_SECRET);

// ---------------------------------------------------------------------------
// Authentification et requêtes
// ---------------------------------------------------------------------------
const g = globalThis as unknown as { __repereWixTokens?: Map<string, { token: string; exp: number }> };
const tokens = (g.__repereWixTokens ??= new Map());

/** Tests : vide le cache des jetons d'app. */
export function resetWixTokens(): void {
  tokens.clear();
}

async function appToken(ctx: ConnectorContext): Promise<string> {
  const instanceId = ctx.config.instanceId ?? '';
  const hit = tokens.get(instanceId);
  const now = ctx.now().getTime();
  if (hit && hit.exp > now) return hit.token;
  if (!wixAppConfigured()) throw new PublishError(503, 'L’app Repéré pour Wix n’est pas encore configurée : utilisez une clé API.', 'wix_app_missing');
  const res = await ctx.http({
    method: 'POST',
    url: `${WIX_API}${WIX_PATHS.token}`,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ grant_type: 'client_credentials', client_id: process.env.WIX_APP_ID, client_secret: process.env.WIX_APP_SECRET, instance_id: instanceId }),
  });
  if (res.status !== 200) throw res.status === 400 || res.status === 401 || res.status === 403 ? new PublishError(401, 'Wix : l’app Repéré n’est plus installée sur ce site.', 'auth') : statusError(res, 'Wix');
  const j = parseJson<{ access_token?: string; expires_in?: number }>(res, 'Wix');
  if (!j.access_token) throw new PublishError(502, 'Wix : jeton absent de la réponse.');
  // jeton valable 4 h (documentation) ; marge de 5 min
  tokens.set(instanceId, { token: j.access_token, exp: now + Math.max(60, (j.expires_in ?? 14_400) - 300) * 1000 });
  return j.access_token;
}

async function authHeaders(ctx: ConnectorContext): Promise<Record<string, string>> {
  if (ctx.credentials.apiKey) return { authorization: ctx.credentials.apiKey, 'wix-site-id': ctx.config.siteId ?? '' };
  if (ctx.config.instanceId) return { authorization: await appToken(ctx) };
  throw new PublishError(401, 'Connexion Wix incomplète : reconnectez le site.', 'auth');
}

function appCode(res: HttpResponse): string {
  try {
    const j = JSON.parse(res.text) as { details?: { applicationError?: { code?: string } } };
    return j.details?.applicationError?.code ?? '';
  } catch {
    return '';
  }
}

function wixError(res: HttpResponse, what: string): PublishError {
  const code = appCode(res);
  if (code === 'DRAFT_SAVED_NOT_PUBLISHED') return new PublishError(409, `${what} : le brouillon est enregistré, mais le site n’a encore jamais été publié dans Wix. Publiez-le une fois depuis l’éditeur.`, 'wix_not_published');
  if (code === 'INVALID_TAGS') return new PublishError(422, `${what} : Wix a refusé la balise (valeur invalide pour ce type).`, 'user_error');
  if (code === 'ITEM_NOT_FOUND') return new PublishError(404, `${what} : élément introuvable sur le site Wix.`, 'not_found');
  if (code === 'FROM_URL_EXISTS') return new PublishError(409, `${what} : une redirection part déjà de cette adresse.`, 'conflict');
  if (res.status === 428) return new PublishError(409, `${what} : identifiant du site manquant ou refusé.`, 'wix_site');
  if (res.status === 403) return new PublishError(403, `${what} : droits insuffisants (la clé doit avoir « Gérer les paramètres SEO » et l’accès à ce site).`, 'forbidden');
  return statusError(res, what);
}

export async function wixRequest<T>(
  ctx: ConnectorContext,
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  bases: readonly string[],
  suffix: string,
  body: unknown,
  what: string,
  ok: number[] = [200],
): Promise<T> {
  const headers = { ...(await authHeaders(ctx)), accept: 'application/json', ...(body !== undefined ? { 'content-type': 'application/json' } : {}) };
  let last: HttpResponse | null = null;
  for (const base of bases) {
    const res = await ctx.http({ method, url: `${WIX_API}${base}${suffix}`, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    if (ok.includes(res.status)) return (res.text ? parseJson<T>(res, what) : ({} as T));
    last = res;
    if (res.status === 404 && !appCode(res)) continue; // chemin alternatif documenté
    break;
  }
  throw wixError(last as HttpResponse, what);
}

// ---------------------------------------------------------------------------
// Balises SEO d'un élément
// ---------------------------------------------------------------------------
export interface WixTag {
  type: string;
  props?: Record<string, string>;
  children?: string;
  custom?: boolean;
  disabled?: boolean;
  meta?: unknown;
}
interface ItemSeoTags {
  itemType?: string;
  itemId?: string;
  tags?: WixTag[];
  hasOverride?: boolean;
  resolvedTags?: { tag: WixTag; source?: string }[];
}

type TagKind = 'meta.title' | 'meta.description' | 'canonical' | 'meta.robots' | 'jsonld';
const TAG_KINDS = new Set<ChangeKind>(['meta.title', 'meta.description', 'canonical', 'meta.robots', 'jsonld']);
const lc = (s: unknown) => String(s ?? '').toLowerCase();

export function tagMatches(kind: TagKind, t: WixTag): boolean {
  switch (kind) {
    case 'meta.title':
      return t.type === 'title';
    case 'meta.description':
      return t.type === 'meta' && lc(t.props?.name) === 'description';
    case 'meta.robots':
      return t.type === 'meta' && lc(t.props?.name) === 'robots';
    case 'canonical':
      return t.type === 'link' && lc(t.props?.rel) === 'canonical';
    case 'jsonld':
      return t.type === 'script' && lc(t.props?.type) === 'application/ld+json';
  }
}

const SCRIPT_RE = /<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi;
export const scriptHtml = (json: string) => `<script type="application/ld+json">${json.trim()}</script>`;

/** Blocs JSON-LD d'un texte (`<script type="application/ld+json">…</script>`), JSON vérifié. */
export function jsonLdScripts(value: string): string[] {
  const out: string[] = [];
  for (const m of value.matchAll(SCRIPT_RE)) {
    const inner = m[1].trim();
    try {
      JSON.parse(inner);
    } catch {
      throw new PublishError(422, 'Données structurées : JSON invalide.', 'user_error');
    }
    out.push(inner);
  }
  return out;
}

function tagValue(kind: TagKind, tags: WixTag[]): string | null {
  const live = tags.filter((t) => !t.disabled && tagMatches(kind, t));
  if (kind === 'jsonld') return live.length ? live.map((t) => scriptHtml(t.children ?? '')).join('\n\n') : null;
  const t = live[0];
  if (!t) return null;
  if (kind === 'meta.title') return t.children ?? '';
  if (kind === 'canonical') return t.props?.href ?? '';
  return t.props?.content ?? '';
}

function makeTags(kind: TagKind, value: string): WixTag[] {
  switch (kind) {
    case 'meta.title':
      return [{ type: 'title', children: value }];
    case 'meta.description':
      return [{ type: 'meta', props: { name: 'description', content: value } }];
    case 'meta.robots':
      return [{ type: 'meta', props: { name: 'robots', content: value } }];
    case 'canonical':
      return [{ type: 'link', props: { rel: 'canonical', href: value } }];
    case 'jsonld': {
      const scripts = jsonLdScripts(value);
      if (!scripts.length) throw new PublishError(422, 'Données structurées : aucun bloc JSON-LD à écrire.', 'user_error');
      return scripts.map((children) => ({ type: 'script', props: { type: 'application/ld+json' }, children }));
    }
  }
}

const itemPath = (ref: ResourceRef) => `/${encodeURIComponent(ref.extra?.itemType ?? '')}/${encodeURIComponent(ref.id ?? '')}`;

async function getItem(ctx: ConnectorContext, ref: ResourceRef): Promise<ItemSeoTags> {
  const r = await wixRequest<{ itemSeoTags?: ItemSeoTags }>(ctx, 'GET', WIX_PATHS.seoTags, itemPath(ref), undefined, 'Balises SEO Wix');
  return r.itemSeoTags ?? {};
}

function pathOf(url: string | undefined): string {
  try {
    return normPath(new URL(url ?? '').pathname);
  } catch {
    return '';
  }
}
const normPath = (p: string) => (p.replace(/\/+$/, '') || '/').toLowerCase();

function canonicalPath(item: ItemSeoTags): string | null {
  const t = (item.resolvedTags ?? []).map((r) => r.tag).find((x) => x && tagMatches('canonical', x));
  return t?.props?.href ? pathOf(t.props.href) : null;
}

/** Recherche d'un élément par l'URL canonique résolue (la liste ne renvoie pas d'URL : seulement les balises). */
async function findByCanonical(ctx: ConnectorContext, itemType: string, want: string): Promise<string | null> {
  let cursor = '';
  let fetched = 0;
  for (let page = 0; page < 10; page++) {
    const q = `?paging.limit=100${cursor ? `&paging.cursor=${encodeURIComponent(cursor)}` : ''}`;
    const r = await wixRequest<{ itemSeoTags?: ItemSeoTags[]; pagingMetadata?: { hasNext?: boolean; cursors?: { next?: string } } }>(ctx, 'GET', WIX_PATHS.seoTags, `/${itemType}${q}`, undefined, 'Pages Wix');
    for (const it of r.itemSeoTags ?? []) {
      let canon = canonicalPath(it);
      if (canon === null && it.itemId && fetched < 100) {
        fetched++;
        canon = canonicalPath(await getItem(ctx, { type: 'page', id: it.itemId, extra: { itemType } }));
      }
      if (canon === want && it.itemId) return it.itemId;
    }
    const next = r.pagingMetadata?.cursors?.next;
    if (!r.pagingMetadata?.hasNext || !next) break;
    cursor = next;
  }
  return null;
}

/** Adresses par défaut de Wix : /post/<slug> (blog), /product-page/<slug> (boutique). */
export function wixPath(path: string): { type: 'post' | 'product' | 'page'; itemType: string; slug?: string } {
  const p = path.replace(/^\/[a-z]{2}(?=\/)/i, ''); // préfixe de langue (site multilingue)
  let m = /^\/post\/([^/?#]+)$/.exec(p);
  if (m) return { type: 'post', itemType: 'BLOG_POST', slug: decodeURIComponent(m[1]) };
  m = /^\/product-page\/([^/?#]+)$/.exec(p);
  if (m) return { type: 'product', itemType: 'STORES_PRODUCT', slug: decodeURIComponent(m[1]) };
  return { type: 'page', itemType: 'STATIC_PAGE' };
}

async function locateItem(ctx: ConnectorContext, change: Change): Promise<ResourceRef> {
  const path = pathOf(change.target.url);
  if (!path) throw new PublishError(422, 'Adresse de page manquante.', 'unsupported');
  const w = wixPath(path);
  let id: string | null = null;
  if (w.slug) {
    try {
      if (w.type === 'post') id = (await wixRequest<{ post?: { id?: string } }>(ctx, 'GET', WIX_PATHS.blogBySlug, encodeURIComponent(w.slug), undefined, 'Article Wix')).post?.id ?? null;
      else id = (await wixRequest<{ product?: { id?: string } }>(ctx, 'GET', WIX_PATHS.productBySlug, encodeURIComponent(w.slug), undefined, 'Produit Wix')).product?.id ?? null;
    } catch (e) {
      if (!(e instanceof PublishError) || e.status !== 404) throw e;
    }
  }
  if (!id) id = await findByCanonical(ctx, w.itemType, path);
  if (!id) throw new PublishError(404, 'Page introuvable sur le site Wix (pages de collection CMS : utilisez l’export).', 'not_found');
  return { type: w.type, id, extra: { itemType: w.itemType } };
}

async function writeTags(ctx: ConnectorContext, change: Change, value: string | null): Promise<void> {
  const kind = change.kind as TagKind;
  const ref = await wixConnector.locate(ctx, change);
  const cur = await getItem(ctx, ref);
  const others = (cur.tags ?? []).filter((t) => !tagMatches(kind, t));
  const next = value === null ? others : [...others, ...makeTags(kind, value)];
  if (!next.length) {
    await wixRequest(ctx, 'POST', WIX_PATHS.seoTags, `${itemPath(ref)}/reset-to-default`, {}, 'Balises SEO Wix');
    return;
  }
  await wixRequest(ctx, 'PATCH', WIX_PATHS.seoTags, itemPath(ref), { itemSeoTags: { tags: next }, fieldMask: 'tags', ...(ref.extra?.itemType === 'STATIC_PAGE' ? { publish: true } : {}) }, 'Balises SEO Wix');
}

// ---------------------------------------------------------------------------
// Redirections
// ---------------------------------------------------------------------------
interface WixRedirect {
  id?: string;
  from: string;
  to: string;
  options?: { groupRedirect?: boolean };
  language?: string;
}
const samePath = (a: string, b: string) => (a.replace(/\/+$/, '') || '/') === (b.replace(/\/+$/, '') || '/');

async function listRedirects(ctx: ConnectorContext): Promise<WixRedirect[]> {
  return (await wixRequest<{ redirects?: WixRedirect[] }>(ctx, 'GET', WIX_PATHS.redirects, '/redirects', undefined, 'Redirections Wix')).redirects ?? [];
}

async function writeRedirect(ctx: ConnectorContext, change: Change, value: string | null): Promise<{ remoteRef?: string }> {
  const from = change.target.path ?? '';
  const all = await listRedirects(ctx);
  const existing = all.find((r) => samePath(r.from, from) && !r.language);
  if (value === null) {
    if (existing?.id) await wixRequest(ctx, 'DELETE', WIX_PATHS.redirects, `/redirects/${encodeURIComponent(existing.id)}`, undefined, 'Suppression de la redirection Wix', [200, 204]);
    return {};
  }
  if (existing && existing.to === value) return existing.id ? { remoteRef: existing.id } : {};
  // Wix ne chaîne pas : créer A → B supprime une redirection B → C existante. On ne le fait jamais en silence.
  const loop = all.find((r) => samePath(r.from, value) && r !== existing);
  if (loop) throw new PublishError(409, `Une redirection existante part déjà de ${value} (vers ${loop.to}) : Wix la supprimerait. Réglez ce cas dans Wix avant d’appliquer.`, 'conflict');
  if (existing?.id) await wixRequest(ctx, 'DELETE', WIX_PATHS.redirects, `/redirects/${encodeURIComponent(existing.id)}`, undefined, 'Redirection Wix', [200, 204]);
  const r = await wixRequest<{ redirect?: WixRedirect }>(ctx, 'POST', WIX_PATHS.redirects, '/create-redirect', { redirect: { from, to: value, ...(existing?.options ? { options: existing.options } : {}) } }, 'Redirection Wix');
  return r.redirect?.id ? { remoteRef: r.redirect.id } : {};
}

// ---------------------------------------------------------------------------
// robots.txt / llms.txt
// ---------------------------------------------------------------------------
const TXT = { 'robots.txt': { path: '/robots', key: 'robotsTxt' }, 'llms.txt': { path: '/llms', key: 'llmsTxt' } } as const;
type TxtKind = keyof typeof TXT;
export const WIX_DEFAULT_REF = 'wix-default';

interface TxtFile {
  content?: string;
  default?: boolean;
}
const sub = (ctx: ConnectorContext) => ctx.config.subdomain || 'www';

async function readTxt(ctx: ConnectorContext, kind: TxtKind): Promise<TxtFile> {
  const t = TXT[kind];
  const r = await wixRequest<Record<string, TxtFile | undefined>>(ctx, 'GET', WIX_PATHS.txt, `${t.path}?subdomain=${encodeURIComponent(sub(ctx))}`, undefined, `Fichier ${kind} Wix`);
  return r[t.key] ?? {};
}

async function writeTxt(ctx: ConnectorContext, kind: TxtKind, file: { content?: string; default?: boolean }): Promise<void> {
  const t = TXT[kind];
  const entity = { ...(file.content !== undefined ? { content: file.content } : {}), default: Boolean(file.default), subdomain: sub(ctx), ...(kind === 'llms.txt' ? { manuallyEdited: true } : {}) };
  await wixRequest(ctx, 'PUT', WIX_PATHS.txt, t.path, { [t.key]: entity }, `Fichier ${kind} Wix`);
}

// ---------------------------------------------------------------------------
// Connecteur
// ---------------------------------------------------------------------------
function sameOriginPath(site: string | undefined, value: string): string {
  try {
    const base = new URL(site ?? '');
    const u = new URL(value, base);
    return u.origin === base.origin ? `${u.pathname}${u.search}` : value;
  } catch {
    return value;
  }
}

export const wixConnector: PublishConnector = {
  platform: 'wix',
  kinds: WIX_KINDS,

  connect(input: ConnectInput): ConnectInput {
    const siteUrl = normalizeSiteUrl(input.config.siteUrl ?? '');
    const subdomain = String(input.config.subdomain ?? '').trim().toLowerCase();
    if (subdomain && !/^[a-z0-9-]{1,63}$/.test(subdomain)) throw new PublishError(400, 'Sous-domaine invalide (ex. www).');
    const extra: Record<string, string> = subdomain ? { subdomain } : {};
    const instanceId = String(input.config.instanceId ?? '').trim();
    if (instanceId) {
      if (!wixAppConfigured()) throw new PublishError(400, 'La connexion par l’app Repéré n’est pas encore disponible : utilisez une clé API.');
      if (!UUID.test(instanceId)) throw new PublishError(400, 'Identifiant d’installation Wix invalide.');
      return { config: { siteUrl, instanceId, ...extra }, credentials: {} };
    }
    const siteId = String(input.config.siteId ?? '').trim();
    if (!UUID.test(siteId)) throw new PublishError(400, 'Identifiant du site Wix invalide (format 1a2b3c4d-…, visible dans l’adresse du tableau de bord).');
    const apiKey = String(input.credentials.apiKey ?? '').trim();
    if (apiKey.length < 40 || /\s/.test(apiKey)) throw new PublishError(400, 'Clé API Wix requise (Paramètres du compte > Clés API).');
    return { config: { siteUrl, siteId, ...extra }, credentials: { apiKey } };
  },

  async test(ctx): Promise<TestResult> {
    await readTxt(ctx, 'robots.txt'); // lecture SEO : clé et site valides
    await wixRequest(ctx, 'GET', WIX_PATHS.seoTags, '/STATIC_PAGE?paging.limit=1', undefined, 'Pages Wix');
    let manage = true;
    try {
      await readTxt(ctx, 'llms.txt'); // « Manage SEO Settings » requis par la documentation
    } catch (e) {
      if (!(e instanceof PublishError) || (e.status !== 403 && e.status !== 401)) throw e;
      manage = false;
    }
    let redirects = manage;
    if (manage) {
      try {
        await listRedirects(ctx);
      } catch (e) {
        if (!(e instanceof PublishError) || e.status !== 403) throw e;
        redirects = false;
      }
    }
    const caps: ChangeKind[] = manage ? WIX_KINDS.filter((k) => k !== 'redirect' || redirects) : [];
    return {
      ok: caps.length > 0,
      detail: caps.length
        ? `Connecté au site Wix ${ctx.config.siteUrl ?? ''}. Les balises des pages sont publiées directement ; textes d’images, FAQ visibles et textes de page restent guidés (instructions pas à pas).`
        : 'La clé est valide mais en lecture seule : ajoutez la permission « Gérer les paramètres SEO » à la clé API.',
      capabilities: caps,
      info: { mode: ctx.credentials.apiKey ? 'apiKey' : 'app' },
    };
  },

  preparePatch(change: Change): ChangePatch {
    const p = change.patch;
    if (change.kind === 'jsonld' && p.op !== 'replace') {
      const scripts = jsonLdScripts(p.value);
      return scripts.length ? { ...p, value: scripts.map(scriptHtml).join('\n\n') } : p;
    }
    if (change.kind === 'redirect') return { ...p, value: sameOriginPath(change.target.url, p.value) };
    return p;
  },

  async locate(ctx, change): Promise<ResourceRef> {
    if (change.target.resource?.id) return change.target.resource;
    if (change.kind === 'redirect') {
      const hit = (await listRedirects(ctx)).find((r) => samePath(r.from, change.target.path ?? '') && !r.language);
      return { type: 'redirect', ...(hit?.id ? { id: hit.id } : {}) };
    }
    if (change.kind in TXT) return { type: 'file', id: change.kind };
    if (!TAG_KINDS.has(change.kind)) throw new PublishError(422, 'Modification non disponible par l’API Wix : utilisez l’export guidé.', 'unsupported');
    return locateItem(ctx, change);
  },

  async read(ctx, change): Promise<string | null> {
    if (change.kind === 'redirect') {
      const hit = (await listRedirects(ctx)).find((r) => samePath(r.from, change.target.path ?? '') && !r.language);
      return hit?.to ?? null;
    }
    if (change.kind in TXT) return (await readTxt(ctx, change.kind as TxtKind)).content ?? '';
    if (!TAG_KINDS.has(change.kind)) throw new PublishError(422, 'Modification non disponible par l’API Wix : utilisez l’export guidé.', 'unsupported');
    const ref = await wixConnector.locate(ctx, change);
    return tagValue(change.kind as TagKind, (await getItem(ctx, ref)).tags ?? []);
  },

  async apply(ctx, change) {
    if (change.kind === 'redirect') return writeRedirect(ctx, change, change.after);
    if (change.kind in TXT) {
      const cur = await readTxt(ctx, change.kind as TxtKind);
      await writeTxt(ctx, change.kind as TxtKind, { content: change.after ?? '' });
      return cur.default ? { remoteRef: WIX_DEFAULT_REF } : {};
    }
    await writeTags(ctx, change, change.after);
    return {};
  },

  async revert(ctx, change) {
    if (change.kind === 'redirect') {
      await writeRedirect(ctx, change, change.before);
      return;
    }
    if (change.kind in TXT) {
      await writeTxt(ctx, change.kind as TxtKind, change.remoteRef === WIX_DEFAULT_REF ? { default: true } : { content: change.before ?? '' });
      return;
    }
    await writeTags(ctx, change, change.before);
  },
};
