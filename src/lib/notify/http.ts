/** Petits utilitaires communs aux routes du module DONNEES (réponses JSON, erreurs). */
import { NextResponse } from 'next/server';
import { HttpError } from './platform';

export const BUSINESS_ID_RE = /^[A-Za-z0-9_-]{1,100}$/;

export function jsonError(status: number, error: string, extra: Record<string, unknown> = {}): NextResponse {
  return NextResponse.json({ ok: false, error, ...extra }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export function jsonOk(data: Record<string, unknown>, status = 200): NextResponse {
  return NextResponse.json({ ok: true, ...data }, { status, headers: { 'Cache-Control': 'no-store' } });
}

/** Exécute un traitant de route : HttpError → réponse au bon statut, autre erreur → 500 sans détail. */
export async function handle(tag: string, fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    const status = e instanceof HttpError ? e.status : (e as { status?: unknown })?.status;
    if (e instanceof Error && typeof status === 'number' && status >= 400 && status < 500) {
      return jsonError(status, e.message, status === 403 && /démonstration/.test(e.message) ? { demo: true } : {});
    }
    console.error(`[api/${tag}]`, e);
    return jsonError(500, 'Erreur interne.');
  }
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  const j = await req.json().catch(() => null);
  return j && typeof j === 'object' && !Array.isArray(j) ? (j as Record<string, unknown>) : {};
}

/** businessId depuis la requête (query string ou corps), validé. */
export function businessIdOf(v: unknown): string {
  const s = typeof v === 'string' ? v : '';
  if (!BUSINESS_ID_RE.test(s)) throw new HttpError(400, 'Identifiant de commerce invalide.');
  return s;
}

/** Limite par IP (réutilise src/lib/ratelimit.ts). */
export async function limit(req: Request, bucket: string, max: number): Promise<void> {
  const { rateLimit, getClientIp, HOUR_MS } = await import('@/lib/ratelimit');
  const rl = await rateLimit(`data-${bucket}`, getClientIp(req), max, HOUR_MS);
  if (!rl.ok) throw new HttpError(429, 'Trop de requêtes, réessayez plus tard.');
}
