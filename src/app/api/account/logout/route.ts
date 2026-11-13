/** POST /api/account/logout — ferme la session (cookies effacés, jeton Supabase révoqué). Formulaire HTML : 303 vers /connexion. */
import { NextResponse } from 'next/server';
import { clearSessionCookies, toResponse } from '@/lib/auth';
import { authMode } from '@/lib/auth/config';
import { COOKIES, parseCookieHeader } from '@/lib/auth/cookies';
import { assertSameOrigin, json } from '@/lib/auth/http';
import { signOutToken } from '@/lib/auth/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const token = parseCookieHeader(req.headers.get('cookie')).get(COOKIES.access);
    if (token && authMode() === 'supabase') await signOutToken(token);
    const writes = [...clearSessionCookies(), { name: COOKIES.demo, value: '', options: { path: '/', maxAge: 0 } }];
    if ((req.headers.get('accept') ?? '').includes('text/html')) {
      const res = NextResponse.redirect(new URL('/connexion?deconnecte=1', req.url), 303);
      for (const w of writes) res.cookies.set(w.name, w.value, w.options);
      return res;
    }
    return json({ ok: true }, { cookies: writes });
  } catch (e) {
    return toResponse(e, 'api/account/logout');
  }
}
