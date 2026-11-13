/**
 * Logique des endpoints /api/t, /api/t/bot, /api/t/summary (les route.ts sont des enveloppes minces).
 * Jamais stocké : IP, user agent complet, identifiant. L'IP ne sert qu'à un compteur mémoire haché.
 */
import { createHash } from 'node:crypto';
import { DEMO_BUSINESS_ID, getBusinessRecord } from '@/lib/db';
import { HttpError, requireBusiness } from '@/lib/auth';
import { getClientIp, rateLimitSalt } from '@/lib/ratelimit';
import { classifyBot, classifyVisit } from './classify';
import { getAiTraffic, isDemoTrackId, recordBot, recordHit, verifyBotKey } from './index';

export const MAX_BODY = 2048;
const WINDOW_MS = 60_000;
const LIMIT = 120; // requêtes / minute / IP hachée

export const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, x-repere-key',
  'Access-Control-Max-Age': '86400',
};

export const reply = (status: number, body?: unknown, extra: Record<string, string> = {}) =>
  new Response(status === 204 ? null : body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { ...CORS, ...(status === 204 || body === undefined ? {} : { 'content-type': 'application/json' }), 'cache-control': 'no-store', ...extra },
  });

/* ---------- rate limit : IP hachée, mémoire uniquement ---------- */
const g = globalThis as unknown as { __repereTrackRate?: Map<string, number[]> };
const hits: Map<string, number[]> = (g.__repereTrackRate ??= new Map<string, number[]>());

export function trackRateLimit(req: Request, bucket = 't', limit = LIMIT): boolean {
  // Jamais d'erreur 500 sur ce endpoint public : sel de repli (voir rateLimitSalt).
  const key = createHash('sha256').update(`${rateLimitSalt()}:${bucket}:${getClientIp(req)}`).digest('hex').slice(0, 24);
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => t > now - WINDOW_MS);
  if (arr.length >= limit) { hits.set(key, arr); return false; }
  arr.push(now);
  hits.set(key, arr);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => t > now - WINDOW_MS)) hits.delete(k);
  return true;
}
export function resetTrackRateLimit() { hits.clear(); }

/** Lit le corps (≤ 2 Ko) puis le parse. Renvoie null si trop gros ou invalide. */
async function readJson(req: Request): Promise<{ data: unknown } | { tooLarge: true } | null> {
  const len = Number(req.headers.get('content-length') || 0);
  if (len > MAX_BODY) return { tooLarge: true };
  // Lecture bornée en octets, même sans content-length (corps envoyé par morceaux, F3).
  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = req.body?.getReader();
  try {
    while (reader) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      size += value.length;
      if (size > MAX_BODY) {
        await reader.cancel().catch(() => undefined);
        return { tooLarge: true };
      }
      chunks.push(value);
    }
  } catch {
    return null;
  }
  const text = Buffer.concat(chunks).toString('utf8');
  try { return { data: JSON.parse(text) }; } catch { return null; }
}

const SITE_RE = /^[A-Za-z0-9_-]{1,100}$/;
const str = (v: unknown, max: number): string | null =>
  v === undefined || v === null || v === '' ? '' : typeof v === 'string' && v.length <= max ? v : null;

/**
 * Origine du beacon cohérente avec le site déclaré du commerce (ou un sous-domaine) — M2.
 * L'en-tête Origin se falsifie hors navigateur : cela relève le coût d'une pollution, sans la rendre impossible.
 */
