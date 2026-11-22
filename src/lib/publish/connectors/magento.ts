/**
 * Connecteur Magento Open Source / Adobe Commerce (PaaS ou hébergé chez le marchand) — recherche du 22 nov. 2026,
 * docs/v8/magento.md (sources officielles citées).
 *
 * Authentification (intégration créée par le marchand : Système > Extensions > Intégrations, accès « Personnalisé ») :
 * - par défaut, OAuth 1.0a « une jambe » signé HMAC-SHA256 avec les quatre jetons affichés à l'activation (clé et secret
 *   client, jeton d'accès et son secret) : fonctionne sur toutes les versions 2.4.x sans changer de réglage.
 *   https://developer.adobe.com/commerce/webapi/get-started/authentication/gs-authentication-oauth/
 * - en option, le seul jeton d'accès en `Authorization: Bearer` : depuis 2.4.4 c'est désactivé par défaut (« Integration
 *   tokens can no longer be used for API Bearer token authentication ») et ne marche que si le marchand a activé
 *   « Allow OAuth Access Tokens to be used as standalone Bearer tokens » (`oauth/consumer/enable_integration_as_bearer`).
 *   https://developer.adobe.com/commerce/webapi/get-started/authentication/gs-authentication-token
 * Adobe Commerce as a Cloud Service (SaaS) utilise IMS (OAuth 2) : non couvert ici (export guidé).
 *
 * Ce que l'API REST du cœur permet (routes relues dans app/code/Magento/{Catalog,Cms}/etc/webapi.xml, branche 2.4-develop
 * du 19 nov. 2026) et que ce connecteur fait, dans la vue de magasin choisie (`/rest/<code>/V1/…`, défaut `default`) :
 * - produits : `GET|PUT /V1/products/:sku` (ACL Magento_Catalog::products), attributs `meta_title`, `meta_description`,
 *   `description` (réécriture) dans `custom_attributes` ;
 * - catégories : `GET /V1/categories/list`, `GET|PUT /V1/categories/:id` (Magento_Catalog::categories), mêmes attributs ;
 * - pages CMS : `GET /V1/cmsPage/search`, `GET|PUT /V1/cmsPage/:id` (Magento_Cms::page / Magento_Cms::save), champs
 *   `meta_title`, `meta_description`, `content` ; la page est relue en entier puis renvoyée en entier (un PUT partiel peut
 *   vider les autres champs selon les versions) ;
 * - textes alternatifs des images produit : `GET|PUT /V1/products/:sku/media/:entryId`, champ `label` (« gallery entry
 *   alternative text », ProductAttributeMediaGalleryEntryInterface ; ACL Magento_Catalog::catalog) ; entrée complète
 *   renvoyée (tutoriel « Manage product images at the store view level »).
 * Les mots-clés méta (`meta_keyword` / `meta_keywords`) ne sont ni proposés ni modifiés : Google ne les utilise pas pour
 * le classement ; le connecteur ne touche qu'à l'attribut visé, les autres restent intacts.
 *
 * Guidé (export + pas à pas, `MAGENTO_STEPS`) : redirections 301 (le module UrlRewrite du cœur n'expose aucune route
 * REST — pas de etc/webapi.xml), robots.txt (réglage « Search Engine Robots » de la configuration du design), llms.txt
 * (fichier à déposer dans pub/), données structurées, FAQ, canonique et meta robots (réglages du thème ou du catalogue).
 *
 * Portée : écrire dans une vue de magasin crée une valeur propre à cette vue. Le retour arrière y remet la valeur exacte
 * lue avant (elle peut alors rester « propre à la vue » même si elle était héritée) ; pour les images, une valeur
 * d'origine absente (`null`, héritée) est rétablie telle quelle.
 */
import { createHmac, randomBytes } from 'node:crypto';
import { normalizeSiteUrl, parseJson, statusError } from '../http';
import { PublishError, type Change, type ChangeKind, type ConnectInput, type ConnectorContext, type HttpRequest, type HttpResponse, type PublishConnector, type ResourceRef, type TestResult } from '../types';

export const MAGENTO_KINDS: readonly ChangeKind[] = ['meta.title', 'meta.description', 'image.alt', 'rewrite'];
/** Préparé en export avec un pas à pas dans l'administration Magento (pas de route REST du cœur). */
export const MAGENTO_GUIDED: readonly ChangeKind[] = ['redirect', 'robots.txt', 'llms.txt', 'jsonld', 'faq', 'canonical', 'meta.robots', 'sitemap.xml'];

