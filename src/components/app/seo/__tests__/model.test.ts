import { describe, expect, it } from 'vitest';
import { crawlRights, findingsCsv, movers, nextCrawlAllowed, opportunities, priorityOf, templateOf, type RankedFix } from '../model';

const fix = (o: Partial<RankedFix>): RankedFix => ({
  id: 'seo.x', category: 'contenu', severity: 'medium', title: 'T', why: 'W', fix: 'F', affected: [], affectedCount: 0, impact: 2, effort: 1,
  origin: 'seo', section: 'contenu', sectionLabel: 'Balises et contenu', priority: 0, ...o,
});

describe('model APP-SEO', () => {
  it('droits d’exploration : quota par période', () => {
    const r = crawlRights('essentiel');
    const now = new Date('2026-11-13T12:00:00Z');
    expect(nextCrawlAllowed(r, [], now)).toBeNull();
    const next = nextCrawlAllowed(r, ['2026-11-13T08:00:00Z'], now);
    expect(next?.toISOString()).toBe('2026-11-14T08:00:00.000Z');
    expect(nextCrawlAllowed(r, ['2026-11-12T08:00:00Z'], now)).toBeNull();
    expect(nextCrawlAllowed(crawlRights('demo'), [], now)).not.toBeNull();
    expect(crawlRights('inconnu').maxPages).toBe(60);
  });

  it('CSV : une ligne par page, séparateur ;, formules neutralisées', () => {
    const csv = findingsCsv([fix({ title: '=HYPERLINK("x")', affected: [{ url: 'https://a.fr/p', detail: 'd;1' }, { url: 'https://a.fr/q' }], affectedCount: 2 })]);
    const lines = csv.replace(/^﻿/, '').split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain(`"'=HYPERLINK(""x"")"`);
    expect(lines[1]).toContain('"d;1"');
  });

  it('priorité : gravité × effet ÷ effort', () => {
    expect(priorityOf({ severity: 'high', impact: 3, effort: 1 })).toBeGreaterThan(priorityOf({ severity: 'high', impact: 3, effort: 3 }));
  });

  it('opportunités : positions 4 à 15 avec impressions, triées par potentiel', () => {
    const rows = [
      { key: 'a', clicks: 10, impressions: 1000, ctr: 0.01, position: 8 },
      { key: 'b', clicks: 100, impressions: 1000, ctr: 0.1, position: 2 },
      { key: 'c', clicks: 1, impressions: 20, ctr: 0.05, position: 6 },
      { key: 'd', clicks: 5, impressions: 3000, ctr: 0.002, position: 14 },
    ];
    const o = opportunities(rows);
    expect(o.map((r) => r.key)).toEqual(['d', 'a']);
    expect(o[0].potential).toBeGreaterThan(0);
  });

  it('progression / recul des requêtes', () => {
    const m = movers([
      { key: 'up', clicks: 1, impressions: 10, ctr: 0.1, position: 5, previousPosition: 9 },
      { key: 'down', clicks: 1, impressions: 10, ctr: 0.1, position: 12, previousPosition: 7 },
      { key: 'same', clicks: 1, impressions: 10, ctr: 0.1, position: 5, previousPosition: 5.2 },
    ]);
    expect(m.up.map((r) => r.key)).toEqual(['up']);
    expect(m.down.map((r) => r.key)).toEqual(['down']);
  });

  it('modèles de page', () => {
    expect(templateOf('https://a.fr/')).toBe('accueil');
    expect(templateOf('https://a.fr/produits/x')).toBe('produits');
    expect(templateOf('https://a.fr/tarifs')).toBe('pages principales');
  });
});
