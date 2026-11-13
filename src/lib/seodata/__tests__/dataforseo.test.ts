import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { getLedger, reserve } from '../cost';
import { DataForSeoBacklinks, DataForSeoClient, DataForSeoKeywords, DataForSeoSerp, dfsDate, parseSerp } from '../dataforseo';
import { SeoDataError, setSeoDataEndpoints } from '../http';
import { estimateMonthlyEur, serpCostUsd, SEODATA_LIMITS } from '../limits';
import type { SerpRequest } from '../types';
import { startFakeServer, type FakeServer } from './fake-server';

process.env.DATA_DIR = mkdtempSync(path.join(os.tmpdir(), 'seodata-dfs-'));

/** Enveloppe DataForSEO v3 (status_code 20000, tasks[]), d'après la documentation. */
const ok = (result: unknown[], cost = 0.0018, extra: Record<string, unknown> = {}) => ({
  version: '0.1.20261101', status_code: 20000, status_message: 'Ok.', time: '0.4 sec.', cost, tasks_count: 1, tasks_error: 0,
  tasks: [{ id: '11131207-1535-0139-0000-7d8b2f6c3a01', status_code: 20000, status_message: 'Ok.', cost, result_count: result.length, path: [], data: {}, result, ...extra }],
});

const SERP = {
  keyword: 'plombier paris 11', type: 'organic', se_domain: 'google.fr', location_code: 2250, language_code: 'fr',
  check_url: 'https://www.google.fr/search?q=plombier%20paris%2011&hl=fr&gl=FR', datetime: '2026-11-10 08:31:12 +00:00',
  item_types: ['ai_overview', 'local_pack', 'organic', 'people_also_ask'], se_results_count: 1240000, items_count: 14,
  items: [
    { type: 'ai_overview', rank_group: 1, rank_absolute: 1, items: [{ type: 'ai_overview_element', references: [{ domain: 'www.concurrent-a.fr', url: 'https://www.concurrent-a.fr/' }] }], references: [{ domain: 'exemple.fr', url: 'https://exemple.fr/urgence' }] },
    { type: 'local_pack', rank_group: 1, rank_absolute: 2, title: 'Plombier' },
    { type: 'organic', rank_group: 1, rank_absolute: 3, domain: 'www.concurrent-a.fr', url: 'https://www.concurrent-a.fr/', title: 'A' },
    { type: 'organic', rank_group: 2, rank_absolute: 5, domain: 'concurrent-b.fr', url: 'https://concurrent-b.fr/plombier', title: 'B' },
    { type: 'people_also_ask', rank_group: 1, rank_absolute: 6 },
    { type: 'organic', rank_group: 3, rank_absolute: 7, domain: 'www.exemple.fr', url: 'https://www.exemple.fr/', title: 'Nous' },
  ],
};

const req: SerpRequest = { keyword: 'plombier paris 11', device: 'mobile', location: { name: 'Paris,Ile-de-France,France', language: 'fr' }, depth: 20, aiOverview: true };

let s: FakeServer;
beforeAll(async () => {
  s = await startFakeServer();
  setSeoDataEndpoints({ dataforseo: `${s.url}/v3` });
});
afterAll(async () => {
  setSeoDataEndpoints(null);
  await s.close();
});
beforeEach(() => {
  s.requests.length = 0;
});

