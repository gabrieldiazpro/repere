/**
 * Aides HTTP partagées par les routes /api/prompts (réponses JSON, erreurs, limitation de débit).
 */
import { getClientIp, HOUR_MS, rateLimit } from '@/lib/ratelimit';
import { HttpError } from './adapters';

const HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: HEADERS });
}

export function fail(status: number, error: string, extra: Record<string, unknown> = {}): Response {
  return json({ ok: false, error, ...extra }, status);
}

/** Convertit une erreur en réponse : HttpError → son statut ; autre → 500 générique (détail journalisé). */
export function errorResponse(e: unknown, where: string): Response {
  if (e instanceof HttpError || (e instanceof Error && typeof (e as { status?: unknown }).status === 'number')) {
    const he = e as HttpError & { duplicateOf?: string };
    return fail(he.status, he.message, he.duplicateOf ? { duplicateOf: he.duplicateOf } : {});
  }
  console.error(`[api/prompts${where}]`, e);
  return fail(500, 'Erreur interne. Réessayez dans un instant.');
}

export const BUSINESS_ID_RE = /^[A-Za-z0-9_-]{1,100}$/;

export async function readJson(req: Request, maxBytes = 64_000): Promise<Record<string, unknown> | null> {
  const len = Number(req.headers.get('content-length') ?? 0);
  if (len > maxBytes) throw new HttpError(413, 'Contenu trop volumineux.');
  const text = await req.text().catch(() => '');
  if (text.length > maxBytes) throw new HttpError(413, 'Contenu trop volumineux.');
  if (!text) return null;
  try {
    const v = JSON.parse(text);
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Limitation par IP (lève HttpError 429). */
export async function limit(req: Request, bucket: string, max: number, windowMs = HOUR_MS): Promise<void> {
  const rl = await rateLimit(`prompts-${bucket}`, getClientIp(req), max, windowMs);
  if (!rl.ok) throw new HttpError(429, 'Trop de requêtes. Réessayez plus tard.');
}
