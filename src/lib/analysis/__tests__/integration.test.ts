/**
 * INTEGRATION-V5 — analyse 60 s branchée sur les VRAIS modules (CRAWL → SEO-AUDIT + GEO-OPT, PerfData SEO-DATA),
 * de bout en bout sur les faux sites de CRAWL (src/lib/crawl/__tests__/fakesites.ts). Aucune sortie sur Internet.
 */
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startFakeSites, type FakeServer } from '@/lib/crawl/__tests__/fakesites';
import type { PerfData } from '@/lib/seodata/types';
import { collectAnalysis, runFullAnalysis } from '../run';
import type { PagespeedResult } from '../types';
import { clearAiKeys } from './fakeSite';

let srv: FakeServer;
beforeAll(async () => {
  clearAiKeys();
  process.env.DATA_DIR = await fs.mkdtemp(path.join(os.tmpdir(), 'repere-analysis-int-'));
  srv = await startFakeSites();
});
afterAll(async () => {
  srv.restore();
  await srv.close();
});

const ids = (r: { sections: { findings: { id: string }[] }[] } | null) => (r?.sections ?? []).flatMap((s) => s.findings.map((f) => f.id));

describe('analyse 60 s × vrais modules V5 (faux sites CRAWL)', () => {
  it('normal.test : vrais constats SEO et GEO, HTML audité, < 20 s', async () => {
    const t0 = Date.now();
    const a = await collectAnalysis(runFullAnalysis({ url: 'https://normal.test/' }, { budgetMs: 25_000, crawlBudgetMs: 12_000, modules: { aiCheck: async () => null } }));
    const ms = Date.now() - t0;
    expect(ms).toBeLessThan(20_000);
    expect(a).not.toBeNull();
    expect(a!.crawl!.pagesFetched).toBeGreaterThanOrEqual(6);
    // SEO-AUDIT réel : 12 sections, HTML présent (audit avant publicCrawl), constats attendus du faux site.
    expect(a!.seo!.sections.length).toBeGreaterThanOrEqual(10);
    expect((a!.seo!.stats as { pagesWithHtml: number }).pagesWithHtml).toBeGreaterThanOrEqual(6);
    expect(ids(a!.seo)).toEqual(expect.arrayContaining(['seo.broken.internal', 'seo.img.alt_missing']));
    // GEO-OPT réel : sections GEO, passages analysés sur le HTML.
    expect(a!.geo!.sections.map((s) => s.id)).toEqual(expect.arrayContaining(['acces', 'entite', 'passages']));
    expect((a!.geo!.stats as { pagesWithHtml: number; passages: number }).pagesWithHtml).toBeGreaterThanOrEqual(6);
    expect((a!.geo!.stats as { passages: number }).passages).toBeGreaterThan(0);
    expect(ids(a!.geo).every((id) => id.startsWith('geo.'))).toBe(true);
    expect(a!.modules.seo).toMatchObject({ status: 'ok' });
    expect(a!.modules.geo).toMatchObject({ status: 'ok' });
    expect(a!.modules.seo.provisional).toBeUndefined();
    // Aucune clé IA : GEO sans réécriture IA, synthèse cohérente.
    expect(a!.priorities.length).toBeGreaterThan(0);
    expect(a!.scores.global).toBeTypeOf('number');
    // Le HTML ne sort jamais dans l'analyse.
    expect(JSON.stringify(a)).not.toMatch(/<!doctype html>/i);
  }, 30_000);

  it('PerfData SEO-DATA transmise à auditSeo (Core Web Vitals), seul le résumé est gardé', async () => {
    const perf: PerfData = {
      url: 'https://normal.test/',
      fetchedAt: new Date().toISOString(),
      demo: false,
      sources: ['crux'],
      errors: [],
      devices: {
        mobile: {
          device: 'mobile',
          lab: null,
          field: { scope: 'origin', lcpMs: 6200, inpMs: 650, cls: 0.4, fcpMs: 3000, ttfbMs: 2100, ratings: { lcp: 'poor', inp: 'poor', cls: 'poor' }, passesCwv: false, source: 'crux' },
        },
      },
    };
    const ps: PagespeedResult = { strategy: 'mobile', url: 'https://normal.test/', performance: null, lcpMs: 6200, cls: 0.4, inpMs: 650, field: true, source: 'PageSpeed Insights + CrUX', perf };
    const a = await collectAnalysis(
      runFullAnalysis({ url: 'https://normal.test/' }, { budgetMs: 25_000, crawlBudgetMs: 12_000, modules: { aiCheck: async () => null, pagespeed: async () => ps } }),
    );
    expect(ids(a!.seo)).toEqual(expect.arrayContaining(['seo.cwv.lcp', 'seo.cwv.inp', 'seo.cwv.cls']));
    expect(a!.data?.pagespeed).toMatchObject({ lcpMs: 6200, field: true });
    expect((a!.data?.pagespeed as Record<string, unknown>).perf).toBeUndefined();
    expect(a!.modules.data.status).toBe('ok');
  }, 30_000);

  it('bloque.test (RepereBot interdit) : aucune page lue, analyse partielle honnête', async () => {
    const a = await collectAnalysis(runFullAnalysis({ url: 'https://bloque.test/' }, { budgetMs: 15_000, crawlBudgetMs: 6_000, modules: { aiCheck: async () => null } }));
    expect(a).not.toBeNull();
    expect(srv.hits.some((h) => h.includes('bloque.test/robots.txt'))).toBe(true);
    // Pas de faux constats de contenu sur des pages jamais lues.
    expect(ids(a!.seo)).not.toContain('seo.title.missing');
  }, 20_000);
});
