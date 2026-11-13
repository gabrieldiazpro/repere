import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetRateLimit } from '@/lib/ratelimit';
import { startFakeSites, type FakeServer } from '@/lib/crawl/__tests__/fakesites';
import type { SiteCrawl } from '@/lib/crawl/types';
import { POST } from '../route';

let srv: FakeServer;
beforeAll(async () => {
  srv = await startFakeSites();
});
afterAll(() => srv.close());
beforeEach(() => resetRateLimit());

const req = (body: unknown, ip = '198.51.100.7') =>
  new Request('http://localhost/api/v5/crawl', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

type Ev = { type: string; phase?: string; crawl?: SiteCrawl; code?: string; error?: string };
const readNdjson = async (r: Response): Promise<Ev[]> =>
  (await r.text())
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Ev);

describe('POST /api/v5/crawl', () => {
  it('renvoie la progression puis le résultat en NDJSON, sans HTML brut', async () => {
    const r = await POST(req({ url: 'normal.test' }));
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toContain('application/x-ndjson');
    const evs = await readNdjson(r);
    expect(evs[0]).toMatchObject({ type: 'progress', phase: 'robots' });
    const last = evs.at(-1)!;
    expect(last.type).toBe('result');
    expect(last.crawl!.pages.length).toBeGreaterThan(5);
    expect(last.crawl!.pages.every((p) => p.html === undefined)).toBe(true);
    expect(last.crawl!.pages[0].title).toBe('Boulangerie Exemple à Lyon');
  });

  it('SSE sur demande', async () => {
    const r = await POST(req({ url: 'spa.test', format: 'sse' }));
    expect(r.headers.get('content-type')).toContain('text/event-stream');
    const txt = await r.text();
    expect(txt).toMatch(/^event: progress\ndata: \{/);
    expect(txt).toContain('event: result\ndata: ');
  });

  it('plafonds publics et validation', async () => {
    expect((await POST(req({ url: 'normal.test', maxPages: 500 }))).status).toBe(400);
    expect((await POST(req('pas du json'))).status).toBe(400);
    expect((await POST(req({}))).status).toBe(400);
    const evs = await readNdjson(await POST(req({ url: 'geant.test', maxPages: 5 })));
    expect(evs.at(-1)!.crawl!.pages).toHaveLength(5);
  });

  it('adresse interne : événement d’erreur', async () => {
    const evs = await readNdjson(await POST(req({ url: 'http://169.254.169.254/' })));
    expect(evs.at(-1)).toMatchObject({ type: 'error', code: 'blocked_ip' });
  });

  it('limite de débit par IP', async () => {
    for (let i = 0; i < 10; i++) {
      const r = await POST(req({ url: 'spa.test' }, '203.0.113.9'));
      expect(r.status).toBe(200);
      await r.text();
    }
    const r = await POST(req({ url: 'spa.test' }, '203.0.113.9'));
    expect(r.status).toBe(429);
    expect(r.headers.get('retry-after')).toBeTruthy();
  });
});
