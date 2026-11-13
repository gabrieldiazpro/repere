/**
 * Enveloppe commune des routes /api/tools/* : POST JSON, validation zod, limite par IP, réponse `{ ok, data | error }`.
 */
import type { ZodType } from 'zod';
import { HOUR_MS, getClientIp, rateLimit } from '@/lib/ratelimit';
import { SafeFetchError } from './fetch';

export interface ToolOptions {
  /** Seau de limitation (ex. « tools-readiness »). */
  bucket: string;
  /** Appels par heure et par IP (défaut 10 : docs/v3/11-outils-gratuits.md). */
  perHour?: number;
}

const MAX_BODY = 600_000;

export function jsonError(status: number, error: string, code?: string, headers: Record<string, string> = {}): Response {
  return Response.json({ ok: false, error, ...(code ? { code } : {}) }, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}

export function jsonOk(data: unknown): Response {
  return Response.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
}

/** Statut HTTP d'une erreur de récupération. */
export function fetchErrorStatus(e: SafeFetchError): number {
  if (e.code === 'invalid_url' || e.code.startsWith('blocked')) return 400;
  if (e.code === 'robots_disallowed') return 403;
  if (e.code === 'timeout') return 504;
  return 502;
}

export function handleError(e: unknown, where: string): Response {
  if (e instanceof SafeFetchError) return jsonError(fetchErrorStatus(e), e.publicMessage, e.code);
  console.error(`[api/${where}]`, e);
  return jsonError(500, 'Analyse impossible pour le moment. Réessayez dans quelques minutes.', 'internal');
}

/** Crée un gestionnaire POST : lecture du corps, validation, limite par IP, exécution, erreurs normalisées. */
export function toolHandler<T>(schema: ZodType<T>, opts: ToolOptions, run: (input: T, req: Request) => Promise<unknown>) {
  return async function POST(req: Request): Promise<Response> {
    const len = Number(req.headers.get('content-length') ?? 0);
    if (len > MAX_BODY) return jsonError(413, 'Requête trop volumineuse.', 'too_large');
    const text = await req.text().catch(() => '');
    if (text.length > MAX_BODY) return jsonError(413, 'Requête trop volumineuse.', 'too_large');
    let body: unknown = null;
    try {
      body = JSON.parse(text);
    } catch {
      return jsonError(400, 'Requête invalide : JSON attendu.', 'bad_request');
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return jsonError(400, `Requête invalide${first ? ` (${first.path.join('.') || 'corps'} : ${first.message})` : ''}.`, 'bad_request');
    }
    const rl = await rateLimit(opts.bucket, getClientIp(req), opts.perHour ?? 10, HOUR_MS);
    if (!rl.ok) return jsonError(429, 'Trop d’analyses depuis votre connexion : réessayez dans une heure.', 'rate_limited', { 'Retry-After': String(rl.retryAfter) });
    try {
      return jsonOk(await run(parsed.data, req));
    } catch (e) {
      return handleError(e, opts.bucket);
    }
  };
}
