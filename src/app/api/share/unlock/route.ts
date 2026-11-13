/**
 * POST /api/share/unlock (formulaire de /r/[token] : champs `token`, `password`) → cookie de déverrouillage
 * httpOnly, puis redirection 303 vers /r/[token]. Limité par IP (anti force brute).
 */
import { hashToken, resolveShareToken, unlockCookieName, unlockProof, TOKEN_RE } from '@/lib/share';
import { DAY_MS, getClientIp, rateLimit, HOUR_MS } from '@/lib/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function back(req: Request, token: string, err?: string): Response {
  const u = new URL(`/r/${token}`, req.url);
  if (err) u.searchParams.set('e', err);
  return new Response(null, { status: 303, headers: { Location: u.pathname + u.search, 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const token = String(form?.get('token') ?? '');
  const password = String(form?.get('password') ?? '').slice(0, 128);
  if (!TOKEN_RE.test(token)) return new Response('Lien invalide.', { status: 400 });
  const rl = await rateLimit('share-unlock', `${getClientIp(req)}:${token.slice(0, 8)}`, 10, HOUR_MS);
  if (!rl.ok) return back(req, token, 'limite');
  // Plafond par lien, toutes IP confondues (F5 de qa/v3/securite-v3.md : plusieurs IP ne suffisent plus).
  const perLink = await rateLimit('share-unlock-link', hashToken(token).slice(0, 32), 50, DAY_MS);
  if (!perLink.ok) return back(req, token, 'limite');
  const { status, link } = await resolveShareToken(token, { password });
  if (status !== 'ok' || !link) return back(req, token, status === 'password_required' ? 'mdp' : undefined);
  const res = back(req, token);
  const maxAge = Math.max(60, Math.min(30 * 86400, Math.floor((Date.parse(link.expiresAt) - Date.now()) / 1000)));
  res.headers.append('Set-Cookie', `${unlockCookieName(link)}=${unlockProof(link)}; Path=/r/${token}; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
  return res;
}
