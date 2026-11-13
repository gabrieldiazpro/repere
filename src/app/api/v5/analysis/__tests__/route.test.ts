/**
 * Route publique /api/v5/analysis sur un faux site local : flux NDJSON ordonné, lien signé, GET protégé,
 * cache 10 min par domaine, limites de débit (IP, domaine), case « activité professionnelle », SSRF.
 */
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetRateLimit } from '@/lib/ratelimit';
import { setAnalysisRouteOverrides } from '@/lib/analysis';
import { SITE_HOST, clearAiKeys, startFakeSite, type FakeSite } from '@/lib/analysis/__tests__/fakeSite';
import { POST } from '../route';
import { GET } from '../[id]/route';

let site: FakeSite;
beforeAll(async () => {
  clearAiKeys();
  process.env.DATA_DIR = await fs.mkdtemp(path.join(os.tmpdir(), 'repere-analysis-route-'));
  setAnalysisRouteOverrides({ budgetMs: 20_000, crawlBudgetMs: 10_000 });
  site = await startFakeSite();
});
afterAll(async () => {
  setAnalysisRouteOverrides(undefined);
  for (const k of ['ANALYSIS_PER_DOMAIN_PER_HOUR', 'ANALYSIS_RATE_LIMIT_PER_HOUR']) delete process.env[k];
  await site.close();
});
beforeEach(() => resetRateLimit());

let n = 0;
const post = (body: unknown, ip = `198.51.100.${(++n % 250) + 1}`) =>
  POST(new Request('http://localhost/api/v5/analysis', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': ip }, body: JSON.stringify(body) }));

async function lines(res: Response): Promise<Record<string, unknown>[]> {
  const text = await res.text();
  return text.split('\n').filter(Boolean).map((l) => JSON.parse(l) as Record<string, unknown>);
}

describe('POST /api/v5/analysis', () => {
  it('flux NDJSON complet, puis lien signé ; GET avec jeton seulement', async () => {
    const t0 = Date.now();
    const res = await post({ url: SITE_HOST, pro: true, email: 'gerant@exemple.fr', fresh: true });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/ndjson/);
    const ev = await lines(res);
    expect(Date.now() - t0).toBeLessThan(20_000);
    expect(ev[0].type).toBe('start');
    const types = ev.map((e) => e.type);
    expect(types.indexOf('result')).toBeGreaterThan(types.indexOf('detected'));
    const saved = ev.at(-1)!;
    expect(saved.type).toBe('saved');
    // RACCORDS-FINAUX : lien du rapport envoyé à l'e-mail saisi (journalisé sans Resend) ; pages lues dans le flux.
    expect(saved.emailed).toBe(true);
    expect(ev.some((e) => e.type === 'crawl' && Array.isArray(e.urls) && (e.urls as string[]).length > 0)).toBe(true);
    const seqs = ev.filter((e) => typeof e.seq === 'number').map((e) => e.seq as number);
    expect(seqs).toEqual([...seqs].sort((a, b) => a - b));
    expect(JSON.stringify(ev)).not.toMatch(/gerant@exemple\.fr|API_KEY/);

    const id = saved.id as string;
    expect((ev.find((e) => e.type === 'result') as { analysis: { partial: boolean } }).analysis.partial).toBe(false);
    const ok = await GET(new Request(`http://localhost/api/v5/analysis/${id}?t=${saved.token}`), { params: Promise.resolve({ id }) });
    expect(ok.status).toBe(200);
    const body = (await ok.json()) as { analysis: { id: string; detected: { brand: string } } };
    expect(body.analysis.detected.brand).toBe('Boulangerie Dupont');
    const no = await GET(new Request(`http://localhost/api/v5/analysis/${id}`), { params: Promise.resolve({ id }) });
    expect(no.status).toBe(404);
    const bad = await GET(new Request(`http://localhost/api/v5/analysis/${id}?t=${'x'.repeat(43)}`), { params: Promise.resolve({ id }) });
    expect(bad.status).toBe(404);

    // Cache 10 min : même domaine → même analyse, servie tout de suite, avec un NOUVEAU jeton valide.
    const c = await lines(await post({ url: `https://www.${SITE_HOST}/`, pro: true }));
    expect(c[0]).toMatchObject({ type: 'cached', id });
    const s2 = c.at(-1)!;
    expect(s2.type).toBe('saved');
    expect(s2.token).not.toBe(saved.token);
    const ok2 = await GET(new Request(`http://localhost/api/v5/analysis/${id}?t=${s2.token}`), { params: Promise.resolve({ id }) });
    expect(ok2.status).toBe(200);

    // Réanalyse (fresh) : comparaison avec la précédente.
    const r = await lines(await post({ url: SITE_HOST, pro: true, fresh: true }));
    const result = r.find((e) => e.type === 'result') as { analysis: { previousId?: string; comparison?: unknown } };
    expect(result.analysis.previousId).toBe(id);
    expect(result.analysis.comparison).toBeDefined();
  }, 60_000);

  it('case « activité professionnelle » obligatoire, pot de miel, SSRF', async () => {
    const r1 = await post({ url: SITE_HOST });
    expect(r1.status).toBe(400);
    expect(((await r1.json()) as { error: string }).error).toMatch(/professionnels/);
    expect((await post({ url: SITE_HOST, pro: false })).status).toBe(400);
    expect((await post({ url: SITE_HOST, pro: true, hp: 'robot' })).status).toBe(400);
    for (const url of ['http://127.0.0.1/', 'http://localhost/', 'http://169.254.169.254/', 'https://exemple.fr:8443/', 'ftp://exemple.fr/']) {
      const r = await post({ url, pro: true });
      expect(r.status, url).toBe(400);
    }
  });

  it('limite de débit par domaine analysé puis par IP', async () => {
    process.env.ANALYSIS_PER_DOMAIN_PER_HOUR = '1';
    const ok = await post({ url: SITE_HOST, pro: true, fresh: true });
    expect(ok.status).toBe(200);
    await ok.text();
    const blocked = await post({ url: SITE_HOST, pro: true, fresh: true });
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('retry-after')).toBeTruthy();
    delete process.env.ANALYSIS_PER_DOMAIN_PER_HOUR;

    resetRateLimit();
    process.env.ANALYSIS_RATE_LIMIT_PER_HOUR = '2';
    const ip = '203.0.113.7';
    for (let i = 0; i < 2; i++) await (await post({ url: SITE_HOST, pro: true }, ip)).text();
    const third = await post({ url: SITE_HOST, pro: true }, ip);
    expect(third.status).toBe(429);
    expect((await post({ url: SITE_HOST, pro: true }, '203.0.113.8')).status).toBe(200);
    delete process.env.ANALYSIS_RATE_LIMIT_PER_HOUR;
  }, 60_000);
});
