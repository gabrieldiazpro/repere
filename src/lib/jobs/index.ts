/**
 * @/lib/jobs — file de tâches de Repéré (contrat docs/v3/12-CONTRATS-V3.md).
 *
 *   enqueue(type, payload, { runAt, dedupeKey, businessId })  → { id }
 *   registerHandler(type, handler)
 *
 * - Avec Supabase (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY) : table `jobs` (supabase/migrations/0004_jobs.sql),
 *   exécutée par le worker `/api/cron/worker` (cron Vercel, pg_cron chaque minute, et coup de pouce `after()` pour
 *   les tâches urgentes). Réservation `for update skip locked`, bail, backoff, abandon après N tentatives.
 * - Sans base (démo, développement, tests) : file en mémoire, **exécution immédiate** pendant `await enqueue(…)`
 *   (même API) ; les tâches différées (`runAt`) sont réveillées par une minuterie.
 *
 * Les gestionnaires reçoivent la charge utile enfilée + `_job` (id, tentative, signal d'annulation) et doivent être
 * idempotents. Les gestionnaires par défaut (src/lib/jobs/handlers.ts) sont installés au premier usage ; un module
 * qui appelle `registerHandler` pour le même type les remplace.
 */
import { log } from '@/lib/log';
import { createMemoryBackend, nextRunAt } from './backend-memory';
import { createSupabaseBackend } from './backend-supabase';
import { getHandler, isJobType, registerHandler, registeredTypes, unregisterHandler } from './registry';
import { runWorker as runWorkerWith, type WorkerOptions, type WorkerReport } from './worker';
import { DEFAULT_PRIORITY, PermanentJobError, type EnqueueOptions, type Job, type JobBackend, type JobStats, type JobType } from './types';

export { registerHandler, getHandler, registeredTypes, unregisterHandler, isJobType, PermanentJobError };
export { backoffDelay } from './worker';
export type { Job, JobBackend, JobContext, JobHandler, JobPayload, JobStats, JobStatus, JobType, EnqueueOptions } from './types';
export type { WorkerReport } from './worker';
export { JOB_TYPES } from './types';

const MAX_PAYLOAD_BYTES = 64 * 1024;

function numEnv(k: string, def: number): number {
  const v = process.env[k];
  const n = v === undefined || v === '' ? NaN : Number(v);
  return Number.isFinite(n) && n >= 0 ? n : def;
}

export function jobsConfig() {
  return {
    budgetMs: numEnv('JOBS_WORKER_BUDGET_MS', 240_000),
    timeoutMs: numEnv('JOBS_TIMEOUT_MS', 90_000),
    batch: numEnv('JOBS_BATCH', 10),
    concurrency: numEnv('JOBS_CONCURRENCY', 2),
    maxAttempts: Math.max(1, numEnv('JOBS_MAX_ATTEMPTS', 5)),
    backoffBaseMs: numEnv('JOBS_BACKOFF_BASE_MS', 60_000),
    kick: (process.env.JOBS_KICK ?? 'on') !== 'off',
  };
}

// ---------------------------------------------------------------------------
// Persistance
// ---------------------------------------------------------------------------

type MemoryBackend = ReturnType<typeof createMemoryBackend>;
const g = globalThis as unknown as {
  __repereJobs?: { backend: JobBackend | null; draining: boolean; wake: ReturnType<typeof setTimeout> | null; builtins: boolean };
};
const state = (g.__repereJobs ??= { backend: null, draining: false, wake: null, builtins: false });

function supabaseEnv(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return url && key ? { url, key } : null;
}

export function jobBackend(): JobBackend {
  if (!state.backend) {
    const sb = supabaseEnv();
    state.backend = sb ? createSupabaseBackend(sb.url, sb.key) : createMemoryBackend();
  }
  return state.backend;
}

/** Tests : impose une persistance (ex. `createMemoryBackend(horloge)`), ou `null` pour revenir au choix automatique. */
export function setJobBackend(b: JobBackend | null): void {
  if (state.wake) clearTimeout(state.wake);
  state.wake = null;
  state.draining = false;
  state.backend = b;
}

export { createMemoryBackend };

async function ensureBuiltins(): Promise<void> {
  if (state.builtins) return;
  state.builtins = true;
  try {
    const { installBuiltinHandlers } = await import('./handlers');
    installBuiltinHandlers();
  } catch (e) {
    log.error('jobs.builtins_failed', e);
  }
}

/** Tests : n'installe pas les gestionnaires par défaut. */
export function disableBuiltinHandlers(): void {
  state.builtins = true;
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

function cleanPayload(payload: Record<string, unknown>): Record<string, unknown> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('[jobs] la charge utile doit être un objet');
  const json = JSON.stringify(payload, (k, v) => (k === '_job' ? undefined : v));
  if (json.length > MAX_PAYLOAD_BYTES) throw new Error(`[jobs] charge utile trop volumineuse (${json.length} octets, max ${MAX_PAYLOAD_BYTES})`);
  return JSON.parse(json) as Record<string, unknown>;
}

