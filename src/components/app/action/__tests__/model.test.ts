import { describe, expect, it } from 'vitest';
import type { ExecTask } from '@/lib/engine/types-v2';
import { actionScore, calendarWeeks, easeOf, groupOf, lostQuestions, mondayOf, proofFor, sortActions } from '../model';

const task = (p: Partial<ExecTask>): ExecTask => ({
  id: p.id ?? 't',
  businessId: 'b',
  kind: p.kind ?? 'directory',
  title: p.title ?? 'Tâche',
  why: p.why ?? 'Parce que.',
  automation: 'semi',
  minutes: p.minutes ?? 30,
  impact: p.impact ?? 2,
  status: p.status ?? 'todo',
  createdAt: '2026-11-01T00:00:00Z',
  ...p,
});

const audit = {
  queries: [
    { id: 'q1', text: 'meilleur plombier Paris 11', intent: 'best' as const },
    { id: 'q2', text: 'plombier urgence Paris 11', intent: 'urgent' as const },
    { id: 'q3', text: 'avis Plomberie Martin', intent: 'review' as const, kind: 'brand' as const },
  ],
  mentions: [
    { provider: 'chatgpt' as const, queryId: 'q1', run: 1, mentioned: false, rank: null, competitors: ['Dupont', 'Leroy'] },
    { provider: 'gemini' as const, queryId: 'q1', run: 1, mentioned: false, rank: null, competitors: ['Dupont'] },
    { provider: 'chatgpt' as const, queryId: 'q2', run: 1, mentioned: true, rank: 2, competitors: ['Dupont'] },
    { provider: 'chatgpt' as const, queryId: 'q3', run: 1, mentioned: false, rank: null, competitors: ['X'] },
  ],
  sources: {
    totalCitations: 10,
    domains: [{ domain: 'pagesjaunes.fr', label: 'PagesJaunes', category: 'annuaire' as const, citations: 4, citationShare: 0.4, providers: [], queries: [], clientPresence: 'absent' as const, competitorsPresent: ['Dupont'], sampleUrls: [] }],
    byCategory: {},
    opportunities: [],
    clientCitedCount: 0,
  },
  factCheck: {
    checkedAt: '2026-11-05',
    errors: 1,
    items: [{ field: 'horaires' as const, expected: 'lun–sam 8 h–19 h', stated: 'fermé le samedi', provider: 'gemini' as const, quote: '', verdict: 'faux' as const, severity: 'haute' as const }],
  },
};

describe('classement des actions', () => {
  it('regroupe par type', () => {
    expect(groupOf('fact_fix')).toBe('erreur');
    expect(groupOf('faq_page')).toBe('site');
    expect(groupOf('schema')).toBe('technique');
    expect(groupOf('directory')).toBe('web');
  });
  it('score = impact × facilité, erreur factuelle prioritaire', () => {
    expect(easeOf(20)).toBe(3);
    expect(easeOf(90)).toBe(2);
    expect(easeOf(300)).toBe(1);
    expect(actionScore({ impact: 3, minutes: 20, kind: 'directory' })).toBe(9);
    expect(actionScore({ impact: 3, minutes: 20, kind: 'fact_fix' })).toBe(9);
    expect(actionScore({ impact: 1, minutes: 20, kind: 'fact_fix' })).toBe(4);
  });
  it('trie par score puis par durée', () => {
    const s = sortActions([task({ id: 'a', impact: 1, minutes: 20 }), task({ id: 'b', impact: 3, minutes: 200 }), task({ id: 'c', impact: 2, minutes: 20 }), task({ id: 'd', impact: 2, minutes: 10 })]);
    expect(s.map((t) => t.id)).toEqual(['d', 'c', 'a', 'b']);
  });
});

describe('preuve', () => {
  it('question perdue : jamais cité, concurrents présents, hors questions de marque', () => {
    const l = lostQuestions(audit);
    expect(l.map((q) => q.id)).toEqual(['q1']);
    expect(l[0].competitors[0]).toBe('Dupont');
  });
  it('erreur citée', () => {
    const p = proofFor(task({ kind: 'fact_fix', title: 'Corriger vos horaires sur Gemini' }), audit);
    expect(p.kind).toBe('error');
    expect(p.text).toContain('Gemini');
    expect(p.text).toContain('fermé le samedi');
  });
  it('source où vous manquez', () => {
    const p = proofFor(task({ kind: 'directory', sourceDomain: 'pagesjaunes.fr' }), audit);
    expect(p.kind).toBe('source');
    expect(p.text).toContain('PagesJaunes');
    expect(p.text).toContain('4 fois');
    expect(p.text).toContain('Dupont');
  });
  it('contenu : question perdue, sinon le pourquoi de la tâche', () => {
    expect(proofFor(task({ kind: 'faq_page' }), audit).kind).toBe('question');
    expect(proofFor(task({ kind: 'faq_page', why: 'W' }), null)).toEqual({ kind: 'none', text: 'W' });
  });
});

describe('calendrier', () => {
  it('lundi ISO', () => {
    expect(mondayOf(new Date('2026-11-10T12:00:00Z'))).toBe('2026-11-09');
    expect(mondayOf(new Date('2026-11-15T12:00:00Z'))).toBe('2026-11-09');
  });
  it('place les actions prévues et faites ; rien ne disparaît', () => {
    const today = new Date('2026-11-10T12:00:00Z');
    const w = calendarWeeks(
      [
        task({ id: 'old', week: '2026-10-19' }),
        task({ id: 'next', week: '2026-11-16' }),
        task({ id: 'far', week: '2027-03-01' }),
        task({ id: 'done', status: 'done', doneAt: '2026-11-03T09:00:00Z' }),
        task({ id: 'skip', status: 'skipped' }),
      ],
      today,
    );
    expect(w).toHaveLength(6);
    const cur = w.find((x) => x.current)!;
    expect(cur.monday).toBe('2026-11-09');
    expect(cur.planned.map((t) => t.id)).toEqual(['old']);
    expect(w.find((x) => x.monday === '2026-11-16')!.planned.map((t) => t.id)).toEqual(['next']);
    expect(w.at(-1)!.planned.map((t) => t.id)).toEqual(['far']);
    expect(w.find((x) => x.monday === '2026-11-02')!.done.map((t) => t.id)).toEqual(['done']);
  });
});
