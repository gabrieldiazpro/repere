/**
 * Connexion Google Search Console (OAuth 2, scope `webmasters.readonly`, accès hors ligne).
 *
 * - Démarrage : état signé HMAC (commerce + horodatage + empreinte d'un nonce) ; le nonce est posé en cookie HttpOnly
 *   sur le chemin du connecteur : le retour n'est accepté que dans le navigateur qui l'a lancé (anti-CSRF de liaison).
 * - Retour : échange du code, jetons CHIFFRÉS (AES-256-GCM, src/lib/integrations, INTEGRATIONS_SECRET) dans
 *   `seodata.gsc.conn`. Aucun jeton ne quitte le serveur.
 * - Révocation : appel à oauth2.googleapis.com/revoke puis suppression de la connexion et des données importées.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { appUrl } from '@/lib/email';
import { decryptSecret, encryptSecret } from '@/lib/integrations';
import { deleteDoc, getDoc, putDoc } from '@/lib/store';
import { isDemoBusinessId } from '@/lib/demo-v2';
import { SeoDataError, endpoints, env, requestJson } from './http';
import type { GscSite } from './types';

export const GSC_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
export const CONN = 'seodata.gsc.conn';
export const NONCE_COOKIE = 'repere_gsc_nonce';
export const COOKIE_PATH = '/api/v5/connect/google';
export const STATE_MAX_AGE_MS = 10 * 60_000;

export const gscEnabled = () => Boolean(env('GOOGLE_CLIENT_ID') && env('GOOGLE_CLIENT_SECRET'));
export const redirectUri = () => `${appUrl()}/api/v5/connect/google/callback`;

function stateSecret(): string {
  const s = env('AUTH_SECRET') || env('INTEGRATIONS_SECRET') || env('AUDIT_SIGNING_SECRET');
  if (s) return s;
  if (process.env.NODE_ENV === 'production') throw new Error('AUTH_SECRET manquant');
  return 'repere-dev-gsc-state';
}

const nonceHash = (n: string) => createHash('sha256').update(`gsc-nonce:${n}`).digest('base64url').slice(0, 22);

export function newNonce(): string {
  return randomBytes(18).toString('base64url');
}

export function signState(businessId: string, nonce: string, now = Date.now()): string {
  const body = `${Buffer.from(businessId).toString('base64url')}.${now}.${nonceHash(nonce)}`;
  return `${body}.${createHmac('sha256', stateSecret()).update(`gsc:${body}`).digest('base64url')}`;
}

/** Renvoie l'identifiant du commerce si l'état est authentique, récent et lié à ce navigateur ; sinon null. */
export function verifyState(state: string, nonce: string | null, now = Date.now()): string | null {
  const parts = (state || '').split('.');
  if (parts.length !== 4 || !nonce) return null;
  const body = `${parts[0]}.${parts[1]}.${parts[2]}`;
  const exp = createHmac('sha256', stateSecret()).update(`gsc:${body}`).digest();
  const got = Buffer.from(parts[3], 'base64url');
  if (got.length !== exp.length || !timingSafeEqual(got, exp)) return null;
  const nh = Buffer.from(nonceHash(nonce));
  const sh = Buffer.from(parts[2]);
  if (nh.length !== sh.length || !timingSafeEqual(nh, sh)) return null;
  const t = Number(parts[1]);
  if (!Number.isFinite(t) || now - t > STATE_MAX_AGE_MS || t - now > 60_000) return null;
  return Buffer.from(parts[0], 'base64url').toString('utf8');
}

