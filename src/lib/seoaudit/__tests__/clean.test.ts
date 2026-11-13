import { describe, expect, it } from 'vitest';
import { auditSeo, CHECKS, detectSiteType } from '..';
import { cleanLocal, cleanPme, cleanShop } from './fixtures';

const ids = (r: ReturnType<typeof auditSeo>) => r.sections.flatMap((s) => s.findings.map((f) => `${f.id} (${f.affectedCount}) ${f.affected[0]?.url ?? ''} ${f.affected[0]?.detail ?? ''}`));

describe('sites propres : aucun faux positif', () => {
  it.each([
    ['artisan', cleanLocal, 'local'],
    ['PME', cleanPme, 'pme'],
    ['boutique', cleanShop, 'ecommerce'],
  ] as const)('%s : aucun constat, score 100', (_n, make, type) => {
    const crawl = make();
    expect(detectSiteType(crawl)).toBe(type);
    const r = auditSeo(crawl);
    expect(ids(r)).toEqual([]);
    expect(r.score).toBe(100);
    expect(r.grade).toBe('bon');
    expect(r.topFixes).toEqual([]);
    expect(r.stats.siteType).toBe(type);
    expect(r.stats.checksRun).toBe(r.stats.checksApplicable);
  });

  it('catalogue : plus de 100 contrôles, identifiants uniques, textes et sources renseignés', () => {
    expect(CHECKS.length).toBeGreaterThanOrEqual(100);
    expect(new Set(CHECKS.map((c) => c.id)).size).toBe(CHECKS.length);
    for (const c of CHECKS) {
      expect(c.id).toMatch(/^seo\.[a-z0-9_]+\.[a-z0-9_]+$/);
      expect(c.why.length).toBeGreaterThan(20);
      expect(c.fix.length).toBeGreaterThan(10);
      expect(c.source).toMatch(/^https:\/\//);
      expect(c.title(1)).not.toMatch(/undefined/);
      expect(c.title(3)).not.toMatch(/undefined/);
    }
  });
});
