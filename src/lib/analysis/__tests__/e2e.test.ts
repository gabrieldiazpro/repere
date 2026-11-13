/**
 * Bout en bout sur un faux site local : exploration RÉELLE (crawlSite de CRAWL), audits SEO / GEO, contrôle IA
 * (moteur existant, en démo faute de clé), événements ordonnés, résultat partiel, SSRF, stockage et rattachement.
 */
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { collectAnalysis, runFullAnalysis } from '../run';
import { attachAnalysisToBusiness, cachedAnalysis, getStoredAnalysis, issueToken, saveAnalysis, tokenMatches } from '../store';
import type { AnalysisEvent } from '../types';
import { SITE_HOST, clearAiKeys, startFakeSite, type FakeSite } from './fakeSite';

let site: FakeSite;
beforeAll(async () => {
  clearAiKeys();
  process.env.DATA_DIR = await fs.mkdtemp(path.join(os.tmpdir(), 'repere-analysis-'));
  site = await startFakeSite();
});
afterAll(() => site.close());

async function run(url: string, opts: Parameters<typeof runFullAnalysis>[1] = {}) {
  const events: AnalysisEvent[] = [];
  const t0 = Date.now();
  const analysis = await collectAnalysis(runFullAnalysis({ url }, { budgetMs: 25_000, crawlBudgetMs: 12_000, ...opts }), (e) => events.push(e));
  return { analysis, events, ms: Date.now() - t0 };
}

