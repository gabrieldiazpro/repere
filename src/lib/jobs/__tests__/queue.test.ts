/**
 * File de tâches : ordre, reprise (bail expiré), dédoublonnage, idempotence, backoff, abandon, délai,
 * exécution immédiate en mémoire. Horloge simulée : aucune attente réelle.
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'repere-jobs-'));
for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_SUPABASE_URL']) delete process.env[k];

const jobs = await import('@/lib/jobs');
const { createMemoryBackend, enqueue, registerHandler, resetJobsForTests, runWorker, setJobBackend, getJob, jobStats, backoffDelay, PermanentJobError } = jobs;
const { runWorker: rawWorker } = await import('@/lib/jobs/worker');
const { periodKey, isAuditDue } = await import('@/lib/jobs/platform');

/** Horloge simulée partagée par la file et le worker. */
function clock(start = Date.parse('2026-11-09T08:00:00Z')) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

const insert = (b: ReturnType<typeof createMemoryBackend>, type: Parameters<typeof enqueue>[0], o: { priority?: number; runAt?: number; key?: string; max?: number; payload?: Record<string, unknown> } = {}) =>
  b.insert({ type, payload: o.payload ?? {}, businessId: null, dedupeKey: o.key ?? null, priority: o.priority ?? 5, maxAttempts: o.max ?? 3, runAt: new Date(o.runAt ?? 0) });

beforeEach(() => resetJobsForTests());

describe('ordre et réservation', () => {
  it('priorité, puis échéance, puis ordre d’arrivée ; une tâche future attend', async () => {
    const c = clock();
    const b = createMemoryBackend(c.now);
    const seen: string[] = [];
    registerHandler('digest.send', async (p) => void seen.push(String(p.n)));
    await insert(b, 'digest.send', { priority: 5, runAt: c.now() - 1000, payload: { n: 'p5-ancienne' } });
    await insert(b, 'digest.send', { priority: 5, runAt: c.now() - 10, payload: { n: 'p5-récente' } });
    await insert(b, 'digest.send', { priority: 1, runAt: c.now(), payload: { n: 'p1' } });
    await insert(b, 'digest.send', { priority: 1, runAt: c.now() + 60_000, payload: { n: 'future' } });
    const r = await rawWorker({ backend: b, now: c.now, concurrency: 1, timeoutMs: 1000, budgetMs: 1e9 });
    expect(seen).toEqual(['p1', 'p5-ancienne', 'p5-récente']);
    expect(r.done).toBe(3);
    expect((await b.stats()).queued).toBe(1);
  });

  it('deux workers ne prennent jamais la même tâche', async () => {
    const c = clock();
    const b = createMemoryBackend(c.now);
    for (let i = 0; i < 5; i++) await insert(b, 'digest.send', { runAt: c.now() });
    const [a, d] = await Promise.all([b.claim('w1', 3, 1000), b.claim('w2', 3, 1000)]);
    const ids = [...a, ...d].map((j) => j.id);
    expect(ids).toHaveLength(5);
    expect(new Set(ids).size).toBe(5);
  });
});

