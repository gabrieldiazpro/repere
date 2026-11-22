/**
 * V8 (TEST-MARQUE) — test de marque : tableau question × IA, marge d'erreur, « pourquoi lui » (sources, écarts de
 * site relevés pour de vrai, 3 actions), garde-fous de coût (cache 24 h, limite par domaine, plafond), e-mail.
 * Aucun réseau : moteur en démo ou modules injectés, faux site local.
 */
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createMockAudit } from '@/lib/engine/audit';
import type { AuditResult } from '@/lib/engine/types';
import { resetRateLimit } from '@/lib/ratelimit';
import { buildQuickQuestions, isFeminine, plannedCostEur } from '../aicheck';
import { buildBrandTest, competitorSite, competitorsByQuestion, sentenceWith, wilson } from '../brandtest';
import { brandCacheKey, guardedBrandTest } from '../aiguard';
import { pageSignals, siteSignals } from '../signals';
import { draftWhy, finalizeWhy } from '../why';
import { analysisEmailContent, brandHeadline } from '../mail';
import { collectAnalysis, runFullAnalysis } from '../run';
import type { AiCheckContext, AiCheckSummary, AnalysisEvent, FullAnalysis } from '../types';
import { SITE_HOST, clearAiKeys, startFakeSite, type FakeSite } from './fakeSite';

beforeAll(async () => {
  clearAiKeys();
  process.env.DATA_DIR = await fs.mkdtemp(path.join(os.tmpdir(), 'repere-brandtest-'));
});

function mockAudit(): AuditResult {
  const queries = buildQuickQuestions('local', 'boulangerie', 'Lyon', 4);
  return createMockAudit({ businessName: 'Boulangerie Dupont', trade: 'boulangerie', city: 'Lyon', website: 'https://boulangerie-dupont.fr/', segment: 'local' }, 'seed-v8', { queries, queriesMode: 'replace', providers: ['chatgpt', 'perplexity', 'gemini'] });
}

const COMPETITOR_HTML = `<!doctype html><html lang="fr"><head><title>Maison Fournier, boulangerie à Lyon</title>
<script type="application/ld+json">${JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'Bakery',
  name: 'Maison Fournier',
  telephone: '+33 4 78 00 00 00',
  address: { '@type': 'PostalAddress', streetAddress: '3 rue de la Paix', postalCode: '69002', addressLocality: 'Lyon' },
  aggregateRating: { '@type': 'AggregateRating', ratingValue: '4.8', reviewCount: '212' },
  openingHours: 'Mo-Sa 07:00-19:30',
  sameAs: ['https://www.facebook.com/maisonfournier'],
})}</script>
<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [] })}</script>
</head><body><main><h1>Maison Fournier</h1><p>Pain au levain, viennoiseries. Baguette 1,20 €.</p></main></body></html>`;

