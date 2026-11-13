import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'repere-alerts-'));
for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_SUPABASE_URL']) delete process.env[k];

const { detectAlerts, detectAndRecordAlerts } = await import('@/lib/alerts');
const { compareFact, localFactCheck } = await import('@/lib/facts');
const { listAlerts } = await import('@/lib/db');
import type { AuditV2 } from '@/lib/alerts';
import type { BrandFacts } from '@/lib/engine/types-v2';
import type { ProviderId } from '@/lib/engine';

type M = { p: ProviderId; q: string; mentioned: boolean; competitors: string[] };

function audit(id: string, score: number, range: [number, number], mentions: M[], claims: { field: 'telephone' | 'horaires' | 'prix'; value: string; provider: ProviderId }[] = []): AuditV2 {
  const counts = new Map<string, number>();
  for (const m of mentions) for (const c of m.competitors) counts.set(c, (counts.get(c) ?? 0) + 1);
  const total = [...counts.values()].reduce((s, n) => s + n, 0) || 1;
  return {
    id,
    input: { businessName: 'Plomberie Test', trade: 'plombier', city: 'Paris', district: '11e' },
    createdAt: '2026-11-02T08:00:00.000Z',
    measuredAt: '2026-11-02T08:00:00.000Z',
    score,
    range: { low: range[0], high: range[1] },
    subScores: { chatgpt: score, perplexity: score, gemini: score, claude: null },
    mentionRate: 0.5,
    avgRank: 2,
    shareOfVoice: 0.2,
    competitors: [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name, n]) => ({ name, mentions: n, share: n / total })),
    queries: [...new Set(mentions.map((m) => m.q))].map((q) => ({ id: q, text: `question ${q}`, intent: 'best' as const })),
    mentions: mentions.map((m) => ({ provider: m.p, queryId: m.q, run: 1, mentioned: m.mentioned, rank: m.mentioned ? 1 : null, competitors: m.competitors })),
    answers: [],
    confidence: 'moyenne',
    demo: false,
    agreement: 0.8,
    providersUsed: ['chatgpt', 'perplexity', 'gemini'],
    excerpts: [],
    topActions: [],
    perception: claims.length
      ? { quotes: [], sentiment: { positif: 0.5, neutre: 0.5, negatif: 0 }, themes: [], claims: claims.map((c) => ({ ...c, quote: `L'IA dit : ${c.value}` })) }
      : undefined,
  };
}

const facts: BrandFacts = { businessId: 'b1', facts: { telephone: '01 43 55 12 34', horaires: 'Du lundi au vendredi, 8 h – 19 h', prix: 'Intervention à partir de 89 €' }, updatedAt: '' };

describe('detectAlerts', () => {
  const prev = audit('a1', 40, [34, 46], [
    { p: 'perplexity', q: 'q1', mentioned: true, competitors: ['Dupont Plomberie'] },
    { p: 'perplexity', q: 'q2', mentioned: true, competitors: [] },
    { p: 'chatgpt', q: 'q1', mentioned: true, competitors: ['Lefèvre'] },
  ]);
  const next = audit(
    'a2',
    25,
    [19, 31],
    [
      { p: 'perplexity', q: 'q1', mentioned: false, competitors: ['Dupont Plomberie'] },
      { p: 'perplexity', q: 'q2', mentioned: true, competitors: ['Dupont Plomberie', 'Plomberie Nouvelle'] },
      { p: 'perplexity', q: 'q3', mentioned: false, competitors: ['Dupont Plomberie', 'Plomberie Nouvelle'] },
      { p: 'chatgpt', q: 'q1', mentioned: true, competitors: ['Lefèvre'] },
    ],
    [
      { field: 'telephone', value: '01 99 99 99 99', provider: 'chatgpt' },
      { field: 'horaires', value: 'du lundi au vendredi de 8 h à 19 h', provider: 'gemini' },
    ],
  );

  it('détecte un concurrent qui passe devant sur une IA', () => {
    const a = detectAlerts(prev, next, null).find((x) => x.type === 'competitor_overtook');
    expect(a?.payload).toMatchObject({ competitor: 'Dupont Plomberie', provider: 'perplexity', competitorMentions: 3, clientMentions: 1 });
    expect(a?.title).toContain('Perplexity');
  });

  it('détecte un nouveau concurrent (≥ 2 citations, absent avant)', () => {
    const a = detectAlerts(prev, next, null).filter((x) => x.type === 'new_competitor');
    expect(a.map((x) => x.payload.competitor)).toEqual(['Plomberie Nouvelle']);
  });

  it('détecte une information fausse (hallucination) et ignore une formulation équivalente', () => {
    const a = detectAlerts(prev, next, facts).filter((x) => x.type === 'fact_error');
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ severity: 'critique', payload: { field: 'telephone', stated: '01 99 99 99 99' } });
    // première de la liste (tri par gravité)
    expect(detectAlerts(prev, next, facts)[0].type).toBe('fact_error');
  });

  it("ne réalerte pas une erreur déjà présente dans l'audit précédent", () => {
    const prevWithError = { ...prev, perception: next.perception };
    expect(detectAlerts(prevWithError, next, facts).filter((x) => x.type === 'fact_error')).toHaveLength(0);
  });

  it('signale une variation au-delà de la marge, pas en deçà', () => {
    expect(detectAlerts(prev, next, null).find((x) => x.type === 'visibility_change')?.payload).toMatchObject({ direction: 'down', delta: -15 });
    const small = audit('a3', 37, [31, 43], prev.mentions.map((m) => ({ p: m.provider, q: m.queryId, mentioned: m.mentioned, competitors: m.competitors })));
    expect(detectAlerts(prev, small, null).some((x) => x.type === 'visibility_change')).toBe(false);
  });

  it('premier audit : seules les erreurs factuelles', () => {
    expect(detectAlerts(null, next, facts).every((x) => x.type === 'fact_error')).toBe(true);
  });

  it('enregistre les alertes via recordAlert', async () => {
    const out = await detectAndRecordAlerts('biz-alerts', prev, next, facts);
    const stored = await listAlerts('biz-alerts');
    expect(stored).toHaveLength(out.length);
    expect(stored.map((s) => s.type)).toEqual(expect.arrayContaining(['fact_error', 'competitor_overtook', 'new_competitor', 'visibility_change']));
  });
});

describe('compareFact / localFactCheck', () => {
  it('tolère les formats de téléphone et de site', () => {
    expect(compareFact('telephone', '01 43 55 12 34', '+33 1 43 55 12 34')).toBe('correct');
    expect(compareFact('site', 'plomberie-martin.fr', 'https://www.plomberie-martin.fr/contact')).toBe('correct');
    expect(compareFact('prix', 'Intervention à partir de 89 €', 'à partir de 120 €')).toBe('faux');
    expect(compareFact('statut', 'ouvert', 'fermé définitivement')).toBe('faux');
  });
  it('compte les erreurs', () => {
    const r = localFactCheck(audit('x', 10, [5, 15], [], [{ field: 'prix', value: 'à partir de 120 €', provider: 'chatgpt' }]), facts);
    expect(r.errors).toBe(1);
    expect(r.items[0]).toMatchObject({ verdict: 'faux', severity: 'haute' });
  });
});
