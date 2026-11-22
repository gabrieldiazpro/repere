/**
 * Limites de débit et journal d'utilisation de l'API publique.
 *
 * Limites (par clé, fenêtres glissantes, partagées entre instances via src/lib/ratelimit.ts) :
 * - lecture : 120 requêtes par minute ; écriture : 20 par minute ; 10 000 requêtes par jour au total ;
 * - clé de démonstration (publique) : 30 requêtes par minute et 1 000 par jour, PAR ADRESSE IP.
 * Les nouvelles mesures restent en plus bornées par l'offre (une par période, voir routes.ts).
 *
 * Journal : compteurs quotidiens par clé (`publicapi.usage`) et 50 derniers appels (`publicapi.log` : méthode,
 * chemin sans paramètres, statut, durée). Ni corps, ni adresse IP, ni jeton. Rien n'est journalisé pour la démo.
 */
import { getClientIp, rateLimit, DAY_MS } from '@/lib/ratelimit';
import { getDoc, incrDoc, putDoc } from '@/lib/store';
import { ApiError } from './errors';
import type { Principal } from './access';

export const USAGE_COLLECTION = 'publicapi.usage';
export const LOG_COLLECTION = 'publicapi.log';
export const LOG_SIZE = 50;

export const LIMITS = {
  readPerMinute: 120,
  writePerMinute: 20,
  perDay: 10_000,
  demoPerMinute: 30,
  demoPerDay: 1_000,
} as const;

export interface RateInfo {
  limit: number;
  remaining: number;
  /** secondes avant de réessayer (429) */
  retryAfter: number;
}

/** Applique les limites ; lève 429 (avec Retry-After) si une limite est atteinte. */
export async function checkRate(p: Principal, req: Request, kind: 'read' | 'write'): Promise<RateInfo> {
  if (p.demo) {
    const ip = getClientIp(req);
    const day = await rateLimit('papi-demo-d', ip, LIMITS.demoPerDay, DAY_MS);
    if (!day.ok) throw rateError(day.retryAfter, LIMITS.demoPerDay);
    const m = await rateLimit('papi-demo-m', ip, LIMITS.demoPerMinute, 60_000);
    if (!m.ok) throw rateError(m.retryAfter, LIMITS.demoPerMinute);
    return { limit: LIMITS.demoPerMinute, remaining: m.remaining, retryAfter: 0 };
  }
  const day = await rateLimit('papi-d', p.keyId, LIMITS.perDay, DAY_MS);
  if (!day.ok) throw rateError(day.retryAfter, LIMITS.perDay);
  const limit = kind === 'write' ? LIMITS.writePerMinute : LIMITS.readPerMinute;
  const m = await rateLimit(kind === 'write' ? 'papi-w' : 'papi-r', p.keyId, limit, 60_000);
  if (!m.ok) throw rateError(m.retryAfter, limit);
  return { limit, remaining: m.remaining, retryAfter: 0 };
}

function rateError(retryAfter: number, limit: number): ApiError {
  return new ApiError(429, 'rate_limited', `Limite de ${limit} requêtes atteinte. Réessayez dans ${Math.max(1, retryAfter)} s.`, { retryAfter: Math.max(1, retryAfter), limit });
}

export interface UsageEntry {
  at: string;
  method: string;
  /** chemin sans requête (ex. /v1/spaces/abc/scores) ou outil MCP (mcp:scores) */
  path: string;
  status: number;
  ms: number;
}

interface LogDoc {
  keyId: string;
  entries: UsageEntry[];
}

/** Enregistre un appel (jamais bloquant : une erreur de journal ne fait pas échouer la requête). */
export async function recordUsage(p: Principal, ownerRef: string | null, e: UsageEntry): Promise<void> {
  if (p.demo) return;
  try {
    const day = e.at.slice(0, 10);
    const cls = e.status >= 500 ? 's5xx' : e.status >= 400 ? 's4xx' : 's2xx';
    await incrDoc(USAGE_COLLECTION, `${p.keyId}:${day}`, { total: 1, [cls]: 1 }, ownerRef);
    const prev = (await getDoc<LogDoc>(LOG_COLLECTION, p.keyId))?.data;
    const entries = [{ ...e, path: e.path.slice(0, 160) }, ...(prev?.entries ?? [])].slice(0, LOG_SIZE);
    await putDoc<LogDoc>(LOG_COLLECTION, p.keyId, { keyId: p.keyId, entries }, ownerRef);
  } catch {
    /* journal indisponible : sans conséquence pour l'appelant */
  }
}

export interface KeyUsage {
  keyId: string;
  /** les 30 derniers jours, du plus ancien au plus récent (jours sans appel compris) */
  days: { date: string; total: number; errors: number }[];
  total30: number;
  recent: UsageEntry[];
}

export async function usageFor(keyId: string, now: Date = new Date(), days = 30): Promise<KeyUsage> {
  const out: KeyUsage['days'] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now.getTime() - i * DAY_MS).toISOString().slice(0, 10);
    const d = (await getDoc<Record<string, number>>(USAGE_COLLECTION, `${keyId}:${date}`).catch(() => null))?.data;
    out.push({ date, total: d?.total ?? 0, errors: (d?.s4xx ?? 0) + (d?.s5xx ?? 0) });
  }
  const recent = (await getDoc<LogDoc>(LOG_COLLECTION, keyId).catch(() => null))?.data?.entries ?? [];
  return { keyId, days: out, total30: out.reduce((s, d) => s + d.total, 0), recent };
}
