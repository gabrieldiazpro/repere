/** Petits outils des routes de compte : JSON, origine, limitation de débit, cookies de réponse. */
import { NextResponse } from 'next/server';
import { HOUR_MS, getClientIp, rateLimit } from '@/lib/ratelimit';
import type { CookieWrite } from './cookies';
import { HttpError } from './roles';

export function json(data: unknown, init: { status?: number; cookies?: CookieWrite[] } = {}): NextResponse {
  const res = NextResponse.json(data, { status: init.status ?? 200, headers: { 'cache-control': 'no-store' } });
  for (const w of init.cookies ?? []) res.cookies.set(w.name, w.value, w.options);
  return res;
}

/**
 * Anti-CSRF en complément des cookies SameSite=Lax : une requête qui modifie l'état et porte un en-tête Origin
 * doit venir du même hôte.
 */
export function assertSameOrigin(req: Request): void {
  const origin = req.headers.get('origin');
  if (!origin) return;
  let host: string | null = null;
  try {
    host = new URL(origin).host;
  } catch {
    throw new HttpError(403, 'Origine refusée.');
  }
  const expected = req.headers.get('x-forwarded-host') || req.headers.get('host') || new URL(req.url).host;
  if (host !== expected) throw new HttpError(403, 'Origine refusée.');
}

export async function limit(req: Request, bucket: string, max: number, windowMs = HOUR_MS): Promise<void> {
  const r = await rateLimit(bucket, getClientIp(req), max, windowMs);
  if (!r.ok) throw new HttpError(429);
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'Requête invalide.');
  return body as Record<string, unknown>;
}

export function str(v: unknown, max = 200): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}
