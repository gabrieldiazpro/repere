/**
 * État de santé (utilisé par /api/health, /api/health/deep, /statut et le contrôle périodique).
 *
 * `computeHealth()` est pure (testée) ; `gatherHealth()` collecte les mesures : ping de la base (4 s max),
 * compteurs de la file, dernier passage du worker, briques configurées (booléens, jamais une valeur).
 */
import { createClient } from '@supabase/supabase-js';
import { validateEnv } from '@/lib/env';
import { jobStats, type JobStats } from '@/lib/jobs';
import { getHeartbeat, type Heartbeat } from './heartbeat';
import { opsConfig } from './config';

export type Level = 'ok' | 'warn' | 'fail';

export const AI_KEYS = {
  chatgpt: 'OPENAI_API_KEY',
  perplexity: 'PERPLEXITY_API_KEY',
  gemini: 'GEMINI_API_KEY',
  claude: 'ANTHROPIC_API_KEY',
  mistral: 'MISTRAL_API_KEY',
} as const;
export type AiName = keyof typeof AI_KEYS;

export interface DbProbe {
  level: Level;
  backend: 'supabase' | 'memory';
  ms?: number;
  error?: string;
}

export interface HealthInput {
  now: Date;
  env: Record<string, string | undefined>;
  db: DbProbe;
  jobs: { stats: JobStats | null; error?: string };
  worker: Heartbeat | null;
}

export interface HealthReport {
  status: Level;
  mode: 'demo' | 'development' | 'production';
  time: string;
  checks: { db: Level; env: Level; jobs: Level; cron: Level };
  cron: { lastWorkerAt: string | null; ageMin: number | null; ok: boolean | null };
  configured: { ai: Record<AiName, boolean>; aiCount: number; stripe: boolean; resend: boolean; sentry: boolean; alerts: boolean };
  /** Détails réservés aux appels authentifiés. */
  detail: {
    db: DbProbe;
    jobs: { stats: JobStats | null; error?: string };
    env: { errors: string[]; warnings: string[]; missing: string[] };
  };
}

const has = (env: Record<string, string | undefined>, k: string) => Boolean(env[k]?.trim());

export function computeHealth(i: HealthInput): HealthReport {
  const envR = validateEnv(i.env);
  const cfg = opsConfig(i.env);
  const envLevel: Level = !envR.ok ? 'fail' : envR.warnings.length ? 'warn' : 'ok';

  let jobsLevel: Level = 'ok';
  if (!i.jobs.stats) jobsLevel = 'fail';
  else if (i.jobs.stats.dead > 0 || (i.jobs.stats.oldestQueuedMin !== null && i.jobs.stats.oldestQueuedMin > 30)) jobsLevel = 'warn';

  // Le worker n'a de sens qu'avec une vraie file (Supabase) : en mémoire, les tâches s'exécutent aussitôt.
  const ageMin = i.worker ? Math.max(0, Math.round((i.now.getTime() - new Date(i.worker.at).getTime()) / 60_000)) : null;
  let cronLevel: Level = 'ok';
  if (i.db.backend === 'supabase') {
    if (ageMin === null) cronLevel = 'warn';
    else if (ageMin > cfg.cronMaxAgeMin || i.worker?.ok === false) cronLevel = 'warn';
  }

  const levels = [i.db.level, envLevel, jobsLevel, cronLevel];
  const status: Level = levels.includes('fail') ? 'fail' : levels.includes('warn') ? 'warn' : 'ok';
  const ai = Object.fromEntries(Object.entries(AI_KEYS).map(([n, k]) => [n, has(i.env, k)])) as Record<AiName, boolean>;
  return {
    status,
    mode: envR.mode,
    time: i.now.toISOString(),
    checks: { db: i.db.level, env: envLevel, jobs: jobsLevel, cron: cronLevel },
    cron: { lastWorkerAt: i.worker?.at ?? null, ageMin, ok: i.worker ? i.worker.ok : null },
    configured: {
      ai,
      aiCount: Object.values(ai).filter(Boolean).length,
      stripe: has(i.env, 'STRIPE_SECRET_KEY') && has(i.env, 'STRIPE_WEBHOOK_SECRET'),
      resend: has(i.env, 'RESEND_API_KEY'),
      sentry: has(i.env, 'SENTRY_DSN'),
      alerts: Boolean(cfg.alertEmail),
    },
    detail: { db: i.db, jobs: i.jobs, env: { errors: envR.errors, warnings: envR.warnings, missing: envR.missing } },
  };
}

export async function pingDb(timeoutMs = 4000): Promise<DbProbe> {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) return { level: 'ok', backend: 'memory' };
  const t0 = Date.now();
  try {
    const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await sb.from('businesses').select('id').limit(1).abortSignal(AbortSignal.timeout(timeoutMs));
    if (error) return { level: 'fail', backend: 'supabase', ms: Date.now() - t0, error: error.message.slice(0, 200) };
    return { level: 'ok', backend: 'supabase', ms: Date.now() - t0 };
  } catch (e) {
    return { level: 'fail', backend: 'supabase', ms: Date.now() - t0, error: e instanceof Error ? e.message.slice(0, 200) : 'erreur' };
  }
}

export async function gatherHealth(now: Date = new Date()): Promise<HealthReport> {
  const [db, jobs, worker] = await Promise.all([
    pingDb(),
    jobStats().then(
      (stats) => ({ stats }),
      () => ({ stats: null, error: 'file de tâches illisible (migration 0004 appliquée ?)' }),
    ),
    getHeartbeat('worker').catch(() => null),
  ]);
  return computeHealth({ now, env: process.env, db, jobs, worker });
}

const g = globalThis as unknown as { __repereHealthCache?: { at: number; report: HealthReport } | null };

/** Version mise en cache quelques secondes (route publique, page /statut) : protège la base des rafales. */
export async function cachedHealth(maxAgeMs = 15_000): Promise<HealthReport> {
  const c = g.__repereHealthCache;
  if (c && Date.now() - c.at < maxAgeMs) return c.report;
  const report = await gatherHealth();
  g.__repereHealthCache = { at: Date.now(), report };
  return report;
}

/** Corps public de /api/health : niveaux et briques configurées (booléens), aucun détail sensible. */
export function publicHealth(r: HealthReport) {
  return {
    status: r.status,
    mode: r.mode,
    time: r.time,
    checks: r.checks,
    lastCron: r.cron.lastWorkerAt,
    configured: r.configured,
  };
}
