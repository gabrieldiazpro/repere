/**
 * Routeur de l'API publique v1 (appelé par src/app/api/public/v1/[[...path]]/route.ts).
 * Ordre : correspondance → authentification → limites de débit → traitant → journal d'utilisation.
 * Toutes les réponses : JSON, `Cache-Control: no-store`, `X-Request-Id` ; erreurs au format unique (errors.ts).
 */
import crypto from 'node:crypto';
import { appUrl } from '@/lib/email';
import { ApiError, errorBody, toApiError } from './errors';
import { authenticate, type Principal } from './access';
import { ownerRef, touchKey } from './keys';
import { buildOpenApi, API_BASE_PATH } from './openapi';
import { matchPath } from './routes';
import { checkRate, recordUsage, type RateInfo } from './usage';

const MAX_BODY = 16_384;

function newRequestId(): string {
  return `req_${crypto.randomBytes(9).toString('base64url')}`;
}

function json(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      ...headers,
    },
  });
}

async function readBody(req: Request): Promise<Record<string, unknown> | null> {
  const ct = req.headers.get('content-type') ?? '';
  const raw = await req.text();
  if (!raw.trim()) return null;
  if (raw.length > MAX_BODY) throw new ApiError(400, 'invalid_request', 'Corps de requête trop volumineux (16 Ko au plus).');
  if (!/application\/json/i.test(ct)) throw new ApiError(400, 'invalid_request', 'Envoyez un corps JSON avec « Content-Type: application/json ».');
  try {
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('objet attendu');
    return v as Record<string, unknown>;
  } catch {
    throw new ApiError(400, 'invalid_request', 'Corps JSON illisible : un objet JSON est attendu.');
  }
}

/** Origine publique pour les liens renvoyés (jamais l'en-tête Host du client). */
export function publicBase(): string {
  return appUrl();
}

export async function handlePublicApi(req: Request, segments: string[], now: Date = new Date()): Promise<Response> {
  const requestId = newRequestId();
  const started = Date.now();
  const method = req.method.toUpperCase();
  const path = `/${segments.map((s) => encodeURIComponent(s)).join('/')}`;
  const rid = { 'x-request-id': requestId };

  // Racine et document OpenAPI : publics, sans clé.
  if (method === 'GET' && (path === '/v1' || path === '/' || path === '/v1/')) {
    return json({ name: 'API publique Repéré', version: 'v1', openapi: `${publicBase()}${API_BASE_PATH}/v1/openapi.json`, docs: `${publicBase()}/developpeurs` }, 200, rid);
  }
  if (path === '/v1/openapi.json') {
    if (method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET', ...rid } });
    if (method !== 'GET') return json(errorBody(new ApiError(405, 'method_not_allowed', 'Méthode non autorisée.'), requestId), 405, { allow: 'GET', ...rid });
    return json(buildOpenApi(publicBase()), 200, { 'access-control-allow-origin': '*', 'cache-control': 'public, max-age=300', ...rid });
  }

  let principal: Principal | null = null;
  let rate: RateInfo | null = null;
  let status = 500;
  try {
    const matches = matchPath(path);
    if (!matches.length) throw new ApiError(404, 'not_found', 'Route inconnue. Référence : /developpeurs.');
    const m = matches.find((x) => x.route.method === method);
    if (!m) {
      const allow = [...new Set(matches.map((x) => x.route.method))].join(', ');
      const e = new ApiError(405, 'method_not_allowed', `Méthode non autorisée. Méthodes acceptées : ${allow}.`);
      status = 405;
      return json(errorBody(e, requestId), 405, { allow, ...rid });
    }
    principal = await authenticate(req);
    rate = await checkRate(principal, req, m.route.access);
    const body = method === 'POST' ? await readBody(req) : null;
    const q = new URL(req.url).searchParams;
    const out = await m.route.handler({ req, principal, params: m.params, query: q, base: publicBase(), now, body, path });
    status = out.status ?? 200;
    return json(out.body, status, {
      ...rid,
      'x-ratelimit-limit': String(rate.limit),
      'x-ratelimit-remaining': String(rate.remaining),
      ...(principal.demo ? { 'x-repere-demo': 'true' } : {}),
    });
  } catch (err) {
    const e = toApiError(err);
    if (e.status >= 500) console.error('[publicapi]', err);
    status = e.status;
    const headers: Record<string, string> = { ...rid };
    if (e.status === 401) headers['www-authenticate'] = 'Bearer realm="repere-api"';
    if (e.status === 429) headers['retry-after'] = String((e.details?.retryAfter as number) ?? 60);
    if (rate) {
      headers['x-ratelimit-limit'] = String(rate.limit);
      headers['x-ratelimit-remaining'] = String(rate.remaining);
    }
    return json(errorBody(e, requestId), e.status, headers);
  } finally {
    if (principal && !principal.demo) {
      const p = principal;
      const ref = p.scope.kind === 'demo' ? null : ownerRef(p.scope);
      await recordUsage(p, ref, { at: now.toISOString(), method, path, status, ms: Date.now() - started });
      if (p.record) await touchKey(p.record, now).catch(() => undefined);
    }
  }
}