describe('tableau question × IA', () => {
  it('une cellule par question et par IA, statut, place, cités à la place, phrase, sources', () => {
    const t = buildBrandTest(mockAudit(), { brand: 'Boulangerie Dupont' });
    expect(t.questions).toHaveLength(4);
    expect(t.providers.map((p) => p.label)).toEqual(['ChatGPT', 'Perplexity', 'Gemini']);
    expect(t.demo).toBe(true);
    expect(t.note).toMatch(/Démonstration/);
    for (const q of t.questions) {
      expect(q.cells).toHaveLength(3);
      for (const c of q.cells) {
        expect(['cited', 'not_cited', 'no_reco', 'error']).toContain(c.status);
        if (c.status === 'cited') expect(c.rank === null || c.rank >= 1).toBe(true);
        if (c.status === 'not_cited') expect(c.rank).toBeNull();
        expect(c.instead.length).toBeLessThanOrEqual(3);
        expect(c.sources.length).toBeLessThanOrEqual(5);
      }
    }
    const cells = t.questions.flatMap((q) => q.cells);
    expect(t.overall.cited).toBe(cells.filter((c) => c.status === 'cited').length);
    expect(t.overall.low).toBeLessThanOrEqual(t.overall.rate);
    expect(t.overall.high).toBeGreaterThanOrEqual(t.overall.rate);
    // Une seule exécution : jamais plus de réponses comptées que de cellules.
    expect(t.overall.asked).toBeLessThanOrEqual(12);
  });

  it('intervalle de Wilson : large sur peu de réponses, nul sans réponse', () => {
    expect(wilson(0, 0)).toEqual({ cited: 0, asked: 0, rate: 0, low: 0, high: 0 });
    const w = wilson(3, 12);
    expect(w.rate).toBe(25);
    expect(w.low).toBeGreaterThan(5);
    expect(w.low).toBeLessThan(15);
    expect(w.high).toBeGreaterThan(45);
    expect(wilson(12, 12).high).toBe(100);
  });

  it('phrase extraite et site d’un concurrent repéré dans les réponses (jamais deviné)', () => {
    expect(sentenceWith('Voici mes choix. **Maison Fournier** : très bon pain. Autre chose.', 'maison fournier')).toBe('Maison Fournier : très bon pain.');
    expect(sentenceWith('Rien ici.', 'Dupont')).toBeUndefined();
    const answers = [{ text: 'Voir www.maison-fournier.fr pour les horaires.', citations: ['https://www.pagesjaunes.fr/x'] }];
    expect(competitorSite('Maison Fournier', answers)).toBe('https://www.maison-fournier.fr/');
    expect(competitorSite('Boulangerie Paris Centre', [{ text: '', citations: ['https://www.paris.fr/pages/x'] }])).toBeNull();
    expect(competitorSite('Maison Fournier', answers, ['maison-fournier.fr'])).toBeNull();
  });

  it('questions sans faute de genre', () => {
    expect(isFeminine('boulangerie')).toBe(true);
    expect(isFeminine('plombier')).toBe(false);
    const q = buildQuickQuestions('local', 'boulangerie', 'Lyon', 6).map((x) => x.text);
    expect(q[0]).toBe('Quelle boulangerie me recommandez-vous à Lyon ?');
    expect(q[1]).toBe('Quelles sont les boulangeries les mieux notées à Lyon ?');
    expect(q[3]).toBe('Pouvez-vous me conseiller une boulangerie sérieuse à Lyon ?');
    expect(buildQuickQuestions('local', 'plombier', 'Nantes', 3)[0].text).toBe('Quel plombier me recommandez-vous à Nantes ?');
  });
});

describe('pourquoi lui', () => {
  it('signaux relevés sur une page (rien prêté qui ne soit dans la page)', () => {
    const sig = pageSignals(COMPETITOR_HTML, 'Lyon');
    expect(Object.keys(sig).sort()).toEqual(['address', 'city', 'entity', 'faq', 'hours', 'phone', 'prices', 'rating', 'sameas'].sort());
    expect(sig.rating).toMatch(/4\.8.*212/);
    const bare = pageSignals('<html><head><title>Accueil</title></head><body><p>Bienvenue</p></body></html>', 'Lyon');
    expect(bare).toEqual({});
    expect(siteSignals(null, null)).toEqual({});
  });

  it('écarts = chez lui ET absents de vos pages ; 3 actions au plus, Repéré seulement si un correctif existe', () => {
    const r = mockAudit();
    const t = buildBrandTest(r, { brand: 'Boulangerie Dupont' });
    const drafts = draftWhy(t, r, 'https://boulangerie-dupont.fr/');
    expect(drafts.length).toBeGreaterThan(0);
    expect(drafts.length).toBeLessThanOrEqual(3);
    expect(new Set(drafts.map((d) => d.competitor)).size).toBe(drafts.length);
    expect(competitorsByQuestion(t).length).toBeGreaterThanOrEqual(drafts.length);
    const d = { ...drafts[0], site: { url: 'https://concurrent.test/', read: false } };
    const ours = pageSignals('<html><head><title>Boulangerie Dupont</title></head><body><a href="tel:0478000001">Appeler</a> Pain 1 €</body></html>', 'Lyon');
    const [w] = finalizeWhy([d], {
      ours,
      competitorPages: new Map([['https://concurrent.test/', { signals: pageSignals(COMPETITOR_HTML, 'Lyon') }]]),
      siteType: 'local',
      autoFixes: [{ findingId: 'geo.entity.missing', kind: 'jsonld', title: 'x', source: 'geo' }],
      demo: false,
      measuredAt: '2026-11-22T10:00:00.000Z',
    });
    const ids = w.gaps.map((g) => g.id);
    expect(ids).toEqual(expect.arrayContaining(['entity', 'rating', 'address', 'hours', 'faq']));
    expect(ids).not.toContain('phone'); // vous l'avez aussi
    expect(ids).not.toContain('prices');
    expect(w.site?.read).toBe(true);
    expect(w.actions.length).toBeLessThanOrEqual(3);
    expect(w.actions.find((a) => a.from === 'entity')?.by).toBe('repere');
    expect(w.actions.find((a) => a.from === 'rating')?.by ?? 'vous').toBe('vous');
    expect(w.basis).toMatch(/lue le 22 novembre 2026/);

    // Page du concurrent non lue : aucun écart prêté, actions sur ce qui manque chez vous.
    const [w2] = finalizeWhy([d], { ours, competitorPages: new Map(), siteType: 'local', autoFixes: [], demo: false, measuredAt: '2026-11-22T10:00:00.000Z' });
    expect(w2.gaps).toEqual([]);
    expect(w2.site?.read).toBe(false);
    expect(w2.actions.length).toBeGreaterThan(0);
  });
});

