/**
 * Connecteur Shopify (livrable 5b) : OAuth « authorization code grant », jetons hors ligne EXPIRANTS
 * (`expiring=1`, obligatoire pour les nouvelles apps publiques), jetons chiffrés AES-256-GCM au repos,
 * lecture des commandes (attribution par referrer / UTM de la première visite) et des produits.
 *
 * Désactivé sans `SHOPIFY_CLIENT_ID` + `SHOPIFY_CLIENT_SECRET` (les routes répondent 503).
 * Scopes : `read_products,read_orders` (read_orders = 60 derniers jours ; au-delà, read_all_orders sur demande à Shopify)
 * + V5 (agent de publication, src/lib/publish) : `write_products,write_content,write_online_store_navigation`, et
 * `write_themes` seulement avec SHOPIFY_THEME_WRITE=1 (exemption Shopify requise). Une boutique connectée avant V5
 * garde sa connexion (lecture) ; `connectionStatus().missingPublishScopes` dit s'il faut la ré-autoriser.
 * Version d'API : `SHOPIFY_API_VERSION` (défaut 2026-10, dernière version stable au 9 nov. 2026).
 * Docs lues le 9 nov. 2026 : shopify.dev « Implement authorization code grant manually », « Migrate to expiring
 * offline access tokens », objets GraphQL CustomerJourneySummary / CustomerVisit (2026-10).
 */
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { deleteDoc, getDoc, putDoc } from '@/lib/store';
import { normalizeProduct } from './catalog';
import type { CatalogProduct, MinimalOrder } from './types';

export const SHOPIFY_SCOPES = 'read_products,read_orders';
/** Droits d'écriture de l'agent de publication (V5) : SEO produits/pages/articles, contenus, redirections. */
export const SHOPIFY_PUBLISH_SCOPES = ['write_products', 'write_content', 'write_online_store_navigation'] as const;
/** Portées demandées à l'autorisation (lecture historique + écriture V5 ; thème si SHOPIFY_THEME_WRITE=1). */
export function requestedScopes(): string {
  return [...SHOPIFY_SCOPES.split(','), ...SHOPIFY_PUBLISH_SCOPES, ...(process.env.SHOPIFY_THEME_WRITE === '1' ? ['write_themes'] : [])].join(',');
}
/** Portées d'écriture V5 absentes d'une autorisation (une boutique autorisée avant V5 : toutes). */
export function missingPublishScopes(granted: string): string[] {
  const g = new Set(granted.split(',').map((x) => x.trim()).filter(Boolean));
  return SHOPIFY_PUBLISH_SCOPES.filter((x) => !g.has(x));
}
export const SHOPIFY_COLLECTION = 'ecom.shopify';
export const NONCE_COOKIE = 'repere_shopify_nonce';
export const CALLBACK_PATH = '/api/ecommerce/shopify/callback';
export const SHOP_RE = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;

export const shopifyEnabled = () => Boolean(process.env.SHOPIFY_CLIENT_ID && process.env.SHOPIFY_CLIENT_SECRET);
export const apiVersion = () => (/^\d{4}-(01|04|07|10)$/.test(process.env.SHOPIFY_API_VERSION ?? '') ? (process.env.SHOPIFY_API_VERSION as string) : '2026-10');
const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
export const redirectUri = () => `${siteUrl()}${CALLBACK_PATH}`;

function secret(): string {
  const s = process.env.AUDIT_SIGNING_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === 'production') throw new Error('AUDIT_SIGNING_SECRET manquant');
  return 'dev-only-signing-secret';
}

/* ------------------------------------------------------------------ */
/* Boutique, chiffrement, état OAuth                                   */
/* ------------------------------------------------------------------ */

