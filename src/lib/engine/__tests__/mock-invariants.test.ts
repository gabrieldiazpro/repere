/**
 * Invariants du mock et des comptes démo (QA-VISUEL-APP, docs/v3/09-audit-app.md D3/D5/D7) :
 * - « cité » ⇔ le nom figure dans le texte de la réponse ; le rang = position réelle du nom dans la liste ;
 * - réponses, verbatims et sources datés de la mesure, pas du jour ;
 * - plafonds de vraisemblance : aucun concurrent cité partout, PagesJaunes pas dans 100 % des réponses.
 */
import { describe, expect, it } from 'vitest';
import { buildDemoWorkspace } from '@/lib/demo-v2';
import { createMockAudit, isBrandQuery, type AuditInput, type AuditResult } from '@/lib/engine';
import type { Segment } from '@/lib/engine/types-v2';
import { alignText } from '../providers/mock-align';

const LIST_LINE = /^(?:\d+\.|-|\*) \*\*(.+?)\*\*/;
const clientOf = (input: AuditInput) => input.businessName.replace(/\b(SARL|SASU|SAS|EURL|SNC|EIRL|EI)\b\.?/g, '').replace(/\s+/g, ' ').trim();

/** Rang du nom dans le texte (liste, ou ordre d'apparition dans la phrase « on trouve … »), null s'il est absent. */
function rankInText(text: string, name: string): number | null {
  const list = text.split('\n').map((l) => LIST_LINE.exec(l)?.[1]).filter((x): x is string => !!x);
  if (list.length) {
    const i = list.indexOf(name);
    return i >= 0 ? i + 1 : text.includes(name) ? -1 : null;
  }
  const m = /on trouve (.+?)\. /.exec(text);
  if (m) {
    const names = m[1].split(/, | et /).map((s) => s.trim());
    const i = names.indexOf(name);
    if (i >= 0) return i + 1;
  }
  return text.includes(name) ? -1 : null;
}

function checkAudit(a: AuditResult, label: string) {
  const client = clientOf(a.input);
  const qById = new Map(a.queries.map((q) => [q.id, q]));
  let checked = 0;
  for (const m of a.mentions) {
    const ans = a.answers.find((x) => x.provider === m.provider && x.queryId === m.queryId && x.run === m.run);
    expect(ans, `${label} : réponse absente pour ${m.provider}/${m.queryId}/${m.run}`).toBeTruthy();
    if (!ans || isBrandQuery(qById.get(m.queryId) ?? { id: m.queryId })) continue;
    const inText = ans.text.includes(client);
    const where = `${label} ${m.provider} « ${qById.get(m.queryId)?.text} » (passage ${m.run})`;
    expect(m.mentioned, `${where} : cité=${m.mentioned} mais nom ${inText ? 'présent' : 'absent'} du texte`).toBe(inText);
    if (m.mentioned) {
      const r = rankInText(ans.text, client);
      if (r !== null && r > 0) expect(m.rank, `${where} : rang annoncé ${m.rank}, position réelle ${r}`).toBe(r);
    } else expect(m.rank).toBeNull();
    checked++;
  }
  expect(checked).toBeGreaterThan(0);
}

const LOCAL: AuditInput = { businessName: 'Boulangerie Dupain', trade: 'boulangerie', city: 'Lyon' };
const PME: AuditInput & { segment: Segment; category: string } = { businessName: 'Kalipaie', trade: 'logiciel de paie', city: 'Paris', segment: 'pme', category: 'logiciel de paie' };
const ECOM: AuditInput & { segment: Segment; productCategories: string[] } = {
  businessName: 'Savons Lumen',
  trade: 'cosmétiques solides',
  city: 'Lyon',
  segment: 'ecommerce',
  productCategories: ['shampoing solide'],
};

describe('mock moteur : « cité » et rang dérivés du texte', () => {
  it.each([
    ['local', LOCAL],
    ['pme', PME],
    ['ecommerce', ECOM],
  ] as const)('createMockAudit %s', (seg, input) => {
    for (const seed of ['s1', 's2', 's3']) checkAudit(createMockAudit(input, `${seed}-${seg}`), `${seg}/${seed}`);
  });

  it.each(['local', 'pme', 'ecommerce'] as Segment[])('comptes démo façonnés (%s) : 6 mois, chaque réponse', (seg) => {
    const ws = buildDemoWorkspace(seg, new Date('2026-11-10T12:00:00Z'));
    expect(ws.audits).toHaveLength(6);
    for (const a of ws.audits) checkAudit(a, `${ws.business.id}/${a.id}`);
    // Le taux de citation suit la progression imposée (ni tout cité, ni rien au dernier mois).
    const last = ws.audits[ws.audits.length - 1];
    expect(last.mentions.some((m) => m.mentioned)).toBe(true);
    expect(last.mentions.some((m) => !m.mentioned)).toBe(true);
  });

  it('demo-pme : plus aucune réponse « cité » sans « Paysia » dans le texte (cas QA)', () => {
    const ws = buildDemoWorkspace('pme', new Date('2026-11-10T12:00:00Z'));
    for (const a of ws.audits)
      for (const m of a.mentions.filter((x) => x.mentioned)) {
        const ans = a.answers.find((x) => x.provider === m.provider && x.queryId === m.queryId && x.run === m.run)!;
        expect(ans.text).toContain('Paysia');
      }
  });
});