describe('DataForSEO : analyse des réponses', () => {
  it('SERP : positions organiques, fonctionnalités, aperçu IA et domaines cités', () => {
    const r = parseSerp(SERP, req, 0.0018);
    expect(r.organic.map((o) => [o.position, o.domain])).toEqual([[1, 'concurrent-a.fr'], [2, 'concurrent-b.fr'], [3, 'exemple.fr']]);
    expect(r.features).toEqual(['ai_overview', 'local_pack', 'people_also_ask']);
    expect(r.aiOverview).toBe(true);
    expect(r.aiOverviewDomains.sort()).toEqual(['concurrent-a.fr', 'exemple.fr']);
    expect(r.checkedAt).toBe('2026-11-10T08:31:12.000Z');
  });
  it('aperçu IA inconnu si non demandé et absent ; false si demandé et absent', () => {
    const none = { ...SERP, item_types: ['organic'], items: SERP.items.filter((i) => i.type === 'organic') };
    expect(parseSerp(none, { ...req, aiOverview: false }).aiOverview).toBeNull();
    expect(parseSerp(none, req).aiOverview).toBe(false);
    expect(dfsDate('n’importe quoi')).toMatch(/^\d{4}-/);
  });
  it('coûts officiels : SERP par page de 10 + aperçu IA', () => {
    expect(serpCostUsd(10, false, 'standard')).toBeCloseTo(0.0006);
    expect(serpCostUsd(20, true, 'standard')).toBeCloseTo(0.0018);
    expect(serpCostUsd(20, false, 'live')).toBeCloseTo(0.004);
    expect(estimateMonthlyEur(SEODATA_LIMITS.decouverte)).toBe(0);
    expect(estimateMonthlyEur(SEODATA_LIMITS.essentiel)).toBeGreaterThan(0.8);
    expect(estimateMonthlyEur(SEODATA_LIMITS.essentiel)).toBeLessThan(SEODATA_LIMITS.essentiel.monthlyBudgetEur);
    expect(estimateMonthlyEur(SEODATA_LIMITS.accompagne)).toBeLessThan(SEODATA_LIMITS.accompagne.monthlyBudgetEur);
  });
});

