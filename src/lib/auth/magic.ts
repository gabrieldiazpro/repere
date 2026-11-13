/**
 * Liens magiques : envoi et vérification, dans les deux modes.
 *
 * Paramètres transportés jusqu'au retour (`/connexion/callback`) :
 * - `next`   : chemin de retour sûr (safeNext) ;
 * - `claim`  : rattachement signé d'un commerce payé (achat) ou d'une inscription Découverte (voir claims.ts) ;
 * - `invite` : jeton brut d'invitation d'équipe.
 * Ils n'ouvrent aucun droit seuls : ils sont liés à l'e-mail de la session, prouvé par le clic sur le lien.
 */
import { appUrl } from '@/lib/email';
import { getDoc, putDoc } from '@/lib/store';
import { authMode, isProduction } from './config';
import { COOKIES, cookieOptions, parseCookieHeader, randomToken, safeNext, signValue, verifyValue, type CookieWrite } from './cookies';
import { localSessionCookies, supabaseSessionCookies, type Session } from './session';
import * as sbAuth from './supabase';
import { markLocalConfirmed, normEmail } from './users';

export const CALLBACK_PATH = '/connexion/callback';
const LOCAL_LINK_TTL_SEC = 30 * 60;
/** Liens envoyés après un achat ou une invitation : valables plus longtemps (le client ouvre l'e-mail plus tard). */
const LOCAL_LINK_TTL_LONG_SEC = 7 * 24 * 3600;

export interface LinkParams {
  next?: string | null;
  claim?: string | null;
  invite?: string | null;
}

function callbackUrl(params: LinkParams, extra: Record<string, string> = {}): string {
  const u = new URL(CALLBACK_PATH, appUrl());
  for (const [k, v] of Object.entries(extra)) u.searchParams.set(k, v);
  if (params.next) u.searchParams.set('next', safeNext(params.next));
  if (params.claim) u.searchParams.set('claim', params.claim);
  if (params.invite) u.searchParams.set('invite', params.invite);
  return u.toString();
}

interface LocalMagicPayload {
  k: 'magic';
  email: string;
  n: string;
  exp: number;
}

function localLink(email: string, params: LinkParams, ttlSec: number): string {
  const token = signValue({ k: 'magic', email: normEmail(email), n: randomToken(12), exp: Math.floor(Date.now() / 1000) + ttlSec } satisfies LocalMagicPayload);
  const link = callbackUrl(params, { local: token });
  // « Compte local de développement » : pas de service d'e-mail, le lien est affiché dans la console du serveur.
  if (!isProduction()) console.info(`\n[auth:local] Lien de connexion pour ${normEmail(email)} :\n${link}\n`);
  else console.info('[auth:local] lien de connexion émis pour', normEmail(email));
  return link;
}

export interface StartResult {
  ok: boolean;
  /** Cookies à poser (vérificateur PKCE). */
  cookies: CookieWrite[];
  /** Lien à envoyer soi-même (achat, invitation) ; en local, le lien affiché dans la console. */
  link?: string;
  /** Hors production uniquement : lien local renvoyé à l'interface pour tester sans e-mail. */
  devLink?: string;
  error?: string;
}

/**
 * Connexion depuis un navigateur (formulaire /connexion, /inscription) : Supabase envoie l'e-mail (PKCE).
 * Le compte doit exister (créé par l'inscription, le paiement ou une invitation).
 */
export async function startBrowserLogin(email: string, params: LinkParams = {}): Promise<StartResult> {
  const e = normEmail(email);
  const mode = authMode();
  if (mode === 'off') return { ok: false, cookies: [], error: 'unavailable' };
  if (mode === 'local') {
    const link = localLink(e, params, LOCAL_LINK_TTL_SEC);
    return { ok: true, cookies: [], link, devLink: isProduction() ? undefined : link };
  }
  const { verifier, error } = await sbAuth.sendOtpPkce(e, callbackUrl(params));
  if (error) return { ok: false, cookies: [], error };
  return {
    ok: true,
    cookies: verifier ? [{ name: COOKIES.verifier, value: verifier, options: cookieOptions(60 * 60) }] : [],
  };
}

/**
 * Lien à insérer dans un e-mail envoyé par le serveur (achat, invitation), sans navigateur : pas de PKCE possible,
 * on utilise un `token_hash` généré par Supabase (ou un lien local signé).
 * null : génération impossible (l'e-mail renvoie alors vers /connexion).
 */
export async function serverMagicLink(email: string, params: LinkParams = {}): Promise<string | null> {
  const e = normEmail(email);
  const mode = authMode();
  if (mode === 'off') return null;
  if (mode === 'local') return localLink(e, params, LOCAL_LINK_TTL_LONG_SEC);
  const hash = await sbAuth.generateMagicTokenHash(e);
  if (!hash) return null;
  // `as` : adresse signée, affichée par l'écran « Continuer en tant que … ? » du retour (anti connexion forcée).
  return callbackUrl(params, { token_hash: hash, type: 'magiclink', as: signValue({ k: 'as', email: e, h: hash.slice(0, 16) }) });
}

/**
 * Adresse annoncée par un lien `token_hash` (paramètre `as` signé et lié au jeton), ou null.
 * Sert uniquement à l'affichage de la confirmation : la session reste ouverte par la vérification Supabase.
 */
export function announcedEmail(url: URL): string | null {
  const tokenHash = url.searchParams.get('token_hash');
  const p = verifyValue<{ k: string; email: string; h: string }>(url.searchParams.get('as'));
  if (!tokenHash || !p || p.k !== 'as' || typeof p.email !== 'string' || p.h !== tokenHash.slice(0, 16)) return null;
  return p.email;
}

export interface CompleteResult {
  session: Session | null;
  cookies: CookieWrite[];
  error?: 'invalid' | 'expired' | 'unavailable';
}

/** Vérifie le retour du lien magique et ouvre la session (cookies httpOnly). */
export async function completeMagicLink(url: URL, cookieHeader: string | null): Promise<CompleteResult> {
  const mode = authMode();
  const clearVerifier: CookieWrite = { name: COOKIES.verifier, value: '', options: cookieOptions(0) };
  if (mode === 'off') return { session: null, cookies: [], error: 'unavailable' };

  if (mode === 'local') {
    const p = verifyValue<LocalMagicPayload>(url.searchParams.get('local'));
    if (!p || p.k !== 'magic' || !p.email) return { session: null, cookies: [], error: 'expired' };
    // usage unique
    const used = await getDoc('auth.magic_used', p.n);
    if (used) return { session: null, cookies: [], error: 'expired' };
    await putDoc('auth.magic_used', p.n, { at: new Date().toISOString() });
    const user = await markLocalConfirmed(p.email);
    return { session: { userId: user.id, email: user.email }, cookies: localSessionCookies(user.id, user.email) };
  }

  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  let tokens: sbAuth.SupabaseTokens | null = null;
  if (code) {
    const verifier = parseCookieHeader(cookieHeader).get(COOKIES.verifier);
    if (!verifier) return { session: null, cookies: [clearVerifier], error: 'invalid' };
    tokens = await sbAuth.exchangeCode(code, verifier);
  } else if (tokenHash) {
    const t = url.searchParams.get('type');
    tokens = await sbAuth.verifyTokenHash(tokenHash, t === 'invite' || t === 'signup' || t === 'magiclink' ? t : 'email');
  }
  if (!tokens) return { session: null, cookies: [clearVerifier], error: 'expired' };
  return {
    session: { userId: tokens.userId, email: tokens.email },
    cookies: [...supabaseSessionCookies(tokens), clearVerifier],
  };
}