/** Pas à pas de l'export pour une boutique Magento (libellés de l'administration en français). */
export const MAGENTO_STEPS: Partial<Record<ChangeKind, string>> = {
  redirect: 'Redirections : Marketing > SEO et recherche > Réécritures d’URL > « Ajouter une réécriture d’URL » ; choisissez « Personnalisée », renseignez le chemin demandé et le chemin cible du fichier redirections/redirections.csv, type « Permanente (301) ».',
  'robots.txt': 'robots.txt : Contenu > Design > Configuration > (votre site) > Modifier > « Robots des moteurs de recherche » > « Modifier les instructions personnalisées du fichier robots.txt » ; collez le contenu de robots.txt puis enregistrez.',
  'llms.txt': 'llms.txt : déposez le fichier à la racine publique de la boutique (dossier pub/ sur la plupart des installations) par votre hébergeur ou votre agence ; vérifiez ensuite qu’il s’ouvre à l’adresse /llms.txt.',
  jsonld: 'Données structurées : à ajouter dans le thème (fichier de gabarit ou bloc de mise en page) par la personne qui gère le thème ; le bloc JSON-LD est fourni prêt à coller.',
  faq: 'FAQ : ajoutez les questions et réponses visibles dans la page (Contenu > Pages, ou la description du produit) puis le bloc JSON-LD fourni dans le thème.',
  canonical: 'URL canonique : Magasins > Configuration > Catalogue > Catalogue > Optimisation pour les moteurs de recherche > « Utiliser la balise de lien canonique » pour les catégories et les produits.',
  'meta.robots': 'Consigne d’indexation : Contenu > Design > Configuration > (votre vue de magasin) > « Robots des moteurs de recherche » > « Robots par défaut ».',
  'sitemap.xml': 'Plan du site : Marketing > SEO et recherche > Plan du site > « Ajouter un plan du site », puis « Générer ».',
};

const TOKEN = /^[a-z0-9]{32}$/i;
const STORE = /^[a-z0-9_]{1,32}$/i;

// ---------------------------------------------------------------------------
// OAuth 1.0a (RFC 5849), HMAC-SHA256
// ---------------------------------------------------------------------------
/** Encodage RFC 3986 (section 3.6 de RFC 5849). */
export const rfc3986 = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

export interface OAuthCreds {
  consumerKey: string;
  consumerSecret: string;
  accessToken: string;
  accessTokenSecret: string;
}

/** Chaîne de base de la signature : méthode, URL sans requête, paramètres oauth_* + requête triés. */
export function oauthBaseString(method: string, rawUrl: string, oauth: Record<string, string>): string {
  const u = new URL(rawUrl);
  const params: [string, string][] = Object.entries(oauth).filter(([k]) => k !== 'oauth_signature');
  for (const [k, v] of u.searchParams) params.push([k, v]);
  const enc = params.map(([k, v]) => [rfc3986(k), rfc3986(v)] as const).sort((a, b) => (a[0] === b[0] ? (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0) : a[0] < b[0] ? -1 : 1));
  const port = u.port && !((u.protocol === 'https:' && u.port === '443') || (u.protocol === 'http:' && u.port === '80')) ? `:${u.port}` : '';
  const base = `${u.protocol.toLowerCase()}//${u.hostname.toLowerCase()}${port}${u.pathname}`;
  return [method.toUpperCase(), rfc3986(base), rfc3986(enc.map(([k, v]) => `${k}=${v}`).join('&'))].join('&');
}

export function oauthSignature(base: string, consumerSecret: string, tokenSecret: string): string {
  return createHmac('sha256', `${rfc3986(consumerSecret)}&${rfc3986(tokenSecret)}`).update(base).digest('base64');
}

/** En-tête `Authorization: OAuth …` d'un appel d'API. */
export function oauthHeader(method: string, url: string, c: OAuthCreds, now: Date, nonce = randomBytes(16).toString('hex')): string {
  const oauth: Record<string, string> = {
    oauth_consumer_key: c.consumerKey,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA256',
    oauth_timestamp: String(Math.floor(now.getTime() / 1000)),
    oauth_token: c.accessToken,
    oauth_version: '1.0',
  };
  oauth.oauth_signature = oauthSignature(oauthBaseString(method, url, oauth), c.consumerSecret, c.accessTokenSecret);
  return `OAuth ${Object.entries(oauth)
    .map(([k, v]) => `${k}="${rfc3986(v)}"`)
    .join(', ')}`;
}

