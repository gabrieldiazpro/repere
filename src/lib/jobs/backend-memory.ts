/**
 * File en mémoire (mode démo / sans base, tests). Même sémantique que la table `jobs` :
 * réservation atomique (JavaScript est mono-fil : la sélection et le marquage sont synchrones),
 * bail expirable, clé d'unicité, ordre priorité → run_at → création.
 */
import type { Job, JobBackend, JobStats, NewJob } from './types';

export function createMemoryBackend(clock: () => number = Date.now): JobBackend & { all(): Job[]; clear(): void } {
  const jobs = new Map<string, Job>();
  const byKey = new Map<string, string>();
  let seq = 0;
  const order = new Map<string, number>();
  const iso = (ms: number) => new Date(ms).toISOString();

  const guard = (id: string, workerId: string): Job | null => {
    const j = jobs.get(id);
    if (!j || j.status !== 'running' || j.lockedBy !== workerId) return null;
    return j;
  };

  return {
    kind: 'memory',
    async insert(n: NewJob) {
      if (n.dedupeKey) {
        const existing = byKey.get(n.dedupeKey);
        if (existing && jobs.has(existing)) return { job: structuredClone(jobs.get(existing)!), created: false };
      }
      const now = iso(clock());
      const job: Job = {
        id: crypto.randomUUID(),
        type: n.type,
        payload: structuredClone(n.payload),
        businessId: n.businessId,
        dedupeKey: n.dedupeKey,
        status: 'queued',
        priority: n.priority,
        attempts: 0,
        maxAttempts: n.maxAttempts,
        runAt: n.runAt.toISOString(),
        lockedBy: null,
        lockExpiresAt: null,
        lastError: null,
        result: null,
        createdAt: now,
        updatedAt: now,
        finishedAt: null,
      };
      jobs.set(job.id, job);
      order.set(job.id, seq++);
      if (n.dedupeKey) byKey.set(n.dedupeKey, job.id);
      return { job: structuredClone(job), created: true };
    },
    async claim(workerId, limit, leaseMs) {
      const now = clock();
      const ready = [...jobs.values()]
        .filter(
          (j) =>
            (j.status === 'queued' && Date.parse(j.runAt) <= now) ||
            (j.status === 'running' && j.lockExpiresAt !== null && Date.parse(j.lockExpiresAt) < now),
        )
        .sort((a, b) => a.priority - b.priority || a.runAt.localeCompare(b.runAt) || order.get(a.id)! - order.get(b.id)!)
        .slice(0, Math.max(0, limit));
      for (const j of ready) {
        j.status = 'running';
        j.attempts += 1;
        j.lockedBy = workerId;
        j.lockExpiresAt = iso(now + leaseMs);
        j.updatedAt = iso(now);
      }
      return ready.map((j) => structuredClone(j));
    },
    async complete(id, workerId, result) {
      const j = guard(id, workerId);
      if (!j) return;
      const now = iso(clock());
      Object.assign(j, { status: 'done', result, lockedBy: null, lockExpiresAt: null, updatedAt: now, finishedAt: now, lastError: null });
    },
    async retry(id, workerId, error, runAt) {
      const j = guard(id, workerId);
      if (!j) return;
      Object.assign(j, { status: 'queued', lastError: error, runAt: runAt.toISOString(), lockedBy: null, lockExpiresAt: null, updatedAt: iso(clock()) });
    },
    async kill(id, workerId, error) {
      const j = guard(id, workerId);
      if (!j) return;
      const now = iso(clock());
      Object.assign(j, { status: 'dead', lastError: error, lockedBy: null, lockExpiresAt: null, updatedAt: now, finishedAt: now });
    },
    async get(id) {
      const j = jobs.get(id);
      return j ? structuredClone(j) : null;
    },
    async stats(): Promise<JobStats> {
      const now = clock();
      const s: JobStats = { queued: 0, running: 0, done: 0, dead: 0, oldestQueuedMin: null, backend: 'memory' };
      let oldest: number | null = null;
      for (const j of jobs.values()) {
        s[j.status] += 1;
        if (j.status === 'queued') {
          const t = Date.parse(j.runAt);
          if (t <= now && (oldest === null || t < oldest)) oldest = t;
        }
      }
      s.oldestQueuedMin = oldest === null ? null : Math.floor((now - oldest) / 60_000);
      return s;
    },
    async listByBusiness(businessId, limit = 500) {
      return [...jobs.values()]
        .filter((j) => j.businessId === businessId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit)
        .map((j) => structuredClone(j));
    },
    async deleteByBusiness(businessId) {
      let n = 0;
      for (const [id, j] of jobs) {
        if (j.businessId !== businessId) continue;
        jobs.delete(id);
        if (j.dedupeKey) byKey.delete(j.dedupeKey);
        n++;
      }
      return n;
    },
    all() {
      return [...jobs.values()].map((j) => structuredClone(j));
    },
    clear() {
      jobs.clear();
      byKey.clear();
      order.clear();
    },
  };
}

/** Prochaine échéance (ms) d'une tâche en attente, pour réveiller la file mémoire. */
export function nextRunAt(jobs: Job[]): number | null {
  let next: number | null = null;
  for (const j of jobs) {
    if (j.status !== 'queued') continue;
    const t = Date.parse(j.runAt);
    if (next === null || t < next) next = t;
  }
  return next;
}
