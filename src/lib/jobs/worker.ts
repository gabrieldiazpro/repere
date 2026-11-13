/**
 * Worker de la file : réserve des tâches (verrou + bail), les exécute avec un délai maximal par tâche,
 * marque `done`, ou reprogramme avec backoff exponentiel, ou abandonne (`dead`) après `maxAttempts`.
 *
 * Garanties : « au moins une fois ». Une tâche peut être rejouée (plantage, délai, bail expiré) : les gestionnaires
 * sont idempotents (clés d'unicité, marqueurs d'exécution). Le worker ne lève jamais.
 */
import { captureError, log } from '@/lib/log';
import { getHandler } from './registry';
import { PermanentJobError, type Job, type JobBackend, type JobContext } from './types';

export interface WorkerOptions {
  backend: JobBackend;
  workerId?: string;
  /** Temps total accordé au worker (ms). Aucune tâche n'est démarrée s'il reste moins de `timeoutMs`. */
  budgetMs?: number;
  /** Tâches réservées par tour. */
  batch?: number;
  /** Tâches exécutées en parallèle dans un tour. */
  concurrency?: number;
  /** Délai maximal d'une tâche (ms) : au-delà, elle est annulée et reprogrammée. */
  timeoutMs?: number;
  /** Base du backoff (ms) : base × 2^(tentative−1), plafonné à 6 h, ±10 %. */
  backoffBaseMs?: number;
  /** Nombre maximal de tâches traitées par cet appel. */
  maxJobs?: number;
  now?: () => number;
  random?: () => number;
}

export interface WorkerJobOutcome {
  id: string;
  type: Job['type'];
  attempt: number;
  status: 'done' | 'retry' | 'dead';
  durationMs: number;
  error?: string;
}

export interface WorkerReport {
  workerId: string;
  processed: number;
  done: number;
  retried: number;
  dead: number;
  durationMs: number;
  stoppedBy: 'empty' | 'budget' | 'maxJobs';
  jobs: WorkerJobOutcome[];
}

const MAX_BACKOFF_MS = 6 * 3600_000;

export function backoffDelay(attempt: number, baseMs: number, random: () => number = Math.random): number {
  const raw = Math.min(MAX_BACKOFF_MS, baseMs * 2 ** Math.max(0, attempt - 1));
  const jitter = 1 + (random() * 0.2 - 0.1);
  return Math.max(1000, Math.round(raw * jitter));
}

export class JobTimeoutError extends Error {
  constructor(ms: number) {
    super(`délai dépassé (${Math.round(ms / 1000)} s)`);
    this.name = 'JobTimeoutError';
  }
}

function errorMessage(e: unknown): string {
  const m = e instanceof Error ? `${e.name === 'Error' ? '' : `${e.name} : `}${e.message}` : String(e);
  return m.slice(0, 2000);
}