/** Lit un en-tête OAuth (pour les tests et le diagnostic). */
export function parseOAuthHeader(h: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of h.replace(/^OAuth\s+/i, '').matchAll(/([a-z_]+)="([^"]*)"/gi)) out[m[1]] = decodeURIComponent(m[2]);
  return out;
}

// ---------------------------------------------------------------------------
// Requêtes
// ---------------------------------------------------------------------------
const storeCode = (ctx: ConnectorContext) => (STORE.test(ctx.config.storeCode ?? '') ? ctx.config.storeCode : 'default');
const api = (ctx: ConnectorContext, path: string) => `${ctx.config.siteUrl}/rest/${storeCode(ctx)}/V1${path}`;

function authHeader(ctx: ConnectorContext, method: string, url: string): string {
  const c = ctx.credentials;
  if (c.consumerKey && c.consumerSecret && c.accessToken && c.accessTokenSecret) {
    return oauthHeader(method, url, { consumerKey: c.consumerKey, consumerSecret: c.consumerSecret, accessToken: c.accessToken, accessTokenSecret: c.accessTokenSecret }, ctx.now());
  }
  if (c.accessToken) return `Bearer ${c.accessToken}`;
  throw new PublishError(401, 'Connexion Magento incomplète : reconnectez la boutique.', 'auth');
}

const bearerMode = (ctx: ConnectorContext) => !ctx.credentials.consumerKey;

function magentoError(ctx: ConnectorContext, res: HttpResponse, what: string): PublishError {
  // Magento répond 401 aussi bien pour un jeton refusé que pour une ressource non cochée dans l'intégration.
  if (res.status === 401) {
    return new PublishError(
      401,
      `${what} : accès refusé (jeton invalide ou ressource non cochée dans l’intégration${bearerMode(ctx) ? ' ; en mode jeton seul, le réglage « Autoriser les jetons d’accès OAuth comme jetons Bearer » doit être activé depuis la 2.4.4' : ''}).`,
      'auth',
    );
  }
  if (res.status === 400 && /store/i.test(res.text) && /found|exist/i.test(res.text)) return new PublishError(400, `${what} : code de vue de magasin inconnu (${storeCode(ctx)}).`, 'magento_store');
  return statusError(res, what);
}

