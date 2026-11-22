/**
 * GET /api/health — surveillance (moniteur de disponibilité gratuit, voir docs/MISE-EN-LIGNE.md « Supervision »).
 *
 * - Public, rapide (mis en cache 15 s, ping base ≤ 4 s), sans secret :
 *   `{ status, mode, time, checks: { db, env, jobs, cron }, lastCron, configured: { ai, aiCount, stripe, resend, … } }`
 *   (niveaux ok / warn / fail ; briques configurées en booléens, jamais une valeur).
 * - Avec `Authorization: Bearer <CRON_SECRET>` : en plus `release`, `db`, `env` (noms des variables en défaut),
 *   `jobs` (compteurs), `keys` (forme historique lue par scripts/ops/verifier-prod.mjs). Contrôle approfondi :
 *   /api/health/deep.
 * Code HTTP : 200 si ok ou warn, 503 si une vérification échoue (le moniteur alerte).
 * Chaque appel peut déclencher, après la réponse, le contrôle périodique des alertes (au plus toutes les 5 min).
 */
import { NextResponse } from 'next/server';
import { afterResponse, cachedHealth, gatherHealth, hasCronBearer, publicHealth, runOpsTick } from '@/lib/ops';
import { HOUR_MS, getClientIp, rateLimit } from '@/lib/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function detailed(req: Request): boolean {
  if (!process.env.CRON_SECRET) return process.env.NODE_ENV !== 'production';
  return hasCronBearer(req);
}

export async function GET(req: Request) {
  const full = detailed(req);
  // F4 de qa/v3/securite-v3.md : route publique bornée (la surveillance authentifiée n'est pas limitée).
  if (!full) {
    const rl = await rateLimit('health', getClientIp(req), 120, HOUR_MS);
    if (!rl.ok) return NextResponse.json({ status: 'limited' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } });
  }
  const r = full ? await gatherHealth() : await cachedHealth();
  const body: Record<string, unknown> = publicHealth(r);
  if (full) {
    const d = r.detail;
    body.release = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null;
    body.db = d.db;
    body.env = d.env;
    body.jobs = { level: r.checks.jobs, ...(d.jobs.stats ? { stats: d.jobs.stats } : {}), ...(d.jobs.error ? { error: d.jobs.error } : {}) };
    body.cron = r.cron;
    body.keys = {
      supabase: d.db.backend === 'supabase',
      stripe: r.configured.stripe,
      resend: r.configured.resend,
      sentry: r.configured.sentry,
      cron: Boolean(process.env.CRON_SECRET?.trim()),
      alerts: r.configured.alerts,
      ai: r.configured.ai,
      aiOptional: r.configured.aiOptional,
    };
  }
  afterResponse(() => runOpsTick());
  return NextResponse.json(body, {
    status: r.status === 'fail' ? 503 : 200,
    headers: { 'cache-control': 'no-store', 'x-robots-tag': 'noindex' },
  });
}

/** HEAD : certains moniteurs gratuits ne font que HEAD ; même code HTTP, sans corps. */
export async function HEAD(req: Request) {
  const res = await GET(req);
  return new Response(null, { status: res.status, headers: res.headers });
}
