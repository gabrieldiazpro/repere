/**
 * Chemin « file de tâches » une fois seodata.* ajouté à JOB_TYPES (simulé ici) : mise en file, exécution par le
 * worker mémoire, collecte différée de 20 min, dédoublonnage par clé.
 */
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { BusinessRecord } from '@/lib/db';
import { startFakeServer, type FakeServer } from './fake-server';

process.env.DATA_DIR = mkdtempSync(path.join(os.tmpdir(), 'seodata-queue-'));

vi.mock('@/lib/jobs/types', async (orig) => {
  const real = await orig<typeof import('@/lib/jobs/types')>();
  return {
    ...real,
    JOB_TYPES: [...real.JOB_TYPES, 'seodata.gsc.sync', 'seodata.rank.weekly', 'seodata.rank.collect'],
    DEFAULT_PRIORITY: { ...real.DEFAULT_PRIORITY, 'seodata.gsc.sync': 5, 'seodata.rank.weekly': 6, 'seodata.rank.collect': 6 },
  };
});

const BIZ: BusinessRecord = {
  id: 'q-biz', name: 'q', trade: 't', city: 'Lyon', website: 'exemple.fr', plan: 'essentiel', segment: 'ecommerce', planId: null, lastScore: null,
  createdAt: '2026-01-01T00:00:00Z', ownerId: 'u1', isActive: true, alertThreshold: 5,
};
vi.mock('@/lib/db', async (orig) => {
  const real = await orig<typeof import('@/lib/db')>();
  return { ...real, getBusinessRecord: vi.fn(async (id: string) => (id === 'q-biz' ? BIZ : real.getBusinessRecord(id))) };
});

const jobsLib = await import('@/lib/jobs');
const { useMemoryJobs, listLocalJobs, runDueLocalJobs } = await import('@/lib/jobs/testing');
const { setSeoDataEndpoints, weekKey } = await import('../http');
const seoJobs = await import('../jobs');
const rank = await import('../rank');
const { contextFor } = await import('../providers');
/** Types seodata.* simulés dans JOB_TYPES (pas encore dans le type statique). */
const jt = (t: string) => t as Parameters<typeof listLocalJobs>[0];

let s: FakeServer;
let ready = false;
beforeAll(async () => {
  s = await startFakeServer();
  process.env.DATAFORSEO_LOGIN = 'l';
  process.env.DATAFORSEO_PASSWORD = 'p';
  setSeoDataEndpoints({ dataforseo: `${s.url}/v3` });
  s.on('POST', '/v3/serp/google/organic/task_post', (r) => ({ json: { status_code: 20000, cost: 0.0018, tasks: (r.json as unknown[]).map((_, i) => ({ id: `queue-task-000${i}`, status_code: 20100 })) } }));
  s.on('GET', /task_get\/advanced\//, () =>
    ready
      ? { json: { status_code: 20000, tasks: [{ status_code: 20000, result: [{ keyword: 'savon', item_types: ['organic'], items: [{ type: 'organic', rank_group: 2, domain: 'exemple.fr', url: 'https://exemple.fr/' }] }] }] } }
      : { json: { status_code: 20000, tasks: [{ status_code: 40602, status_message: 'Task In Queue.' }] } },
  );
  jobsLib.disableBuiltinHandlers();
  useMemoryJobs();
});
afterAll(async () => {
  setSeoDataEndpoints(null);
  await s.close();
});

describe('seodata.* dans la file', () => {
  it('relevé mis en file → dépôt → collecte différée → terminé', async () => {
    expect(seoJobs.registerSeoDataJobs()).toEqual(['seodata.gsc.sync', 'seodata.rank.weekly', 'seodata.rank.collect']);
    const ctx = await contextFor('q-biz');
    await rank.addKeywords(ctx, ['savon'], 'manual', null);
    const now = new Date();
    expect(await seoJobs.dispatch('seodata.rank.weekly', { businessId: 'q-biz' }, { dedupeKey: `rank:q-biz:${weekKey(now)}` })).toBe('queued');
    // file mémoire : exécution immédiate du relevé ; la collecte est programmée à +20 min
    const weekly = await listLocalJobs(jt('seodata.rank.weekly'));
    expect(weekly).toHaveLength(1);
    expect(weekly[0].status).toBe('done');
    expect(weekly[0].result).toMatchObject({ status: 'pending', pending: 1 });
    const collects = await listLocalJobs(jt('seodata.rank.collect'));
    expect(collects).toHaveLength(1);
    expect(Date.parse(collects[0].runAt) - Date.now()).toBeGreaterThan(19 * 60_000);
    // même clé : pas de second relevé
    await seoJobs.dispatch('seodata.rank.weekly', { businessId: 'q-biz' }, { dedupeKey: `rank:q-biz:${weekKey(now)}` });
    expect(await listLocalJobs(jt('seodata.rank.weekly'))).toHaveLength(1);

    // collecte n° 1 : pas prête → collecte n° 2 programmée
    // L'horloge système avance (comme en vrai) : le gestionnaire programme la collecte suivante à partir d'elle.
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date(now.getTime() + 21 * 60_000));
      await runDueLocalJobs(new Date(), jt('seodata.rank.collect'));
      expect((await listLocalJobs(jt('seodata.rank.collect'))).length).toBe(2);
      ready = true;
      vi.setSystemTime(new Date(now.getTime() + 42 * 60_000));
      await runDueLocalJobs(new Date(), jt('seodata.rank.collect'));
      expect((await listLocalJobs(jt('seodata.rank.collect'))).length).toBe(2);
    } finally {
      vi.useRealTimers();
    }
    const ctx2 = await contextFor('q-biz');
    const h = await rank.rankHistory(ctx2, {} as never);
    expect(h.at(-1)!.results[0]).toMatchObject({ keyword: 'savon', position: 2 });
  });

  it('erreur définitive : tâche abandonnée sans nouvelle tentative', async () => {
    await seoJobs.dispatch('seodata.gsc.sync', { businessId: 'q-biz', mode: 'daily' });
    const j = (await listLocalJobs(jt('seodata.gsc.sync')))[0];
    expect(j.status).toBe('dead');
    expect(j.attempts).toBe(1);
    expect(j.lastError).toMatch(/not_connected/);
  });
});
