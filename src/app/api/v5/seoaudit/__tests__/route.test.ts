import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetRateLimit } from '@/lib/ratelimit';
import { startFakeSites, type FakeServer } from '@/lib/crawl/__tests__/fakesites';
import { cleanPme } from '@/lib/seoaudit/__tests__/fixtures';
import type { SeoReport } from '@/lib/seoaudit/types';
import type { PerfData as SeoDataPerf } from '@/lib/seodata/types';
import { POST } from '../route';

let srv: FakeServer;
beforeAll(async () => {
  srv = await startFakeSites();
});
afterAll(() => srv.close());
beforeEach(() => resetRateLimit());

const req = (body: unknown, ip = '198.51.100.9') =>
  new Request('http://localhost/api/v5/seoaudit', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
const json = async (r: Response) => (await r.json()) as { ok: boolean; data?: SeoReport; error?: string; code?: string };

describe('POST /api/v5/seoaudit', () => {
  it('mode url : explore puis audite', async () => {
    const r = await POST(req({ url: 'normal.test' }));
    expect(r.status).toBe(200);
    const b = await json(r);
    expect(b.ok).toBe(true);
    expect(b.data!.stats.pagesCrawled).toBeGreaterThan(3);
    expect(b.data!.stats.pagesWithHtml).toBeGreaterThan(0);
    expect(b.data!.sections.flatMap((s) => s.findings.map((f) => f.id))).toContain('seo.img.alt_missing');
  });

  it('mode crawl : audit d’un SiteCrawl fourni, type imposé, PerfData de SEO-DATA', async () => {
    const perf: SeoDataPerf = {
      url: 'https://www.exemple.fr/',
      fetchedAt: '2026-11-12T00:00:00Z',
      demo: false,
      sources: ['crux'],
      errors: [],
      devices: { mobile: { device: 'mobile', field: { scope: 'origin', lcpMs: 4800, inpMs: 150, cls: 0.05, fcpMs: 1800, ttfbMs: 500, ratings: { lcp: 'poor', inp: 'good', cls: 'good' }, passesCwv: false, source: 'crux' }, lab: null } },
    };
    const b = await json(await POST(req({ crawl: cleanPme(), siteType: 'pme', perf })));
    expect(b.ok).toBe(true);
    const ids = b.data!.sections.flatMap((s) => s.findings.map((f) => `${f.id}:${f.severity}`));
    expect(ids).toEqual(['seo.cwv.lcp:high']);
    expect(b.data!.stats.perfData).toBe(true);
  });

  it('crawl sans HTML (publicCrawl) : pas de faux constats sur les contrôles HTML', async () => {
    const c = cleanPme();
    for (const p of c.pages) delete p.html;
    const b = await json(await POST(req({ crawl: c })));
    expect(b.data!.stats.pagesWithHtml).toBe(0);
    expect(b.data!.sections.flatMap((s) => s.findings)).toEqual([]);
  });

  it('refuse un corps invalide', async () => {
    expect((await POST(req('pas du json'))).status).toBe(400);
    expect((await POST(req({}))).status).toBe(400);
    expect((await POST(req({ url: 'normal.test', crawl: cleanPme() }))).status).toBe(400);
    const c = cleanPme() as unknown as { pages: unknown[] };
    c.pages = [{ url: 'x' }];
    const r = await POST(req({ crawl: c }));
    expect(r.status).toBe(400);
    expect((await json(r)).code).toBe('bad_request');
  });

  it('bloque les adresses internes (SSRF)', async () => {
    const r = await POST(req({ url: 'http://127.0.0.1/' }));
    expect(r.status).toBe(400);
  });

  it('limite les explorations par IP', async () => {
    for (let i = 0; i < 10; i++) await POST(req({ url: 'spa.test' }, '203.0.113.50'));
    const r = await POST(req({ url: 'spa.test' }, '203.0.113.50'));
    expect(r.status).toBe(429);
    expect(r.headers.get('retry-after')).toBeTruthy();
  });
});
