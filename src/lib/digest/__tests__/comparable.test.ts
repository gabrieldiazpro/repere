/** B2 / B10 (qa/v3/regard-client-v3.md) : jamais de comparaison entre mesures de périmètres différents. */
import { describe, expect, it, vi } from 'vitest';
import { comparableAudits, comparableHistory, firstMeasureLine, nextMeasureDate, previousComparable, rankMove, newEntrants } from '../stats';
import type { AuditResult } from '@/lib/engine/types';

vi.setConfig({ testTimeout: 30_000 });

type A = AuditResult;
const DAY = 86_400_000;

function audit(id: string, at: number, questions: string[], extra: Partial<A> = {}): A {
  return {
    id,
    input: { businessName: 'Plomberie Karim', trade: 'plombier', city: 'Paris', district: '11e', segment: 'local' },
    score: 30,
    createdAt: new Date(at).toISOString(),
    queries: questions.map((text, i) => ({ id: `Q${i + 1}`, text, intent: 'best', kind: 'reco' })),
    mentions: [],
    competitors: [],
    excerpts: [],
    providersUsed: ['chatgpt'],
    subScores: {},
    ...extra,
  } as unknown as A;
}

const T0 = Date.parse('2026-11-10T08:00:00Z');
const FREE8 = Array.from({ length: 8 }, (_, i) => `Quel est le meilleur plombier à Paris 11e ? variante ${i}`);
const TRACK5 = FREE8.slice(0, 5);

describe('mesures comparables', () => {
  it('audit gratuit (8 questions) puis première mesure (5 questions) le même jour : pas de mesure précédente', () => {
    const free = audit('free', T0, FREE8, { score: 29 });
    const first = audit('first', T0 + 3600_000, TRACK5, { score: 50 });
    expect(comparableAudits(free, first)).toBe(false);
    expect(previousComparable([free, first])).toBeNull();
    expect(rankMove([free, first])).toBeNull();
    expect(newEntrants([free, first])).toEqual([]);
  });

  it('mêmes questions mais moins de 6 jours d’écart : pas de comparaison', () => {
    expect(comparableAudits(audit('a', T0, TRACK5), audit('b', T0 + 2 * DAY, TRACK5))).toBe(false);
  });

  it('mêmes questions, un mois d’écart : comparables', () => {
    const a = audit('a', T0, TRACK5);
    const b = audit('b', T0 + 30 * DAY, TRACK5);
    expect(comparableAudits(a, b)).toBe(true);
    expect(previousComparable([a, b])?.id).toBe('a');
  });

  it('autre parcours ou autres questions : jamais comparables', () => {
    const a = audit('a', T0, TRACK5);
    const pme = audit('b', T0 + 30 * DAY, TRACK5, { input: { businessName: 'X', trade: 'paie', city: 'France', segment: 'pme' } as A['input'] });
    expect(comparableAudits(a, pme)).toBe(false);
    expect(comparableAudits(a, audit('c', T0 + 30 * DAY, ['Autre question 1', 'Autre question 2']))).toBe(false);
  });

  it('historique : on écarte l’audit gratuit mais on garde les mesures suivies', () => {
    const free = audit('free', T0, FREE8);
    const m1 = audit('m1', T0 + 3600_000, TRACK5);
    const m2 = audit('m2', T0 + 29 * DAY, TRACK5);
    expect(comparableHistory([free, m1, m2]).map((a) => a.id)).toEqual(['m1', 'm2']);
    expect(previousComparable([m2, free, m1])?.id).toBe('m1');
  });

  it('comptes démo : tout l’historique reste comparable (courbes et évolutions inchangées)', async () => {
    const { buildDemoWorkspace } = await import('@/lib/demo-v2');
    for (const seg of ['local', 'pme', 'ecommerce'] as const) {
      const ws = buildDemoWorkspace(seg);
      expect(comparableHistory(ws.audits)).toHaveLength(ws.audits.length);
      expect(rankMove(ws.audits, 'month')).not.toBeNull();
    }
  });

  it('première mesure : point de départ et date de la prochaine mesure', () => {
    const next = nextMeasureDate('2026-11-10T08:00:00Z', 'monthly');
    expect(next.slice(0, 10)).toBe('2026-12-08');
    expect(firstMeasureLine(next)).toBe('Première mesure : voici votre point de départ. Prochaine mesure vers le 8 décembre.');
    expect(firstMeasureLine(null)).not.toMatch(/calme/);
  });
});
