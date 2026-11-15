/**
 * GET /app/agence/demo — compte démo agence (?compte=demo-agence, src/lib/auth/routing.ts) : pose le repère
 * « démo agence » et ouvre le portefeuille. Données de démonstration seulement, rien n'est écrit côté serveur.
 */
import { NextResponse } from 'next/server';
import { COOKIES, cookieOptions } from '@/lib/auth/cookies';
import { DEMO_AGENCY_COOKIE } from '@/lib/agency/load';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const res = NextResponse.redirect(new URL('/app/agence', req.url));
  res.cookies.set(DEMO_AGENCY_COOKIE, '1', cookieOptions(30 * 86_400, { httpOnly: false }));
  res.cookies.set(COOKIES.demo, 'local', cookieOptions(30 * 86_400, { httpOnly: false }));
  return res;
}
