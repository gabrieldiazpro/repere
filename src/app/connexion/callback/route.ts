/**
 * Retour du lien magique : `?code=` (PKCE), `?token_hash=&type=` (liens générés par le serveur) ou `?local=` (compte
 * local de développement). Ouvre la session (cookies httpOnly), applique rattachement et invitation, puis redirige :
 * vers `next` si l'utilisateur a un espace, sinon vers /bienvenue (jamais la démo).
 *
 * Anti connexion forcée (F6, qa/v3/securite-v3.md) : un lien `token_hash` (envoyé par le serveur, sans PKCE) n'ouvre
 * pas la session sur GET. GET affiche « Continuer en tant que <adresse> ? » ; seul le POST du bouton, depuis ce site
 * (Origin / Sec-Fetch-Site vérifiés), pose les cookies. Les antivirus de messagerie qui ouvrent les liens ne
 * consomment plus le jeton. `?code=` (PKCE : vérificateur en cookie) et `?local=` (développement) restent en GET.
 */
import { NextResponse } from 'next/server';
import { applyLoginEffects } from '@/lib/auth/claims';
import { COOKIES, cookieOptions, safeNext, type CookieWrite } from '@/lib/auth/cookies';
import { announcedEmail, completeMagicLink } from '@/lib/auth/magic';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

/** Écran de confirmation (aucune écriture) : le formulaire poste sur la même URL (CSP form-action 'self'). */
function confirmPage(url: URL): Response {
  const email = announcedEmail(url);
  const title = email ? `Continuer en tant que ${email} ?` : 'Continuer la connexion ?';
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Connexion – Repéré</title></head>
<body style="margin:0;font-family:system-ui,Arial,sans-serif;background:#F6F7FB;color:#1B1F2E"><main style="max-width:520px;margin:12vh auto;padding:28px;background:#fff;border:1px solid #D5D9E4;border-radius:14px">
<h1 style="font-size:22px;line-height:1.3;margin:0 0 12px;overflow-wrap:anywhere">${esc(title)}</h1>
<p style="margin:0 0 20px;color:#5A6275">Vous allez ouvrir votre espace Repéré${email ? ' avec cette adresse' : ''}. Si vous n’avez pas demandé ce lien, fermez simplement cette page.</p>
<form method="post" action="${esc(url.pathname + url.search)}"><button type="submit" style="font-size:16px;font-weight:600;padding:12px 18px;border:0;border-radius:10px;background:#3730A3;color:#fff;cursor:pointer">Continuer</button></form>
</main></body></html>`;
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex', 'Referrer-Policy': 'no-referrer' },
  });
}

/** POST venu d'une autre origine (formulaire auto-soumis par un site tiers) : refusé. */
function crossSite(req: Request, url: URL): boolean {
  const site = req.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin') return true;
  const origin = req.headers.get('origin');
  if (!origin) return false;
  if (origin === 'null') return true;
  let host: string;
  try {
    host = new URL(origin).host;
  } catch {
    return true;
  }
  // Hôte vu par le navigateur (derrière un proxy : x-forwarded-host), pas le schéma (http interne / https public).
  const hosts = [url.host, req.headers.get('x-forwarded-host'), req.headers.get('host')].filter(Boolean).map((h) => h!.split(',')[0].trim());
  return !hosts.includes(host);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get('token_hash') && !url.searchParams.get('code')) return confirmPage(url);
  return complete(req, url);
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  if (crossSite(req, url)) return new Response('Requête refusée.', { status: 403, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  return complete(req, url);
}

async function complete(req: Request, url: URL): Promise<Response> {
  const next = safeNext(url.searchParams.get('next'), '/app');
  const fail = (reason: string, writes: CookieWrite[] = []) => {
    const to = new URL('/connexion', url);
    to.searchParams.set('erreur', reason);
    if (next !== '/app') to.searchParams.set('next', next);
    const res = NextResponse.redirect(to, 303);
    for (const w of writes) res.cookies.set(w.name, w.value, w.options);
    return res;
  };

  let result;
  try {
    result = await completeMagicLink(url, req.headers.get('cookie'));
  } catch (e) {
    console.error('[auth/callback]', e);
    return fail('indisponible');
  }
  if (!result.session) return fail(result.error === 'unavailable' ? 'indisponible' : 'lien', result.cookies);

  const writes: CookieWrite[] = [
    ...result.cookies,
    // Une démo choisie avant la connexion ne doit pas masquer l'espace réel.
    { name: COOKIES.demo, value: '', options: cookieOptions(0, { httpOnly: false }) },
  ];
  let to = next;
  try {
    const fx = await applyLoginEffects(result.session, { claim: url.searchParams.get('claim'), invite: url.searchParams.get('invite') });
    if (fx.selectBusinessId) {
      writes.push({ name: COOKIES.business, value: fx.selectBusinessId, options: cookieOptions(365 * 86_400, { httpOnly: false }) });
    }
    if (fx.hasBusiness) {
      writes.push({ name: COOKIES.workspace, value: result.session.userId, options: cookieOptions(12 * 3600) });
      if (fx.next) to = fx.next;
    } else {
      to = '/bienvenue';
    }
    if (fx.invite && fx.invite !== 'accepted' && fx.invite !== 'already_member') {
      to = `${fx.hasBusiness ? '/app' : '/bienvenue'}?invitation=${fx.invite}`;
    }
  } catch (e) {
    // Session ouverte malgré tout : /bienvenue ou l'espace afficheront l'état réel.
    console.error('[auth/callback] effets de connexion', e);
  }
  const res = NextResponse.redirect(new URL(to, url), 303);
  for (const w of writes) res.cookies.set(w.name, w.value, w.options);
  return res;
}
