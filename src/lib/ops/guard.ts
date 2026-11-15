/**
 * Garde-fou de coûts : quand la dépense estimée du jour dépasse OPS_DAILY_COST_CAP_EUR, les tâches NON URGENTES
 * de la file sont mises en pause jusqu'au lendemain (minuit de Paris), les urgentes continuent :
 *   priorité ≤ 3 = urgentes (audit.run après achat, webhook.deliver, tasks.generate) — src/lib/jobs/types.ts.
 * L'admin peut lever la pause pour la journée (/admin/ops). État : `ops.state` / `guard`.
 *
 * Mise en œuvre sans toucher à src/lib/jobs : `pausableBackend()` enveloppe la persistance passée au worker
 * (/api/cron/worker) ; une tâche non urgente réservée pendant la pause est reprogrammée au lendemain et sa
 * tentative est rendue (Supabase), pour qu'une pause ne la rapproche pas de l'abandon.
 */
import { createClient } from '@supabase/supabase-js';
import type { Job, JobBackend } from '@/lib/jobs';
import { getDoc, putDoc } from '@/lib/store';
import { OPS, nextParisDayStart, parisDay } from './config';

export const URGENT_MAX_PRIORITY = 3;

export interface GuardState {
  /** Jour de Paris pendant lequel la pause s'applique. */
  pausedDay: string | null;
  reason: string | null;
  since: string | null;
  /** Jour pour lequel l'admin a levé la pause. */
  overrideDay: string | null;
  deferred: number;
}

const EMPTY: GuardState = { pausedDay: null, reason: null, since: null, overrideDay: null, deferred: 0 };

export async function guardState(): Promise<GuardState> {
  return { ...EMPTY, ...((await getDoc<GuardState>(OPS.state, 'guard'))?.data ?? {}) };
}

export function isPausedState(s: GuardState, now: Date = new Date()): boolean {
  const day = parisDay(now);
  return s.pausedDay === day && s.overrideDay !== day;
}

export async function isCostPaused(now: Date = new Date()): Promise<boolean> {
  try {
    return isPausedState(await guardState(), now);
  } catch {
    return false; // store illisible : on ne bloque pas la file
  }
}

/** Déclenche la pause du jour (idempotent). Renvoie true si elle vient d'être posée. */
export async function pauseForToday(reason: string, now: Date = new Date()): Promise<boolean> {
  const s = await guardState();
  const day = parisDay(now);
  if (s.pausedDay === day) return false;
  await putDoc<GuardState>(OPS.state, 'guard', { ...s, pausedDay: day, reason: reason.slice(0, 300), since: now.toISOString(), deferred: 0 });
  return true;
}

/** Action admin : lever la pause pour aujourd'hui (elle peut revenir demain si le plafond est de nouveau dépassé). */
export async function overrideToday(now: Date = new Date()): Promise<void> {
  const s = await guardState();
  await putDoc<GuardState>(OPS.state, 'guard', { ...s, overrideDay: parisDay(now) });
}

/** Action admin : annuler la levée (la pause s'applique de nouveau si le plafond est dépassé). */
export async function clearOverride(): Promise<void> {
  const s = await guardState();
  await putDoc<GuardState>(OPS.state, 'guard', { ...s, overrideDay: null });
}

async function addDeferred(n: number): Promise<void> {
  if (n <= 0) return;
  try {
    const s = await guardState();
    await putDoc<GuardState>(OPS.state, 'guard', { ...s, deferred: (s.deferred ?? 0) + n });
  } catch {
    /* compteur indicatif */
  }
}

/** Rend la tentative consommée par la réservation (Supabase). Mémoire : sans objet (démo). */
async function refundAttempt(job: Job): Promise<void> {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) return;
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  await sb.from('jobs').update({ attempts: Math.max(0, job.attempts - 1) }).eq('id', job.id).eq('status', 'queued');
}

export interface PausableOptions {
  isPaused?: () => Promise<boolean>;
  now?: () => Date;
  refund?: (job: Job) => Promise<void>;
}

/**
 * Enveloppe une persistance de file : pendant la pause, seules les tâches urgentes sortent de `claim`.
 * La file étant servie par priorité croissante, une réservation qui ne contient que des tâches non urgentes
 * signifie qu'il n'y a plus d'urgente prête : le worker s'arrête alors (« empty »).
 */
export function pausableBackend(inner: JobBackend, opts: PausableOptions = {}): JobBackend {
  const paused = opts.isPaused ?? (() => isCostPaused());
  const now = opts.now ?? (() => new Date());
  const refund = opts.refund ?? refundAttempt;
  return {
    get kind() {
      return inner.kind;
    },
    insert: (j) => inner.insert(j),
    complete: (id, w, r) => inner.complete(id, w, r),
    retry: (id, w, e, at) => inner.retry(id, w, e, at),
    kill: (id, w, e) => inner.kill(id, w, e),
    get: (id) => inner.get(id),
    stats: () => inner.stats(),
    listByBusiness: (b, l) => inner.listByBusiness(b, l),
    deleteByBusiness: (b) => inner.deleteByBusiness(b),
    async claim(workerId, limit, leaseMs) {
      const claimed = await inner.claim(workerId, limit, leaseMs);
      if (!claimed.length || !(await paused())) return claimed;
      const keep: Job[] = [];
      const resumeAt = new Date(nextParisDayStart(now()).getTime() + 5 * 60_000);
      let deferred = 0;
      for (const job of claimed) {
        if (job.priority <= URGENT_MAX_PRIORITY) {
          keep.push(job);
          continue;
        }
        try {
          await inner.retry(job.id, workerId, 'En pause : plafond de coût journalier atteint (reprise demain).', resumeAt);
          await refund(job).catch(() => undefined);
          deferred += 1;
        } catch {
          keep.push(job); // impossible de la reporter : on l'exécute plutôt que de la laisser verrouillée
        }
      }
      await addDeferred(deferred);
      return keep;
    },
  };
}