describe('analyse 60 s sur un faux site local', () => {
  it('analyse complète en moins de 20 s, événements ordonnés, synthèse cohérente', async () => {
    const { analysis, events, ms } = await run(`https://${SITE_HOST}/`);
    expect(ms).toBeLessThan(20_000);
    expect(analysis).not.toBeNull();
    const a = analysis!;

    // Ordre : start → detected → … → result (dernier), seq strictement croissant, t croissant.
    expect(events[0].type).toBe('start');
    expect(events.at(-1)!.type).toBe('result');
    events.forEach((e, i) => {
      expect(e.seq).toBe(i + 1);
      if (i) expect(e.t).toBeGreaterThanOrEqual(events[i - 1].t);
    });
    const idx = (p: (e: AnalysisEvent) => boolean) => events.findIndex(p);
    expect(idx((e) => e.type === 'detected')).toBeLessThan(idx((e) => e.type === 'step' && e.step === 'crawl' && e.status === 'running'));
    expect(idx((e) => e.type === 'step' && e.step === 'crawl' && e.status === 'ok')).toBeLessThan(idx((e) => e.type === 'step' && e.step === 'seo' && e.status === 'running'));
    expect(events.some((e) => e.type === 'crawl')).toBe(true);
    expect(events.filter((e) => e.type === 'finding').length).toBeGreaterThanOrEqual(3);
    expect(events.some((e) => e.type === 'ai')).toBe(true);

    // Détection depuis la page d'accueil.
    expect(a.detected).toMatchObject({ brand: 'Boulangerie Dupont', siteType: 'local', city: 'Lyon', activity: 'boulangerie' });
    // Exploration réelle : les 4 pages, robots et sitemap lus ; la page /ancienne-page en 404.
    expect(a.crawl!.pagesFetched).toBeGreaterThanOrEqual(4);
    expect(a.crawl!.robotsFound).toBe(true);
    expect(a.crawl!.sitemapUrls).toBe(4);
    expect(site.hits).toContain(`${SITE_HOST}/robots.txt`);
    // Constats réels attendus.
    const ids = [...a.seo!.sections, ...a.geo!.sections].flatMap((s) => s.findings.map((f) => f.id));
    expect(ids).toEqual(expect.arrayContaining(['seo.title.missing', 'seo.dup.title', 'seo.broken.internal', 'seo.img.alt_missing', 'geo.acces.search_blocked']));
    // Vrais modules (plus d'adaptateur provisoire) : 12 sections SEO, audit GEO sur le HTML du crawl.
    expect(a.modules.seo.provisional).toBeUndefined();
    expect(a.modules.geo.provisional).toBeUndefined();
    expect((a.seo!.stats as { pagesWithHtml?: number }).pagesWithHtml).toBeGreaterThanOrEqual(4);
    expect((a.geo!.stats as { pagesWithHtml?: number }).pagesWithHtml).toBeGreaterThanOrEqual(4);
    // Synthèse.
    expect(a.scores.seo).toBeTypeOf('number');
    expect(a.scores.geo).toBeTypeOf('number');
    expect(a.scores.global).toBeTypeOf('number');
    expect(a.priorities.length).toBeGreaterThan(0);
    expect(a.priorities.length).toBeLessThanOrEqual(5);
    expect(new Set(a.priorities.map((p) => p.source))).toEqual(new Set(['seo', 'geo']));
    expect(a.autoFixes.some((x) => x.kind === 'robots.txt')).toBe(true);
    expect(a.verdict).toMatch(/^Boulangerie Dupont : /);
    // IA : aucune clé → démo étiquetée, zéro appel payant, 3 à 6 questions.
    expect(a.ai?.demo).toBe(true);
    expect(a.demo).toBe(true);
    expect(a.ai?.calls).toBe(0);
    expect(a.ai!.questions.length).toBeGreaterThanOrEqual(3);
    expect(a.ai!.questions.length).toBeLessThanOrEqual(6);
    expect(a.ai!.note).toMatch(/Démonstration/);
    // SEO-DATA non configuré : dit, pas inventé.
    expect(a.modules.data.status).toBe('skipped');
    expect(a.data?.pagespeed).toBeNull();
    expect(a.partial).toBe(false);
  }, 30_000);

  it('résultat partiel quand un module échoue (exploration puis IA)', async () => {
    const r1 = await run(`https://${SITE_HOST}/`, {
      modules: {
        crawl: async () => {
          throw new Error('panne simulée');
        },
      },
    });
    const a = r1.analysis!;
    expect(a.partial).toBe(true);
    expect(a.modules.crawl).toMatchObject({ status: 'failed', error: 'panne simulée' });
    expect(a.modules.seo.status).toBe('skipped');
    expect(a.seo).toBeNull();
    expect(a.scores.global).toBeNull();
    expect(a.ai).toBeDefined(); // le contrôle IA a quand même tourné
    expect(r1.events.at(-1)!.type).toBe('result');

    const r2 = await run(`https://${SITE_HOST}/`, {
      modules: {
        aiCheck: () => new Promise(() => undefined), // ne répond jamais : coupé par le budget
      },
      budgetMs: 8_000,
      crawlBudgetMs: 4_000,
    });
    expect(r2.analysis!.modules.ai.status).toBe('timeout');
    expect(r2.analysis!.scores.seo).toBeTypeOf('number');
    expect(r2.analysis!.partial).toBe(true);
    expect(r2.ms).toBeLessThan(9_000);
  }, 30_000);

  it('SSRF : adresses internes refusées, rien n’est exploré', async () => {
    for (const url of ['http://127.0.0.1/', 'http://169.254.169.254/latest/meta-data/', 'http://localhost:8080/', 'file:///etc/passwd']) {
      const { analysis, events } = await run(url);
      expect(analysis).toBeNull();
      expect(events.at(-1)!.type).toBe('error');
    }
  });

  it('stockage : lien signé, cache, rattachement par e-mail', async () => {
    const { analysis } = await run(`https://${SITE_HOST}/`, { modules: { aiCheck: async () => null } });
    const saved = await saveAnalysis(analysis!, { domain: SITE_HOST, email: 'Gerant@Exemple.fr' });
    const doc = (await getStoredAnalysis(analysis!.id))!;
    expect(JSON.stringify(doc)).not.toMatch(/gerant@exemple\.fr/i); // e-mail jamais en clair
    expect(tokenMatches(doc, saved.token)).toBe(true);
    expect(tokenMatches(doc, saved.token.slice(0, -1) + (saved.token.endsWith('A') ? 'B' : 'A'))).toBe(false);
    expect(tokenMatches(doc, saved.token, new Date(Date.now() + 91 * 86_400_000))).toBe(false); // expiré
    expect((await cachedAnalysis(SITE_HOST))?.analysis.id).toBe(analysis!.id);
    expect(await cachedAnalysis(SITE_HOST, 10 * 60_000, new Date(Date.now() + 11 * 60_000))).toBeNull();
    const t2 = await issueToken(analysis!.id, 'autre@exemple.fr');
    expect(tokenMatches((await getStoredAnalysis(analysis!.id))!, t2!.token)).toBe(true);
    expect(await attachAnalysisToBusiness(analysis!.id, 'biz_1', 'intrus@exemple.fr')).toBe(false);
    expect(await attachAnalysisToBusiness(analysis!.id, 'biz_1', 'gerant@exemple.fr')).toBe(true);
    expect(await attachAnalysisToBusiness(analysis!.id, 'biz_2', 'autre@exemple.fr')).toBe(false); // déjà rattachée
  }, 30_000);
});
