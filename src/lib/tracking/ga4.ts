/**
 * Connecteur GA4 (optionnel, préparé). Désactivé si GOOGLE_CLIENT_ID est absent.
 * OAuth 2 (scope analytics.readonly, accès hors ligne) ; jetons chiffrés AES-256-GCM dans `track.ga4`.
 */
import { SITE_URL } from '@/lib/seo/site';
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { getDoc, putDoc } from '@/lib/store';
import { aiSourceRegex, classifyVisit } from './classify';
import type { AiEngine } from '@/lib/engine/types-v2';

export const GA4_SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';
const COLL = 'track.ga4';

export const ga4Enabled = () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
export const siteBase = () => SITE_URL;
export const redirectUri = () => `${siteBase()}/api/connect/ga4/callback`;

function secret(): string {
  const s = process.env.AUDIT_SIGNING_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === 'production') throw new Error('AUDIT_SIGNING_SECRET manquant');
  return 'dev-only-signing-secret';
}

/* ---------- chiffrement ---------- */
const key = () => createHash('sha256').update(`ga4-tokens:${secret()}`).digest();

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString('base64url')).join('.');
}
export function decryptSecret(token: string): string {
  const [iv, tag, enc] = token.split('.').map((s) => Buffer.from(s, 'base64url'));
  const d = createDecipheriv('aes-256-gcm', key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
}

/* ---------- état OAuth signé (anti-CSRF, lie le retour au commerce) ---------- */
/** Cookie HttpOnly qui lie le retour OAuth au navigateur qui l'a lancé (M1 : pas de CSRF de liaison de compte). */
export const NONCE_COOKIE = 'repere_ga4_nonce';
const nonceHash = (n: string) => createHash('sha256').update(`ga4-nonce:${n}`).digest('base64url').slice(0, 22);

export function newNonce(): string {
  return randomBytes(18).toString('base64url');
}

export function signState(businessId: string, nonce: string, now = Date.now()): string {
  const body = `${Buffer.from(businessId).toString('base64url')}.${now}.${nonceHash(nonce)}`;
  return `${body}.${createHmac('sha256', secret()).update(`ga4:${body}`).digest('base64url')}`;
}
export function verifyState(state: string, nonce: string | null, maxAgeMs = 600_000, now = Date.now()): string | null {
  const parts = state.split('.');
  if (parts.length !== 4 || !nonce) return null;
  const body = `${parts[0]}.${parts[1]}.${parts[2]}`;
  const exp = createHmac('sha256', secret()).update(`ga4:${body}`).digest();
  const got = Buffer.from(parts[3], 'base64url');
  if (got.length !== exp.length || !timingSafeEqual(got, exp)) return null;
  const nh = Buffer.from(nonceHash(nonce));
  const sh = Buffer.from(parts[2]);
  if (nh.length !== sh.length || !timingSafeEqual(nh, sh)) return null;
  if (!(now - Number(parts[1]) < maxAgeMs)) return null;
  return Buffer.from(parts[0], 'base64url').toString('utf8');
}

/** Valeur de l'en-tête Set-Cookie du nonce (10 min, chemin du connecteur). */
export function nonceCookie(nonce: string, maxAge = 600): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${NONCE_COOKIE}=${nonce}; Path=/api/connect/ga4; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function readNonce(req: Request): string | null {
  return req.headers.get('cookie')?.match(new RegExp(`(?:^|;\\s*)${NONCE_COOKIE}=([A-Za-z0-9_-]+)`))?.[1] ?? null;
}

export function buildAuthUrl(businessId: string, nonce: string): string {
  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || '',
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: GA4_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state: signState(businessId, nonce),
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

/* ---------- jetons ---------- */
interface Ga4Doc { refreshToken: string; propertyId: string | null; connectedAt: string }

async function tokenCall(params: Record<string, string>): Promise<{ access_token: string; refresh_token?: string }> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID || '', client_secret: process.env.GOOGLE_CLIENT_SECRET || '', ...params }),
  });
  if (!res.ok) throw new Error(`oauth ${res.status}`);
  return res.json();
}