export function nonceCookie(nonce: string, maxAge = 600): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${NONCE_COOKIE}=${nonce}; Path=${COOKIE_PATH}; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}
export function clearNonceCookie(): string {
  return `${NONCE_COOKIE}=; Path=${COOKIE_PATH}; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function readNonce(req: Request): string | null {
  return req.headers.get('cookie')?.match(new RegExp(`(?:^|;\\s*)${NONCE_COOKIE}=([A-Za-z0-9_-]+)`))?.[1] ?? null;
}

export function buildAuthUrl(businessId: string, nonce: string): string {
  const q = new URLSearchParams({
    client_id: env('GOOGLE_CLIENT_ID'),
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: GSC_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state: signState(businessId, nonce),
  });
  return `${endpoints().googleAuth}?${q}`;
}

// ---------------------------------------------------------------------------
// Connexion stockée
// ---------------------------------------------------------------------------

export interface GscConnection {
  businessId: string;
  refreshTokenEnc: string;
  accessTokenEnc: string | null;
  accessExpiresAt: number;
  scope: string;
  connectedAt: string;
  /** propriété choisie (`https://exemple.fr/` ou `sc-domain:exemple.fr`) */
  siteUrl: string | null;
  sites: GscSite[];
  status: 'active' | 'revoked';
  importedAt: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
}

/** Vue publique (jamais de jeton). */
export interface GscConnectionView {
  connected: boolean;
  status: GscConnection['status'] | null;
  siteUrl: string | null;
  sites: GscSite[];
  connectedAt: string | null;
  importedAt: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
}

export async function getConnection(businessId: string): Promise<GscConnection | null> {
  if (isDemoBusinessId(businessId)) return null;
  return (await getDoc<GscConnection>(CONN, businessId))?.data ?? null;
}

export function connectionView(c: GscConnection | null): GscConnectionView {
  return {
    connected: Boolean(c && c.status === 'active'),
    status: c?.status ?? null,
    siteUrl: c?.siteUrl ?? null,
    sites: c?.sites ?? [],
    connectedAt: c?.connectedAt ?? null,
    importedAt: c?.importedAt ?? null,
    lastSyncAt: c?.lastSyncAt ?? null,
    lastError: c?.lastError ?? null,
  };
}

export async function saveConnection(c: GscConnection): Promise<void> {
  if (isDemoBusinessId(c.businessId)) throw new SeoDataError('demo_read_only', 'Compte de démonstration : aucune connexion.');
  await putDoc(CONN, c.businessId, c, c.businessId);
}

interface TokenResponse { access_token: string; refresh_token?: string; expires_in?: number; scope?: string; token_type?: string }

async function tokenCall(params: Record<string, string>): Promise<TokenResponse> {
  if (!gscEnabled()) throw new SeoDataError('not_configured', 'Connexion Google non configurée : ajoutez GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET.');
  try {
    return await requestJson<TokenResponse>(endpoints().googleToken, {
      provider: 'Google OAuth',
      form: { client_id: env('GOOGLE_CLIENT_ID'), client_secret: env('GOOGLE_CLIENT_SECRET'), ...params },
    });
  } catch (e) {
    // invalid_grant (jeton révoqué par le client chez Google, ou expiré) : 400 → connexion à refaire.
    if (e instanceof SeoDataError && e.code === 'bad_request' && /invalid_grant|expired|revoked/i.test(e.message)) {
      throw new SeoDataError('auth', 'Accès Google révoqué ou expiré : reconnectez Search Console.', 401);
    }
    throw e;
  }
}

/** Retour OAuth : échange du code, jetons chiffrés, liste des propriétés (choix automatique s'il n'y en a qu'une). */
export async function connectWithCode(businessId: string, code: string, listSites: (accessToken: string) => Promise<GscSite[]>, now = new Date()): Promise<GscConnection> {
  if (isDemoBusinessId(businessId)) throw new SeoDataError('demo_read_only', 'Compte de démonstration : aucune connexion.');
  const t = await tokenCall({ grant_type: 'authorization_code', code, redirect_uri: redirectUri() });
  if (!t.refresh_token) throw new SeoDataError('auth', 'Google n’a pas fourni d’accès hors ligne : relancez la connexion.');
  if (t.scope && !t.scope.split(/\s+/).some((s) => s === GSC_SCOPE || s === 'https://www.googleapis.com/auth/webmasters')) {
    throw new SeoDataError('auth', 'L’accès à Search Console n’a pas été accordé.');
  }
  const sites = (await listSites(t.access_token).catch(() => [] as GscSite[])).filter((s) => s.permissionLevel !== 'siteUnverifiedUser');
  const prev = await getConnection(businessId);
  const keep = prev?.siteUrl && sites.some((s) => s.siteUrl === prev.siteUrl) ? prev.siteUrl : null;
  const c: GscConnection = {
    businessId,
    refreshTokenEnc: encryptSecret(t.refresh_token),
    accessTokenEnc: encryptSecret(t.access_token),
    accessExpiresAt: now.getTime() + Math.max(60, (t.expires_in ?? 3600) - 120) * 1000,
    scope: t.scope ?? GSC_SCOPE,
    connectedAt: now.toISOString(),
    siteUrl: keep ?? (sites.length === 1 ? sites[0].siteUrl : null),
    sites: sites.slice(0, 200),
    status: 'active',
    importedAt: keep ? prev?.importedAt ?? null : null,
    lastSyncAt: keep ? prev?.lastSyncAt ?? null : null,
    lastError: null,
  };
  await saveConnection(c);
  return c;
}

