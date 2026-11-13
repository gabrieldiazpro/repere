import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildDemoWorkspaceById } from '@/lib/demo-v2';
import type { AuditResult } from '@/lib/engine/types';

const audits = buildDemoWorkspaceById('demo-pme')!.audits as AuditResult[];

vi.mock('@/lib/db', async (orig) => {
  const real = await orig<typeof import('@/lib/db')>();
  return {
    ...real,
    getBusinessRecord: vi.fn(async (id: string) => (id === 'bizM' ? { id, name: 'Paysage Test', plan: 'essentiel', trade: 'paysagiste', city: 'Nantes', lastScore: 40, createdAt: '2026-01-01', ownerId: null, isActive: true, alertThreshold: 5 } : null)),
    listAuditsForBusiness: vi.fn(async (id: string) => (id === 'bizM' ? audits : [])),
  };
});

import { __setRelaunch, compareSnapshots, demoMeasures, getActionImpact, impactOf, linkedQueries, listActionImpacts, snapshotOf, startActionMeasure } from '@/lib/measure';
import { runDueLocalJobs, listLocalJobs, useMemoryJobs } from '@/lib/jobs/testing';
import { listNotifications } from '@/lib/notify/center';

beforeAll(() => {
  useMemoryJobs();
  (globalThis as { __repereDocsDir?: string }).__repereDocsDir = mkdtempSync(path.join(os.tmpdir(), 'measure-'));
});
afterAll(() => __setRelaunch(null));

describe('comparaison avant / après', () => {
  it('dans la marge d’erreur quand l’écart est faible', () => {
    const r = compareSnapshots({ answers: 24, mentioned: 6 }, { answers: 24, mentioned: 8 });
    expect(r.verdict).toBe('stable');
    expect(r.delta).toBeCloseTo(8.3, 1);
    expect(r.margin).toBeGreaterThan(Math.abs(r.delta));
  });
  it('hausse nette au-delà de la marge', () => {
    const r = compareSnapshots({ answers: 48, mentioned: 5 }, { answers: 48, mentioned: 30 });
    expect(r.verdict).toBe('hausse');
    expect(r.delta).toBeGreaterThan(r.margin);
  });
  it('baisse, et trop peu de réponses', () => {
    expect(compareSnapshots({ answers: 48, mentioned: 30 }, { answers: 48, mentioned: 5 }).verdict).toBe('baisse');
    expect(compareSnapshots({ answers: 4, mentioned: 0 }, { answers: 4, mentioned: 4 }).verdict).toBe('insuffisant');
    expect(compareSnapshots({ answers: 0, mentioned: 0 }, { answers: 10, mentioned: 5 }).verdict).toBe('insuffisant');
  });
  it('marge non nulle même à 0 %', () => {
    expect(compareSnapshots({ answers: 20, mentioned: 0 }, { answers: 20, mentioned: 0 }).margin).toBeGreaterThan(0);
  });
});

describe('questions liées et état « avant »', () => {
  const last = audits[audits.length - 1];
  it('par source visée, sinon par lacunes', () => {
    const dom = last.sources!.domains.find((d) => d.queries.length)!;
    const bySource = linkedQueries({ sourceDomain: dom.domain }, last);
    expect(bySource.reason).toBe('source');
    for (const q of bySource.queries) expect(dom.queries).toContain(q.id);
    const byGap = linkedQueries({ sourceDomain: 'inconnu.example' }, last);
    expect(['gaps', 'all']).toContain(byGap.reason);
    expect(byGap.queries.length).toBeGreaterThan(0);
    expect(byGap.queries.every((q) => q.kind !== 'brand')).toBe(true);
  });
  it('instantané cohérent', () => {
    const ids = last.queries.slice(0, 3).map((q) => q.id);
    const s = snapshotOf(last, ids);
    expect(s.mentioned).toBeLessThanOrEqual(s.answers);
    expect(s.perQuery.reduce((n, q) => n + q.answers, 0)).toBe(s.answers);
  });
});

describe('cycle complet', () => {
  it('avant, relances J+14 / J+30 planifiées, impact', async () => {
    const doneAt = '2026-11-06T10:00:00.000Z';
    const m = (await startActionMeasure('bizM', { id: 't-faq', title: 'Page FAQ publiée', doneAt }, new Date(doneAt)))!;
    expect(m.before?.answers).toBeGreaterThan(0);
    expect(m.checkpoints.map((c) => c.dueAt)).toEqual(['2026-11-20T10:00:00.000Z', '2026-12-06T10:00:00.000Z']);
    const jobs = await listLocalJobs('measure.action');
    expect(jobs.filter((j) => j.payload.taskId === 't-faq')).toHaveLength(2);
    expect((await getActionImpact('t-faq', { businessId: 'bizM' }))!.verdict).toBe('en_attente');
    expect(await getActionImpact('t-faq', { businessId: 'autre' })).toBeNull();
    // idempotent
    await startActionMeasure('bizM', { id: 't-faq', title: 'Page FAQ publiée', doneAt });
    expect((await listLocalJobs('measure.action')).filter((j) => j.payload.taskId === 't-faq')).toHaveLength(2);

    // relance simulée : toutes les réponses citent désormais le commerce
    __setRelaunch(async (audit, queries) => ({
      ...audit,
      queries,
      mentions: audit.mentions.filter((x) => queries.some((q) => q.id === x.queryId)).map((x) => ({ ...x, mentioned: true, rank: 1 })),
    }));
    expect(await runDueLocalJobs(new Date('2026-11-21T00:00:00Z'), 'measure.action')).toBe(1);
    const i = (await getActionImpact('t-faq', { businessId: 'bizM' }))!;
    expect(i.after?.rate).toBe(1);
    expect(['hausse', 'insuffisant']).toContain(i.verdict);
    expect(i.note).toMatch(/Corrélation/);
    const { items } = await listNotifications('bizM');
    expect(items.some((n) => n.type === 'measure_result')).toBe(true);
    expect((await listActionImpacts('bizM')).length).toBe(1);
  });

  it('pas de mesure pour un compte démo (lecture seule)', async () => {
    expect(await startActionMeasure('demo', { id: 'x', title: 'x' })).toBeNull();
  });
});

describe('seed de démonstration', () => {
  it('mesure démo étiquetée, dates réelles des audits', () => {
    for (const id of ['demo', 'demo-pme', 'demo-ecom']) {
      const [m] = demoMeasures(id);
      expect(m.demo).toBe(true);
      const i = impactOf(m);
      expect(i.demo).toBe(true);
      expect(i.before?.answers).toBeGreaterThan(0);
      expect(i.after).not.toBeNull();
      expect(['hausse', 'baisse', 'stable', 'insuffisant']).toContain(i.verdict);
      if (i.verdict === 'stable') expect(i.label).toMatch(/marge d’erreur/);
    }
  });
});
