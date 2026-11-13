/** Petits utilitaires HTTP des routes /api/local/*. Réponses : `{ ok: true, data, demo? }` ou `{ ok: false, error }`. */
import { NextResponse } from 'next/server';
import { BUSINESS_ID_RE } from '@/lib/auth';
import type { BusinessRecord } from '@/lib/db';
import { isDemoBusinessId } from '@/lib/demo-v2';
import { getClientIp, rateLimit, DAY_MS } from '@/lib/ratelimit';
import { HttpError, requireBusiness } from './auth';

export function ok(data: unknown, extra: Record<string, unknown> = {}, status = 200): NextResponse {
  return NextResponse.json({ ok: true, data, ...extra }, { status, headers: { 'cache-control': 'no-store' } });
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  const len = Number(req.headers.get('content-length') ?? 0);
  if (len > 300_000) throw new HttpError(413, 'Requête trop volumineuse.');
  try {
    const b = (await req.json()) as unknown;
    return b && typeof b === 'object' && !Array.isArray(b) ? (b as Record<string, unknown>) : {};
  } catch {
    throw new HttpError(400, 'Corps de requête JSON invalide.');
  }
}

export function businessIdFrom(v: unknown): string {
  const id = typeof v === 'string' ? v.trim() : '';
  if (!BUSINESS_ID_RE.test(id)) throw new HttpError(400, 'Identifiant de commerce invalide.');
  return id;
}

/**
 * Accès au commerce. `compute` : calcul sans écriture autorisé aux comptes démo (lecture seule côté serveur) ;
 * sinon l'écriture exige le rôle membre.
 */
export async function access(req: Request, businessId: string, mode: 'read' | 'write' | 'compute'): Promise<{ business: BusinessRecord; demo: boolean }> {
  const demo = isDemoBusinessId(businessId);
  const { business } = await requireBusiness(req, businessId, { write: mode === 'write' || (mode === 'compute' && !demo) });
  return { business: business as BusinessRecord, demo };
}

/** Limite par commerce et par IP (appels coûteux : Places, LLM, vérifications réseau). */
export async function limit(req: Request, bucket: string, businessId: string, max: number, windowMs = DAY_MS): Promise<void> {
  const r = await rateLimit(`local.${bucket}`, `${businessId}|${getClientIp(req)}`, max, windowMs);
  if (!r.ok) throw new HttpError(429, 'Trop de demandes : réessayez plus tard.');
}