/** Jeton d'accès valide (rafraîchi si besoin). Une révocation côté Google passe la connexion en `revoked`. */
export async function accessToken(businessId: string, now = Date.now()): Promise<string> {
  const c = await getConnection(businessId);
  if (!c || c.status !== 'active') throw new SeoDataError('not_connected', 'Search Console n’est pas connecté.');
  if (c.accessTokenEnc && c.accessExpiresAt > now) {
    try {
      return decryptSecret(c.accessTokenEnc);
    } catch {
      /* clé changée : on rafraîchit */
    }
  }
  let refresh: string;
  try {
    refresh = decryptSecret(c.refreshTokenEnc);
  } catch {
    await saveConnection({ ...c, status: 'revoked', lastError: 'Jeton illisible : reconnectez Search Console.' });
    throw new SeoDataError('auth', 'Jeton illisible : reconnectez Search Console.');
  }
  try {
    const t = await tokenCall({ grant_type: 'refresh_token', refresh_token: refresh });
    await saveConnection({ ...c, accessTokenEnc: encryptSecret(t.access_token), accessExpiresAt: now + Math.max(60, (t.expires_in ?? 3600) - 120) * 1000 });
    return t.access_token;
  } catch (e) {
    if (e instanceof SeoDataError && e.code === 'auth') await saveConnection({ ...c, status: 'revoked', lastError: e.message });
    throw e;
  }
}

/** Choix de la propriété Search Console (doit figurer dans la liste accordée). */
export async function chooseProperty(businessId: string, siteUrl: string): Promise<GscConnection> {
  const c = await getConnection(businessId);
  if (!c || c.status !== 'active') throw new SeoDataError('not_connected', 'Search Console n’est pas connecté.');
  if (!c.sites.some((s) => s.siteUrl === siteUrl)) throw new SeoDataError('bad_request', 'Propriété inconnue pour ce compte Google.');
  const changed = c.siteUrl !== siteUrl;
  const next: GscConnection = { ...c, siteUrl, ...(changed ? { importedAt: null, lastSyncAt: null } : {}) };
  await saveConnection(next);
  return next;
}

/**
 * Révocation : Google d'abord (jeton de rafraîchissement : révoque tout l'accès accordé), puis suppression locale
 * même si Google est injoignable (le client garde la main ; il peut aussi retirer l'accès depuis son compte Google).
 */
export async function revoke(businessId: string, dropData: (businessId: string) => Promise<void>): Promise<{ revokedAtGoogle: boolean }> {
  const c = await getConnection(businessId);
  if (!c) return { revokedAtGoogle: false };
  let revokedAtGoogle = false;
  try {
    const token = decryptSecret(c.refreshTokenEnc);
    await requestJson<unknown>(`${endpoints().googleRevoke}?token=${encodeURIComponent(token)}`, { provider: 'Google OAuth', method: 'POST', form: {} });
    revokedAtGoogle = true;
  } catch (e) {
    // 400 invalid_token : déjà révoqué chez Google.
    revokedAtGoogle = e instanceof SeoDataError && e.code === 'bad_request';
  }
  await deleteDoc(CONN, businessId);
  await dropData(businessId);
  return { revokedAtGoogle };
}
