import { NextResponse } from 'next/server';
import { isAdmin } from '../data';
import { HOUR_MS, getClientIp, rateLimit } from '@/lib/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Échange ADMIN_TOKEN (formulaire POST) contre un cookie HttpOnly (qa/securite.md M3).
 * Le jeton ne passe plus jamais dans l'URL. Cookie sur path=/ : envoyé aussi à POST /api/audit (bouton d'audit).
 */
export async function POST(req: Request) {
  const rl = await rateLimit('admin-login', getClientIp(req), 10, HOUR_MS, { failClosed: true });
  if (!rl.ok) return new NextResponse('Trop de tentatives, réessayez plus tard.', { status: 429 });
  const form = await req.formData().catch(() => null);
  const token = String(form?.get('token') ?? '');
  if (!isAdmin(token)) return NextResponse.redirect(new URL('/admin?erreur=1', req.url), 303);
  const res = NextResponse.redirect(new URL('/admin', req.url), 303);
  res.cookies.set('admin_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 8 * 3600,
  });
  return res;
}

/** Déconnexion. */
export async function DELETE(req: Request) {
  const res = NextResponse.redirect(new URL('/admin', req.url), 303);
  res.cookies.delete('admin_token');
  return res;
}
