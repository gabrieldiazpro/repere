import { describe, expect, it } from 'vitest';
import { createMockAudit } from '@/lib/engine/audit';
import { computeMargins } from '@/lib/engine/analytics';
import { auditStats } from '@/lib/digest/stats';
import { PROVIDER_META, PROVIDER_ORDER } from '../derive';
import { gapsOf, type ReportResult } from '../adapters';
import { citedUrls, decouvertePlanId, marginOf, safeHref, shortUrl, signupHref, summaryOf, voiceOf } from '../v3';

const local = createMockAudit({ businessName: 'Plomberie Martin', trade: 'plombier', city: 'Paris', district: '11e' }, 'v3-local') as ReportResult;
const pme = createMockAudit(
  { businessName: 'Paysia', trade: 'logiciel de paie', city: 'France', segment: 'pme', category: 'logiciel de paie pour PME', market: 'France' } as never,
  'v3-pme',
) as ReportResult;

describe('rapport V3 : dérivations', () => {
  it('Mistral a une étiquette et une place dans l’ordre des IA', () => {
    expect(PROVIDER_ORDER).toContain('mistral');
    expect(PROVIDER_META.mistral.label).toMatch(/Mistral/);
  });

  it('marge d’erreur : celle du moteur, même valeur que computeMargins', () => {
    for (const r of [local, pme]) {
      const m = marginOf(r);
      const ref = r.margins ?? computeMargins(r);
      expect(m.score).toBe(Math.round(r.score));
      expect(m.low).toBe(Math.round(ref.score.low));
      expect(m.high).toBe(Math.round(ref.score.high));
      expect(m.low).toBeLessThanOrEqual(m.score);
      expect(m.high).toBeGreaterThanOrEqual(m.score);
      if (m.margin > 0) expect(m.short).toBe(`${m.score} ± ${m.margin}`);
    }
  });

  it('marge recalculée pour un audit antérieur à la V3 (sans margins)', () => {
    const old = { ...local, margins: undefined } as ReportResult;
    expect(marginOf(old).low).toBe(marginOf(local).low);
  });

  it('synthèse : rang et comptages identiques à auditStats (une seule fonction par chiffre)', () => {
    const s = summaryOf(pme);
    const st = auditStats(pme);
    expect(s.rank).toBe(st.rank);
    expect(s.of).toBe(st.of);
    expect(s.cited).toBe(st.citations);
    expect(s.answers).toBe(st.answers);
    expect(s.action.title.length).toBeGreaterThan(3);
    expect(s.action.href.startsWith('#')).toBe(true);
  });

  it('synthèse : une erreur factuelle passe en premier', () => {
    const r = {
      ...local,
      factCheck: { checkedAt: local.createdAt, errors: 1, items: [{ field: 'horaires', expected: 'lun.-ven. 8 h - 19 h', stated: 'lun.-sam. 8 h - 20 h', provider: 'gemini', quote: '', verdict: 'faux', severity: 'haute' }] },
    } as unknown as ReportResult;
    expect(summaryOf(r).action.href).toBe('#verite');
  });

  it('URL citées : 5 au plus, triées par citations, liens http(s) seulement', () => {
    const urls = citedUrls(pme, 5);
    expect(urls.length).toBeLessThanOrEqual(5);
    for (let i = 1; i < urls.length; i++) expect(urls[i - 1].citations).toBeGreaterThanOrEqual(urls[i].citations);
    expect(safeHref('javascript:alert(1)')).toBeNull();
    expect(safeHref('https://www.capterra.fr/x')).toBe('https://www.capterra.fr/x');
    expect(shortUrl('https://www.capterra.fr/directory/paie?x=1')).toBe('capterra.fr/directory/paie');
  });

  it('URL citées : repli sur les exemples par domaine', () => {
    const r = {
      ...local,
      sources: { totalCitations: 3, domains: [{ domain: 'pagesjaunes.fr', label: 'PagesJaunes', category: 'annuaire', citations: 3, citationShare: 1, providers: ['chatgpt'], queries: [], clientPresence: 'absent', competitorsPresent: ['Guérin'], sampleUrls: ['https://www.pagesjaunes.fr/a', 'https://www.pagesjaunes.fr/b'] }], byCategory: {}, opportunities: [], clientCitedCount: 0, note: '' },
    } as unknown as ReportResult;
    const u = citedUrls(r);
    expect(u.map((x) => x.url)).toEqual(['https://www.pagesjaunes.fr/a', 'https://www.pagesjaunes.fr/b']);
    expect(u[0].competitors).toEqual(['Guérin']);
  });

  it('matrice thème × IA : taux entre 0 et 100, dimensions cohérentes', () => {
    const v = voiceOf(pme);
    if (!v) return; // moins de 2 thèmes : la section n'est pas affichée
    expect(v.cells.length).toBe(v.themes.length);
    for (const row of v.cells) {
      expect(row.length).toBe(v.providers.length);
      for (const c of row) if (c) {
        expect(c.rate).toBeGreaterThanOrEqual(0);
        expect(c.rate).toBeLessThanOrEqual(100);
        expect(c.cited).toBeLessThanOrEqual(c.answers);
      }
    }
  });

  it('« pourquoi ils passent devant » : seulement les concurrents réellement devant, comptage commun', () => {
    for (const r of [local, pme]) {
      const st = auditStats(r);
      const { gaps } = gapsOf(r);
      for (const g of gaps) {
        expect(g.mentions).toBeGreaterThan(st.citations);
        expect(g.reasons[0]).toContain(`contre ${st.citations} pour vous`);
      }
    }
  });

  it('conversion : Découverte du bon parcours, lien d’inscription rattaché à l’audit', () => {
    expect(decouvertePlanId(local)).toBe('local_decouverte');
    expect(decouvertePlanId(pme)).toBe('pme_decouverte');
    expect(signupHref(pme)).toBe(`/inscription?audit=${encodeURIComponent(pme.id)}&offre=pme_decouverte`);
  });
});