describe('reprise', () => {
  it('une tâche abandonnée par un worker (bail expiré) est reprise ; l’ancien worker ne peut plus écrire', async () => {
    const c = clock();
    const b = createMemoryBackend(c.now);
    const { job } = await insert(b, 'audit.run', { runAt: c.now() });
    const [taken] = await b.claim('mort', 1, 10_000);
    expect(taken.attempts).toBe(1);
    expect(await b.claim('w2', 1, 10_000)).toHaveLength(0); // bail encore valide
    c.advance(10_001);
    const [again] = await b.claim('w2', 1, 10_000);
    expect(again.id).toBe(job.id);
    expect(again.attempts).toBe(2);
    await b.complete(job.id, 'mort', { faux: true }); // ignoré : plus le verrou
    expect((await b.get(job.id))!.status).toBe('running');
    await b.complete(job.id, 'w2', { ok: true });
    expect((await b.get(job.id))!).toMatchObject({ status: 'done', result: { ok: true }, lockedBy: null });
  });

  it('échec → backoff exponentiel, puis dead après maxAttempts', async () => {
    const c = clock();
    const b = createMemoryBackend(c.now);
    let calls = 0;
    registerHandler('webhook.deliver', async () => {
      calls++;
      throw new Error('cible injoignable');
    });
    const { job } = await insert(b, 'webhook.deliver', { runAt: c.now(), max: 3 });
    const opts = { backend: b, now: c.now, timeoutMs: 1000, budgetMs: 1e9, backoffBaseMs: 60_000, random: () => 0.5 };
    let r = await rawWorker(opts);
    expect(r.retried).toBe(1);
    let j = (await b.get(job.id))!;
    expect(j.status).toBe('queued');
    expect(j.lastError).toContain('cible injoignable');
    expect(Date.parse(j.runAt) - c.now()).toBe(60_000);
    expect((await rawWorker(opts)).processed).toBe(0); // pas avant l'échéance
    c.advance(60_000);
    await rawWorker(opts);
    expect(Date.parse((await b.get(job.id))!.runAt) - c.now()).toBe(120_000);
    c.advance(120_000);
    r = await rawWorker(opts);
    expect(r.dead).toBe(1);
    j = (await b.get(job.id))!;
    expect(j.status).toBe('dead');
    expect(calls).toBe(3);
    expect((await b.stats()).dead).toBe(1);
  });

  it('PermanentJobError : abandon immédiat, sans nouvelle tentative', async () => {
    const c = clock();
    const b = createMemoryBackend(c.now);
    registerHandler('tasks.generate', async () => {
      throw new PermanentJobError('commerce introuvable');
    });
    const { job } = await insert(b, 'tasks.generate', { runAt: c.now(), max: 5 });
    await rawWorker({ backend: b, now: c.now, timeoutMs: 1000, budgetMs: 1e9 });
    expect((await b.get(job.id))!).toMatchObject({ status: 'dead', attempts: 1 });
  });

  it('délai dépassé : la tâche est annulée (signal) et reprogrammée', async () => {
    const b = createMemoryBackend();
    let aborted = false;
    registerHandler('siteaudit.run', (p) => {
      const ctx = p._job as { signal: AbortSignal };
      ctx.signal.addEventListener('abort', () => (aborted = true));
      return new Promise(() => undefined); // ne se termine jamais
    });
    const { job } = await insert(b, 'siteaudit.run', { runAt: Date.now() });
    const r = await rawWorker({ backend: b, timeoutMs: 120, budgetMs: 1e9 });
    expect(r.retried).toBe(1);
    expect(aborted).toBe(true);
    expect((await b.get(job.id))!.lastError).toMatch(/délai dépassé/);
  });

  it('budget : aucune tâche démarrée s’il reste moins que le délai d’une tâche', async () => {
    const c = clock();
    const b = createMemoryBackend(c.now);
    registerHandler('digest.send', async () => void c.advance(40_000));
    for (let i = 0; i < 5; i++) await insert(b, 'digest.send', { runAt: c.now() });
    const r = await rawWorker({ backend: b, now: c.now, concurrency: 1, timeoutMs: 30_000, budgetMs: 100_000 });
    expect(r.stoppedBy).toBe('budget');
    expect(r.done).toBe(2);
    expect((await b.stats()).queued).toBe(3); // rien ne reste verrouillé
  });

  it('backoffDelay : 1, 2, 4… min, plafonné à 6 h, ±10 %', () => {
    expect(backoffDelay(1, 60_000, () => 0.5)).toBe(60_000);
    expect(backoffDelay(3, 60_000, () => 0.5)).toBe(240_000);
    expect(backoffDelay(30, 60_000, () => 0.5)).toBe(6 * 3600_000);
    expect(backoffDelay(1, 60_000, () => 0)).toBe(54_000);
  });
});

