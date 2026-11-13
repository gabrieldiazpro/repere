/**
 * INTEGRATION-V5 : droits V5 par offre (analyse, SEO-DATA, publication), types de tâches V5 et gestionnaires,
 * réanalyse d'un espace de bout en bout (faux site CRAWL) et balayage selon le rythme de l'offre.
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.setConfig({ testTimeout: 60_000 });
process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'repere-int-v5-'));
for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_SUPABASE_URL', 'OPENAI_API_KEY', 'PERPLEXITY_API_KEY', 'GEMINI_API_KEY', 'ANTHROPIC_API_KEY', 'MISTRAL_API_KEY', 'RESEND_API_KEY', 'PAGESPEED_API_KEY', 'CRUX_API_KEY']) {
  delete process.env[k];
}
process.env.GEO_LLM = 'off';

const { getEntitlements, assertCanApplyPublish, PUBLIC_ANALYSIS_MAX_PAGES } = await import('@/lib/entitlements');
const { SEODATA_LIMITS } = await import('@/lib/seodata/limits');
const { JOB_TYPES, DEFAULT_PRIORITY } = await import('@/lib/jobs/types');
const jobs = await import('@/lib/jobs');
const { installBuiltinHandlers } = await import('@/lib/jobs/handlers');
const { SEODATA_JOB_TYPES } = await import('@/lib/seodata/jobs');
const { BAROMETRE_JOB, registerBarometreJob } = await import('@/lib/barometre/job');
const { handleAnalysisRerun, handleAnalysisScheduled, isReanalysisDue, rerunBudgets } = await import('@/lib/analysis/job');
const { getStoredAnalysis, listAnalysesForBusiness } = await import('@/lib/analysis/store');
const { createBusiness } = await import('@/lib/db');
const { startFakeSites } = await import('@/lib/crawl/__tests__/fakesites');

const ent = (plan: string, segment: 'local' | 'pme' | 'ecommerce' = 'local') => getEntitlements({ id: `b-${plan}-${segment}`, plan: plan as never, segment, planId: null as never, isActive: true });

describe('droits V5 par offre', () => {
  it('pages explorées : Découverte 60, Essentiel 500, Accompagné 2 000', () => {
    expect(PUBLIC_ANALYSIS_MAX_PAGES).toBe(60);
    expect(ent('free').analysis.maxPages).toBe(60);
    expect(ent('essentiel').analysis.maxPages).toBe(500);
    expect(ent('accompagne', 'pme').analysis.maxPages).toBe(2_000);
    expect(ent('free').analysis.reanalysis).toBe('monthly');
    expect(ent('accompagne').analysis.reanalysis).toBe('weekly');
    expect(getEntitlements({ id: 'demo', plan: 'free' as never, segment: 'local', planId: null as never }).analysis.reanalysis).toBe('none');
  });
  it('seoData = table de SEO-DATA (Essentiel local à part)', () => {
    expect(ent('free').seoData).toEqual(SEODATA_LIMITS.decouverte);
    expect(ent('essentiel', 'local').seoData).toEqual(SEODATA_LIMITS.essentiel_local);
    expect(ent('essentiel', 'pme').seoData).toEqual(SEODATA_LIMITS.essentiel);
    expect(ent('accompagne', 'ecommerce').seoData).toEqual(SEODATA_LIMITS.accompagne);
    expect(ent('agency').seoData.keywords).toBe(2_000);
    // Un commerce inactif retombe sur Découverte : aucun appel payant.
    expect(getEntitlements({ id: 'x', plan: 'essentiel' as never, segment: 'pme', planId: null as never, isActive: false }).seoData.monthlyBudgetEur).toBe(0);
  });
  it('publication : export pour tous, application directe à partir d’Essentiel', () => {
    expect(() => assertCanApplyPublish(ent('free'))).toThrow(/Essentiel/);
    expect(() => assertCanApplyPublish(ent('essentiel'))).not.toThrow();
    expect(ent('essentiel').publish.changeSetsPerMonth).toBeGreaterThan(0);
  });
});

describe('file de tâches V5', () => {
  beforeEach(() => {
    jobs.resetJobsForTests();
    installBuiltinHandlers();
  });
  it('types V5 déclarés, priorités et gestionnaires installés', () => {
    for (const t of [...SEODATA_JOB_TYPES, BAROMETRE_JOB, 'publish.verify', 'analysis.rerun', 'analysis.scheduled']) {
      expect(JOB_TYPES).toContain(t);
      expect(DEFAULT_PRIORITY[t as (typeof JOB_TYPES)[number]]).toBeTypeOf('number');
      expect(jobs.getHandler(t as (typeof JOB_TYPES)[number])).toBeTypeOf('function');
    }
    expect(registerBarometreJob()).toBe(true);
  });
  it('budgets de réanalyse bornés par le délai par tâche', () => {
    expect(rerunBudgets({ maxPages: 2_000, crawlBudgetMs: 600_000 }, 90_000)).toEqual({ maxPages: 2_000, crawlBudgetMs: 55_000, budgetMs: 65_000 });
    expect(rerunBudgets({ maxPages: 60, crawlBudgetMs: 45_000 }, 300_000).crawlBudgetMs).toBe(45_000);
  });
  it('rythme de réanalyse', () => {
    const now = new Date('2026-11-13T10:00:00Z');
    expect(isReanalysisDue('monthly', null, now)).toBe(true);
    expect(isReanalysisDue('monthly', '2026-11-01T10:00:00Z', now)).toBe(false);
    expect(isReanalysisDue('weekly', '2026-11-05T10:00:00Z', now)).toBe(true);
    expect(isReanalysisDue('none', null, now)).toBe(false);
  });
  it('publish.verify : charge utile invalide refusée sans écrire', async () => {
    await expect(jobs.getHandler('publish.verify')!({ businessId: 'b1' })).rejects.toThrow(/changeSetId/);
  });
});

describe('réanalyse d’un espace (faux site CRAWL)', () => {
  let srv: Awaited<ReturnType<typeof startFakeSites>>;
  beforeAll(async () => {
    srv = await startFakeSites();
  });
  afterAll(async () => {
    srv.restore();
    await srv.close();
  });

  it('analysis.rerun : vraie exploration, SEO + GEO, rattachée à l’espace, idempotente ; balayage selon l’offre', async () => {
    const b = await createBusiness({ name: 'Boulangerie Exemple', trade: 'boulangerie', city: 'Lyon', website: 'https://normal.test/', plan: 'essentiel' as never, segment: 'local', contactEmail: 'c@exemple.fr' });
    const job = { id: 'job-0001', type: 'analysis.rerun', attempt: 1, maxAttempts: 3, signal: new AbortController().signal };
    const r = await handleAnalysisRerun({ businessId: b.id, reason: 'test', _job: job });
    expect(r.analysisId).toBe('an_r_job0001');
    expect(r.pages).toBeGreaterThanOrEqual(6);
    const doc = (await getStoredAnalysis('an_r_job0001'))!;
    expect(doc.businessId).toBe(b.id);
    expect(doc.analysis.seo!.sections.length).toBeGreaterThanOrEqual(10);
    expect(doc.analysis.geo).not.toBeNull();
    expect(doc.analysis.modules.ai.status).toBe('skipped'); // aucun appel IA payant dans la réanalyse
    expect((await listAnalysesForBusiness(b.id)).map((a) => a.id)).toContain('an_r_job0001');
    // Rejouée : relit l'analyse déjà faite.
    expect(await handleAnalysisRerun({ businessId: b.id, _job: job })).toMatchObject({ reused: true });
    // Balayage : analysée à l'instant → pas due ; dans 40 jours → due (Essentiel : mensuelle).
    jobs.resetJobsForTests();
    const now = await handleAnalysisScheduled({ now: new Date().toISOString() });
    expect(now.queued).toBe(0);
    const later = await handleAnalysisScheduled({ now: new Date(Date.now() + 40 * 86_400_000).toISOString() });
    expect(later.queued).toBeGreaterThanOrEqual(1);
  });

  it('espace sans site ou démo : rien n’est exploré', async () => {
    const b = await createBusiness({ name: 'Sans site', trade: 'fleuriste', city: 'Lyon', plan: 'essentiel' as never, segment: 'local', contactEmail: 'c@exemple.fr' });
    expect(await handleAnalysisRerun({ businessId: b.id })).toMatchObject({ skipped: 'aucun site renseigné' });
    expect(await handleAnalysisRerun({ businessId: 'demo' })).toMatchObject({ skipped: expect.stringMatching(/démonstration/) });
  });
});