describe('dates de la démo = date de la mesure', () => {
  it.each(['local', 'pme', 'ecommerce'] as Segment[])('%s', (seg) => {
    const ws = buildDemoWorkspace(seg, new Date('2026-11-10T12:00:00Z'));
    for (const a of ws.audits) {
      const day = a.measuredAt!.slice(0, 10);
      expect(day.endsWith('-05')).toBe(true);
      for (const ans of a.answers) expect(ans.at?.slice(0, 10), `${a.id} réponse`).toBe(day);
      for (const q of a.perception?.quotes ?? []) expect(String(q.at).slice(0, 10), `${a.id} verbatim`).toBe(day);
      if (a.factCheck) expect(a.factCheck.checkedAt.slice(0, 10)).toBe(day);
    }
  });

  it('createMockAudit({ measuredAt }) date chaque réponse', () => {
    const at = '2026-10-05T08:00:00.000Z';
    const a = createMockAudit(PME, 'dates', { measuredAt: at });
    expect(a.measuredAt).toBe(at);
    expect(a.answers.every((x) => x.at === at)).toBe(true);
  });
});

describe('plafonds de vraisemblance (D5, D7)', () => {
  it.each(['local', 'pme', 'ecommerce'] as Segment[])('%s : aucun concurrent cité dans toutes les réponses du mois courant', (seg) => {
    const ws = buildDemoWorkspace(seg, new Date('2026-11-10T12:00:00Z'));
    const a = ws.audits[ws.audits.length - 1];
    const valid = a.mentions.filter((m) => !m.noRec);
    const counts = new Map<string, number>();
    for (const m of valid) for (const c of new Set(m.competitors)) counts.set(c, (counts.get(c) ?? 0) + 1);
    const max = Math.max(...counts.values());
    expect(max / valid.length).toBeLessThan(0.9);
  });

  it('local : PagesJaunes n’est pas citée par 100 % des réponses d’une IA', () => {
    const a = buildDemoWorkspace('local', new Date('2026-11-10T12:00:00Z')).audits.at(-1)!;
    for (const p of ['chatgpt', 'perplexity'] as const) {
      const reco = a.answers.filter((x) => x.provider === p && !isBrandQuery(a.queries.find((q) => q.id === x.queryId) ?? { id: x.queryId }));
      const pj = reco.filter((x) => x.citations.some((u) => u.includes('pagesjaunes'))).length;
      expect(reco.length).toBeGreaterThan(0);
      expect(pj / reco.length, p).toBeLessThan(0.9);
    }
  });
});

describe('alignText', () => {
  const list = 'Voici :\n\n1. **Alpha** – bien.\n2. **Beta** – bien.\n3. **Gamma** – bien.\n\nComparez.';
  it('injecte le nom au rang demandé et renumérote', () => {
    const t = alignText(list, { client: 'Paysia', mention: true, rank: 2 });
    expect(t).toContain('1. **Alpha**');
    expect(t).toContain('2. **Paysia**');
    expect(t).toContain('3. **Beta**');
    expect(t).toContain('4. **Gamma**');
  });
  it('retire le nom (ligne et phrases) et les concurrents demandés, jamais toutes les recommandations', () => {
    const src = 'Voici :\n\n1. **Paysia** – bien.\n2. **Beta** – bien.\n\nPaysia est joignable au 01. Comparez.';
    const t = alignText(src, { client: 'Paysia', mention: false, drop: ['Beta'] });
    expect(t).not.toContain('Paysia');
    expect(t).toContain('1. **Beta**');
    expect(t).toContain('Comparez.');
  });
  it('forme rédigée « on trouve A, B et C »', () => {
    const src = 'Voici. Parmi les noms qui reviennent le plus souvent, on trouve Alpha, Paysia et Beta. Très bien pour Paysia.\n\nAppelez.';
    const t = alignText(src, { client: 'Paysia', mention: false });
    expect(t).toContain('on trouve Alpha et Beta.');
    expect(t).not.toContain('Paysia');
  });
});