async function call<T>(ctx: ConnectorContext, method: HttpRequest['method'], path: string, body: unknown, what: string): Promise<T> {
  const url = api(ctx, path);
  const res = await ctx.http({
    method,
    url,
    headers: { authorization: authHeader(ctx, method, url), accept: 'application/json', ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (res.status !== 200) throw magentoError(ctx, res, what);
  return (res.text ? parseJson<T>(res, what) : ({} as T));
}

/** Critères de recherche Magento (`searchCriteria[filterGroups][0][filters][0][…]=…`). */
export function searchQuery(field: string, value: string, pageSize = 5): string {
  const f = 'searchCriteria[filterGroups][0][filters][0]';
  return [
    [`${f}[field]`, field],
    [`${f}[value]`, value],
    [`${f}[conditionType]`, 'eq'],
    ['searchCriteria[pageSize]', String(pageSize)],
  ]
    .map(([k, v]) => `${rfc3986(k)}=${rfc3986(v)}`)
    .join('&');
}

// ---------------------------------------------------------------------------
// Ressources
// ---------------------------------------------------------------------------
type MType = 'product' | 'category' | 'cms';
interface CustomAttr {
  attribute_code: string;
  value: unknown;
}
interface MProduct {
  id?: number;
  sku: string;
  custom_attributes?: CustomAttr[];
}
interface MCategory {
  id: number;
  custom_attributes?: CustomAttr[];
}
type MCmsPage = Record<string, unknown> & { id: number; identifier?: string };
interface MMedia {
  id: number;
  media_type?: string;
  label?: string | null;
  position?: number;
  disabled?: boolean;
  types?: string[];
  file?: string;
}

const FIELD: Partial<Record<ChangeKind, string>> = { 'meta.title': 'meta_title', 'meta.description': 'meta_description', rewrite: 'description' };
const fieldFor = (type: MType, kind: ChangeKind): string => {
  const f = FIELD[kind];
  if (!f) throw new PublishError(422, 'Modification non disponible par l’API Magento : utilisez l’export guidé.', 'unsupported');
  return type === 'cms' && kind === 'rewrite' ? 'content' : f;
};

const attr = (list: CustomAttr[] | undefined, code: string): string | null => {
  const a = (list ?? []).find((x) => x.attribute_code === code);
  return a ? (a.value == null ? '' : String(a.value)) : null;
};

/** URL publique → indices (chemin sans code de magasin ni suffixe, dernier segment, suffixe .html présent). */
export function magentoPath(url: string, store = ''): { path: string; last: string; html: boolean } | null {
  let p: string;
  try {
    p = decodeURIComponent(new URL(url).pathname);
  } catch {
    return null;
  }
  let segs = p.split('/').filter(Boolean);
  if (segs[0] === 'index.php') segs = segs.slice(1);
  if (store && segs[0] === store) segs = segs.slice(1);
  const lastRaw = segs[segs.length - 1] ?? '';
  const html = /\.html?$/i.test(lastRaw);
  if (segs.length) segs[segs.length - 1] = lastRaw.replace(/\.html?$/i, '');
  return { path: segs.join('/'), last: segs[segs.length - 1] ?? '', html };
}

async function findProduct(ctx: ConnectorContext, urlKey: string): Promise<string | null> {
  if (!urlKey) return null;
  const r = await call<{ items?: MProduct[] }>(ctx, 'GET', `/products?${searchQuery('url_key', urlKey)}`, undefined, 'Recherche du produit Magento');
  const items = r.items ?? [];
  return items.length === 1 ? items[0].sku : null;
}

async function findCategory(ctx: ConnectorContext, path: string, last: string): Promise<string | null> {
  for (const [field, value] of [['url_path', path], ['url_key', last]] as const) {
    if (!value) continue;
    const r = await call<{ items?: MCategory[] }>(ctx, 'GET', `/categories/list?${searchQuery(field, value)}`, undefined, 'Recherche de la catégorie Magento');
    const items = r.items ?? [];
    if (items.length === 1) return String(items[0].id);
    if (field === 'url_key' && items.length > 1) {
      const exact = items.find((c) => attr(c.custom_attributes, 'url_path') === path);
      if (exact) return String(exact.id);
    }
  }
  return null;
}

async function findCms(ctx: ConnectorContext, identifier: string): Promise<string | null> {
  const r = await call<{ items?: MCmsPage[] }>(ctx, 'GET', `/cmsPage/search?${searchQuery('identifier', identifier || ctx.config.homeIdentifier || 'home')}`, undefined, 'Recherche de la page Magento');
  const items = r.items ?? [];
  return items.length === 1 ? String(items[0].id) : null;
}

async function locatePage(ctx: ConnectorContext, url: string, productOnly = false): Promise<ResourceRef> {
  const p = magentoPath(url, storeCode(ctx));
  if (!p) throw new PublishError(422, 'Adresse de page manquante.', 'unsupported');
  const order: MType[] = productOnly ? ['product'] : p.html ? ['product', 'category'] : ['cms', 'category', 'product'];
  for (const t of order) {
    const id = t === 'product' ? await findProduct(ctx, p.last) : t === 'category' ? await findCategory(ctx, p.path, p.last) : await findCms(ctx, p.path);
    if (id) return { type: t, id };
  }
  throw new PublishError(404, productOnly ? 'Produit introuvable dans Magento pour cette adresse (texte d’image hors fiche produit : utilisez l’export guidé).' : 'Page introuvable dans Magento (adresse personnalisée ou page générée par une extension) : utilisez l’export.', 'not_found');
}

const fileName = (s: string) => {
  let p = s;
  try {
    p = new URL(s, 'https://x.invalid').pathname;
  } catch {
    /* tel quel */
  }
  return decodeURIComponent(p.split('/').pop() ?? '').toLowerCase();
};

async function listMedia(ctx: ConnectorContext, sku: string): Promise<MMedia[]> {
  return call<MMedia[]>(ctx, 'GET', `/products/${encodeURIComponent(sku)}/media`, undefined, 'Images du produit Magento');
}

async function getMedia(ctx: ConnectorContext, ref: ResourceRef): Promise<MMedia> {
  return call<MMedia>(ctx, 'GET', `/products/${encodeURIComponent(ref.id ?? '')}/media/${encodeURIComponent(ref.extra?.entryId ?? '')}`, undefined, 'Image du produit Magento');
}

async function readField(ctx: ConnectorContext, ref: ResourceRef, kind: ChangeKind): Promise<string | null> {
  const type = ref.type as MType;
  const field = fieldFor(type, kind);
  const id = encodeURIComponent(ref.id ?? '');
  if (type === 'product') return attr((await call<MProduct>(ctx, 'GET', `/products/${id}`, undefined, 'Lecture du produit Magento')).custom_attributes, field) ?? '';
  if (type === 'category') return attr((await call<MCategory>(ctx, 'GET', `/categories/${id}`, undefined, 'Lecture de la catégorie Magento')).custom_attributes, field) ?? '';
  const page = await call<MCmsPage>(ctx, 'GET', `/cmsPage/${id}`, undefined, 'Lecture de la page Magento');
  const v = page[field];
  return v == null ? '' : String(v);
}

/** Champs en lecture seule d'une page CMS (refusés ou ignorés au PUT). */
const CMS_READ_ONLY = new Set(['creation_time', 'update_time']);

async function writeField(ctx: ConnectorContext, ref: ResourceRef, kind: ChangeKind, value: string): Promise<void> {
  const type = ref.type as MType;
  const field = fieldFor(type, kind);
  const id = encodeURIComponent(ref.id ?? '');
  if (type === 'product') {
    await call(ctx, 'PUT', `/products/${id}`, { product: { sku: ref.id, custom_attributes: [{ attribute_code: field, value }] } }, 'Mise à jour du produit Magento');
    return;
  }
  if (type === 'category') {
    await call(ctx, 'PUT', `/categories/${id}`, { category: { id: Number(ref.id), custom_attributes: [{ attribute_code: field, value }] } }, 'Mise à jour de la catégorie Magento');
    return;
  }
  const page = await call<MCmsPage>(ctx, 'GET', `/cmsPage/${id}`, undefined, 'Lecture de la page Magento');
  const full: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(page)) if (!CMS_READ_ONLY.has(k)) full[k] = v;
  full[field] = value;
  await call(ctx, 'PUT', `/cmsPage/${id}`, { page: full }, 'Mise à jour de la page Magento');
}

async function writeLabel(ctx: ConnectorContext, ref: ResourceRef, label: string | null): Promise<void> {
  const e = await getMedia(ctx, ref);
  const entry: MMedia = { id: e.id, media_type: e.media_type ?? 'image', label, position: e.position, disabled: e.disabled, types: e.types ?? [], file: e.file };
  await call(ctx, 'PUT', `/products/${encodeURIComponent(ref.id ?? '')}/media/${encodeURIComponent(String(e.id))}`, { entry }, 'Mise à jour du texte de l’image Magento');
}

// ---------------------------------------------------------------------------
// Connecteur
// ---------------------------------------------------------------------------
async function probe(ctx: ConnectorContext, path: string): Promise<number> {
  const url = api(ctx, path);
  const res = await ctx.http({ method: 'GET', url, headers: { authorization: authHeader(ctx, 'GET', url), accept: 'application/json' } });
  return res.status;
}

/** Marqueur de `remoteRef` : le texte d'image était hérité (`null`) avant l'écriture. */
export const MAGENTO_INHERITED = 'magento-inherited';

export const magentoConnector: PublishConnector = {
  platform: 'magento',
  kinds: MAGENTO_KINDS,

  connect(input: ConnectInput): ConnectInput {
    const siteUrl = normalizeSiteUrl(input.config.siteUrl ?? '');
    const sc = String(input.config.storeCode ?? '').trim();
    if (sc && !STORE.test(sc)) throw new PublishError(400, 'Code de vue de magasin invalide (lettres, chiffres et _ ; ex. default).');
    const config: Record<string, string> = { siteUrl, ...(sc ? { storeCode: sc } : {}) };
    const c = Object.fromEntries(['consumerKey', 'consumerSecret', 'accessToken', 'accessTokenSecret'].map((k) => [k, String(input.credentials[k] ?? '').trim()]));
    if (!TOKEN.test(c.accessToken)) throw new PublishError(400, 'Jeton d’accès Magento invalide (32 caractères, affiché à l’activation de l’intégration).');
    const oauth = ['consumerKey', 'consumerSecret', 'accessTokenSecret'];
    const given = oauth.filter((k) => c[k]);
    if (given.length === 0) return { config: { ...config, auth: 'bearer' }, credentials: { accessToken: c.accessToken } };
    if (given.length !== 3 || !oauth.every((k) => TOKEN.test(c[k]))) throw new PublishError(400, 'Recopiez les quatre jetons de l’intégration Magento (32 caractères chacun) : clé client, secret client, jeton d’accès, secret du jeton d’accès.');
    return { config: { ...config, auth: 'oauth' }, credentials: c };
  },

  async test(ctx): Promise<TestResult> {
    const products = await probe(ctx, `/products?${rfc3986('searchCriteria[pageSize]')}=1`);
    const categories = await probe(ctx, `/categories/list?${rfc3986('searchCriteria[pageSize]')}=1`);
    const cms = await probe(ctx, `/cmsPage/search?${rfc3986('searchCriteria[pageSize]')}=1`);
    const readable = { products: products === 200, categories: categories === 200, cms: cms === 200 };
    const any = readable.products || readable.categories || readable.cms;
    if (!any) {
      const first = [products, categories, cms].find((s) => s !== 401 && s !== 200);
      return {
        ok: false,
        detail: first
          ? statusError({ status: first, headers: {}, text: '' }, 'API Magento').message
          : `Magento refuse l’accès : vérifiez les jetons de l’intégration et qu’elle est bien « Active »${bearerMode(ctx) ? ' ; avec le jeton seul, activez « Autoriser les jetons d’accès OAuth comme jetons Bearer » (Magasins > Configuration > Services > OAuth) ou donnez les quatre jetons' : ''}.`,
        capabilities: [],
      };
    }
    const capabilities: ChangeKind[] = ['meta.title', 'meta.description', 'rewrite'];
    if (readable.products) capabilities.push('image.alt');
    const missing = [!readable.products && 'Produits', !readable.categories && 'Catégories', !readable.cms && 'Pages (Contenu)'].filter(Boolean);
    return {
      ok: true,
      detail: `Connecté à la boutique Magento ${ctx.config.siteUrl ?? ''} (vue de magasin « ${storeCode(ctx)} »).${missing.length ? ` Ressources non cochées dans l’intégration : ${missing.join(', ')}.` : ''} Les droits d’écriture sont vérifiés à la première application ; redirections, robots.txt et llms.txt restent guidés.`,
      capabilities,
      info: { mode: bearerMode(ctx) ? 'bearer' : 'oauth', readable: Object.entries(readable).filter(([, v]) => v).map(([k]) => k).join(',') },
    };
  },

  async locate(ctx, change: Change): Promise<ResourceRef> {
    if (change.target.resource?.id) return change.target.resource;
    if (change.kind === 'image.alt') {
      const ref = await locatePage(ctx, change.target.url ?? '', true);
      const want = fileName(change.target.imageSrc ?? '');
      if (!want) throw new PublishError(404, 'Image introuvable.');
      const hit = (await listMedia(ctx, ref.id ?? '')).find((m) => fileName(m.file ?? '') === want);
      if (!hit) throw new PublishError(404, 'Image introuvable parmi les images du produit Magento.', 'not_found');
      return { type: 'media', id: ref.id, extra: { entryId: String(hit.id) } };
    }
    if (!FIELD[change.kind]) throw new PublishError(422, 'Modification non disponible par l’API Magento : utilisez l’export guidé.', 'unsupported');
    return locatePage(ctx, change.target.url ?? '');
  },

  async read(ctx, change): Promise<string | null> {
    const ref = await magentoConnector.locate(ctx, change);
    if (change.kind === 'image.alt') return (await getMedia(ctx, ref)).label ?? '';
    return readField(ctx, ref, change.kind);
  },

  async apply(ctx, change) {
    const ref = await magentoConnector.locate(ctx, change);
    if (change.kind === 'image.alt') {
      const inherited = (await getMedia(ctx, ref)).label == null;
      await writeLabel(ctx, ref, change.after ?? '');
      return inherited ? { remoteRef: MAGENTO_INHERITED } : {};
    }
    await writeField(ctx, ref, change.kind, change.after ?? '');
    return {};
  },

  async revert(ctx, change) {
    const ref = await magentoConnector.locate(ctx, change);
    if (change.kind === 'image.alt') {
      // `null` : « Reverts to the global alt text » (documentation Adobe) quand la valeur était héritée.
      await writeLabel(ctx, ref, change.remoteRef === MAGENTO_INHERITED ? null : (change.before ?? ''));
      return;
    }
    await writeField(ctx, ref, change.kind, change.before ?? '');
  },
};
