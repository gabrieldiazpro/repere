/**
 * Session serveur (cookies httpOnly) : lecture, émission, rafraîchissement, déconnexion.
 *
 * Sources acceptées, dans l'ordre :
 * 1. `Authorization: Bearer <jeton Supabase>` (PWA, clients existants) ;
 * 2. cookie `rp_session` (jeton d'accès Supabase, posé uniquement par le serveur, httpOnly) ;
 * 3. cookie `rp_local` (compte local de développement, signé HMAC), seulement en mode local.
 */
import { authMode } from './config';
import {
  COOKIES,
  SESSION_MAX_AGE,
  cookieOptions,
  isJwtExpired,
  parseCookieHeader,
  signValue,
  verifyValue,
  type CookieWrite,
} from './cookies';
import * as sbAuth from './supabase';
import type { SupabaseTokens } from './supabase';
import { normEmail } from './users';

export interface Session {
  userId: string;
  email: string;
}

interface LocalSessionPayload {
  uid: string;
  email: string;
  exp: number;
  /** marqueur de type (évite qu'un jeton de lien magique soit accepté comme session) */
  k: 'session';
}

export function bearerToken(req: Request | null | undefined): string | null {
  const h = req?.headers.get('authorization');
  return h?.startsWith('Bearer ') ? h.slice(7).trim() || null : null;
}

/** Lit une session à partir d'un en-tête Cookie et d'un éventuel jeton Bearer. */
export async function sessionFromCookieHeader(cookieHeader: string | null | undefined, bearer: string | null = null): Promise<Session | null> {
  const mode = authMode();
  if (mode === 'off') return null;
  if (mode === 'supabase') {
    const jar = parseCookieHeader(cookieHeader);
    const token = bearer || jar.get(COOKIES.access);
    if (!token || isJwtExpired(token, 0)) return null;
    const u = await sbAuth.verifyAccessToken(token);
    return u ? { userId: u.userId, email: u.email } : null;
  }
  const local = verifyValue<LocalSessionPayload>(parseCookieHeader(cookieHeader).get(COOKIES.local));
  if (!local || local.k !== 'session' || !local.uid || !local.email) return null;
  return { userId: local.uid, email: local.email };
}

/**
 * Session de la requête. Sans `req` : cookies de la requête Next en cours (composant serveur, route) ; hors requête
 * (tests, scripts) : null.
 */
export async function getSession(req?: Request): Promise<Session | null> {
  if (req) return sessionFromCookieHeader(req.headers.get('cookie'), bearerToken(req));
  try {
    const { cookies, headers } = await import('next/headers');
    const jar = await cookies();
    const h = await headers();
    const header = jar
      .getAll()
      .map((c) => `${c.name}=${encodeURIComponent(c.value)}`)
      .join('; ');
    const auth = h.get('authorization');
    return sessionFromCookieHeader(header, auth?.startsWith('Bearer ') ? auth.slice(7) : null);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Émission
// ---------------------------------------------------------------------------

export function supabaseSessionCookies(t: SupabaseTokens): CookieWrite[] {
  return [
    { name: COOKIES.access, value: t.accessToken, options: cookieOptions(SESSION_MAX_AGE) },
    { name: COOKIES.refresh, value: t.refreshToken, options: cookieOptions(SESSION_MAX_AGE) },
    { name: COOKIES.local, value: '', options: cookieOptions(0) },
  ];
}

export function localSessionCookies(userId: string, email: string, maxAgeSec = SESSION_MAX_AGE): CookieWrite[] {
  const payload: LocalSessionPayload = {
    uid: userId,
    email: normEmail(email),
    exp: Math.floor(Date.now() / 1000) + maxAgeSec,
    k: 'session',
  };
  return [{ name: COOKIES.local, value: signValue(payload), options: cookieOptions(maxAgeSec) }];
}

/** Efface toutes les traces de session (y compris l'indice d'espace et le commerce choisi). */
export function clearSessionCookies(): CookieWrite[] {
  return [COOKIES.access, COOKIES.refresh, COOKIES.local, COOKIES.verifier, COOKIES.workspace, COOKIES.business].map((name) => ({
    name,
    value: '',
    options: cookieOptions(0, { httpOnly: name !== COOKIES.business }),
  }));
}

/**
 * Rafraîchissement (middleware) : si le jeton d'accès Supabase expire dans moins d'une minute et qu'un jeton de
 * rafraîchissement existe, renvoie les nouveaux cookies ; refus de Supabase → cookies effacés.
 * `null` = rien à faire.
 */
export async function refreshIfNeeded(
  cookieHeader: string | null | undefined,
  refresh: (rt: string) => Promise<SupabaseTokens | null> = sbAuth.refreshTokens,
): Promise<CookieWrite[] | null> {
  if (authMode() !== 'supabase') return null;
  const jar = parseCookieHeader(cookieHeader);
  const access = jar.get(COOKIES.access);
  const rt = jar.get(COOKIES.refresh);
  if (!rt) return null;
  if (access && !isJwtExpired(access, 60)) return null;
  const t = await refresh(rt);
  if (!t) return [COOKIES.access, COOKIES.refresh].map((name) => ({ name, value: '', options: cookieOptions(0) }));
  return supabaseSessionCookies(t);
}

/** Applique des écritures de cookies sur une réponse Next (NextResponse ou équivalent). */
export function setCookies(res: { cookies: { set: (name: string, value: string, opts: object) => unknown } }, writes: CookieWrite[]): void {
  for (const w of writes) res.cookies.set(w.name, w.value, w.options);
}