export async function connectWithCode(businessId: string, code: string): Promise<{ propertyId: string | null }> {
  const t = await tokenCall({ grant_type: 'authorization_code', code, redirect_uri: redirectUri() });
  if (!t.refresh_token) throw new Error('refresh_token absent');
  const props = await listProperties(t.access_token).catch(() => []);
  const propertyId = props.length === 1 ? props[0].id : null;
  const doc: Ga4Doc = { refreshToken: encryptSecret(t.refresh_token), propertyId, connectedAt: new Date().toISOString() };
  await putDoc(COLL, businessId, doc, businessId);
  return { propertyId };
}

export async function getConnection(businessId: string): Promise<{ connected: boolean; propertyId: string | null }> {
  const d = await getDoc<Ga4Doc>(COLL, businessId);
  return { connected: Boolean(d), propertyId: d?.data.propertyId ?? null };
}

async function accessToken(businessId: string): Promise<string> {
  const d = await getDoc<Ga4Doc>(COLL, businessId);
  if (!d) throw new Error('GA4 non connecté');
  return (await tokenCall({ grant_type: 'refresh_token', refresh_token: decryptSecret(d.data.refreshToken) })).access_token;
}

export async function listProperties(token: string): Promise<{ id: string; name: string }[]> {
  const res = await fetch('https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200', { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`admin ${res.status}`);
  const j = (await res.json()) as { accountSummaries?: { propertySummaries?: { property: string; displayName: string }[] }[] };
  return (j.accountSummaries ?? []).flatMap((a) => a.propertySummaries ?? []).map((p) => ({ id: p.property.replace('properties/', ''), name: p.displayName }));
}

/* ---------- rapport ---------- */
export function buildReportBody(days: number) {
  return {
    dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
    dimensions: [{ name: 'date' }, { name: 'sessionSource' }, { name: 'landingPagePlusQueryString' }],
    metrics: [{ name: 'sessions' }, { name: 'keyEvents' }],
    dimensionFilter: {
      filter: { fieldName: 'sessionSource', stringFilter: { matchType: 'PARTIAL_REGEXP', value: aiSourceRegex(), caseSensitive: false } },
    },
    limit: 10000,
  };
}

export interface Ga4Row { date: string; engine: AiEngine; path: string; sessions: number; keyEvents: number }

export function normalizeRows(rows: { dimensionValues: { value: string }[]; metricValues: { value: string }[] }[]): Ga4Row[] {
  const out: Ga4Row[] = [];
  for (const r of rows) {
    const [d, src, landing] = r.dimensionValues.map((x) => x.value);
    const cls = classifyVisit(src, src);
    if (!cls) continue;
    out.push({
      date: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`,
      engine: cls.engine,
      path: (landing || '/').split(/[?#]/)[0].slice(0, 120),
      sessions: Number(r.metricValues[0]?.value) || 0,
      keyEvents: Number(r.metricValues[1]?.value) || 0,
    });
  }
  return out;
}

/** Sessions IA GA4 (Data API runReport). Ne jamais additionner avec le snippet : GA4 = chiffre de référence. */
export async function fetchGa4AiSessions(businessId: string, days = 30): Promise<Ga4Row[]> {
  const d = await getDoc<Ga4Doc>(COLL, businessId);
  if (!d?.data.propertyId) throw new Error('Propriété GA4 non choisie');
  const token = await accessToken(businessId);
  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${d.data.propertyId}:runReport`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(buildReportBody(days)),
  });
  if (!res.ok) throw new Error(`runReport ${res.status}`);
  const j = (await res.json()) as { rows?: Parameters<typeof normalizeRows>[0] };
  return normalizeRows(j.rows ?? []);
}