describe('DataForSEO contre un faux serveur', () => {
  const client = () => new DataForSeoClient(undefined, { login: 'api@exemple.fr', password: 'secret' });

  it('non configuré sans identifiants', () => {
    expect(() => new DataForSeoClient(undefined, { login: '', password: '' })).toThrow(/non configuré/);
  });

  it('volumes Google Ads FR : authentification Basic, une tâche, mots-clés sans donnée → null', async () => {
    s.on('POST', '/v3/keywords_data/google_ads/search_volume/live', () => ({
      json: ok([{ keyword: 'plombier paris 11', spell: null, location_code: 2250, language_code: 'fr', search_partners: false, competition: 'MEDIUM', competition_index: 45, search_volume: 880, low_top_of_page_bid: 1.1, high_top_of_page_bid: 4.2, cpc: 3.5, monthly_searches: [{ year: 2026, month: 10, search_volume: 900 }, { year: 2026, month: 9, search_volume: 860 }] }], 0.09),
    }));
    const kp = new DataForSeoKeywords(client(), 0.9);
    const v = await kp.volumes(['Plombier Paris 11', 'mot-clé introuvable'], { code: 2250, language: 'fr' });
    const r = s.requests[0];
    expect(r.headers.authorization).toBe(`Basic ${Buffer.from('api@exemple.fr:secret').toString('base64')}`);
    expect(r.json).toEqual([{ keywords: ['plombier paris 11', 'mot-clé introuvable'], location_code: 2250, language_code: 'fr' }]);
    expect(v[0]).toMatchObject({ keyword: 'plombier paris 11', volume: 880, cpcEur: 3.15, competition: 'MEDIUM', trend: [{ month: '2026-09', volume: 860 }, { month: '2026-10', volume: 900 }] });
    expect(v[1]).toMatchObject({ keyword: 'mot-clé introuvable', volume: null });
  });

  it('SERP en direct, puis file standard : dépôt, tâche pas prête (40602), collecte', async () => {
    s.on('POST', '/v3/serp/google/organic/live/advanced', () => ({ json: ok([SERP], 0.006) }));
    const serp = new DataForSeoSerp(client());
    const live = await serp.live(req);
    expect(live.organic.find((o) => o.domain === 'exemple.fr')?.position).toBe(3);
    expect(s.requests[0].json).toEqual([{ keyword: 'plombier paris 11', location_name: 'Paris,Ile-de-France,France', language_code: 'fr', device: 'mobile', os: 'android', depth: 20, load_async_ai_overview: true }]);

    s.on('POST', '/v3/serp/google/organic/task_post', (r) => ({
      json: { status_code: 20000, cost: 0.0036, tasks: (r.json as unknown[]).map((_, i) => ({ id: `0000000${i}-aaaa-bbbb-cccc-000000000000`, status_code: 20100, status_message: 'Task Created.', cost: 0.0018, result: null })) },
    }));
    const posted = await serp.submit([req, { ...req, keyword: 'fuite paris' }]);
    expect(posted.map((p) => p.taskId)).toEqual(['00000000-aaaa-bbbb-cccc-000000000000', '00000001-aaaa-bbbb-cccc-000000000000']);
    let ready = false;
    s.on('GET', /\/v3\/serp\/google\/organic\/task_get\/advanced\/.+/, () =>
      ready ? { json: ok([SERP]) } : { json: { status_code: 20000, tasks: [{ id: 'x', status_code: 40602, status_message: 'Task In Queue.', result: null }] } },
    );
    expect(await serp.collect(posted[0].taskId, req)).toBeNull();
    ready = true;
    expect((await serp.collect(posted[0].taskId, req))?.aiOverview).toBe(true);
    await expect(serp.collect('../../etc', req)).rejects.toThrow(/invalide/);
  });

  it('erreurs : identifiants refusés (40100), HTTP 500 → reprenable', async () => {
    s.on('POST', '/v3/backlinks/summary/live', () => ({ json: { status_code: 40100, status_message: 'You are not authorized to access this resource.', tasks: [] } }));
    const e = await new DataForSeoBacklinks(client()).summary('exemple.fr').catch((x) => x);
    expect(e).toBeInstanceOf(SeoDataError);
    expect(e.code).toBe('auth');
    s.on('POST', '/v3/backlinks/summary/live', () => ({ status: 500, json: { status_code: 50000, status_message: 'Internal Error.' } }));
    const e2 = await new DataForSeoBacklinks(client()).summary('exemple.fr').catch((x) => x);
    expect(e2.code).toBe('upstream');
    expect(e2.retryable).toBe(true);
  });

  it('liens entrants et Labs : formes documentées', async () => {
    s.on('POST', '/v3/backlinks/summary/live', () => ({ json: ok([{ target: 'exemple.fr', rank: 212, backlinks: 1840, referring_domains: 162, referring_main_domains: 150, broken_backlinks: 12 }], 0.02) }));
    s.on('POST', '/v3/backlinks/referring_domains/live', () => ({ json: ok([{ total_count: 1, items_count: 1, items: [{ type: 'backlinks_referring_domains', domain: 'journal.fr', rank: 410, backlinks: 3, first_seen: '2025-03-02 10:00:00 +00:00' }] }]) }));
    s.on('POST', '/v3/backlinks/anchors/live', () => ({ json: ok([{ items: [{ type: 'backlinks_anchors', anchor: 'Exemple', backlinks: 900, referring_domains: 80 }] }]) }));
    s.on('POST', '/v3/backlinks/timeseries_new_lost_summary/live', () => ({ json: ok([{ target: 'exemple.fr', items: [{ type: 'backlinks_timeseries_new_lost_summary', date: '2026-10-31 00:00:00 +00:00', new_backlinks: 14, lost_backlinks: 3, new_referring_domains: 4, lost_referring_domains: 1 }] }]) }));
    const b = new DataForSeoBacklinks(client());
    expect(await b.summary('https://www.exemple.fr/')).toMatchObject({ target: 'exemple.fr', backlinks: 1840, referringDomains: 162, rank: 212 });
    expect((s.requests.at(-1)!.json as { target: string }[])[0].target).toBe('exemple.fr');
    expect((await b.referringDomains('exemple.fr', 10))[0]).toMatchObject({ domain: 'journal.fr', backlinks: 3 });
    expect((await b.anchors('exemple.fr', 10))[0]).toEqual({ anchor: 'Exemple', backlinks: 900, referringDomains: 80 });
    expect((await b.newLost('exemple.fr', '2025-11-01'))[0]).toEqual({ date: '2026-10-31', newBacklinks: 14, lostBacklinks: 3, newDomains: 4, lostDomains: 1 });

    s.on('POST', '/v3/dataforseo_labs/google/ranked_keywords/live', () => ({
      json: ok([{ target: 'exemple.fr', items: [{ keyword_data: { keyword: 'plombier paris 11', keyword_info: { search_volume: 880 }, keyword_properties: { keyword_difficulty: 34 } }, ranked_serp_element: { serp_item: { type: 'organic', rank_group: 4, url: 'https://exemple.fr/' } } }] }]),
    }));
    s.on('POST', '/v3/dataforseo_labs/google/competitors_domain/live', () => ({ json: ok([{ items: [{ domain: 'exemple.fr', avg_position: 9, intersections: 50 }, { domain: 'rival.fr', avg_position: 7.44, intersections: 21 }] }]) }));
    const k = new DataForSeoKeywords(client());
    expect(await k.rankedKeywords('exemple.fr', { code: 2250, language: 'fr' }, 100)).toEqual([{ keyword: 'plombier paris 11', position: 4, url: 'https://exemple.fr/', volume: 880, difficulty: 34 }]);
    expect(await k.competitors('exemple.fr', { code: 2250, language: 'fr' }, 5)).toEqual([{ domain: 'rival.fr', commonKeywords: 21, avgPosition: 7.4 }]);
  });
});