/** « ma-boutique », « ma-boutique.myshopify.com », « https://ma-boutique.myshopify.com/admin » → hôte validé, ou null. */
export function normalizeShop(input: string): string | null {
  let s = String(input || '').trim().toLowerCase();
  s = s.replace(/^https?:\/\//, '').split(/[/?#]/)[0];
  if (s && !s.includes('.')) s = `${s}.myshopify.com`;
  return SHOP_RE.test(s) ? s : null;
}

const key = () => createHash('sha256').update(`shopify-tokens:${secret()}`).digest();

export function encryptToken(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString('base64url')).join('.');
}
export function decryptToken(token: string): string {
  const [iv, tag, enc] = token.split('.').map((s) => Buffer.from(s, 'base64url'));
  const d = createDecipheriv('aes-256-gcm', key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
}

export const newNonce = () => randomBytes(18).toString('base64url');
const nonceHash = (n: string) => createHash('sha256').update(`shopify-nonce:${n}`).digest('base64url').slice(0, 22);
const b64 = (s: string) => Buffer.from(s).toString('base64url');

/** État signé : commerce + boutique + date + empreinte du nonce (lié au navigateur par cookie HttpOnly). */
export function signState(businessId: string, shop: string, nonce: string, now = Date.now()): string {
  const body = `${b64(businessId)}.${b64(shop)}.${now}.${nonceHash(nonce)}`;
  return `${body}.${createHmac('sha256', secret()).update(`shopify:${body}`).digest('base64url')}`;
}

export function verifyState(state: string, nonce: string | null, maxAgeMs = 600_000, now = Date.now()): { businessId: string; shop: string } | null {
  const parts = state.split('.');
  if (parts.length !== 5 || !nonce) return null;
  const body = parts.slice(0, 4).join('.');
  const exp = createHmac('sha256', secret()).update(`shopify:${body}`).digest();
  const got = Buffer.from(parts[4], 'base64url');
  if (got.length !== exp.length || !timingSafeEqual(got, exp)) return null;
  const nh = Buffer.from(nonceHash(nonce));
  const sh = Buffer.from(parts[3]);
  if (nh.length !== sh.length || !timingSafeEqual(nh, sh)) return null;
  if (!(now - Number(parts[2]) < maxAgeMs)) return null;
  return { businessId: Buffer.from(parts[0], 'base64url').toString('utf8'), shop: Buffer.from(parts[1], 'base64url').toString('utf8') };
}

export function nonceCookie(nonce: string, maxAge = 600): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${NONCE_COOKIE}=${nonce}; Path=/api/ecommerce/shopify; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}
export function readNonce(req: Request): string | null {
  return req.headers.get('cookie')?.match(new RegExp(`(?:^|;\\s*)${NONCE_COOKIE}=([A-Za-z0-9_-]+)`))?.[1] ?? null;
}

export function buildAuthorizeUrl(shop: string, state: string): string {
  const q = new URLSearchParams({ client_id: process.env.SHOPIFY_CLIENT_ID || '', scope: requestedScopes(), redirect_uri: redirectUri(), state });
  return `https://${shop}/admin/oauth/authorize?${q.toString()}`;
}

/** HMAC du retour OAuth : paramètres hors `hmac` (et `signature`), triés, `clé=valeur` joints par `&`, HMAC-SHA256 hex. */
export function verifyCallbackHmac(params: URLSearchParams, clientSecret = process.env.SHOPIFY_CLIENT_SECRET || ''): boolean {
  const hmac = params.get('hmac') ?? '';
  if (!clientSecret || !/^[0-9a-f]{64}$/i.test(hmac)) return false;
  const msg = [...params.entries()]
    .filter(([k]) => k !== 'hmac' && k !== 'signature')
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  const exp = createHmac('sha256', clientSecret).update(msg).digest();
  const got = Buffer.from(hmac, 'hex');
  return got.length === exp.length && timingSafeEqual(got, exp);
}

/* ------------------------------------------------------------------ */
/* Jetons                                                              */
/* ------------------------------------------------------------------ */

export interface ShopifyConnection {
  shop: string;
  scope: string;
  accessToken: string; // chiffré
  refreshToken: string | null; // chiffré
  expiresAt: string | null;
  refreshExpiresAt: string | null;
  connectedAt: string;
}

export type FetchImpl = typeof fetch;

interface TokenResponse {
  access_token?: string;
  scope?: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
}

function toConnection(shop: string, t: TokenResponse, connectedAt: string, now = Date.now()): ShopifyConnection {
  if (!t.access_token) throw new Error('Réponse Shopify sans jeton.');
  return {
    shop,
    scope: t.scope ?? '',
    accessToken: encryptToken(t.access_token),
    refreshToken: t.refresh_token ? encryptToken(t.refresh_token) : null,
    expiresAt: t.expires_in && t.expires_in > 0 ? new Date(now + t.expires_in * 1000).toISOString() : null,
    refreshExpiresAt: t.refresh_token_expires_in && t.refresh_token_expires_in > 0 ? new Date(now + t.refresh_token_expires_in * 1000).toISOString() : null,
    connectedAt,
  };
}

