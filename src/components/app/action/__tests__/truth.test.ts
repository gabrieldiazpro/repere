import { describe, expect, it } from 'vitest';
import type { FactCheckItem } from '@/lib/engine/types-v2';
import { cellKey, errorHistory, truthGrid } from '../truth';

const it_ = (field: FactCheckItem['field'], provider: FactCheckItem['provider'], verdict: FactCheckItem['verdict'], stated = 'x'): FactCheckItem => ({ field, provider, verdict, stated, expected: 'y', quote: '', severity: 'haute' });

describe('grille de vérité', () => {
  it('compte les champs et les paires, la case la plus grave gagne', () => {
    const g = truthGrid([it_('horaires', 'chatgpt', 'correct'), it_('horaires', 'chatgpt', 'faux'), it_('horaires', 'gemini', 'correct'), it_('prix', 'gemini', 'non_verifiable')], ['chatgpt', 'perplexity', 'gemini']);
    expect(g.checked).toBe(2);
    expect(g.providers).toEqual(['chatgpt', 'gemini']);
    expect(g.cells[cellKey('horaires', 'chatgpt')]).toBe('faux');
    expect(g.wrong).toBe(1);
    expect(g.correct).toBe(1);
    expect(g.answers).toBe(2);
  });
});

describe('historique des erreurs', () => {
  const a = (d: string, items: FactCheckItem[]) => ({ createdAt: d, measuredAt: d, factCheck: { checkedAt: d, items, errors: items.filter((i) => i.verdict === 'faux').length } });
  it('détectée, toujours présente, puis corrigée seulement si revérifiée', () => {
    const h = errorHistory(
      [
        a('2026-09-05', [it_('horaires', 'gemini', 'faux', 'fermé samedi'), it_('prix', 'chatgpt', 'faux')]),
        a('2026-10-05', [it_('horaires', 'gemini', 'faux', 'fermé le samedi'), it_('prix', 'chatgpt', 'non_verifiable')]),
        a('2026-11-05', [it_('horaires', 'gemini', 'correct')]),
      ],
      [{ kind: 'fact_fix', title: 'Corriger vos horaires', status: 'done', doneAt: '2026-10-20T10:00:00Z' }],
    );
    const hor = h.find((x) => x.field === 'horaires')!;
    expect(hor.firstSeen).toBe('2026-09-05');
    expect(hor.lastSeen).toBe('2026-10-05');
    expect(hor.resolvedAt).toBe('2026-11-05');
    expect(hor.stated).toBe('fermé le samedi');
    expect(hor.taskDoneAt).toBe('2026-10-20T10:00:00Z');
    const prix = h.find((x) => x.field === 'prix')!;
    expect(prix.resolvedAt).toBeNull();
    expect(prix.taskDoneAt).toBeNull();
    expect(h[0].field).toBe('prix'); // ouvertes d'abord
  });
});
