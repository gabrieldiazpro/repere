/**
 * Aides HTTP des routes /api/ecommerce/* : réponses `{ ok, … }`, erreurs, lecture du corps, limitation par IP,
 * contrôle d'accès (`requireBusiness` de @/lib/auth : comptes démo lisibles, jamais modifiables).
 */
import { BUSINESS_ID_RE, HttpError, requireBusiness, type BusinessAccess } from '@/lib/auth';
import { getClientIp, HOUR_MS, rateLimit } from '@/lib/ratelimit';

const HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };

export function json(data: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), { status, headers: { ...HEADERS, ...extra } });
}

export function fail(status: number, error: string, code?: string): Response {
  return json({ ok: false, error, ...(code ? { code } : {}) }, status);
}

export function errorResponse(e: unknown, where: string): Response {
  if (e instanceof HttpError || (e instanceof Error && typeof (e as { status?: unknown }).status === 'number')) {
    const he = e as HttpError;
    return fail(he.status, he.message, he.code);
  }
  console.error(`[api/ecommerce${where}]`, e);
  return fail(500, 'Erreur interne. Réessayez dans un instant.');
}

export async function readJson(req: Request, maxBytes = 64_000): Promise<Record<string, unknown>> {
  const len = Number(req.headers.get('content-length') ?? 0);
  if (len > maxBytes) throw new HttpError(413, 'Contenu trop volumineux.');
  const text = await req.text().catch(() => '');
  if (text.length > maxBytes) throw new HttpError(413, 'Contenu trop volumineux.');
  try {
    const v = text ? JSON.parse(text) : null;
    if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  } catch {
    /* corps invalide */
  }
  throw new HttpError(400, 'Requête invalide.');
}

export async function limit(req: Request, bucket: string, max: number, windowMs = HOUR_MS): Promise<void> {
  const rl = await rateLimit(`ecom-${bucket}`, getClientIp(req), max, windowMs);
  if (!rl.ok) throw new HttpError(429, 'Trop de requêtes. Réessayez plus tard.');
}

export function businessIdOf(v: unknown): string {
  const id = typeof v === 'string' ? v : '';
  if (!BUSINESS_ID_RE.test(id)) throw new HttpError(400, 'Identifiant de commerce invalide.');
  return id;
}

/** Lecture (comptes démo autorisés). */
export async function readAccess(req: Request, businessId: string): Promise<BusinessAccess> {
  return requireBusiness(req, businessId);
}

/** Écriture (membre au moins ; refusée sur les comptes démo : 403 demo_read_only). */
export async function writeAccess(req: Request, businessId: string, minRole: 'member' | 'admin' = 'member'): Promise<BusinessAccess> {
  return requireBusiness(req, businessId, { write: true, minRole });
}
