/**
 * Routes /api/v5/seodata/** sur les 3 comptes démo (vrai contrôle d'accès : lecture publique, écriture refusée) et
 * « non configuré » explicite pour un vrai compte sans clés.
 */
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { GET as status } from '../status/route';
import { GET as gsc, POST as gscPost } from '../search-console/route';
import { GET as perf } from '../perf/route';
import { GET as keywords, POST as keywordsPost } from '../keywords/route';
import { GET as rankings, POST as rankingsPost } from '../rankings/route';
import { GET as suggestions } from '../suggestions/route';
import { GET as backlinks } from '../backlinks/route';
import { GET as bing } from '../bing/route';
import { GET as cron } from '../cron/route';
import { contextFor, providersFor } from '@/lib/seodata/providers';
import { gscOverviewView, perfView } from '@/lib/seodata/service';

process.env.DATA_DIR = mkdtempSync(path.join(os.tmpdir(), 'seodata-routes-'));
for (const k of ['GOOGLE_CLIENT_ID', 'PAGESPEED_API_KEY', 'CRUX_API_KEY', 'DATAFORSEO_LOGIN', 'DATAFORSEO_PASSWORD']) delete process.env[k];

const get = (p: string) => new Request(`https://app.test${p}`);
const post = (p: string, body: unknown) => new Request(`https://app.test${p}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const body = async (r: Response) => (await r.json()) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

describe('Routes SEO-DATA — comptes démo', () => {
  it.each(['demo', 'demo-pme', 'demo-ecom'])('%s : toutes les vues répondent, étiquetées démo', async (id) => {
    const st = await body(await status(get(`/api/v5/seodata/status?businessId=${id}`)));
    expect(st.demo).toBe(true);
    expect(st.providers.every((p: { state: string }) => p.state === 'demo')).toBe(true);
    expect(st.budget.capEur).toBe(0);

    const g = await body(await gsc(get(`/api/v5/seodata/search-console?businessId=${id}`)));
    expect(g.available).toBe(true);
    expect(g.source).toMatchObject({ provider: 'demo', demo: true });
    expect(g.source.note).toMatch(/démonstration/);
    expect(g.monthly.length).toBeGreaterThanOrEqual(16);
    // progression sur 16 mois (cohérente avec la montée des scores des comptes démo)
    expect(g.monthly.at(-2).clicks).toBeGreaterThan(g.monthly[1].clicks);

    const pf = await body(await perf(get(`/api/v5/seodata/perf?businessId=${id}`)));
    expect(pf).toMatchObject({ available: true, demo: true });
    expect(pf.devices.mobile.field.lcpMs).toBeGreaterThan(0);

    const kw = await body(await keywords(get(`/api/v5/seodata/keywords?businessId=${id}`)));
    expect(kw.keywords.length).toBe(6);
    const rk = await body(await rankings(get(`/api/v5/seodata/rankings?businessId=${id}`)));
    expect(rk.report.demo).toBe(true);
    expect(rk.weeks).toHaveLength(12);
    const sg = await body(await suggestions(get(`/api/v5/seodata/suggestions?businessId=${id}`)));
    expect(sg.demo).toBe(true);
    const bl = await body(await backlinks(get(`/api/v5/seodata/backlinks?businessId=${id}`)));
    expect(bl).toMatchObject({ available: true, source: { demo: true } });
    expect(bl.referringDomains.every((d: { domain: string }) => d.domain.endsWith('.example'))).toBe(true);
    const bg = await body(await bing(get(`/api/v5/seodata/bing?businessId=${id}`)));
    expect(bg.source.demo).toBe(true);
  });

  it('écritures refusées sur un compte démo', async () => {
    expect((await keywordsPost(post('/api/v5/seodata/keywords', { businessId: 'demo', action: 'add', keywords: ['x'] }))).status).toBe(403);
    expect((await rankingsPost(post('/api/v5/seodata/rankings', { businessId: 'demo-pme' }))).status).toBe(403);
    expect((await gscPost(post('/api/v5/seodata/search-console', { businessId: 'demo-ecom', action: 'sync' }))).status).toBe(403);
  });

  it('inspection d’URL démo ; page hors du site refusée', async () => {
    const ok = await gscPost(post('/api/v5/seodata/search-console', { businessId: 'demo', action: 'inspect', url: 'https://plomberie-martin.fr/urgence' }));
    expect(await body(ok)).toMatchObject({ available: true, source: { demo: true } });
    const ko = await gscPost(post('/api/v5/seodata/search-console', { businessId: 'demo', action: 'inspect', url: 'https://ailleurs.fr/' }));
    expect(ko.status).toBe(400);
    const pf = await perf(get('/api/v5/seodata/perf?businessId=demo&url=https://ailleurs.fr/'));
    expect(pf.status).toBe(400);
  });

  it('entrées invalides et cron protégé', async () => {
    expect((await status(get('/api/v5/seodata/status?businessId=../x'))).status).toBe(400);
    process.env.CRON_SECRET = 'secret-cron-test';
    try {
      expect((await cron(get('/api/v5/seodata/cron'))).status).toBe(401);
      const ok = await cron(new Request('https://app.test/api/v5/seodata/cron', { headers: { authorization: 'Bearer secret-cron-test' } }));
      expect(await body(ok)).toEqual({ gsc: 0, ranks: 0, collects: 0, errors: 0 });
    } finally {
      delete process.env.CRON_SECRET;
    }
  });
});

describe('Vrai compte sans clés : « non configuré » explicite, aucun chiffre', () => {
  it('fournisseurs off avec raison, vues indisponibles', async () => {
    const rec = { id: 'reel', name: 'Réel', trade: 't', city: 'Paris', website: 'https://reel.fr', plan: 'accompagne', segment: 'pme', planId: null, lastScore: null, createdAt: '', ownerId: 'u', isActive: true, alertThreshold: 5 } as const;
    const ctx = await contextFor('reel', { ...rec });
    const p = await providersFor(ctx);
    expect(p.statuses.map((x) => [x.kind, x.state])).toEqual([['searchConsole', 'off'], ['perf', 'off'], ['keywords', 'off'], ['serp', 'off'], ['backlinks', 'off'], ['bing', 'off']]);
    expect(p.statuses.every((x) => x.reason && x.reason.length > 10)).toBe(true);
    expect(await gscOverviewView(ctx, p)).toMatchObject({ available: false, state: 'off' });
    expect(await perfView(ctx, p, null)).toMatchObject({ available: false, reason: expect.stringMatching(/PAGESPEED_API_KEY/) });
  });
});
