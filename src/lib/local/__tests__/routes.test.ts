import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.setConfig({ testTimeout: 60_000 });

beforeAll(() => {
  process.env.DATA_DIR = mkdtempSync(path.join(os.tmpdir(), 'repere-local-routes-'));
});

const get = (p: string) => new Request(`http://localhost${p}`);
const send = (p: string, method: string, body: unknown) => new Request(`http://localhost${p}`, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

describe('/api/local/* — compte démo (lecture seule)', () => {
  it('GET : les 5 livrables de démonstration', async () => {
    const gbp = await import('@/app/api/local/gbp/route');
    const map = await import('@/app/api/local/map/route');
    const nap = await import('@/app/api/local/nap/route');
    const posts = await import('@/app/api/local/posts/route');
    const reviews = await import('@/app/api/local/reviews/route');
    for (const [mod, p] of [[gbp, 'gbp'], [map, 'map'], [nap, 'nap'], [posts, 'posts'], [reviews, 'reviews']] as const) {
      const res = await mod.GET(get(`/api/local/${p}?businessId=demo`));
      expect(res.status, p).toBe(200);
      const j = await res.json();
      expect(j.ok).toBe(true);
      expect(j.demo).toBe(true);
    }
    const j = await (await map.GET(get('/api/local/map?businessId=demo'))).json();
    expect(j.data.map.label).toMatch(/Simulation/);
    expect(j.data.map.zones.length).toBeGreaterThan(5);
  });

  it('POST de calcul sans écriture ; PATCH refusé', async () => {
    const gbp = await import('@/app/api/local/gbp/route');
    const r1 = await (await gbp.POST(send('/api/local/gbp', 'POST', { businessId: 'demo', manual: { reviewCount: 3, rating: 5 } }))).json();
    expect(r1.ok).toBe(true);
    expect(r1.data.saved).toBe(false);
    const reviews = await import('@/app/api/local/reviews/route');
    const r2 = await (await reviews.POST(send('/api/local/reviews', 'POST', { businessId: 'demo', reviews: 'Très rapide et propre.\n\nTrop cher.' }))).json();
    expect(r2.data.report.analyzed).toBe(2);
    const posts = await import('@/app/api/local/posts/route');
    const r3 = await posts.PATCH(send('/api/local/posts', 'PATCH', { businessId: 'demo', postId: 'lp_x', status: 'published' }));
    expect(r3.status).toBe(403);
  });

  it('identifiant invalide → 400 ; rappels (cron) sans secret hors production', async () => {
    const gbp = await import('@/app/api/local/gbp/route');
    expect((await gbp.GET(get('/api/local/gbp?businessId=../x'))).status).toBe(400);
    const rem = await import('@/app/api/local/reminders/route');
    const res = await rem.POST(send('/api/local/reminders', 'POST', {}));
    expect(res.status).toBe(200);
  });
});
