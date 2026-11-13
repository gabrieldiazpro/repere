import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDoc, listDocs } from '../../store';
import { CATALOG } from '../catalog';
import { runBarometre, runMonthly } from '../pipeline';
import { applyWithdrawals, editionToCsv, getPageData, getPublicEdition, listPublished, publishedEntries } from '../public';
import { createSimulatedProvider } from '../simulate';
import { BudgetLedger, COLL, DemoPublicationError, addWithdrawal, isPublishable, saveEdition } from '../storage';
import type { BarometreDef, BarometreEdition, RawRun } from '../types';
import { fakeRealProvider, isolateStore } from './helpers';

const def: BarometreDef = { ...CATALOG.find((d) => d.slug === 'plombiers-lyon')!, providers: ['chatgpt', 'perplexity', 'gemini', 'claude'] };
const PLANNED = 12 * 4 * 3;
const bigBudget = () => new BudgetLedger('t', 1000);
const NOW = () => '2026-11-13T10:00:00.000Z';

beforeEach(() => {
  isolateStore();
  for (const k of ['OPENAI_API_KEY', 'PERPLEXITY_API_KEY', 'GEMINI_API_KEY', 'ANTHROPIC_API_KEY', 'MISTRAL_API_KEY', 'BAROMETRE_DEMO_PREVIEW', 'VERCEL_ENV']) vi.stubEnv(k, '');
});
afterEach(() => vi.unstubAllEnvs());

describe('pipeline complet sur fournisseur simulé', () => {
  it('collecte, extrait, fusionne, agrège ; l’édition simulée est rangée à part et jamais publiée', async () => {
    const res = await runBarometre(def, { demo: true, period: '2026-11', budget: bigBudget(), now: NOW });
    expect(res.status).toBe('collected');
    expect(res.calls).toBe(PLANNED);
    const e = res.edition!;
    expect(e.demo).toBe(true);
    expect(e.status).toBe('complete');
    expect(e.answersValid).toBe(PLANNED);
    expect(res.publishable).toBe(false);
    expect(isPublishable(e)).toBe(false);
    // Fusion : une seule ligne par nom de base malgré SARL, ville, accents, ordre des mots, majuscules.
    const alpha = e.ranking.filter((r) => /alpha/i.test(r.name));
    expect(alpha).toHaveLength(1);
    expect(alpha[0].variants.length).toBeGreaterThan(1);
    expect(alpha[0].rank).toBe(1);
    // Exclusions : nom de personne et nom vu par une seule IA sans site.
    expect(e.ranking.some((r) => /Jean Exemple/.test(r.name))).toBe(false);
    expect(e.ranking.some((r) => /Unique Fictif/.test(r.name))).toBe(false);
    expect(e.unverifiedCount).toBeGreaterThan(0);
    // Marges : l’intervalle contient le point ; tri décroissant.
    for (const r of e.ranking) {
      expect(r.rateLow).toBeLessThanOrEqual(r.rate);
      expect(r.rateHigh).toBeGreaterThanOrEqual(r.rate);
      expect(r.sovLow).toBeLessThanOrEqual(r.sov);
    }
    for (let i = 1; i < e.ranking.length; i++) expect(e.ranking[i - 1].rate).toBeGreaterThanOrEqual(e.ranking[i].rate);
    // Sources : Gemini exclu.
    expect(e.sources.length).toBeGreaterThan(0);
    expect(e.sources.every((s) => !s.providers.includes('gemini'))).toBe(true);
    expect(e.answersWithSources).toBe(12 * 3 * 3);
    // Stockage : collection démo uniquement.
    expect(await listDocs(COLL.editions)).toHaveLength(0);
    expect((await getDoc<BarometreEdition>(COLL.demo, 'plombiers-lyon:2026-11'))?.data.demo).toBe(true);
  });

  it('déterministe : même collecte, même classement et mêmes marges', async () => {
    const a = (await runBarometre(def, { demo: true, period: '2026-11', budget: bigBudget(), now: NOW })).edition!;
    isolateStore();
    const b = (await runBarometre(def, { demo: true, period: '2026-11', budget: bigBudget(), now: NOW })).edition!;
    expect(b.ranking).toEqual(a.ranking);
  });
});