describe('Plafond de coût par compte et par mois', () => {
  it('réserve, ajuste au coût réel renvoyé, refuse au-delà du plafond SANS appeler le fournisseur', async () => {
    const now = new Date('2026-11-13T10:00:00Z');
    const settle = await reserve('cap-a', 'serp.live', 0.5, 1, now); // 1 € ≈ 1,087 $
    await settle(0.3);
    let l = await getLedger('cap-a', now);
    expect(l.spentUsd).toBeCloseTo(0.3);
    expect(l.byOp['serp.live']).toEqual({ calls: 1, usd: 0.3 });
    await reserve('cap-a', 'serp.live', 0.785, 1, now); // 1,085 $ sur ~1,087 $
    await expect(reserve('cap-a', 'serp.live', 0.2, 1, now)).rejects.toMatchObject({ code: 'budget' });
    l = await getLedger('cap-a', now);
    expect(l.refused).toBe(1);
    // le mois suivant repart de zéro
    expect((await getLedger('cap-a', new Date('2026-12-01T00:00:00Z'))).spentUsd).toBe(0);

    s.requests.length = 0;
    const meter = (op: string, usd: number) => reserve('cap-a', op, usd, 1, now);
    const serp = new DataForSeoSerp(new DataForSeoClient(meter, { login: 'a', password: 'b' }));
    await expect(serp.live(req)).rejects.toMatchObject({ code: 'budget' });
    expect(s.requests).toHaveLength(0);
  });

  it('offre sans données payantes (plafond 0) : refus explicite', async () => {
    await expect(reserve('cap-b', 'keywords.volume', 0.09, 0)).rejects.toThrow(/pas incluses dans votre offre/);
  });

  it('appel en échec réseau : la réservation est rendue', async () => {
    const now = new Date();
    s.on('POST', '/v3/serp/google/organic/live/advanced', () => ({ status: 503, json: { status_code: 50000, status_message: 'Busy' } }));
    const serp = new DataForSeoSerp(new DataForSeoClient((op, usd) => reserve('cap-c', op, usd, 3, now), { login: 'a', password: 'b' }));
    await expect(serp.live(req)).rejects.toMatchObject({ code: 'upstream' });
    expect((await getLedger('cap-c', now)).spentUsd).toBe(0);
    s.on('POST', '/v3/serp/google/organic/live/advanced', () => ({ json: ok([SERP], 0.006) }));
    await serp.live(req);
    expect((await getLedger('cap-c', now)).spentUsd).toBeCloseTo(0.006);
  });
});
