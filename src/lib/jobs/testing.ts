/**
 * Aides de test pour la file en mémoire (remplacent les anciens adaptateurs locaux `listLocalJobs` /
 * `runDueLocalJobs` de src/lib/notify/platform.ts). Ne pas importer depuis le code de production.
 */
import { createMemoryBackend } from './backend-memory';
import { jobBackend, runWorker, setJobBackend } from './index';
import type { Job, JobType } from './types';

const g = globalThis as unknown as { __repereJobsTestClock?: number | null };

/** Installe une file mémoire dont l'horloge peut être avancée par `runDueLocalJobs(now)`. */
export function useMemoryJobs(): void {
  g.__repereJobsTestClock = null;
  setJobBackend(createMemoryBackend(() => g.__repereJobsTestClock ?? Date.now()));
}

/** Tâches de la file mémoire (toutes, ou d'un type). */
export async function listLocalJobs(type?: JobType): Promise<Job[]> {
  const b = jobBackend() as unknown as { all?: () => Job[] };
  return (b.all?.() ?? []).filter((j) => !type || j.type === type);
}

/** Exécute les tâches dues à la date `now` ; renvoie le nombre de tâches traitées (du type demandé). */
export async function runDueLocalJobs(now: Date = new Date(), type?: JobType): Promise<number> {
  g.__repereJobsTestClock = now.getTime();
  try {
    const r = await runWorker({ now: () => now.getTime(), budgetMs: Number.MAX_SAFE_INTEGER });
    return r.jobs.filter((j) => !type || j.type === type).length;
  } finally {
    g.__repereJobsTestClock = null;
  }
}
