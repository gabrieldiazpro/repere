import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetRateLimit } from '@/lib/ratelimit';
import { startFakeSites, type FakeServer } from '@/lib/crawl/__tests__/fakesites';
import { artisanSite } from '@/lib/geo/__tests__/fixtures';
import type { GeoReport } from '@/lib/geo';
import { POST } from '../route';

let srv: FakeServer;
beforeAll(async () => {
  srv = await startFakeSites();
});
afterAll(() => srv.close());
beforeEach(() => resetRateLimit());

const req = (body: unknown, ip = '198.51.100.9') =>
  new Request('http://localhost/api/v5/geo', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

describe('POST /api/v5/geo', () => {
  it('exploration fournie : rapport GEO complet', async () => {
    const r = await POST(req({ crawl: artisanSite(), siteType: 'artisan', ai: false, facts: { telephone: '04 78 12 34 56' } }));
    expect(r.status).toBe(200);
    const j = (await r.json()) as { ok: boolean; data: GeoReport };
    expect(j.ok).toBe(true);
    expect(j.data.sections).toHaveLength(8);
    expect(j.data.siteType).toBe('local');
    expect(j.data.demo).toBe(true);
    expect(j.data.method).toBe('repere-geo-v5.0');
  });

  it('url : exploration publique puis audit (faux site local)', async () => {
    const r = await POST(req({ url: 'normal.test', ai: false }));
    expect(r.status).toBe(200);
    const j = (await r.json()) as { data: GeoReport };
    expect(j.data.stats.pagesAnalyzed).toBeGreaterThan(3);
    expect(j.data.score).toBeGreaterThanOrEqual(0);
  });

  it('validation et limite', async () => {
    expect((await POST(req('pas du json'))).status).toBe(400);
    expect((await POST(req({}))).status).toBe(400);
    expect((await POST(req({ crawl: { origin: 'x' } }))).status).toBe(400);
    for (let i = 0; i < 10; i++) await POST(req({ crawl: artisanSite(), ai: false }, '203.0.113.5'));
    expect((await POST(req({ crawl: artisanSite(), ai: false }, '203.0.113.5'))).status).toBe(429);
  });
});
