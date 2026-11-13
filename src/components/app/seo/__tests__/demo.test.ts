import { describe, expect, it } from 'vitest';
import { auditSeo } from '@/lib/seoaudit';
import { auditGeo } from '@/lib/geo';
import { DEMO_CRAWL_STAGES, demoSiteCrawl } from '@/lib/seoaudit/demo-crawl';
import { DEMO_SPECS } from '@/lib/seodata/demo';
import { diffRuns, summarizeCrawl, topFixes, linkStats, type SeoRun } from '../model';

const TYPES = { demo: 'local', 'demo-pme': 'pme', 'demo-ecom': 'ecommerce' } as const;

function run(id: keyof typeof TYPES, stage: number): SeoRun {
  const crawl = demoSiteCrawl(id, stage);
  const seo = auditSeo(crawl, { siteType: TYPES[id] });
  const geo = auditGeo(crawl, { siteType: TYPES[id], now: crawl.startedAt });
  return { id: `${id}:${stage}`, businessId: id, at: crawl.startedAt, demo: true, url: crawl.startUrl, pagesCrawled: crawl.pages.length, truncated: false, durationMs: 0, seo, geo, pages: summarizeCrawl(crawl), trigger: 'demo' };
}

describe('explorations démo (APP-SEO)', () => {
  for (const id of ['demo', 'demo-pme', 'demo-ecom'] as const) {
    it(`${id} : domaine cohérent avec SEO-DATA, audit réaliste, progression dans le temps`, () => {
      const runs = Array.from({ length: DEMO_CRAWL_STAGES }, (_, s) => run(id, s));
      const cur = runs.at(-1)!;
      expect(new URL(cur.url).hostname.replace(/^www\./, '')).toBe(DEMO_SPECS[id].domain);
      // Les pages des mots-clés démo existent dans l'exploration.
      for (const k of DEMO_SPECS[id].keywords) expect(cur.pages.some((p) => new URL(p.url).pathname === k.page), `${id} ${k.page}`).toBe(true);
      expect(cur.seo.stats.pagesWithHtml).toBeGreaterThan(10);
      expect(cur.seo.score).toBeGreaterThanOrEqual(40);
      expect(cur.seo.score).toBeLessThan(95);
      expect(cur.seo.score).toBeGreaterThanOrEqual(runs[0].seo.score);
      expect(topFixes(cur.seo, cur.geo).length).toBe(5);
      const d = diffRuns(runs[DEMO_CRAWL_STAGES - 2], cur);
      expect(d.resolved.length + d.better.length).toBeGreaterThan(0);
      expect(linkStats(cur.pages).broken.length).toBeGreaterThanOrEqual(0);
      if (process.env.SEO_DEBUG)
        console.log(id, runs.map((r) => `${r.seo.score}/${r.geo.score}`).join(' → '), '\n', cur.seo.sections.map((s) => `${s.id}:${s.score}:${s.findings.length}`).join(' '), '\n', topFixes(cur.seo, cur.geo, 12).map((f) => `${f.origin} ${f.severity} ${f.id} ${f.affectedCount} ${f.autoFix ? 'AUTO' : ''}`).join('\n '), '\n resolved', d.resolved.map((f) => f.id).join(','), 'appeared', d.appeared.map((f) => f.id).join(','));
    });
  }
});
