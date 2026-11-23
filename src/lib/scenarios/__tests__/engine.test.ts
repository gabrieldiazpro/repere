import { describe, expect, it, vi } from 'vitest';
import { auditSeo } from '@/lib/seoaudit';
import { auditGeo } from '@/lib/geo';
import { demoSiteCrawl } from '@/lib/seoaudit/demo-crawl';
import type { SiteCrawl } from '@/lib/crawl/types';
import { buildScenarios, candidatesOf, locate, rankCandidates, simulate, whoOf } from '../engine';
import { followUp } from '../follow';
import { launchScenario } from '../launch';
import type { ScenarioLaunch } from '../types';

const NOW = new Date('2026-11-20T10:00:00Z');
const TYPES = { demo: 'local', 'demo-pme': 'pme', 'demo-ecom': 'ecommerce' } as const;
type Id = keyof typeof TYPES;

function setup(id: Id, stage = 3) {
  const crawl = demoSiteCrawl(id, stage, NOW);
  const t = TYPES[id];
  const auditor = vi.fn((c: SiteCrawl) => ({ seo: auditSeo(c, { siteType: t }), geo: auditGeo(c, { siteType: t, brand: 'Démo', now: c.startedAt }) }));
  const base = auditor(crawl);
  return { crawl, auditor, base };
}

describe('simulate', () => {
  it.each(Object.keys(TYPES) as Id[])('0 correction = scores réels, section par section (%s)', (id) => {
    const { crawl, auditor, base } = setup(id);
    const r = simulate(crawl, auditor, base, []);
    expect(r.after).toEqual({ seo: base.seo.score, geo: base.geo.score });
    expect(r.before).toEqual(r.after);
    for (const s of r.sections) expect(s.after).toBe(s.before);
    expect(r.applied).toEqual([]);
    expect(r.appeared).toEqual([]);
  });

  it('ne modifie jamais l’exploration d’origine', () => {
    const { crawl, auditor, base } = setup('demo-ecom');
    const before = JSON.stringify(crawl);
    const keys = candidatesOf(base).map((c) => c.key);
    simulate(crawl, auditor, base, keys);
    expect(JSON.stringify(crawl)).toBe(before);
  });

  it('un noindex sur la recherche interne change la section e-commerce, pas les autres', () => {
    const { crawl, auditor, base } = setup('demo-ecom');
    const key = 'seo:seo.ecom.search_indexable';
    expect(locate(base).has(key)).toBe(true);
    const r = simulate(crawl, auditor, base, [key]);
    expect(r.applied.map((a) => a.key)).toEqual([key]);
    expect(r.resolved).toContain(key);
    const changed = r.sections.filter((s) => s.after !== s.before);
    expect(changed.map((s) => `${s.origin}:${s.id}`)).toContain('seo:ecommerce');
    const eco = r.sections.find((s) => s.origin === 'seo' && s.id === 'ecommerce')!;
    expect(eco.after).toBeGreaterThan(eco.before);
    for (const s of r.sections) if (s.origin === 'geo') expect(s.after).toBe(s.before);
  });

  it('des titres corrigés font progresser la section « Balises et contenu »', () => {
    const { crawl, auditor, base } = setup('demo');
    const key = 'seo:seo.title.too_long';
    const r = simulate(crawl, auditor, base, [key]);
    const c = r.sections.find((s) => s.id === 'contenu')!;
    expect(c.after).toBeGreaterThan(c.before);
    expect(r.sections.find((s) => s.id === 'indexation')!.after).toBe(r.sections.find((s) => s.id === 'indexation')!.before);
    expect(r.after.seo).toBeGreaterThanOrEqual(r.before.seo);
  });

  it('exclut et explique ce qui ne peut pas être simulé exactement', () => {
    const { crawl, auditor, base } = setup('demo');
    const key = 'seo:seo.content.thin';
    const r = simulate(crawl, auditor, base, [key]);
    expect(r.applied).toEqual([]);
    expect(r.excluded).toHaveLength(1);
    expect(r.excluded[0].reason).toMatch(/Pas de correction préparée/);
    expect(r.excluded[0].who).toBe('vous');
    expect(r.after).toEqual(r.before);
  });

  it('ignore les clés inconnues', () => {
    const { crawl, auditor, base } = setup('demo');
    expect(simulate(crawl, auditor, base, ['seo:inexistant']).selection).toEqual([]);
  });
});