describe('garde-fou : une simulation n’est JAMAIS publiée', () => {
  it('écriture publique refusée, déguisement détecté, pages / sitemap / llms.txt vides', async () => {
    const e = (await runBarometre(def, { demo: true, period: '2026-11', budget: bigBudget(), now: NOW })).edition!;
    await expect(saveEdition(e, { target: 'public' })).rejects.toBeInstanceOf(DemoPublicationError);
    // Même si quelqu’un retire le drapeau, le modèle simulé trahit l’édition.
    const disguised = { ...e, demo: false };
    expect(isPublishable(disguised)).toBe(false);
    await expect(saveEdition(disguised, { target: 'public' })).rejects.toBeInstanceOf(DemoPublicationError);
    await saveEdition(disguised);
    expect(await listDocs(COLL.editions)).toHaveLength(0);
    expect(await getPublicEdition('plombiers-lyon')).toBeNull();
    expect(await listPublished()).toEqual([]);
    expect(await publishedEntries()).toEqual([]);
    // Page : 404 en production, même avec l’aperçu demandé ; visible seulement en local avec BAROMETRE_DEMO_PREVIEW=1.
    expect(await getPageData('plombiers-lyon', { NODE_ENV: 'production', BAROMETRE_DEMO_PREVIEW: '1' })).toBeNull();
    expect(await getPageData('plombiers-lyon', { NODE_ENV: 'development', VERCEL_ENV: 'preview', BAROMETRE_DEMO_PREVIEW: '1' })).toBeNull();
    expect(await getPageData('plombiers-lyon', { NODE_ENV: 'development' })).toBeNull();
    const local = await getPageData('plombiers-lyon', { NODE_ENV: 'development', BAROMETRE_DEMO_PREVIEW: '1' });
    expect(local?.demo).toBe(true);
    expect(editionToCsv(local!.edition)).toContain(';oui');
  });

  it('une mesure réelle refuse un fournisseur simulé et ne retombe jamais sur le simulé sans clé', async () => {
    await expect(runBarometre(def, { period: '2026-11', budget: bigBudget(), providerFactory: (id, d) => createSimulatedProvider(id, d) })).rejects.toThrow(/simulé/);
    await expect(runBarometre(def, { period: '2026-11', budget: bigBudget() })).rejects.toThrow(/aucune IA configurée/);
  });
});

describe('budget', () => {
  it('s’arrête avant de dépasser, n’enregistre pas d’édition incomplète, puis reprend sans doublon', async () => {
    const counter = { n: 0 };
    const factory = (id: Parameters<typeof fakeRealProvider>[0], d: BarometreDef) => fakeRealProvider(id, d, { cost: 0.05, counter });
    const small = new BudgetLedger('2026-11', 2);
    const r1 = await runBarometre(def, { period: '2026-11', budget: small, providerFactory: factory, extractor: null, concurrency: 3, now: NOW });
    expect(r1.status).toBe('stopped_budget');
    expect(small.spentEur).toBeLessThanOrEqual(2 + 1e-9);
    expect(counter.n).toBe(40);
    expect(r1.publishable).toBe(false);
    expect(await listDocs(COLL.editions)).toHaveLength(0);
    const r2 = await runBarometre(def, { period: '2026-11', budget: new BudgetLedger('2026-11', 100), providerFactory: factory, extractor: null, now: NOW });
    expect(r2.status).toBe('collected');
    expect(counter.n).toBe(PLANNED);
    expect(r2.publishable).toBe(true);
  });

  it('passe mensuelle : les baromètres qui ne tiennent pas dans le budget sont reportés', async () => {
    const defs = CATALOG.slice(0, 3).map((d) => ({ ...d, providers: ['chatgpt', 'perplexity'] as BarometreDef['providers'] }));
    const res = await runMonthly({ catalog: defs, period: '2026-11', budgetEur: 1, providerFactory: (id, d) => fakeRealProvider(id, d, { cost: 0.001 }), extractor: null, now: NOW });
    // estimation (table) : 12 × 2 × 3 appels ≈ 0,71 € : un seul tient dans 1 €.
    expect(res.results.map((r) => r.slug)).toEqual([defs[0].slug]);
    expect(res.skippedForBudget).toEqual([defs[1].slug, defs[2].slug]);
  });
});

