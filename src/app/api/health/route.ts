/**
 * GET /api/health — surveillance (UptimeRobot, Better Stack…) : base, configuration, file de tâches.
 *
 * - Public : `{ status, mode, checks: { db, env, jobs } }` (ok / warn / fail), sans aucun détail sensible.
 * - Avec `Authorization: Bearer <CRON_SECRET>` : détail (briques configurées en booléens, erreurs de configuration
 *   par nom de variable, compteurs de la file). Jamais une valeur de secret.
 * Code HTTP : 200 si ok ou warn, 503 si une vérification échoue (alerte du moniteur).
 * Alerte file : au moins une tâche morte, ou une tâche prête qui attend depuis plus de 30 minutes.
 */
import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateEnv } from '@/lib/env';
import { jobStats } from '@/lib/jobs';
import { captureError } from '@/lib/log';
import { HOUR_MS, getClientIp, rateLimit } from '@/lib/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Level = 'ok' | 'warn' | 'fail';

function detailed(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== 'production';
  const a = Buffer.from(req.headers.get('authorization') ?? '');
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function pingDb(): Promise<{ level: Level; backend: 'supabase' | 'memory'; ms?: number; error?: string }> {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) return { level: 'ok', backend: 'memory' };
  const t0 = Date.now();
  try {
    const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await sb.from('businesses').select('id').limit(1).abortSignal(AbortSignal.timeout(4000));
    if (error) return { level: 'fail', backend: 'supabase', ms: Date.now() - t0, error: error.message.slice(0, 200) };
    return { level: 'ok', backend: 'supabase', ms: Date.now() - t0 };
  } catch (e) {
    return { level: 'fail', backend: 'supabase', ms: Date.now() - t0, error: e instanceof Error ? e.message.slice(0, 200) : 'erreur' };
  }
}

export async function GET(req: Request) {
  const full = detailed(req);
  // F4 de qa/v3/securite-v3.md : route publique bornée (la surveillance authentifiée n'est pas limitée).
  if (!full) {
    const rl = await rateLimit('health', getClientIp(req), 120, HOUR_MS);
    if (!rl.ok) return NextResponse.json({ status: 'limited' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } });
  }
  const env = validateEnv(process.env);
  const db = await pingDb();

  let jobs: { level: Level; stats?: Awaited<ReturnType<typeof jobStats>>; error?: string };
  try {
    const stats = await jobStats();
    const late = stats.oldestQueuedMin !== null && stats.oldestQueuedMin > 30;
    jobs = { level: stats.dead > 0 || late ? 'warn' : 'ok', stats };
  } catch (e) {
    captureError(e, { event: 'health.jobs_failed' });
    jobs = { level: 'fail', error: 'file de tâches illisible (migration 0004 appliquée ?)' };
  }

  const envLevel: Level = !env.ok ? 'fail' : env.warnings.length ? 'warn' : 'ok';
  const levels = [db.level, envLevel, jobs.level];
  const status: Level = levels.includes('fail') ? 'fail' : levels.includes('warn') ? 'warn' : 'ok';

  const has = (k: string) => Boolean(process.env[k]?.trim());
  const body: Record<string, unknown> = {
    status,
    mode: env.mode,
    time: new Date().toISOString(),
    checks: { db: db.level, env: envLevel, jobs: jobs.level },
  };
  if (full) {
    body.release = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null;
    body.db = db;
    body.env = { errors: env.errors, warnings: env.warnings, missing: env.missing };
    body.jobs = jobs;
    body.keys = {
      supabase: db.backend === 'supabase',
      stripe: has('STRIPE_SECRET_KEY') && has('STRIPE_WEBHOOK_SECRET'),
      resend: has('RESEND_API_KEY'),
      sentry: has('SENTRY_DSN'),
      cron: has('CRON_SECRET'),
      ai: {
        chatgpt: has('OPENAI_API_KEY'),
        perplexity: has('PERPLEXITY_API_KEY'),
        gemini: has('GEMINI_API_KEY'),
        claude: has('ANTHROPIC_API_KEY'),
        mistral: has('MISTRAL_API_KEY'),
      },
    };
  }
  return NextResponse.json(body, { status: status === 'fail' ? 503 : 200, headers: { 'cache-control': 'no-store' } });
}
