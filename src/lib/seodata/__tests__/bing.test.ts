import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BingWebmaster, bingFor, connectBing, msDate } from '../bing';
import { setSeoDataEndpoints } from '../http';
import { getDoc } from '@/lib/store';
import { startFakeServer, type FakeServer } from './fake-server';

process.env.DATA_DIR = mkdtempSync(path.join(os.tmpdir(), 'seodata-bing-'));
const KEY = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';

let s: FakeServer;
beforeAll(async () => {
  s = await startFakeServer();
  setSeoDataEndpoints({ bing: `${s.url}/webmaster/api.svc/json` });
  s.on('GET', /\/webmaster\/api\.svc\/json\/.+/, (r) => {
    if (r.query.get('apikey') !== KEY) return { status: 400, json: { ErrorCode: 3, Message: 'InvalidApiKey' } };
    const m = r.path.split('/').pop();
    // Format JSON documenté : tableau sous « d », dates « \/Date(ms)\/ »
    if (m === 'GetUserSites') return { json: { d: [{ __type: 'Site:#Microsoft.Bing.Webmaster.Api', Url: 'https://www.exemple.fr/', IsVerified: true }, { Url: 'https://autre.fr/', IsVerified: false }] } };
    if (m === 'GetQueryStats') return { json: { d: [{ __type: 'QueryStats:#Microsoft.Bing.Webmaster.Api', AvgClickPosition: 3, AvgImpressionPosition: 4.5, Clicks: 12, Date: '/Date(1762588800000)/', Impressions: 240, Query: 'logiciel paie' }, { AvgImpressionPosition: 0, Clicks: 0, Date: '/Date(1762588800000-0800)/', Impressions: 3, Query: 'rare' }] } };
    if (m === 'GetRankAndTrafficStats') return { json: { d: [{ Clicks: 40, Date: '/Date(1762588800000)/', Impressions: 900 }, { Clicks: 31, Date: '/Date(1761984000000)/', Impressions: 800 }] } };
    return { status: 404, json: {} };
  });
});
afterAll(async () => {
  setSeoDataEndpoints(null);
  await s.close();
});

describe('Bing Webmaster Tools', () => {
  it('dates Microsoft JSON', () => {
    expect(msDate('/Date(1762588800000)/')).toBe('2025-11-08');
    expect(msDate('/Date(1762588800000-0800)/')).toBe('2025-11-08');
    expect(msDate(null)).toBe('');
  });

  it('requêtes et trafic ; position 0 = inconnue', async () => {
    const b = new BingWebmaster(KEY);
    const q = await b.queryStats('https://www.exemple.fr/');
    expect(q[0]).toEqual({ query: 'logiciel paie', date: '2025-11-08', clicks: 12, impressions: 240, avgPosition: 4.5 });
    expect(q[1].avgPosition).toBeNull();
    const t = await b.trafficStats('https://www.exemple.fr/');
    expect(t.map((x) => x.date)).toEqual(['2025-11-01', '2025-11-08']);
    expect(s.requests.some((r) => r.path.endsWith('/GetQueryStats') && r.query.get('siteUrl') === 'https://www.exemple.fr/')).toBe(true);
  });

  it('connexion : clé vérifiée, site vérifié requis, clé chiffrée au repos', async () => {
    await expect(connectBing('b1', 'X'.repeat(32), 'exemple.fr')).rejects.toMatchObject({ code: 'auth' });
    await expect(connectBing('b1', KEY, 'autre.fr')).rejects.toThrow(/pas vérifié/);
    await expect(connectBing('demo', KEY, 'exemple.fr')).rejects.toMatchObject({ code: 'demo_read_only' });
    expect(await connectBing('b1', KEY, 'https://exemple.fr')).toEqual({ siteUrl: 'https://www.exemple.fr/' });
    const doc = await getDoc<Record<string, string>>('seodata.bing.conn', 'b1');
    expect(JSON.stringify(doc)).not.toContain(KEY);
    expect((await bingFor('b1'))!.siteUrl).toBe('https://www.exemple.fr/');
    expect(() => new BingWebmaster('pas une clé !')).toThrow(/invalide/);
  });
});