describe('reprise après interruption', () => {
  it('relancer ne repose que les questions manquantes ou en erreur', async () => {
    const counter = { n: 0 };
    const ctrl = new AbortController();
    const failing = new Set(['T1g-']);
    const factory = (id: Parameters<typeof fakeRealProvider>[0], d: BarometreDef) =>
      fakeRealProvider(id, d, {
        counter,
        fail: (q) => failing.size > 0 && q.startsWith('T9') && id === 'claude',
      });
    const wrapped = (id: Parameters<typeof fakeRealProvider>[0], d: BarometreDef) => {
      const p = factory(id, d);
      return { ...p, ask: async (q: string, c: Parameters<typeof p.ask>[1]) => { if (counter.n >= 50) ctrl.abort(); return p.ask(q, c); } };
    };
    const r1 = await runBarometre(def, { period: '2026-11', budget: bigBudget(), providerFactory: wrapped, extractor: null, signal: ctrl.signal, checkpointEvery: 5, concurrency: 2, now: NOW });
    expect(r1.status).toBe('aborted');
    const saved = (await getDoc<RawRun>(COLL.raw, 'plombiers-lyon:2026-11'))!.data;
    const done = Object.keys(saved.answers).length;
    expect(done).toBeGreaterThanOrEqual(50);
    // Simule un redémarrage : mémoire vidée, relecture depuis le disque.
    (globalThis as unknown as { __repereDocs: Map<string, unknown> }).__repereDocs.clear();
    failing.clear();
    const before = counter.n;
    const errored = Object.values(saved.answers).filter((a) => a.error).length;
    const r2 = await runBarometre(def, { period: '2026-11', budget: bigBudget(), providerFactory: factory, extractor: null, now: NOW });
    expect(r2.status).toBe('collected');
    expect(counter.n - before).toBe(PLANNED - done + errored);
    expect(r2.edition!.answersValid).toBe(PLANNED);
  });
});

describe('publication réelle, évolution, retrait, CSV', () => {
  it('édition publiable → page, sitemap, CSV ; mois suivant → évolution ; retrait appliqué au rendu', async () => {
    const factory = (seed: string) => (id: Parameters<typeof fakeRealProvider>[0], d: BarometreDef) => fakeRealProvider(id, d, { seed });
    const oct = await runBarometre(def, { period: '2026-10', budget: bigBudget(), providerFactory: factory('oct'), extractor: null, now: () => '2026-10-05T10:00:00.000Z' });
    expect(oct.publishable).toBe(true);
    expect(oct.edition!.version).toBe(1);
    const nov = await runBarometre(def, { period: '2026-11', budget: bigBudget(), providerFactory: factory('nov'), extractor: null, now: NOW });
    const e = nov.edition!;
    expect(e.evolution?.previousPeriod).toBe('2026-10');
    expect(e.ranking.every((r) => r.change)).toBe(true);
    expect(e.ranking.some((r) => r.change?.kind === 'delta')).toBe(true);

    const page = await getPageData('plombiers-lyon', { NODE_ENV: 'production' });
    expect(page?.demo).toBe(false);
    expect(page?.history.map((h) => h.period)).toEqual(['2026-11', '2026-10']);
    const entries = await publishedEntries();
    expect(entries.map((x) => x.path)).toEqual(['/barometre', '/barometre/plombiers-lyon']);

    // Recalcul du même mois : nouvelle version, l’ancienne archivée.
    const again = await runBarometre(def, { period: '2026-11', budget: bigBudget(), providerFactory: factory('nov'), extractor: null, now: NOW });
    expect(again.edition!.version).toBe(2);
    expect(await getDoc(COLL.archive, 'plombiers-lyon:2026-11:v1')).not.toBeNull();

    const leader = e.ranking[0];
    await addWithdrawal(leader.variants[leader.variants.length - 1], ['plombiers-lyon']);
    const after = await getPublicEdition('plombiers-lyon');
    expect(after!.ranking.some((r) => r.id === leader.id)).toBe(false);
    expect(after!.ranking[0].rank).toBe(1);
    expect(after!.withdrawnCount).toBeGreaterThan(0);

    const csv = editionToCsv(after!);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.split('\r\n')[0]).toContain('taux_citation_bas_90');
    expect(csv).not.toContain(leader.name);
  });

  it('CSV : pas d’injection de formule', () => {
    const fake = { period: '2026-11', slug: 's', providers: [], answersValid: 1, methodVersion: 'repere-barometre-v1.0', demo: false, ranking: [{ rank: 1, name: '=HYPERLINK("x")', variants: [], rate: 0.5, rateLow: 0.4, rateHigh: 0.6, sov: 0.2, sovLow: 0.1, sovHigh: 0.3, citedAnswers: 1, questions: 1, avgPosition: 1, byProvider: {} }] } as unknown as BarometreEdition;
    expect(editionToCsv(fake)).toContain(`"'=HYPERLINK(""x"")"`);
    expect(applyWithdrawals(fake, new Set()).ranking).toHaveLength(1);
  });
});