describe('scénarios proposés', () => {
  it('trois scénarios calculés par le même moteur, sans promesse', () => {
    const { crawl, auditor, base } = setup('demo-ecom');
    const ranked = rankCandidates(crawl, auditor, base);
    const sc = buildScenarios(crawl, auditor, base, ranked);
    expect(sc.map((s) => s.id)).toEqual(['rentables', 'repere', 'trente']);
    expect(sc[0].keys.length).toBeLessThanOrEqual(3);
    const byKey = new Map(ranked.map((c) => [c.key, c]));
    for (const k of sc[1].keys) expect(byKey.get(k)!.who).not.toBe('vous');
    expect(sc[2].result.minutes).toBeLessThanOrEqual(30);
    for (const s of sc) {
      const again = simulate(crawl, auditor, base, s.keys);
      expect(s.result.after).toEqual(again.after);
    }
  });

  it('qui fait quoi', () => {
    expect(whoOf({})).toBe('vous');
    expect(whoOf({ autoFix: { kind: 'canonical', payload: { items: [] } } })).toBe('auto');
    expect(whoOf({ autoFix: { kind: 'meta.title', payload: { items: [] } } })).toBe('guide');
    expect(whoOf({ autoFix: { kind: 'inconnu', payload: {} } })).toBe('vous');
  });
});

describe('prévu vs mesuré', () => {
  const launch: ScenarioLaunch = {
    id: 'b:1', businessId: 'b', at: '2026-11-10T00:00:00Z', runId: 'r1', runAt: '2026-11-09T00:00:00Z', title: 'x',
    keys: ['seo:seo.ecom.search_indexable'], titles: { 'seo:seo.ecom.search_indexable': 'Recherche' },
    predicted: { seo: 55, geo: 97, resolved: ['seo:seo.ecom.search_indexable'], sections: [] }, before: { seo: 50, geo: 97 }, changeSetIds: [], taskIds: [],
  };
  it('en attente sans nouvelle exploration, mesuré ensuite', () => {
    const { base } = setup('demo-ecom');
    expect(followUp(launch, [{ id: 'r1', at: launch.runAt, ...base }]).status).toBe('waiting');
    const f = followUp(launch, [{ id: 'r1', at: launch.runAt, ...base }, { id: 'r2', at: '2026-11-15T00:00:00Z', ...base }]);
    expect(f.status).toBe('measured');
    expect(f.measured).toEqual({ seo: base.seo.score, geo: base.geo.score });
    expect(f.findings[0]).toMatchObject({ predictedResolved: true, measuredResolved: false });
  });
});

describe('lancer un scénario', () => {
  it('brouillons pour l’agent, tâches pour vous, rien de publié', async () => {
    const { crawl, auditor, base } = setup('demo-ecom');
    const createChangeSets = vi.fn(async (_b: string, f: { id: string }[]) => ({ changeSets: f.map((x) => ({ id: `cs-${x.id}` })), skipped: [] }));
    const createCustomTask = vi.fn(async (_b: string, t: { title: string }) => ({ id: `t-${t.title}` }));
    const saveLaunch = vi.fn(async () => {});
    const keys = ['seo:seo.ecom.search_indexable', 'seo:seo.content.thin'];
    const r = await launchScenario(
      { businessId: 'biz_reel', crawl, auditor, base, run: { id: 'r1', at: '2026-11-19T00:00:00Z' }, keys, title: 'Test', actor: { id: 'u1' }, now: NOW },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { createChangeSets: createChangeSets as any, createCustomTask: createCustomTask as any, listTasks: async () => [], saveLaunch, siteFromCrawl: () => ({ businessId: 'biz_reel', origin: crawl.finalOrigin, pages: [] }) as any },
    );
    expect(createChangeSets).toHaveBeenCalledTimes(1);
    expect(createChangeSets.mock.calls[0][1].map((f) => f.id)).toEqual(['seo.ecom.search_indexable']);
    expect(createCustomTask).toHaveBeenCalledTimes(1);
    expect(r.changeSets).toBe(1);
    expect(r.tasks).toBe(1);
    expect(r.launch.predicted.resolved).toContain('seo:seo.ecom.search_indexable');
    expect(saveLaunch).toHaveBeenCalledWith(r.launch);
  });

  it('refuse les comptes démo', async () => {
    const { crawl, auditor, base } = setup('demo');
    await expect(launchScenario({ businessId: 'demo', crawl, auditor, base, run: { id: 'r', at: 'x' }, keys: ['seo:seo.content.thin'], title: 't', actor: { id: 'u' } }, {})).rejects.toThrow(/démonstration/);
  });
});