export async function originAllowed(site: string, origin: string | null): Promise<boolean> {
  if (isDemoTrackId(site)) return true;
  if (!origin) return false; // sendBeacon / fetch envoient toujours Origin pour un POST
  let host: string;
  try {
    host = new URL(origin).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return false;
  }
  const b = await getBusinessRecord(site).catch(() => null);
  const declared = (b?.website ?? '').replace(/^https?:\/\//i, '').split(/[/?#:]/)[0].replace(/^www\./, '').toLowerCase();
  return Boolean(declared) && (host === declared || host.endsWith(`.${declared}`));
}

export async function siteExists(id: string): Promise<boolean> {
  if (isDemoTrackId(id)) return true;
  try { return Boolean(await getBusinessRecord(id)); } catch { return false; }
}

/** POST /api/t : page vue ou conversion. Corps : {s, p, r, u, m, c?}. */
export async function handleBeacon(req: Request): Promise<Response> {
  if (!trackRateLimit(req)) return reply(429, { error: 'rate' }, { 'retry-after': '60' });
  const body = await readJson(req);
  if (!body) return reply(400, { error: 'invalid' });
  if ('tooLarge' in body) return reply(413, { error: 'too_large' });
  const o = body.data as Record<string, unknown> | null;
  if (!o || typeof o !== 'object' || Array.isArray(o)) return reply(400, { error: 'invalid' });
  const site = typeof o.s === 'string' ? o.s : '';
  const p = str(o.p, 200), r = str(o.r, 200), u = str(o.u, 60), m = str(o.m, 40), c = str(o.c, 40);
  if (!SITE_RE.test(site) || p === null || r === null || u === null || m === null || c === null) return reply(400, { error: 'invalid' });
  if (!(await siteExists(site))) return reply(404, { error: 'unknown_site' });
  // Origine étrangère : ignorée silencieusement (aucune information pour l'appelant).
  if (!(await originAllowed(site, req.headers.get('origin')))) return reply(204);
  if (!trackRateLimit(req, `site:${site}`, 600)) return reply(204);

  // Montant de la conversion en centimes (entier 1..1e8), ignoré s'il est absent ou invalide.
  const valueCents = typeof o.v === 'number' && Number.isInteger(o.v) && o.v >= 1 && o.v <= 100_000_000 ? o.v : undefined;
  const cls = classifyVisit(r, u);
  try {
    await recordHit({ businessId: site, engine: cls?.engine ?? null, path: p || '/', conversion: Boolean(c), ...(c && valueCents ? { valueCents } : {}) });
  } catch (e) {
    console.error('[api/t]', (e as Error).message);
    return reply(500, { error: 'store' });
  }
  return reply(204);
}

/** POST /api/t/bot : appelé côté serveur par le plugin WordPress. En-tête x-repere-key = HMAC(secret, businessId). */
export async function handleBot(req: Request): Promise<Response> {
  if (!trackRateLimit(req, 'bot', 600)) return reply(429, { error: 'rate' }, { 'retry-after': '60' });
  const body = await readJson(req);
  if (!body) return reply(400, { error: 'invalid' });
  if ('tooLarge' in body) return reply(413, { error: 'too_large' });
  const o = body.data as Record<string, unknown> | null;
  if (!o || typeof o !== 'object' || Array.isArray(o)) return reply(400, { error: 'invalid' });
  const businessId = typeof o.businessId === 'string' ? o.businessId : '';
  const ua = str(o.ua, 400), path = str(o.path, 200);
  if (!SITE_RE.test(businessId) || ua === null || path === null || !ua) return reply(400, { error: 'invalid' });
  if (!verifyBotKey(businessId, req.headers.get('x-repere-key'))) return reply(401, { error: 'unauthorized' });
  if (!(await siteExists(businessId))) return reply(404, { error: 'unknown_site' });
  const bot = classifyBot(ua);
  if (!bot) return reply(204); // robot non IA : ignoré, rien n'est conservé
  try {
    await recordBot(businessId, bot.token);
  } catch (e) {
    console.error('[api/t/bot]', (e as Error).message);
    return reply(500, { error: 'store' });
  }
  return reply(204);
}

/** GET /api/t/summary : mêmes règles d'accès que /api/actions (comptes démo en accès libre). */
export async function handleSummary(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const businessId = url.searchParams.get('businessId') || '';
  const days = Number(url.searchParams.get('days') || 30);
  if (!SITE_RE.test(businessId)) return Response.json({ error: 'businessId invalide.' }, { status: 400 });
  if (!trackRateLimit(req, 'sum', 300)) return Response.json({ error: 'Trop de requêtes.' }, { status: 429 });
  if (businessId !== DEMO_BUSINESS_ID && !isDemoTrackId(businessId)) {
    try {
      await requireBusiness(req, businessId);
    } catch (e) {
      if (e instanceof HttpError) return Response.json({ error: 'Accès refusé.' }, { status: e.status });
      throw e;
    }
  }
  return Response.json(await getAiTraffic(businessId, Number.isFinite(days) ? days : 30), { headers: { 'cache-control': 'no-store' } });
}
