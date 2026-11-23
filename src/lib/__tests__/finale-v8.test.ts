/** V8 FINALE : raccords techniques (droits API, IA mesurables du site, Réglages, budget par offre, santé, contenus). */
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { getEntitlements, TIER_NAMES } from '@/lib/entitlements';
import { apiAllowed } from '@/lib/publicapi/access';
import { ALL_PROVIDERS } from '@/lib/engine/types';

beforeAll(() => {
  (globalThis as { __repereDocsDir?: string }).__repereDocsDir = mkdtempSync(path.join(os.tmpdir(), 'finale-v8-'));
});
afterEach(() => vi.unstubAllEnvs());

describe('droits : champ api', () => {
  it('Accompagné, Agence et démo ; pas Découverte ni Essentiel', () => {
    const e = (plan: string) => getEntitlements({ id: 'b', plan, segment: 'pme', planId: null } as never);
    expect(e('accompagne').api).toBe(true);
    expect(e('agency').api).toBe(true);
    expect(e('essentiel').api).toBe(false);
    expect(e('free').api).toBe(false);
    expect(getEntitlements({ id: 'demo', plan: 'free', segment: 'local', planId: null } as never).api).toBe(true);
    expect(apiAllowed(e('accompagne'))).toBe(true);
    expect(apiAllowed(e('essentiel'))).toBe(false);
  });
});

describe('site : IA mesurables', () => {
  it('10 IA, aucune IA « en option » annoncée comme incluse dans une offre', async () => {
    const { aiCoverage, aiCoverageCounts } = await import('@/components/site/ai-coverage');
    const list = aiCoverage();
    expect(list.map((a) => a.id).sort()).toEqual([...ALL_PROVIDERS].sort());
    expect(aiCoverageCounts().total).toBe(10);
    const off = (id: string) => list.find((a) => a.id === id)!;
    // V10 : aperçus IA de Google et AI Mode dans les offres payantes ; Copilot et DeepSeek en option (Accompagné, Agence).
    for (const id of ['copilot', 'deepseek']) expect(off(id).status).toBe('option');
    for (const id of ['google_aio', 'google_ai_mode']) expect(off(id)).toMatchObject({ status: 'offres', offers: 'Toutes les offres payantes' });
    expect(off('grok').status).toBe('demande');
    expect(off('chatgpt').offers).toBe('Toutes les offres');
    // Les IA « dans les offres » sont exactement celles des droits.
    const inEnt = new Set(['local', 'pme', 'ecommerce'].flatMap((s) => ['free', 'essentiel', 'accompagne'].flatMap((p) => getEntitlements({ id: 'x', plan: p, segment: s, planId: null } as never).engines)));
    for (const a of list) if (a.status === 'offres') expect(inEnt.has(a.id)).toBe(true);
    expect(off('copilot').mode).toMatch(/Bing/);
    expect(off('gemini').mode).toMatch(/sans recherche web/);
  });
});

describe('Réglages : liste dynamique des IA', () => {
  it('toutes les IA du moteur, en option quand aucune offre ne les inclut', async () => {
    const { engineAccess } = await import('@/components/app/shell/verrou');
    const names = { essentiel: TIER_NAMES.essentiel, accompagne: TIER_NAMES.accompagne };
    const ess = getEntitlements({ id: 'x', plan: 'essentiel', segment: 'pme', planId: null } as never);
    const list = engineAccess(ess, 'pme', (b) => getEntitlements(b), names, { extras: ['deepseek'] });
    expect(list.map((e) => e.id)).toEqual(ALL_PROVIDERS);
    expect(list.find((e) => e.id === 'google_aio')).toMatchObject({ included: true, optional: false });
    expect(list.find((e) => e.id === 'deepseek')).toMatchObject({ optional: true, extraActive: true });
    expect(list.find((e) => e.id === 'copilot')).toMatchObject({ optional: true });
    expect(list.find((e) => e.id === 'copilot')?.extraActive).toBeUndefined();
    expect(list.find((e) => e.id === 'mistral')).toMatchObject({ optional: false, unlock: TIER_NAMES.accompagne });
  });
});