async function runOne(job: Job, o: Required<Omit<WorkerOptions, 'workerId' | 'maxJobs'>> & { workerId: string }): Promise<WorkerJobOutcome> {
  const started = o.now();
  const controller = new AbortController();
  const ctx: JobContext = { id: job.id, type: job.type, attempt: job.attempts, maxAttempts: job.maxAttempts, signal: controller.signal };
  const jlog = log.child({ jobId: job.id, jobType: job.type, attempt: job.attempts, businessId: job.businessId ?? undefined });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const handler = getHandler(job.type);
    if (!handler) throw new Error(`aucun gestionnaire enregistré pour « ${job.type} »`);
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new JobTimeoutError(o.timeoutMs));
      }, o.timeoutMs);
      (timer as { unref?: () => void }).unref?.();
    });
    const result = await Promise.race([handler({ ...job.payload, _job: ctx }), timeout]);
    await o.backend.complete(job.id, o.workerId, result && typeof result === 'object' ? (result as Record<string, unknown>) : null);
    jlog.info('job.done', { durationMs: o.now() - started });
    return { id: job.id, type: job.type, attempt: job.attempts, status: 'done', durationMs: o.now() - started };
  } catch (e) {
    const message = errorMessage(e);
    const permanent = e instanceof PermanentJobError;
    const durationMs = o.now() - started;
    try {
      if (permanent || job.attempts >= job.maxAttempts) {
        await o.backend.kill(job.id, o.workerId, message);
        captureError(e, { event: 'job.dead', jobId: job.id, jobType: job.type, attempt: job.attempts, businessId: job.businessId ?? undefined });
        return { id: job.id, type: job.type, attempt: job.attempts, status: 'dead', durationMs, error: message };
      }
      const delay = backoffDelay(job.attempts, o.backoffBaseMs, o.random);
      await o.backend.retry(job.id, o.workerId, message, new Date(o.now() + delay));
      jlog.warn('job.retry', { error: message, retryInMs: delay });
      return { id: job.id, type: job.type, attempt: job.attempts, status: 'retry', durationMs, error: message };
    } catch (e2) {
      // La base est injoignable : le bail expirera et la tâche sera reprise.
      captureError(e2, { event: 'job.state_write_failed', jobId: job.id, jobType: job.type });
      return { id: job.id, type: job.type, attempt: job.attempts, status: 'retry', durationMs, error: message };
    }
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Exécute des tâches jusqu'à épuisement de la file, du budget ou de `maxJobs`. */
export async function runWorker(opts: WorkerOptions): Promise<WorkerReport> {
  const now = opts.now ?? Date.now;
  const o = {
    backend: opts.backend,
    workerId: opts.workerId ?? `w-${crypto.randomUUID().slice(0, 8)}`,
    budgetMs: opts.budgetMs ?? 240_000,
    batch: Math.max(1, opts.batch ?? 10),
    concurrency: Math.max(1, opts.concurrency ?? 2),
    timeoutMs: Math.max(100, opts.timeoutMs ?? 90_000),
    backoffBaseMs: opts.backoffBaseMs ?? 60_000,
    now,
    random: opts.random ?? Math.random,
  };
  const maxJobs = opts.maxJobs ?? Infinity;
  const started = now();
  const outcomes: WorkerJobOutcome[] = [];
  let stoppedBy: WorkerReport['stoppedBy'] = 'empty';
  // Bail = délai d'une tâche + marge : une tâche « running » orpheline redevient prenable ensuite.
  const leaseMs = o.timeoutMs + 30_000;

  for (;;) {
    const remaining = o.budgetMs - (now() - started);
    if (remaining < o.timeoutMs) {
      stoppedBy = 'budget';
      break;
    }
    if (outcomes.length >= maxJobs) {
      stoppedBy = 'maxJobs';
      break;
    }
    let claimed: Job[];
    try {
      // Un tour = au plus `concurrency` tâches : le budget restant est revérifié avant chaque tour, aucune tâche
      // réservée n'attend son tour au-delà du budget (elle resterait verrouillée jusqu'à l'expiration du bail).
      claimed = await o.backend.claim(o.workerId, Math.min(o.batch, o.concurrency, maxJobs - outcomes.length), leaseMs);
    } catch (e) {
      captureError(e, { event: 'jobs.claim_failed' });
      break;
    }
    if (claimed.length === 0) {
      stoppedBy = 'empty';
      break;
    }
    // Pool de `concurrency` exécutions simultanées, dans l'ordre de réservation.
    let next = 0;
    const lane = async () => {
      while (next < claimed.length) {
        const job = claimed[next++];
        outcomes.push(await runOne(job, o));
      }
    };
    await Promise.all(Array.from({ length: Math.min(o.concurrency, claimed.length) }, lane));
  }

  return {
    workerId: o.workerId,
    processed: outcomes.length,
    done: outcomes.filter((x) => x.status === 'done').length,
    retried: outcomes.filter((x) => x.status === 'retry').length,
    dead: outcomes.filter((x) => x.status === 'dead').length,
    durationMs: now() - started,
    stoppedBy,
    jobs: outcomes,
  };
}