describe('garde-fous du test de marque', () => {
  const ctx = (over: Partial<AiCheckContext> = {}): AiCheckContext => ({
    url: 'https://garde.test/',
    brand: 'Garde',
    siteType: 'local',
    city: 'Lyon',
    activity: 'fleuriste',
    maxCalls: 18,
    signal: new AbortController().signal,
    ...over,
  });
  const fake = (calls: { n: number }) => async (c: AiCheckContext): Promise<AiCheckSummary> => {
    calls.n++;
    const t = buildBrandTest(mockAudit(), { brand: c.brand });
    return { demo: false, providers: ['chatgpt'], questions: [], score: 40, mentionRate: 0.3, calls: 4, topCompetitors: [], note: '', test: { ...t, demo: false } };
  };
  beforeEach(() => {
    resetRateLimit();
    process.env.OPENAI_API_KEY = 'sk-test-v8';
  });
  afterAll(() => {
    delete process.env.OPENAI_API_KEY;
    for (const k of ['ANALYSIS_AI_DAILY_CAP_EUR', 'ANALYSIS_AI_PER_DOMAIN_PER_DAY']) delete process.env[k];
  });

  it('cache 24 h : même domaine et mêmes paramètres → aucune IA réinterrogée, résultat daté', async () => {
    const calls = { n: 0 };
    const now = new Date('2026-11-22T10:00:00Z');
    const a = await guardedBrandTest(ctx(), 'garde.test', { run: fake(calls), now });
    const b = await guardedBrandTest(ctx(), 'garde.test', { run: fake(calls), now: new Date('2026-11-22T20:00:00Z') });
    expect(calls.n).toBe(1);
    expect(a?.test?.reused).toBeUndefined();
    expect(b?.test?.reused?.at).toBe(now.toISOString());
    // Ville corrigée : autres questions, nouveau test.
    await guardedBrandTest(ctx({ city: 'Lille' }), 'garde.test', { run: fake(calls), now });
    expect(calls.n).toBe(2);
    // Après 24 h : nouveau test.
    await guardedBrandTest(ctx(), 'garde.test', { run: fake(calls), now: new Date('2026-11-23T11:00:00Z') });
    expect(calls.n).toBe(3);
    expect(brandCacheKey('garde.test', ctx())).not.toBe(brandCacheKey('garde.test', ctx({ brand: 'Autre' })));
  });

  it('limite par domaine et par jour, puis plafond quotidien : test non lancé, raison dite', async () => {
    process.env.ANALYSIS_AI_PER_DOMAIN_PER_DAY = '1';
    const calls = { n: 0 };
    const skips: string[] = [];
    await guardedBrandTest(ctx({ brand: 'Lim1' }), 'limite.test', { run: fake(calls) });
    const r = await guardedBrandTest(ctx({ brand: 'Lim2', onSkip: (s) => skips.push(s.reason) }), 'limite.test', { run: fake(calls) });
    expect(r).toBeNull();
    expect(skips).toEqual(['domain_limit']);
    delete process.env.ANALYSIS_AI_PER_DOMAIN_PER_DAY;

    process.env.ANALYSIS_AI_DAILY_CAP_EUR = '0.0001';
    const r2 = await guardedBrandTest(ctx({ brand: 'Cap', onSkip: (s) => skips.push(s.reason) }), 'plafond.test', { run: fake(calls) });
    expect(r2).toBeNull();
    expect(skips.at(-1)).toBe('cost_cap');
    expect(calls.n).toBe(1);
    expect(plannedCostEur(['chatgpt'], 5)).toBeGreaterThan(0);
  });

  it('démonstration (aucune clé) : pas de garde-fou de coût, rien en cache', async () => {
    delete process.env.OPENAI_API_KEY;
    const calls = { n: 0 };
    await guardedBrandTest(ctx({ brand: 'Demo' }), 'demo.test', { run: fake(calls) });
    await guardedBrandTest(ctx({ brand: 'Demo' }), 'demo.test', { run: fake(calls) });
    expect(calls.n).toBe(2);
  });
});