describe('budget d’une mesure payante (économie des offres)', () => {
  it('V10 : « offre » par défaut (coût prévu + 10 %, plafonné) ; « fixe » = ancien garde-fou', async () => {
    const { paidBudgetForPlan } = await import('@/lib/engine/audit');
    expect(paidBudgetForPlan('paid', 18.4, 2.7)).toBeCloseTo(20.24);
    vi.stubEnv('AUDIT_BUDGET_PAID_MODE', 'fixe');
    expect(paidBudgetForPlan('paid', 18.4, 2.7)).toBe(2.7);
    vi.stubEnv('AUDIT_BUDGET_PAID_MODE', 'offre');
    expect(paidBudgetForPlan('paid', 10, 2.7)).toBeCloseTo(11);
    expect(paidBudgetForPlan('paid', 30, 2.7)).toBe(25);
    expect(paidBudgetForPlan('paid', 1, 2.7)).toBe(2.7);
    expect(paidBudgetForPlan('free', 10, 0.6)).toBe(0.6);
    vi.stubEnv('AUDIT_BUDGET_PAID_MAX_EUR', '40');
    expect(paidBudgetForPlan('paid', 30, 2.7)).toBeCloseTo(33);
  });
});

describe('santé : IA en option', () => {
  it('relevés Google / Bing seulement avec la liste et DataForSEO', async () => {
    const { optionalAiConfigured } = await import('@/lib/ops/health');
    expect(optionalAiConfigured({ DEEPSEEK_API_KEY: 'sk-x', AUDIT_SERP_ENGINES: 'google_aio' })).toMatchObject({ deepseek: true, grok: false, google_aio: false });
    const ok = optionalAiConfigured({ AUDIT_SERP_ENGINES: 'google_aio, copilot', DATAFORSEO_LOGIN: 'a', DATAFORSEO_PASSWORD: 'b' });
    expect(ok).toMatchObject({ google_aio: true, copilot: true, google_ai_mode: false });
    expect(optionalAiConfigured({ AUDIT_SERP_ENGINES: 'all', DATAFORSEO_LOGIN: 'a', DATAFORSEO_PASSWORD: 'b' }).google_ai_mode).toBe(true);
  });
});

describe('ROI : dépense DataForSEO des relevés d’IA', () => {
  it('cumul mensuel en dollars', async () => {
    const { recordSerpAiSpend, readSerpAiUsd } = await import('@/lib/roi/serpai');
    const now = new Date('2026-11-22T10:00:00Z');
    await recordSerpAiSpend(0.004, now);
    await recordSerpAiSpend(0.006, now);
    await recordSerpAiSpend(-1, now);
    expect(await readSerpAiUsd('2026-11')).toBeCloseTo(0.01);
    expect(await readSerpAiUsd('2026-10')).toBe(0);
  });
});

describe('agent de contenu : mesure J+30 / J+90 planifiée', () => {
  it('complète la mesure due à partir des mesures existantes, sans appel IA', async () => {
    const { putDoc } = await import('@/lib/store');
    const { DRAFTS, getDraft } = await import('@/lib/content/service');
    const { sweepContentEffects } = await import('@/lib/content/scheduled');
    const published = '2026-09-01T00:00:00.000Z';
    const draft = {
      id: 'cd-finale', businessId: 'biz-finale', status: 'published', questionIds: ['q1'], target: 'plombier lyon',
      updatedAt: published, createdAt: published, effect: { publishedAt: published, baseline: { at: published, ai: null, gsc: null, rank: null } },
    };
    await putDoc(DRAFTS, draft.id, draft, draft.businessId);
    const audit = vi.fn(async () => ({ measuredAt: '2026-10-15T00:00:00.000Z', mentions: [{ queryId: 'q1', mentioned: true } as never] }));
    const r = await sweepContentEffects(new Date('2026-10-20T00:00:00Z'), { latestAudit: audit, gsc: async () => null });
    expect(r).toMatchObject({ businesses: 1, measured: 1, errors: 0 });
    const d = await getDraft('biz-finale', 'cd-finale');
    expect(d?.effect?.d30?.ai).toMatchObject({ cited: 1, total: 1 });
    expect(d?.effect?.d90).toBeUndefined();
    // Déjà mesuré à J+30, J+90 pas encore dû : rien de plus.
    expect((await sweepContentEffects(new Date('2026-10-21T00:00:00Z'), { latestAudit: audit, gsc: async () => null })).measured).toBe(0);
  });
});
