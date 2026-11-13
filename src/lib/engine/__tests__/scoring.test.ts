import { describe, expect, it } from 'vitest';
import { bootstrapRange, components, computeScore, rankQuality, runAgreement, W, wilson } from '../scoring';
import type { MentionResult, ProviderAnswer, ProviderId } from '../types';

const P: ProviderId[] = ['chatgpt', 'perplexity', 'gemini'];

function build(
  fn: (p: ProviderId, q: number, run: number) => { mentioned: boolean; rank?: number; competitors?: string[] },
  opts: { queries?: number; runs?: number; demo?: boolean } = {},
) {
  const answers: ProviderAnswer[] = [];
  const mentions: MentionResult[] = [];
  for (let q = 1; q <= (opts.queries ?? 8); q++)
    for (let run = 1; run <= (opts.runs ?? 2); run++)
      for (const p of P) {
        const r = fn(p, q, run);
        answers.push({ provider: p, queryId: `T${q}-0000`, run, text: 'x', citations: [], demo: !!opts.demo });
        mentions.push({
          provider: p,
          queryId: `T${q}-0000`,
          run,
          mentioned: r.mentioned,
          rank: r.mentioned ? r.rank ?? 1 : null,
          competitors: r.competitors ?? ['Concurrent A', 'Concurrent B', 'Concurrent C'],
        });
      }
  return { answers, mentions };
}

describe('formule', () => {
  it('poids conformes à la méthode', () => {
    expect(W.M + W.R + W.V + W.C).toBeCloseTo(1, 10);
    expect(W).toEqual({ M: 0.45, R: 0.2, V: 0.2, C: 0.15 });
  });

  it('q(r)', () => {
    expect(rankQuality(1)).toBe(1);
    expect(rankQuality(2)).toBeCloseTo(0.8);
    expect(rankQuality(6)).toBe(0);
    expect(rankQuality(9)).toBe(0);
  });

  it('borne basse : jamais cité → 0', () => {
    const { answers, mentions } = build(() => ({ mentioned: false }));
    const s = computeScore(answers, mentions, P, 'audit-0');
    expect(s.score).toBe(0);
    expect(s.range).toEqual({ low: 0, high: 0 });
    expect(s.subScores).toEqual({ chatgpt: 0, perplexity: 0, gemini: 0, claude: null });
  });

  it('borne haute : toujours cité au rang 1, aucun concurrent → proche de 100', () => {
    const { answers, mentions } = build(() => ({ mentioned: true, rank: 1, competitors: [] }));
    const s = computeScore(answers, mentions, P, 'audit-1');
    // M=1, V=1, C=1, R = 48/50 (rétrécissement) → 100 × (0,45 + 0,2×0,96 + 0,2 + 0,15) = 99
    expect(s.score).toBe(99);
    expect(s.score).toBeLessThanOrEqual(100);
    expect(s.confidence).toBe('bonne');
  });

  it('calcul détaillé d’un cas mixte', () => {
    // ChatGPT cite toujours au rang 2 avec 3 concurrents, les autres jamais.
    const { answers, mentions } = build((p) => ({ mentioned: p === 'chatgpt', rank: 2 }));
    const c = components(mentions, P);
    expect(c.M).toBeCloseTo(16 / 48);
    expect(c.R).toBeCloseTo(0.8 * (16 / 18));
    // SoV = 16 / (16 + 3 × 48)
    expect(c.sov).toBeCloseTo(16 / 160);
    expect(c.V).toBeCloseTo(0.1 / 0.25);
    expect(c.C).toBeCloseTo(1 / 3);
    const s = computeScore(answers, mentions, P, 'audit-2');
    const expected = Math.round(100 * (0.45 * c.M + 0.2 * c.R + 0.2 * c.V + 0.15 * c.C));
    expect(s.score).toBe(expected);
    expect(s.subScores.perplexity).toBe(0);
    expect(s.subScores.chatgpt).toBeGreaterThan(s.score);
    expect(s.competitors[0]).toMatchObject({ name: 'Concurrent A', mentions: 48 });
  });

  it('exclut erreurs et noRec du dénominateur', () => {
    const { answers, mentions } = build((p, q) => ({ mentioned: q <= 4 }));
    const a2 = answers.map((a, i) => (i % 6 === 0 ? { ...a, error: 'HTTP 500' } : a));
    const m2 = mentions.map((m, i) => (i % 6 === 1 ? { ...m, mentioned: false, competitors: [], noRec: true, snippet: '[aucune recommandation]' } : m));
    const s = computeScore(a2, m2, P, 'audit-3');
    expect(s.details.validAnswers).toBe(48 - 8 - 8);
    expect(s.details.excludedNoRec).toBe(8);
  });

  it('les réponses démo sont exclues quand il existe des réponses réelles, et la confiance devient faible', () => {
    const { answers, mentions } = build(() => ({ mentioned: true }));
    const a2 = answers.map((a) => (a.provider === 'gemini' ? { ...a, demo: true } : a));
    const s = computeScore(a2, mentions, P, 'audit-4');
    expect(s.subScores.gemini).toBeNull();
    expect(s.confidence).toBe('faible');
  });
});

describe('bootstrap et stabilité', () => {
  const data = build((p, q, run) => ({ mentioned: (q + run + p.length) % 3 === 0, rank: (q % 4) + 1 }));

  it('déterministe pour une même graine', () => {
    const a = computeScore(data.answers, data.mentions, P, 'audit-xyz');
    const b = computeScore(data.answers, data.mentions, P, 'audit-xyz');
    expect(a.range).toEqual(b.range);
    expect(a.score).toBe(b.score);
    expect(bootstrapRange(data.mentions, P, 'seed')).toEqual(bootstrapRange(data.mentions, P, 'seed'));
  });

  it('fourchette encadre le score', () => {
    const s = computeScore(data.answers, data.mentions, P, 'audit-xyz');
    expect(s.range.low).toBeLessThanOrEqual(s.score);
    expect(s.range.high).toBeGreaterThanOrEqual(s.score);
    expect(s.range.high).toBeGreaterThan(s.range.low);
  });

  it('agreement', () => {
    const { mentions } = build((p, q, run) => ({ mentioned: q === 1 ? run === 1 : true }));
    // 8 requêtes × 3 IA = 24 couples ; la requête 1 est instable sur les 3 IA.
    expect(runAgreement(mentions)).toBeCloseTo(21 / 24);
  });

  it('wilson', () => {
    const [lo, hi] = wilson(24, 48);
    expect(lo).toBeCloseTo(0.383, 2);
    expect(hi).toBeCloseTo(0.617, 2);
  });
});
