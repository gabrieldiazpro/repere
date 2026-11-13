/** Intégration avec le vrai `crawlSite` de CRAWL sur ses faux sites HTTP locaux (aucune sortie réseau). */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crawlSite } from '@/lib/crawl';
import { startFakeSites, type FakeServer } from '@/lib/crawl/__tests__/fakesites';
import { auditSeo } from '..';

let srv: FakeServer;
beforeAll(async () => {
  srv = await startFakeSites();
});
afterAll(() => srv.close());
const fast = { delayMs: 0, timeBudgetMs: 15_000 };

const CASES: [string, string[], string[]][] = [
  ['normal.test', ['seo.img.alt_missing', 'seo.broken.internal', 'seo.link.orphans', 'seo.broken.external', 'seo.img.broken', 'seo.mobile.viewport_missing', 'seo.url.tracking_internal', 'seo.local.no_phone'], []],
  ['redirs.test', ['seo.redirect.loop', 'seo.redirect.chain', 'seo.redirect.temporary', 'seo.redirect.internal_links'], ['seo.https.http_pages', 'seo.broken.dev_links']],
  ['spa.test', ['seo.index.client_rendered'], []],
  ['meta.test', ['seo.index.xrobots_noindex', 'seo.dup.content', 'seo.hreflang.no_return', 'seo.canonical.relative'], []],
  ['casse.test', ['seo.sd.parse_errors', 'seo.img.broken'], []],
  ['partiel.test', ['seo.index.blocked_linked'], []],
];

describe('audit sur un vrai crawl (faux sites de CRAWL)', () => {
  it.each(CASES)('%s', async (host, expected, absent) => {
    const c = await crawlSite(host, { ...fast, checkLinks: true });
    const r = auditSeo(c);
    const ids = r.sections.flatMap((s) => s.findings.map((f) => f.id));
    for (const id of expected) expect(ids, id).toContain(id);
    for (const id of absent) expect(ids, id).not.toContain(id);
    expect(r.score).toBeLessThan(80);
    expect(r.topFixes.length).toBeGreaterThan(0);
    expect(r.stats.checksRun).toBe(r.stats.checksApplicable);
  });
});