describe('analyse complète avec test de marque (faux site, modules injectés)', () => {
  let site: FakeSite;
  beforeAll(async () => {
    site = await startFakeSite();
  });
  afterAll(() => site.close());

  it('événements brandplan → brand avant le résultat ; pourquoi lui avec la page du concurrent lue', async () => {
    const fetched: string[] = [];
    const events: AnalysisEvent[] = [];
    const a = await collectAnalysis(
      runFullAnalysis(
        { url: `https://${SITE_HOST}/` },
        {
          budgetMs: 25_000,
          crawlBudgetMs: 10_000,
          modules: {
            aiCheck: async (c) => {
              const r = mockAudit();
              r.demo = false;
              const t = buildBrandTest(r, { brand: c.brand });
              c.onPlan?.({ demo: false, questions: t.questions.map((q) => ({ id: q.id, text: q.text })), providers: t.providers.map((p) => ({ id: p.id, label: p.label })) });
              t.why = draftWhy(t, r, c.url).map((w) => ({ ...w, site: { url: 'https://concurrent.test/', read: false } }));
              return { demo: false, providers: ['chatgpt', 'perplexity', 'gemini'], questions: [], score: 40, mentionRate: 0.4, calls: 12, topCompetitors: [], note: '', test: t };
            },
            fetchPage: async (u) => {
              fetched.push(u);
              return { finalUrl: u, html: COMPETITOR_HTML };
            },
          },
        },
      ),
      (e) => events.push(e),
    );
    expect(a).not.toBeNull();
    const types = events.map((e) => e.type);
    expect(types.indexOf('brandplan')).toBeGreaterThan(-1);
    expect(types.indexOf('brandplan')).toBeLessThan(types.indexOf('brand'));
    expect(types.indexOf('brand')).toBeLessThan(types.indexOf('result'));
    expect(fetched).toEqual(['https://concurrent.test/']);
    const bt = a!.brandTest!;
    expect(bt.questions).toHaveLength(4);
    expect(a!.ai?.test).toBeUndefined(); // une seule copie
    expect(bt.why!.length).toBeGreaterThan(0);
    const w = bt.why![0];
    expect(w.site?.read).toBe(true);
    // Le faux site n'a ni note balisée ni FAQ : écarts relevés pour de vrai.
    expect(w.gaps.map((g) => g.id)).toEqual(expect.arrayContaining(['rating', 'faq']));
    expect(w.actions.length).toBeGreaterThan(0);
    expect(w.actions.length).toBeLessThanOrEqual(3);
  }, 40_000);

  it('e-mail : test de marque en tête, désinscription', () => {
    const t = { ...buildBrandTest(mockAudit(), { brand: 'Boulangerie Dupont' }), why: [] };
    const a = { id: 'an_x', detected: { brand: 'Boulangerie Dupont' }, input: { url: 'https://b.fr/' }, crawl: null, brandTest: t, verdict: 'Verdict.', scores: { seo: 50, geo: 40, global: 45 }, priorities: [], partial: false } as unknown as FullAnalysis;
    const c = analysisEmailContent(a, 'https://repere.test/analyse/an_x?t=abc', 'gerant@exemple.fr');
    expect(c.subject).toMatch(/Boulangerie Dupont : cité \d+ fois sur \d+ par les IA \(démonstration\)/);
    expect(c.text).toContain(brandHeadline(t));
    expect(c.text).toMatch(/ChatGPT : \d+ sur \d+/);
    expect(c.html).toMatch(/Ne plus recevoir/);
    expect(c.text).toMatch(/réponses simulées/);
  });
});
