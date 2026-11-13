import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  auditCounts,
  buildContentBrief,
  buildVoiceMatrix,
  changeConfidence,
  computeMargins,
  createMockAudit,
  explainChange,
  mergeUrlHistory,
  normalizeCustomQuery,
  queryGaps,
  reconcilePerception,
  resolveAuditQueries,
  runAudit,
  selectedProviders,
  sentimentShares,
  type AuditInput,
  type AuditResult,
  type FactCheckReport,
  type PerceptionReport,
} from '../index';
import { inferAngle } from '../queries-v3';
import { parseMistralConversation, createMistralProvider, MISTRAL_COST_PER_CALL_EUR } from '../providers/mistral';
import { getProvider } from '../providers';

const KEYS = ['OPENAI_API_KEY', 'PERPLEXITY_API_KEY', 'GEMINI_API_KEY', 'ANTHROPIC_API_KEY', 'MISTRAL_API_KEY', 'MISTRAL_MODEL', 'AUDIT_PROVIDERS', 'AUDIT_EXTRACTOR'];
const saved: Record<string, string | undefined> = {};
beforeEach(() => {
  for (const k of KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
});
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

const LOCAL: AuditInput = { businessName: 'Plomberie Martin', trade: 'plombier', city: 'Paris', district: '11e', website: 'plomberie-martin.fr', segment: 'local' };
const PME: AuditInput = {
  businessName: 'Paysia',
  trade: 'logiciel de paie',
  city: 'Paris',
  website: 'paysia.fr',
  segment: 'pme',
  category: 'logiciel de paie pour PME',
  knownCompetitors: ['PayFit', 'Silae', 'Cegid', 'Lucca'],
  market: 'France',
};
const ECOM: AuditInput = {
  businessName: 'Maison Sora',
  trade: 'cosmétiques solides',
  city: 'Lyon',
  website: 'maison-sora.fr',
  segment: 'ecommerce',
  productCategories: ['shampoing solide', 'déodorant solide'],
  knownCompetitors: ['Lamazuna', 'Respire', 'Cut by Fred'],
};
const SEGMENTS: [string, AuditInput][] = [
  ['local', LOCAL],
  ['pme', PME],
  ['ecommerce', ECOM],
];
const AT = '2026-11-05T08:00:00.000Z';

describe('V3 · questions personnalisées', () => {
  it('normalise une question : id stable, angle, thème, étiquettes', () => {
    const q = normalizeCustomQuery({ text: '  Quel logiciel de paie   choisir pour 20 salariés ?', tags: ['Paie', 'paie', ''], theme: 'Choisir' }, PME)!;
    expect(q.id).toMatch(/^C-[0-9a-z]{4}$/);
    expect(q.text).toBe('Quel logiciel de paie choisir pour 20 salariés ?');
    expect(q.theme).toBe('Choisir');
    expect(q.tags).toEqual(['personnalisée', 'paie']);
    expect(q.custom).toBe(true);
    expect(q.kind).toBe('reco');
    expect(normalizeCustomQuery({ text: 'Quel logiciel de paie choisir pour 20 salariés ?' }, PME)!.id).toBe(q.id);
    expect(normalizeCustomQuery({ text: ' ' }, PME)).toBeNull();
  });

  it('déduit angle et intention ; détecte une question sur la marque', () => {
    expect(inferAngle('PayFit vs Silae : lequel choisir ?')).toBe('comparison');
    expect(inferAngle('Combien coûte un plombier le dimanche ?')).toBe('price');
    const b = normalizeCustomQuery({ text: 'Que pensez-vous de Paysia ?' }, PME)!;
    expect(b.kind).toBe('brand');
    expect(b.id).toMatch(/^CB-/);
    const i = normalizeCustomQuery({ text: 'Un plombier fiable ?', intent: 'review' }, LOCAL)!;
    expect(i.intent).toBe('review');
  });

  it('remplace ou complète les gabarits ; chaque question porte thème et étiquettes', () => {
    const custom = [{ text: 'Quel plombier pour une fuite sous évier à Paris 11e ?', tags: ['fuite'] }];
    const replaced = resolveAuditQueries(LOCAL, 'free', custom);
    expect(replaced).toHaveLength(1);
    const appended = resolveAuditQueries(LOCAL, 'free', custom, 'append');
    const base = resolveAuditQueries(LOCAL, 'free');
    expect(appended).toHaveLength(base.length + 1);
    for (const q of appended) {
      expect(q.theme).toBeTruthy();
      expect(q.tags!.length).toBeGreaterThan(0);
    }
    // doublon de texte retiré
    expect(resolveAuditQueries(LOCAL, 'free', [{ text: base[0].text }], 'append')).toHaveLength(base.length);
  });

  it('runAudit(input, { queries }) interroge les questions fournies', async () => {
    const r = await runAudit(PME, {
      queries: [{ text: 'Quel logiciel de paie pour une PME de 30 salariés ?', theme: 'Choisir' }, { text: 'PayFit ou Silae : lequel choisir ?' }],
      forceMock: true,
      measuredAt: AT,
    });
    expect(r.queries).toHaveLength(2);
    expect(new Set(r.answers.map((a) => a.queryId)).size).toBe(2);
    expect(r.measuredAt).toBe(AT);
    expect(r.voice!.themes).toContain('Choisir');
    expect(r.counts!.visibilityQuestions).toBe(2);
  });
});

describe('V3 · Mistral', () => {
  it('sélection : option payante avec la clé, jamais en gratuit', () => {
    expect(selectedProviders('paid')).not.toContain('mistral');
    process.env.MISTRAL_API_KEY = 'x';
    expect(selectedProviders('paid')).toContain('mistral');
    expect(selectedProviders('free')).not.toContain('mistral');
    process.env.AUDIT_PROVIDERS = 'chatgpt,lechat';
    expect(selectedProviders('free')).toEqual(['chatgpt', 'mistral']);
  });

  it('fournisseur réel avec la clé (modèle par variable), mock sinon ; coût budgété', () => {
    expect(createMistralProvider()).toBeNull();
    expect(getProvider('mistral', LOCAL, 's').demo).toBe(true);
    process.env.MISTRAL_API_KEY = 'x';
    process.env.MISTRAL_MODEL = 'mistral-medium-latest';
    const p = createMistralProvider()!;
    expect(p.model).toBe('mistral-medium-latest');
    expect(p.costPerCallEur).toBeGreaterThan(0);
    expect(MISTRAL_COST_PER_CALL_EUR).toBeLessThan(0.1);
  });

  it('lit texte et références de la Conversations API', () => {
    const r = parseMistralConversation({
      outputs: [
        { type: 'tool.execution', name: 'web_search' },
        {
          type: 'message.output',
          content: [
            { type: 'text', text: 'Plomberie Martin est bien noté.' },
            { type: 'tool_reference', tool: 'web_search', title: 'PagesJaunes', url: 'https://www.pagesjaunes.fr/x' },
            { type: 'text', text: ' Ets Bonnet aussi.' },
          ],
        },
      ],
    });
    expect(r.text).toBe('Plomberie Martin est bien noté. Ets Bonnet aussi.');
    expect(r.citations).toEqual(['https://www.pagesjaunes.fr/x']);
    expect(r.sources![0].title).toBe('PagesJaunes');
  });

  it('audit démo avec Mistral : sous-score et colonne dans la grille', async () => {
    const r = await runAudit(LOCAL, { providers: ['chatgpt', 'mistral'], forceMock: true });
    expect(r.providersUsed).toContain('mistral');
    expect(r.subScores.mistral).not.toBeUndefined();
    expect(r.voice!.providers).toContain('mistral');
  });

  it('budget : Mistral réel est compté et peut être écarté', async () => {
    process.env.MISTRAL_API_KEY = 'x';
    const calls: string[] = [];
    const orig = globalThis.fetch;
    globalThis.fetch = (async (url: string) => {
      calls.push(String(url));
      return new Response(JSON.stringify({ outputs: [{ type: 'message.output', content: 'Rien.' }] }), { status: 200 });
    }) as typeof fetch;
    try {
      const r = await runAudit(LOCAL, { providers: ['mistral'], budgetEur: 0 });
      expect(calls).toHaveLength(0);
      expect(r.details!.skippedForBudget).toBeGreaterThan(0);
    } finally {
      globalThis.fetch = orig;
    }
  });
});

describe.each(SEGMENTS)('V3 · mock %s', (_, input) => {
  const r = createMockAudit(input, 'demo-1', { measuredAt: AT });

  it('déterministe (à date de mesure égale)', () => {
    const again = createMockAudit(input, 'demo-1', { measuredAt: AT });
    expect(again.margins).toEqual(r.margins);
    expect(again.voice).toEqual(r.voice);
    expect(again.sources).toEqual(r.sources);
    expect(again.counts).toEqual(r.counts);
  });

  it('marges d’erreur par indicateur (bootstrap), cohérentes avec la fourchette du score', () => {
    const m = r.margins!;
    expect(m.method).toBe('bootstrap-questions');
    expect(m.samples).toBe(500);
    expect(m.score.value).toBe(r.score);
    expect(m.score.low).toBeLessThanOrEqual(r.score);
    expect(m.score.high).toBeGreaterThanOrEqual(r.score);
    expect(m.score.low).toBe(Math.min(r.range.low, r.score));
    for (const s of [m.mentionRate, m.shareOfVoice]) {
      expect(s.low).toBeLessThanOrEqual(s.value);
      expect(s.high).toBeGreaterThanOrEqual(s.value);
      expect(s.margin).toBeGreaterThanOrEqual(0);
      expect(s.high).toBeLessThanOrEqual(1);
    }
    expect(m.label).toMatch(/^Score \d+ ± \d+/);
  });

  it('part de voix thème × IA et 10 premiers concurrents', () => {
    const v = r.voice!;
    expect(v.themes.length).toBeGreaterThan(1);
    expect(v.cells).toHaveLength(v.themes.length);
    expect(v.providers).toEqual(r.providersUsed);
    let answers = 0;
    for (const row of v.cells)
      for (const c of row) {
        if (!c) continue;
        answers += c.answers;
        expect(c.shareOfVoice).toBeGreaterThanOrEqual(0);
        expect(c.shareOfVoice).toBeLessThanOrEqual(1);
        expect(c.leaders.length).toBeLessThanOrEqual(5);
      }
    expect(answers).toBe(r.counts!.answers);
    expect(v.topCompetitors.length).toBeLessThanOrEqual(10);
    expect(v.topCompetitors.map((c) => c.name)).toEqual(r.competitors.slice(0, 10).map((c) => c.name));
    const t = v.topCompetitors[0];
    expect(Object.values(t.byProvider).reduce((a, b) => a + (b ?? 0), 0)).toBe(t.mentions);
    expect(Object.values(t.byTheme).reduce((a, b) => a + b, 0)).toBe(t.mentions);
  });

  it('citations URL par URL', () => {
    const urls = r.sources!.urls!;
    expect(urls.length).toBeGreaterThan(0);
    const total = urls.reduce((a, u) => a + u.citations, 0);
    expect(total).toBeLessThanOrEqual(r.sources!.totalCitations);
    for (const u of urls.slice(0, 20)) {
      expect(u.url).toMatch(/^https?:\/\//);
      expect(u.domain).toBeTruthy();
      expect(u.providers.length).toBeGreaterThan(0);
      expect(u.queries.length).toBeGreaterThan(0);
      expect(u.providers).not.toContain('gemini');
    }
    for (let i = 1; i < urls.length; i++) expect(urls[i - 1].citations).toBeGreaterThanOrEqual(urls[i].citations);
  });

  it('cohérence : comptages uniques, dates de la mesure, erreur factuelle en négatif', () => {
    const c = auditCounts(r);
    expect(r.counts).toEqual(c);
    expect(c.visibilityQuestions).toBe(r.queries.filter((q) => q.kind !== 'brand' && !/^B\d/.test(q.id)).length);
    expect(c.label).toContain(`${c.visibilityQuestions} questions de visibilité`);
    expect(r.factCheck!.checkedAt).toBe(AT);
    expect(r.perception!.quotes.every((q) => q.at === AT)).toBe(true);
    expect(r.factCheck!.errors).toBe(1);
    expect(r.perception!.quotes.some((q) => q.factError && q.sentiment === 'negatif')).toBe(true);
    expect(r.perception!.sentiment.negatif).toBeGreaterThan(0);
    expect(r.perception!.sentiment).toEqual(sentimentShares(r.perception!.quotes));
  });

  it('brief de contenu depuis un écart, un concurrent et une source', () => {
    const gaps = queryGaps(r);
    const targets = [...gaps.slice(0, 1), ...(r.gaps ?? []).slice(0, 1), ...(r.sources?.opportunities ?? []).slice(0, 1)];
    expect(targets.length).toBeGreaterThan(1);
    for (const t of targets) {
      const b = buildContentBrief(t, input, r);
      expect(b.title).toBeTruthy();
      expect(b.angle).toBeTruthy();
      expect(b.outline.length).toBeGreaterThan(1);
      expect(b.length.maxWords).toBeGreaterThan(b.length.minWords);
      expect(b.note).toMatch(/sans aucune garantie/);
      expect(buildContentBrief(t, input, r)).toEqual(b);
    }
  });
});

describe('V3 · cohérence du sentiment', () => {
  it('un verbatim faux passe en négatif et les parts sont recalculées', () => {
    const p: PerceptionReport = {
      quotes: [{ provider: 'gemini', query: 'q', text: 'Plomberie Martin est ouvert le dimanche de 8h à 20h.', sentiment: 'positif', at: '2026-11-09T00:00:00Z' }],
      sentiment: { positif: 1, neutre: 0, negatif: 0 },
      themes: [],
      claims: [],
    };
    const fc: FactCheckReport = {
      checkedAt: AT,
      errors: 1,
      items: [{ field: 'horaires', provider: 'gemini', expected: 'lun-ven', stated: 'dimanche', verdict: 'faux', severity: 'haute', quote: 'Plomberie Martin est ouvert le dimanche de 8h à 20h.' }],
    };
    const out = reconcilePerception(p, fc, AT);
    expect(out.quotes[0].sentiment).toBe('negatif');
    expect(out.quotes[0].at).toBe(AT);
    expect(out.sentiment.negatif).toBe(1);
    // verbatim absent : ajouté
    const added = reconcilePerception({ ...p, quotes: [] }, fc, AT);
    expect(added.quotes).toHaveLength(1);
    expect(added.sentiment.negatif).toBe(1);
  });
});

describe('V3 · expliquer un changement', () => {
  it('confiance par rapport à la marge', () => {
    expect(changeConfidence(10, 6)).toBe('forte');
    expect(changeConfidence(4, 6)).toBe('moyenne');
    expect(changeConfidence(2, 6)).toBe('faible');
    expect(changeConfidence(0, 6)).toBe('faible');
  });

  it('deux mesures identiques : stable, rien à signaler', () => {
    const r = createMockAudit(LOCAL, 'demo-1', { measuredAt: AT });
    const e = explainChange(r, r);
    expect(e.score.delta).toBe(0);
    expect(e.comparable).toBe(true);
    expect(e.questionsGained).toHaveLength(0);
    expect(e.headline).toMatch(/stable/);
  });

  it('questions gagnées, IA, sources et concurrents ; phrases en français', () => {
    const prev = createMockAudit(PME, 'seed-a', { measuredAt: '2026-10-05T08:00:00.000Z' });
    const next = createMockAudit({ ...PME }, 'seed-b', { measuredAt: AT });
    const e = explainChange(prev, next);
    expect(e.from).toBe('2026-10-05T08:00:00.000Z');
    expect(e.to).toBe(AT);
    expect(e.score.delta).toBe(next.score - prev.score);
    expect(e.score.margin).toBeGreaterThanOrEqual(0);
    expect(e.headline).toMatch(/Votre score/);
    expect(e.sentences.length).toBeGreaterThan(0);
    expect(e.providers.map((p) => p.provider).sort()).toEqual([...new Set([...prev.providersUsed, ...next.providersUsed])].sort());
  });

  it('question perdue détectée de façon contrôlée', () => {
    const prev = createMockAudit(PME, 'demo-1', { measuredAt: '2026-10-05T08:00:00.000Z' });
    const target = prev.mentions.find((m) => m.mentioned)!;
    const next: AuditResult = {
      ...prev,
      measuredAt: AT,
      mentions: prev.mentions.map((m) => (m.queryId === target.queryId ? { ...m, mentioned: false, rank: null } : m)),
      margins: undefined,
    };
    const e = explainChange(prev, next);
    expect(e.questionsLost.map((q) => q.queryId)).toContain(target.queryId);
    expect(e.sentences.join(' ')).toMatch(/Questions perdues/);
  });

  it('signale des jeux de questions différents', () => {
    const prev = createMockAudit(LOCAL, 'demo-1', { measuredAt: AT });
    const next = createMockAudit(LOCAL, 'demo-1', { measuredAt: AT, queries: [{ text: 'Quel plombier pour une fuite à Paris 11e ?' }] });
    const e = explainChange(prev, next);
    expect(e.comparable).toBe(false);
    expect(e.warnings[0]).toMatch(/questions suivies ont changé/);
  });
});

describe('V3 · historique des URL', () => {
  it('fusionne deux mesures : citations additionnées, première et dernière date', () => {
    const a = createMockAudit(ECOM, 'demo-1', { measuredAt: '2026-10-05T08:00:00.000Z' });
    const b = createMockAudit(ECOM, 'demo-1', { measuredAt: AT });
    const m = mergeUrlHistory([b, a]);
    const u = m[0];
    const one = a.sources!.urls!.find((x) => x.url === u.url)!;
    expect(u.citations).toBe(one.citations * 2);
    expect(u.firstSeen).toBe('2026-10-05T08:00:00.000Z');
    expect(u.lastSeen).toBe(AT);
  });

  it('marges et grille calculables sur un audit stocké sans champs V3', () => {
    const r = createMockAudit(LOCAL, 'demo-1', { measuredAt: AT });
    const old = { ...r, margins: undefined, voice: undefined, counts: undefined };
    expect(computeMargins(old)).toEqual(r.margins);
    expect(buildVoiceMatrix(old)).toEqual(r.voice);
  });
});