/**
 * Met une tâche en file. Avec `dedupeKey`, une seconde mise en file renvoie l'identifiant de la tâche existante
 * (quel que soit son statut) : c'est la garde d'idempotence des crons et des webhooks.
 */
export async function enqueue(
  type: JobType,
  payload: Record<string, unknown>,
  opts: EnqueueOptions = {},
): Promise<{ id: string }> {
  if (!isJobType(type)) throw new Error(`[jobs] type inconnu : ${String(type)}`);
  const cfg = jobsConfig();
  const runAt = opts.runAt && !Number.isNaN(opts.runAt.getTime()) ? opts.runAt : new Date();
  const businessId = opts.businessId ?? (typeof payload?.businessId === 'string' ? (payload.businessId as string) : null);
  const backend = jobBackend();
  const { job, created } = await backend.insert({
    type,
    payload: cleanPayload(payload),
    businessId,
    dedupeKey: opts.dedupeKey ? opts.dedupeKey.slice(0, 300) : null,
    priority: opts.priority ?? DEFAULT_PRIORITY[type],
    maxAttempts: opts.maxAttempts ?? cfg.maxAttempts,
    runAt,
  });
  if (created) {
    log.debug('job.enqueued', { jobId: job.id, jobType: type, businessId: businessId ?? undefined, runAt: job.runAt });
    if (backend.kind === 'memory') {
      if (runAt.getTime() <= Date.now()) await drainMemory();
      else scheduleWake();
    } else if (cfg.kick && runAt.getTime() <= Date.now() + 1000 && job.priority <= 3) {
      await kickWorker();
    }
  }
  return { id: job.id };
}

export async function getJob(id: string): Promise<Job | null> {
  if (!id || id.length > 100) return null;
  return jobBackend().get(id);
}

export async function jobStats(): Promise<JobStats> {
  return jobBackend().stats();
}

export async function listJobsForBusiness(businessId: string, limit = 500): Promise<Job[]> {
  return jobBackend().listByBusiness(businessId, limit);
}

export async function deleteJobsForBusiness(businessId: string): Promise<number> {
  return jobBackend().deleteByBusiness(businessId);
}

/** Exécute les tâches dues (route /api/cron/worker, crons, tests). */
export async function runWorker(opts: Partial<Omit<WorkerOptions, 'backend'>> & { backend?: JobBackend } = {}): Promise<WorkerReport> {
  await ensureBuiltins();
  const cfg = jobsConfig();
  return runWorkerWith({
    budgetMs: cfg.budgetMs,
    timeoutMs: cfg.timeoutMs,
    batch: cfg.batch,
    concurrency: cfg.concurrency,
    backoffBaseMs: cfg.backoffBaseMs,
    ...opts,
    backend: opts.backend ?? jobBackend(),
  });
}

// ---------------------------------------------------------------------------
// Mémoire : exécution immédiate, réveil des tâches différées
// ---------------------------------------------------------------------------

async function drainMemory(): Promise<void> {
  // Une mise en file depuis un gestionnaire en cours : la boucle extérieure la prendra au tour suivant.
  if (state.draining) return;
  state.draining = true;
  try {
    await runWorker({ budgetMs: Number.MAX_SAFE_INTEGER, workerId: 'memory' });
  } finally {
    state.draining = false;
    scheduleWake();
  }
}

function scheduleWake(): void {
  const backend = state.backend;
  if (!backend || backend.kind !== 'memory') return;
  const next = nextRunAt((backend as MemoryBackend).all());
  if (state.wake) clearTimeout(state.wake);
  state.wake = null;
  if (next === null) return;
  const delay = Math.min(Math.max(0, next - Date.now()) + 5, 2 ** 31 - 1);
  state.wake = setTimeout(() => {
    state.wake = null;
    void drainMemory();
  }, delay);
  (state.wake as { unref?: () => void }).unref?.();
}

/** Supabase : lance un petit worker après la réponse HTTP (`after()` de Next), sans bloquer l'appelant. */
async function kickWorker(): Promise<void> {
  try {
    const { after } = await import('next/server');
    after(() => runWorker({ budgetMs: 55_000, maxJobs: 3 }).then(() => undefined).catch(() => undefined));
  } catch {
    /* hors requête (script, test) : le prochain passage du worker s'en charge */
  }
}

/** Tests : vide la file mémoire et oublie les gestionnaires enregistrés. */
export function resetJobsForTests(): void {
  setJobBackend(createMemoryBackend());
  unregisterHandler();
  state.builtins = true;
}
