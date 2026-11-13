/**
 * Middleware (runtime Node.js, stable depuis Next 15.5) :
 * 1. rafraîchit la session Supabase (cookies httpOnly) et transmet les cookies à jour à la page ou la route ;
 * 2. protège /app/** : sans session → /connexion ; démo seulement explicite (?compte=demo|demo-pme|demo-ecom ou
 *    cookie de démo) ; connecté sans commerce → /bienvenue, jamais la démo en silence ;
 * 3. /bienvenue exige une session ;
 * 4. CSP à nonce par requête sur les pages dynamiques (src/lib/csp.ts ; /app, /bienvenue, /connexion, /inscription, /r).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { listBusinessesForUser } from '@/lib/db';
import { COOKIES, applyCookieWrites, cookieOptions, type CookieWrite } from '@/lib/auth/cookies';
import { decideRoute } from '@/lib/auth/routing';
import { refreshIfNeeded, sessionFromCookieHeader } from '@/lib/auth/session';
import { newNonce, nonceCsp, wantsNonceCsp } from '@/lib/csp';

export const config = {
  runtime: 'nodejs',
  matcher: ['/app/:path*', '/bienvenue/:path*', '/connexion/:path*', '/inscription/:path*', '/r/:path*', '/api/((?!t/|t$|stripe/|cron/|health).*)'],
};

const WORKSPACE_HINT_MAX_AGE = 12 * 3600;

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const originalCookies = req.headers.get('cookie');
  let writes: CookieWrite[] = [];
  try {
    writes = (await refreshIfNeeded(originalCookies)) ?? [];
  } catch (e) {
    console.warn('[middleware] rafraîchissement de session impossible', e);
  }
  const cookieHeader = writes.length ? applyCookieWrites(originalCookies, writes) : originalCookies;

  const finish = (res: NextResponse) => {
    for (const w of writes) res.cookies.set(w.name, w.value, w.options);
    return res;
  };
  const csp = !pathname.startsWith('/api/') && wantsNonceCsp(pathname) ? nonceCsp(newNonce()) : null;
  const pass = () => {
    if (!writes.length && !csp) return NextResponse.next();
    const headers = new Headers(req.headers);
    if (writes.length) {
      if (cookieHeader) headers.set('cookie', cookieHeader);
      else headers.delete('cookie');
    }
    // Next lit le nonce dans la CSP de la requête et l'applique à ses scripts ; la réponse porte la même CSP.
    if (csp) headers.set('content-security-policy', csp);
    const res = NextResponse.next({ request: { headers } });
    if (csp) res.headers.set('content-security-policy', csp);
    return finish(res);
  };

  if (pathname.startsWith('/api/')) return pass();

  const session = await sessionFromCookieHeader(cookieHeader).catch(() => null);
  const hint = req.cookies.get(COOKIES.workspace)?.value;
  const input = {
    pathname,
    search,
    hasSession: Boolean(session),
    hasWorkspace: session && hint === session.userId ? true : undefined,
    demoCookie: req.cookies.get(COOKIES.demo)?.value ?? null,
  };
  let decision = decideRoute(input);
  if (decision.action === 'needWorkspace' && session) {
    let has = true; // erreur base : on laisse passer (la page affiche l'erreur), jamais la démo en silence
    try {
      has = (await listBusinessesForUser(session.userId)).length > 0;
    } catch (e) {
      console.error('[middleware] lecture des espaces impossible', e);
    }
    if (has) writes.push({ name: COOKIES.workspace, value: session.userId, options: cookieOptions(WORKSPACE_HINT_MAX_AGE) });
    decision = decideRoute({ ...input, hasWorkspace: has });
  }
  if (decision.action === 'redirect') {
    const res = NextResponse.redirect(new URL(decision.to, req.url));
    if (decision.setDemo) res.cookies.set(COOKIES.demo, decision.setDemo, cookieOptions(30 * 86_400, { httpOnly: false }));
    return finish(res);
  }
  return pass();
}
