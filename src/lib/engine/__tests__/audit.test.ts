import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyBudget } from '../audit';
import { createMockAudit, runAudit } from '../index';
import { selectedProviders } from '../providers';
import type { AuditInput } from '../types';

const KEYS = ['OPENAI_API_KEY', 'PERPLEXITY_API_KEY', 'GEMINI_API_KEY', 'ANTHROPIC_API_KEY', 'AUDIT_PROVIDERS'];
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
  vi.unstubAllGlobals();
});

const input: AuditInput = { businessName: 'Plomberie Dupont SARL', trade: 'plombier', city: 'Paris', district: '11' };

describe('runAudit en mode démo (aucune clé)', () => {
  it('produit un AuditResult complet et cohérent', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const progress: number[] = [];
    const r = await runAudit(input, { onProgress: (p) => progress.push(p.done) });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(r.demo).toBe(true);
    expect(r.confidence).toBe('faible');
    expect(r.providersUsed).toEqual(['chatgpt', 'perplexity', 'gemini']);
    expect(r.queries).toHaveLength(8);
    expect(r.answers).toHaveLength(48);
    expect(r.mentions).toHaveLength(48);
    expect(progress).toHaveLength(48);
    expect(progress[progress.length - 1]).toBe(48);
    expect(r.answers.every((a) => a.demo && !a.error && a.text.length > 20)).toBe(true);

    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
    expect(r.range.low).toBeLessThanOrEqual(r.score);
    expect(r.range.high).toBeGreaterThanOrEqual(r.score);
    expect(r.subScores.claude).toBeNull();
    expect(r.subScores.chatgpt).not.toBeNull();
    expect(r.competitors.length).toBeGreaterThan(2);
    expect(r.competitors.length).toBeLessThanOrEqual(10);
    expect(r.competitors.some((c) => /dupont/i.test(c.name))).toBe(false);
    expect(r.excerpts.length).toBeGreaterThanOrEqual(2);
    expect(r.excerpts.length).toBeLessThanOrEqual(4);
    expect(r.topActions).toHaveLength(3);
    expect(r.agreement).toBeGreaterThanOrEqual(0);
    expect(r.agreement).toBeLessThanOrEqual(1);
    expect(new Date(r.measuredAt).toString()).not.toBe('Invalid Date');
    expect(r.details?.method).toBe('repere-score-v1.0');
    // Cohérence mentions ↔ score
    const valid = r.mentions.filter((m) => !m.noRec);
    expect(r.mentionRate).toBeCloseTo(valid.filter((m) => m.mentioned).length / valid.length, 10);
  });

  it('mock déterministe : même graine → mêmes réponses et même score', async () => {
    const a = await runAudit(input, { seed: 's1' });
    const b = await runAudit(input, { seed: 's1' });
    expect(a.answers.map((x) => x.text)).toEqual(b.answers.map((x) => x.text));
    expect(a.mentions).toEqual(b.mentions);
    expect(a.score).toBe(b.score);
    const c1 = createMockAudit(input, 'seed-42');
    const c2 = createMockAudit(input, 'seed-42');
    expect(c1.id).toBe(c2.id);
    expect(c1.score).toBe(c2.score);
    expect(c1.range).toEqual(c2.range);
  });

  it('le mock cite parfois le commerce, avec des scores variés selon les commerces', () => {
    const scores = ['Plomberie Dupont', 'Plomberie Roux & Fils', 'Atelier Lucien', 'Dépannage Express Paris', 'Plomberie Garnier']
      .map((n) => createMockAudit({ ...input, businessName: n }).score);
    expect(Math.max(...scores)).toBeGreaterThan(Math.min(...scores));
    expect(scores.some((s) => s > 0)).toBe(true);
  });

  it('AUDIT_PROVIDERS sélectionne les IA', async () => {
    process.env.AUDIT_PROVIDERS = 'chatgpt, claude';
    expect(selectedProviders()).toEqual(['chatgpt', 'claude']);
    const r = await runAudit(input);
    expect(r.answers).toHaveLength(8 * 2 * 2);
    expect(r.subScores.claude).not.toBeNull();
    expect(r.subScores.gemini).toBeNull();
  });
});

describe('providers réels (fetch simulé)', () => {
  it('OpenAI : réponse parsée, autres IA en mock, réponses démo exclues du score', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    const body = {
      status: 'completed',
      output: [
        { type: 'web_search_call', status: 'completed' },
        {
          type: 'message',
          content: [
            {
              type: 'output_text',
              text: 'Voici :\n\n1. **Plomberie Martin** (Paris 11e) – rapide.\n2. **Dupont Plomberie** (Paris 11e) – sérieux.\n3. **Atelier Roux** – ok.',
              annotations: [{ type: 'url_citation', url: 'https://www.pagesjaunes.fr/x?utm_source=chatgpt' }],
            },
          ],
        },
      ],
    };
    const fetchSpy = vi.fn(async (url: string) => {
      if (String(url).includes('openai')) return new Response(JSON.stringify(body), { status: 200 });
      throw new Error('inattendu');
    });
    vi.stubGlobal('fetch', fetchSpy);
    process.env.AUDIT_EXTRACTOR = 'heuristic';
    const r = await runAudit(input);
    delete process.env.AUDIT_EXTRACTOR;
    const gpt = r.answers.filter((a) => a.provider === 'chatgpt');
    expect(gpt.every((a) => !a.demo && a.citations[0] === 'https://www.pagesjaunes.fr/x')).toBe(true);
    expect(r.mentions.filter((m) => m.provider === 'chatgpt').every((m) => m.mentioned && m.rank === 2)).toBe(true);
    expect(r.demo).toBe(true);
    expect(r.confidence).toBe('faible');
    expect(r.subScores.perplexity).toBeNull();
    expect(r.subScores.chatgpt).toBeGreaterThan(0);
    expect(r.details?.estimatedCostEur).toBeGreaterThan(0);
  });

  it('erreur HTTP : réponse marquée en erreur après une nouvelle tentative', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    process.env.AUDIT_PROVIDERS = 'chatgpt';
    process.env.AUDIT_EXTRACTOR = 'heuristic';
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ error: { message: 'invalid key' } }), { status: 401 }));
    vi.stubGlobal('fetch', fetchSpy);
    const r = await runAudit(input);
    delete process.env.AUDIT_EXTRACTOR;
    expect(fetchSpy).toHaveBeenCalledTimes(16); // 401 non réessayé
    expect(r.answers.every((a) => a.error?.includes('HTTP 401'))).toBe(true);
    expect(r.score).toBe(0);
    expect(r.confidence).toBe('faible');
  });
});

describe('garde-fou budget', () => {
  it('saute la seconde exécution de T8 puis de T4', () => {
    const provider = { id: 'chatgpt' as const, model: 'm', demo: false, costPerCallEur: 0.1, ask: async () => ({ text: '', citations: [] }) };
    const tasks = ['T1-a', 'T4-b', 'T8-c'].flatMap((id) =>
      [1, 2].map((run) => ({ query: { id, text: id, intent: 'best' as const }, run, provider, cost: 0.1 })),
    );
    const r1 = applyBudget(tasks, 0.5);
    expect(r1.skipped).toBe(1);
    expect(r1.kept.find((t) => t.query.id === 'T8-c' && t.run === 2)).toBeUndefined();
    const r2 = applyBudget(tasks, 0.4);
    expect(r2.skipped).toBe(2);
    expect(r2.kept.find((t) => t.query.id === 'T4-b' && t.run === 2)).toBeUndefined();
  });
});