describe('API enqueue (mode mémoire)', () => {
  it('exécution immédiate pendant await enqueue, résultat lisible par getJob', async () => {
    const seen: unknown[] = [];
    registerHandler('report.scheduled', async (p) => {
      seen.push(p.businessId);
      return { sent: 2 };
    });
    const { id } = await enqueue('report.scheduled', { businessId: 'b1' });
    expect(seen).toEqual(['b1']);
    const j = await getJob(id);
    expect(j).toMatchObject({ status: 'done', result: { sent: 2 }, businessId: 'b1', attempts: 1 });
    expect((await jobStats()).done).toBe(1);
  });

  it('dédoublonnage : même clé → même tâche, gestionnaire exécuté une seule fois', async () => {
    let n = 0;
    registerHandler('digest.send', async () => void n++);
    const a = await enqueue('digest.send', { businessId: 'b1', week: '2026-11-09' }, { dedupeKey: 'digest.send:b1:2026-11-09' });
    const b = await enqueue('digest.send', { businessId: 'b1', week: '2026-11-09' }, { dedupeKey: 'digest.send:b1:2026-11-09' });
    expect(b.id).toBe(a.id);
    expect(n).toBe(1);
  });

  it('idempotence : une tâche rejouée après un plantage ne refait pas l’effet (marqueur)', async () => {
    const effects = new Map<string, number>();
    let crash = true;
    registerHandler('measure.action', async (p) => {
      const key = String(p.taskId);
      if (!effects.has(key)) effects.set(key, (effects.get(key) ?? 0) + 1);
      if (crash) {
        crash = false;
        throw new Error('plantage après l’effet');
      }
    });
    const c = clock(Date.now());
    const b = createMemoryBackend(c.now);
    setJobBackend(b);
    await insert(b, 'measure.action', { runAt: c.now(), payload: { taskId: 't1' } });
    await runWorker({ now: c.now, backoffBaseMs: 1000, random: () => 0.5 });
    c.advance(1000);
    const r = await runWorker({ now: c.now, backoffBaseMs: 1000 });
    expect(r.done).toBe(1);
    expect(effects.get('t1')).toBe(1);
  });

  it('tâche enfilée depuis un gestionnaire : exécutée dans la même passe', async () => {
    const order: string[] = [];
    registerHandler('audit.run', async () => {
      order.push('audit');
      await enqueue('tasks.generate', { businessId: 'b2' });
      order.push('audit-fin');
    });
    registerHandler('tasks.generate', async () => void order.push('tâches'));
    await enqueue('audit.run', { businessId: 'b2' });
    expect(order).toEqual(['audit', 'audit-fin', 'tâches']);
  });

  it('runAt futur : la tâche attend (ni exécutée, ni perdue)', async () => {
    let n = 0;
    registerHandler('report.scheduled', async () => void n++);
    const { id } = await enqueue('report.scheduled', { businessId: 'b3' }, { runAt: new Date(Date.now() + 3600_000) });
    expect(n).toBe(0);
    expect((await getJob(id))!.status).toBe('queued');
  });

  it('refuse un type inconnu et une charge utile trop lourde', async () => {
    await expect(enqueue('inconnu' as never, {})).rejects.toThrow(/type inconnu/);
    await expect(enqueue('digest.send', { big: 'x'.repeat(70_000) })).rejects.toThrow(/trop volumineuse/);
  });
});

describe('planification selon l’offre', () => {
  it('clés de période', () => {
    const d = new Date('2026-11-09T10:00:00Z');
    expect(periodKey('monthly', d)).toBe('2026-11');
    expect(periodKey('daily', d)).toBe('2026-11-09');
    expect(periodKey('weekly', d)).toBe('2026-W46');
    expect(periodKey('weekly', new Date('2021-01-01T12:00:00Z'))).toBe('2020-W53');
  });

  it('échéance : mensuel 28 j, hebdomadaire 6,5 j', () => {
    const now = new Date('2026-11-09T10:00:00Z');
    const ago = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString();
    expect(isAuditDue('monthly', null, now)).toBe(true);
    expect(isAuditDue('monthly', ago(20), now)).toBe(false);
    expect(isAuditDue('monthly', ago(29), now)).toBe(true);
    expect(isAuditDue('weekly', ago(5), now)).toBe(false);
    expect(isAuditDue('weekly', ago(7), now)).toBe(true);
  });
});
