/**
 * Cookies de session (tous httpOnly sauf mention) et petits outils de signature.
 * `rp_session` garde son nom V2 (jeton d'accès Supabase) pour que les lecteurs serveur existants continuent de
 * fonctionner, mais il n'est plus jamais posé par JavaScript ni lisible par lui (S3 de docs/v3/10).
 */
import crypto from 'node:crypto';
import { authSecret, isProduction } from './config';

export const COOKIES = {
  /** Jeton d'accès Supabase (JWT, ~1 h, rafraîchi par le middleware). */
  access: 'rp_session',
  /** Jeton de rafraîchissement Supabase. */
  refresh: 'rp_refresh',
  /** Vérificateur PKCE pendant l'envoi du lien magique (10 min). */
  verifier: 'rp_pkce',
  /** Session locale de développement (signée HMAC). */
  local: 'rp_local',
  /** Indice « l'utilisateur a au moins un espace » (évite une requête par navigation dans le middleware). */
  workspace: 'rp_ws',
  /** Commerce sélectionné (lisible par JS : sélecteur de l'en-tête). */
  business: 'rp_business',
  /** Démo explicite (lisible par JS : sélecteur de démo du Shell). Valeurs : local | pme | ecommerce. */
  demo: 'rp_demo_segment',
} as const;

export const SESSION_MAX_AGE = 60 * 60 * 24 * 60; // 60 jours (la durée réelle est celle du jeton de rafraîchissement)

export interface CookieOptions {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'lax' | 'strict' | 'none';
  path?: string;
  maxAge?: number;
}

export function cookieOptions(maxAge: number, opts: { httpOnly?: boolean } = {}): CookieOptions {
  return { httpOnly: opts.httpOnly ?? true, secure: isProduction(), sameSite: 'lax', path: '/', maxAge };
}

/** Une écriture de cookie à appliquer sur une réponse (NextResponse.cookies.set). */
export interface CookieWrite {
  name: string;
  value: string;
  options: CookieOptions;
}

export function parseCookieHeader(header: string | null | undefined): Map<string, string> {
  const out = new Map<string, string>();
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    if (!k || out.has(k)) continue;
    const raw = part.slice(i + 1).trim();
    try {
      out.set(k, decodeURIComponent(raw));
    } catch {
      out.set(k, raw);
    }
  }
  return out;
}

/** Recompose un en-tête Cookie après application des écritures (pour transmettre la session rafraîchie à la route). */
export function applyCookieWrites(header: string | null | undefined, writes: CookieWrite[]): string {
  const m = parseCookieHeader(header);
  for (const w of writes) {
    if (w.options.maxAge === 0 || w.value === '') m.delete(w.name);
    else m.set(w.name, w.value);
  }
  return [...m.entries()].map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('; ');
}

// ---------------------------------------------------------------------------
// JWT (lecture non vérifiée : routage et décision de rafraîchissement seulement)
// ---------------------------------------------------------------------------

export interface JwtClaims {
  sub?: string;
  email?: string;
  exp?: number;
  [k: string]: unknown;
}

export function decodeJwt(token: string | null | undefined): JwtClaims | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as JwtClaims;
  } catch {
    return null;
  }
}

/** Le jeton expire-t-il dans moins de `skewSec` secondes ? (jeton illisible = expiré) */
export function isJwtExpired(token: string | null | undefined, skewSec = 60, nowMs = Date.now()): boolean {
  const exp = decodeJwt(token)?.exp;
  return typeof exp !== 'number' || exp * 1000 <= nowMs + skewSec * 1000;
}

/**
 * Vérification locale HS256 si SUPABASE_JWT_SECRET est fourni (évite un aller-retour réseau par requête).
 * Renvoie null si le secret est absent ou l'algorithme différent (ES256 des nouveaux projets) : l'appelant vérifie
 * alors auprès de Supabase.
 */
export function verifyHs256(token: string, secret: string | undefined, nowMs = Date.now()): JwtClaims | 'invalid' | null {
  if (!secret) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return 'invalid';
  let header: { alg?: string };
  try {
    header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
  } catch {
    return 'invalid';
  }
  if (header.alg !== 'HS256') return null;
  const expected = crypto.createHmac('sha256', secret).update(`${parts[0]}.${parts[1]}`).digest();
  const given = Buffer.from(parts[2], 'base64url');
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return 'invalid';
  const claims = decodeJwt(token);
  if (!claims?.sub || typeof claims.exp !== 'number' || claims.exp * 1000 <= nowMs) return 'invalid';
  return claims;
}

// ---------------------------------------------------------------------------
// Valeurs signées HMAC (session locale, rattachement, invitations)
// ---------------------------------------------------------------------------

function hmac(data: string): string {
  return crypto.createHmac('sha256', authSecret()).update(data).digest('base64url');
}

/** `base64url(json).signature` */
export function signValue(payload: object): string {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${body}.${hmac(body)}`;
}

export function verifyValue<T extends object>(signed: string | null | undefined): T | null {
  if (!signed) return null;
  const i = signed.lastIndexOf('.');
  if (i <= 0) return null;
  const body = signed.slice(0, i);
  const sig = Buffer.from(signed.slice(i + 1));
  const exp = Buffer.from(hmac(body));
  if (sig.length !== exp.length || !crypto.timingSafeEqual(sig, exp)) return null;
  try {
    const v = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as T & { exp?: number };
    if (typeof v.exp === 'number' && v.exp * 1000 < Date.now()) return null;
    return v;
  } catch {
    return null;
  }
}

export function sha256(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex');
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

/** Chemin de retour sûr : relatif au site, jamais `//hôte` ni schéma (redirection ouverte). */
export function safeNext(next: string | null | undefined, fallback = '/app'): string {
  if (!next || typeof next !== 'string' || next.length > 500) return fallback;
  // Caractères de contrôle (tabulation, retours…) et barres obliques inverses : refusés avant toute analyse, car
  // l'analyseur WHATWG les retire ou les traite comme « / » (« /\t/evil.fr » → « //evil.fr ») — M1 de securite-v3.
  if (/[\u0000-\u001f\u007f\\]/.test(next)) return fallback;
  if (!next.startsWith('/') || next.startsWith('//')) return fallback;
  try {
    const base = 'https://repere.invalid';
    const u = new URL(next, base);
    if (u.origin !== base) return fallback;
    return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    return fallback;
  }
}