async function tokenRequest(shop: string, body: Record<string, string>, f: FetchImpl): Promise<TokenResponse> {
  const res = await f(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body: new URLSearchParams(body).toString(),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw Object.assign(new Error(`Shopify ${res.status}`), { status: res.status });
  return (await res.json()) as TokenResponse;
}

/** Échange du code contre un jeton hors ligne expirant, puis enregistrement chiffré. */
export async function connectWithCode(businessId: string, shop: string, code: string, f: FetchImpl = fetch): Promise<ShopifyConnection> {
  const t = await tokenRequest(shop, { client_id: process.env.SHOPIFY_CLIENT_ID || '', client_secret: process.env.SHOPIFY_CLIENT_SECRET || '', code, expiring: '1' }, f);
  const granted = (t.scope ?? '').split(',').map((s) => s.trim());
  // write_* inclut read_* : on accepte l'un ou l'autre
  for (const need of ['products', 'orders']) if (!granted.includes(`read_${need}`) && !granted.includes(`write_${need}`)) throw new Error(`Autorisation incomplète (read_${need}).`);
  const conn = toConnection(shop, t, new Date().toISOString());
  await putDoc(SHOPIFY_COLLECTION, businessId, conn, businessId);
  return conn;
}

export async function getConnection(businessId: string): Promise<ShopifyConnection | null> {
  return (await getDoc<ShopifyConnection>(SHOPIFY_COLLECTION, businessId))?.data ?? null;
}

export async function disconnect(businessId: string): Promise<void> {
  await deleteDoc(SHOPIFY_COLLECTION, businessId);
}

/** Statut public (aucun jeton). */
export async function connectionStatus(businessId: string): Promise<{
  enabled: boolean;
  connected: boolean;
  shop: string | null;
  connectedAt: string | null;
  scopes: string[];
  /** portées réellement accordées par la boutique */
  grantedScopes: string[];
  /** droits d'écriture V5 manquants (ré-autoriser pour que l'agent publie) ; vide si non connecté */
  missingPublishScopes: string[];
}> {
  const c = shopifyEnabled() ? await getConnection(businessId).catch(() => null) : null;
  const granted = (c?.scope ?? '').split(',').map((x) => x.trim()).filter(Boolean);
  return {
    enabled: shopifyEnabled(),
    connected: Boolean(c),
    shop: c?.shop ?? null,
    connectedAt: c?.connectedAt ?? null,
    scopes: requestedScopes().split(','),
    grantedScopes: granted,
    missingPublishScopes: c ? missingPublishScopes(c.scope ?? '') : [],
  };
}

/** Jeton d'accès valide (rafraîchi 60 s avant expiration). Erreur 401 côté Shopify : connexion à refaire. */
export async function accessToken(businessId: string, f: FetchImpl = fetch, now = Date.now()): Promise<{ shop: string; token: string } | null> {
  const c = await getConnection(businessId);
  if (!c) return null;
  if (!c.expiresAt || Date.parse(c.expiresAt) - 60_000 > now) return { shop: c.shop, token: decryptToken(c.accessToken) };
  if (!c.refreshToken) return null;
  try {
    const t = await tokenRequest(c.shop, { client_id: process.env.SHOPIFY_CLIENT_ID || '', client_secret: process.env.SHOPIFY_CLIENT_SECRET || '', grant_type: 'refresh_token', refresh_token: decryptToken(c.refreshToken) }, f);
    const next = toConnection(c.shop, { scope: c.scope, ...t }, c.connectedAt, now);
    await putDoc(SHOPIFY_COLLECTION, businessId, next, businessId);
    return { shop: c.shop, token: t.access_token as string };
  } catch (e) {
    if ((e as { status?: number }).status === 401) await disconnect(businessId);
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* GraphQL Admin                                                       */
/* ------------------------------------------------------------------ */

export async function graphql<T>(shop: string, token: string, query: string, variables: Record<string, unknown>, f: FetchImpl = fetch): Promise<T> {
  const res = await f(`https://${shop}/admin/api/${apiVersion()}/graphql.json`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-shopify-access-token': token },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw Object.assign(new Error(`Shopify ${res.status}`), { status: res.status });
  const j = (await res.json()) as { data?: T; errors?: unknown };
  if (!j.data) throw new Error('Réponse GraphQL sans données.');
  return j.data;
}

/** Commandes : montant, date, première visite (referrer, page d'arrivée, UTM). Aucune donnée client demandée. */
export const ORDERS_QUERY = `query Orders($cursor: String, $q: String) {
  orders(first: 100, after: $cursor, query: $q, sortKey: CREATED_AT) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id createdAt sourceName test
      currentTotalPriceSet { shopMoney { amount currencyCode } }
      customerJourneySummary {
        ready
        firstVisit { referrerUrl landingPage source utmParameters { source medium campaign } }
        lastVisit { referrerUrl landingPage source utmParameters { source medium campaign } }
      }
    }
  }
}`;

interface VisitNode { referrerUrl?: string | null; landingPage?: string | null; source?: string | null; utmParameters?: { source?: string | null; medium?: string | null } | null }
interface OrderNode {
  id: string;
  createdAt: string;
  sourceName?: string | null;
  test?: boolean;
  currentTotalPriceSet?: { shopMoney?: { amount?: string; currencyCode?: string } };
  customerJourneySummary?: { firstVisit?: VisitNode | null; lastVisit?: VisitNode | null } | null;
}

/** Nœud de commande → commande minimale (première visite, sinon dernière). */
export function toMinimalOrder(n: OrderNode): MinimalOrder {
  const v = n.customerJourneySummary?.firstVisit ?? n.customerJourneySummary?.lastVisit ?? null;
  const money = n.currentTotalPriceSet?.shopMoney;
  return {
    id: n.id.split('/').pop() ?? n.id,
    createdAt: n.createdAt,
    totalEur: Number(money?.amount ?? 0) || 0,
    currency: money?.currencyCode ?? 'EUR',
    referrerUrl: v?.referrerUrl ?? null,
    landingPage: v?.landingPage ?? null,
    utmSource: v?.utmParameters?.source ?? null,
    utmMedium: v?.utmParameters?.medium ?? null,
    sourceName: n.sourceName ?? null,
  };
}

export async function fetchOrders(businessId: string, sinceIso: string, f: FetchImpl = fetch, maxPages = 10): Promise<MinimalOrder[] | null> {
  const auth = await accessToken(businessId, f);
  if (!auth) return null;
  const out: MinimalOrder[] = [];
  let cursor: string | null = null;
  for (let i = 0; i < maxPages; i++) {
    const data: { orders: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: OrderNode[] } } = await graphql(auth.shop, auth.token, ORDERS_QUERY, { cursor, q: `created_at:>='${sinceIso.slice(0, 10)}' AND test:false` }, f);
    out.push(...data.orders.nodes.filter((n) => !n.test).map(toMinimalOrder));
    if (!data.orders.pageInfo.hasNextPage) break;
    cursor = data.orders.pageInfo.endCursor;
  }
  return out;
}

export const PRODUCTS_QUERY = `query Products($cursor: String) {
  products(first: 100, after: $cursor, sortKey: TITLE) {
    pageInfo { hasNextPage endCursor }
    nodes {
      handle title productType vendor onlineStoreUrl description
      featuredMedia { preview { image { url } } }
      variants(first: 20) { nodes { title price sku barcode availableForSale } }
    }
  }
}`;

interface ProductNode {
  handle: string;
  title: string;
  productType?: string | null;
  vendor?: string | null;
  onlineStoreUrl?: string | null;
  description?: string | null;
  featuredMedia?: { preview?: { image?: { url?: string } | null } | null } | null;
  variants?: { nodes: { title?: string; price?: string; sku?: string | null; barcode?: string | null; availableForSale?: boolean }[] };
}

export function toCatalogProduct(n: ProductNode, shop: string): CatalogProduct | null {
  const vs = n.variants?.nodes ?? [];
  const p = normalizeProduct(
    {
      id: n.handle,
      name: n.title,
      url: n.onlineStoreUrl ?? `https://${shop}/products/${n.handle}`,
      category: n.productType || undefined,
      price: vs[0]?.price,
      currency: 'EUR',
      sku: vs[0]?.sku ?? undefined,
      gtin: vs[0]?.barcode && /^\d{8,14}$/.test(vs[0].barcode) ? vs[0].barcode : undefined,
      image: n.featuredMedia?.preview?.image?.url,
      description: n.description ?? undefined,
      brand: n.vendor ?? undefined,
      availability: vs.length ? (vs.some((v) => v.availableForSale) ? 'InStock' : 'OutOfStock') : undefined,
      variants: vs.filter((v) => v.title && v.title !== 'Default Title').map((v) => ({ name: v.title, price: v.price, sku: v.sku ?? undefined, gtin: v.barcode ?? undefined })),
    },
    'shopify',
  );
  return 'error' in p ? null : p;
}

export async function fetchProducts(businessId: string, f: FetchImpl = fetch, maxPages = 2): Promise<CatalogProduct[] | null> {
  const auth = await accessToken(businessId, f);
  if (!auth) return null;
  const out: CatalogProduct[] = [];
  let cursor: string | null = null;
  for (let i = 0; i < maxPages; i++) {
    const data: { products: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: ProductNode[] } } = await graphql(auth.shop, auth.token, PRODUCTS_QUERY, { cursor }, f);
    for (const n of data.products.nodes) {
      const p = toCatalogProduct(n, auth.shop);
      if (p) out.push(p);
    }
    if (!data.products.pageInfo.hasNextPage) break;
    cursor = data.products.pageInfo.endCursor;
  }
  return out;
}
