import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BusinessRecord } from '@/lib/db';
import { startFakeServer, type FakeServer } from './fake-server';

process.env.DATA_DIR = mkdtempSync(path.join(os.tmpdir(), 'seodata-rank-'));

const rec = (id: string, plan: BusinessRecord['plan'], segment: BusinessRecord['segment'] = 'pme'): BusinessRecord => ({
  id, name: id, trade: 'logiciel', city: 'Lyon', website: 'https://www.exemple.fr/', plan, segment, planId: null, lastScore: null,
  createdAt: '2026-01-01T00:00:00Z', ownerId: 'u1', isActive: true, alertThreshold: 5,
});
const RECORDS: Record<string, BusinessRecord> = { 'r-ess': rec('r-ess', 'essentiel'), 'r-free': rec('r-free', 'free'), 'r-job': rec('r-job', 'essentiel') };

vi.mock('@/lib/db', async (orig) => {
  const real = await orig<typeof import('@/lib/db')>();
  return { ...real, getBusinessRecord: vi.fn(async (id: string) => RECORDS[id] ?? real.getBusinessRecord(id)) };
});

const { contextFor, providersFor } = await import('../providers');
const rank = await import('../rank');
const { setSeoDataEndpoints, weekKey, SeoDataError } = await import('../http');
const { putDoc } = await import('@/lib/store');
const { RECENT } = await import('../searchconsole');
const jobs = await import('../jobs');

let s: FakeServer;
/** Positions servies par le faux DataForSEO, par mot-clé (modifiables entre deux semaines). */
let positions: Record<string, number | null> = {};
let ready = true;

const serpFor = (keyword: string) => {
  const mine = positions[keyword] ?? null;
  const items: Record<string, unknown>[] = [];
  let p = 1;
  const others = ['rival-a.fr', 'rival-b.fr', 'annuaire.fr', 'rival-c.fr'];
  let o = 0;
  while (p <= 20) {
    if (p === mine) items.push({ type: 'organic', rank_group: p, domain: 'www.exemple.fr', url: 'https://www.exemple.fr/page' });
    else items.push({ type: 'organic', rank_group: p, domain: others[o++ % others.length], url: `https://${others[(o - 1) % others.length]}/x` });
    p++;
  }
  if (keyword === 'logiciel paie') items.unshift({ type: 'ai_overview', references: [{ domain: 'exemple.fr', url: 'https://exemple.fr/' }] });
  return { keyword, datetime: '2026-11-10 08:00:00 +00:00', item_types: keyword === 'logiciel paie' ? ['ai_overview', 'organic'] : ['organic'], items };
};

beforeAll(async () => {
  s = await startFakeServer();
  process.env.DATAFORSEO_LOGIN = 'login';
  process.env.DATAFORSEO_PASSWORD = 'pass';
  setSeoDataEndpoints({ dataforseo: `${s.url}/v3` });
  s.on('POST', '/v3/keywords_data/google_ads/search_volume/live', (r) => ({
    json: { status_code: 20000, cost: 0.09, tasks: [{ status_code: 20000, cost: 0.09, result: ((r.json as { keywords: string[] }[])[0].keywords).map((k, i) => ({ keyword: k, search_volume: (i + 1) * 100, competition: 'LOW', cpc: 1 })) }] },
  }));
  s.on('POST', '/v3/dataforseo_labs/google/bulk_keyword_difficulty/live', (r) => ({
    json: { status_code: 20000, cost: 0.01, tasks: [{ status_code: 20000, result: [{ items: ((r.json as { keywords: string[] }[])[0].keywords).map((k) => ({ keyword: k, keyword_difficulty: 40 })) }] }] },
  }));
  s.on('POST', '/v3/serp/google/organic/task_post', (r) => ({
    json: { status_code: 20000, cost: 0.0018, tasks: (r.json as { keyword: string }[]).map((t) => ({ id: `task-${Buffer.from(t.keyword).toString('hex').slice(0, 20)}`, status_code: 20100, result: null, data: t })) },
  }));
  s.on('GET', /\/v3\/serp\/google\/organic\/task_get\/advanced\/task-.+/, (r) => {
    if (!ready) return { json: { status_code: 20000, tasks: [{ status_code: 40602, status_message: 'Task In Queue.' }] } };
    const kw = Buffer.from(r.path.split('task-')[1], 'hex').toString();
    const keyword = Object.keys(positions).find((k) => Buffer.from(k).toString('hex').slice(0, 20) === Buffer.from(kw).toString('hex').slice(0, 20)) ?? kw;
    return { json: { status_code: 20000, tasks: [{ status_code: 20000, result: [serpFor(keyword)] }] } };
  });
  s.on('POST', '/v3/dataforseo_labs/google/ranked_keywords/live', () => ({
    json: { status_code: 20000, cost: 0.03, tasks: [{ status_code: 20000, result: [{ items: [
      { keyword_data: { keyword: 'paie en ligne', keyword_info: { search_volume: 1900 }, keyword_properties: { keyword_difficulty: 50 } }, ranked_serp_element: { serp_item: { rank_group: 12, url: 'https://www.exemple.fr/paie' } } },
      { keyword_data: { keyword: 'logiciel paie', keyword_info: { search_volume: 2400 } }, ranked_serp_element: { serp_item: { rank_group: 5, url: 'https://www.exemple.fr/' } } },
    ] }] }] },
  }));
  s.on('POST', '/v3/dataforseo_labs/google/competitors_domain/live', () => ({ json: { status_code: 20000, tasks: [{ status_code: 20000, result: [{ items: [{ domain: 'rival-a.fr', avg_position: 6, intersections: 9 }] }] }] } }));
});
afterAll(async () => {
  setSeoDataEndpoints(null);
  await s.close();
});
beforeEach(() => {
  ready = true;
});

describe('Suivi de positions (fournisseur réel simulé)', () => {
  it('ajout : normalisation, dédoublonnage, volumes + difficulté (une tâche), plafond de l’offre', async () => {
    const ctx = await contextFor('r-ess');
    expect(ctx.limits).toMatchObject({ keywords: 100, devices: ['desktop'], depth: 20, aiOverview: true });
    const p = await providersFor(ctx);
    const r = await rank.addKeywords(ctx, ['  Logiciel   PAIE ', 'logiciel paie', 'paie pme', 'x'], 'manual', p.keywords);
    expect(r.added).toEqual(['logiciel paie', 'paie pme']);
    expect(r.config.keywords.map((k) => [k.keyword, k.volume, k.difficulty])).toEqual([['logiciel paie', 100, 40], ['paie pme', 200, 40]]);
    const small = { ...ctx, limits: { ...ctx.limits, keywords: 3 } };
    const r2 = await rank.addKeywords(small, ['a1', 'a2'], 'manual', null);
    expect(r2.added).toEqual(['a1']);
    expect(r2.skipped).toEqual(['a2']);
    await expect(rank.addKeywords(small, ['a3'], 'manual', null)).rejects.toMatchObject({ code: 'budget' });
    await rank.removeKeywords(ctx, ['A1']);
    expect((await rank.getRankConfig(ctx)).keywords.map((k) => k.keyword)).toEqual(['logiciel paie', 'paie pme']);
  });

  it('offre Découverte : pas de suivi, fournisseurs payants « non inclus » (aucun chiffre)', async () => {
    const ctx = await contextFor('r-free');
    const p = await providersFor(ctx);
    expect(p.serp).toBeNull();
    expect(p.statuses.find((x) => x.kind === 'serp')).toMatchObject({ state: 'off', reason: expect.stringMatching(/Non inclus/) });
    await expect(rank.addKeywords(ctx, ['abc'], 'manual', null)).rejects.toMatchObject({ code: 'budget' });
  });

  it('relevé hebdomadaire en file standard : dépôt → pas prêt → collecte ; idempotent ; puis rapport sur 2 semaines', async () => {
    const ctx = await contextFor('r-ess');
    const p = await providersFor(ctx);
    await rank.setCompetitors(ctx, ['https://www.rival-c.fr/', 'exemple.fr', 'pas un domaine']);
    expect((await rank.getRankConfig(ctx)).competitors).toEqual(['rival-c.fr']);

    const w1 = new Date('2026-11-02T06:00:00Z');
    positions = { 'logiciel paie': 8, 'paie pme': null };
    ready = false;
    const snap = await rank.runWeekly(ctx, p.serp, w1);
    expect(snap.status).toBe('pending');
    expect(snap.pending).toHaveLength(2);
    const posted = s.requests.filter((r) => r.path.endsWith('/task_post')).at(-1)!.json as Record<string, unknown>[];
    expect(posted[0]).toMatchObject({ location_code: 2250, language_code: 'fr', device: 'desktop', depth: 20, load_async_ai_overview: true });
    expect((await rank.collectWeekly(ctx, p.serp, weekKey(w1), w1))!.status).toBe('pending');
    ready = true;
    const done = (await rank.collectWeekly(ctx, p.serp, weekKey(w1), w1))!;
    expect(done.status).toBe('done');
    const n = s.requests.length;
    expect((await rank.runWeekly(ctx, p.serp, w1)).week).toBe(weekKey(w1));
    expect(s.requests.length).toBe(n); // déjà relevé : aucun appel

    const w2 = new Date('2026-11-09T06:00:00Z');
    positions = { 'logiciel paie': 3, 'paie pme': 15 };
    await rank.runWeekly(ctx, p.serp, w2);
    await rank.collectWeekly(ctx, p.serp, weekKey(w2), w2);

    const history = await rank.rankHistory(ctx, p);
    expect(history.map((h) => h.week)).toEqual([weekKey(w1), weekKey(w2)]);
    const rep = rank.buildReport(ctx, await rank.getRankConfig(ctx), history);
    const lp = rep.keywords.find((k) => k.keyword === 'logiciel paie')!;
    expect(lp).toMatchObject({ position: 3, previous: 8, change: 5, best: 3, aiOverview: true, aiOverviewCitesUs: true, volume: 100 });
    const pp = rep.keywords.find((k) => k.keyword === 'paie pme')!;
    expect(pp).toMatchObject({ position: 15, previous: null, change: 6 }); // entrée dans le top 20 (depuis 21)
    expect(rep.distribution).toEqual({ top3: 1, top10: 0, top20: 1, out: 0 });
    expect(rep.visibility!).toBeGreaterThan(rep.visibilityPrevious!);
    expect(rep.share.reduce((s2, x) => s2 + x.share, 0)).toBeCloseTo(100, 0);
    expect(rep.share[0]).toMatchObject({ domain: 'exemple.fr', isUs: true });
    expect(rep.competitors[0]).toMatchObject({ domain: 'rival-c.fr', tracked: true });
    expect(rep.competitors.map((c) => c.domain)).toContain('rival-a.fr');
    expect(rep.aiOverview).toEqual({ keywordsWithOverview: 1, citesUs: 1, known: 2 });
    expect(rep.movers.up[0].keyword).toBe('paie pme');
    expect(rep.demo).toBe(false);
  });

  it('sans fournisseur de positions : refus explicite', async () => {
    const ctx = await contextFor('r-ess');
    await expect(rank.runWeekly(ctx, null)).rejects.toMatchObject({ code: 'not_configured' });
  });

  it('suggestions : Search Console « à portée de main » + Labs, mots-clés déjà suivis exclus, sans volume inventé', async () => {
    const ctx = await contextFor('r-ess');
    const p = await providersFor(ctx);
    p.searchConsole = { name: 'google-search-console', demo: false } as never; // connecté (données lues depuis le stockage)
    await putDoc(RECENT, 'r-ess', {
      businessId: 'r-ess', siteUrl: 'sc-domain:exemple.fr', range: { start: '', end: '' }, prevRange: { start: '', end: '' },
      queries: [
        { key: 'logiciel paie', clicks: 50, impressions: 900, ctr: 0.05, position: 6 }, // déjà suivi
        { key: 'paie en ligne', clicks: 3, impressions: 600, ctr: 0.005, position: 11.4 },
        { key: 'bulletin de paie', clicks: 1, impressions: 500, ctr: 0.002, position: 2.1 }, // déjà en tête
        { key: 'convention collective', clicks: 0, impressions: 300, ctr: 0, position: 45 }, // trop loin
      ],
      prevQueries: [], pages: [], devices: [], countries: [], queryPages: [], sitemaps: [], updatedAt: '',
    }, 'r-ess');
    const { suggestions, sources } = await rank.suggestKeywords(ctx, p, new Date('2026-11-13T00:00:00Z'));
    expect(sources).toEqual(['google-search-console', 'dataforseo']);
    expect(suggestions.map((x) => x.keyword)).toEqual(['paie en ligne']);
    expect(suggestions[0]).toMatchObject({ source: 'search-console', position: 11.4, impressions: 600, volume: 1900, difficulty: 50 });
    // Labs mis en cache pour le mois : pas de second appel payant
    const n = s.requests.filter((r) => r.path.includes('ranked_keywords')).length;
    await rank.suggestKeywords(ctx, p, new Date('2026-11-20T00:00:00Z'));
    expect(s.requests.filter((r) => r.path.includes('ranked_keywords')).length).toBe(n);
  });
});

describe('Comptes démo : données étiquetées, cohérentes, lecture seule', () => {
  it('historique 12 semaines, rapport « démo », concurrents fictifs .example', async () => {
    for (const id of ['demo', 'demo-pme', 'demo-ecom'] as const) {
      const ctx = await contextFor(id);
      const p = await providersFor(ctx);
      expect(p.statuses.every((x) => x.state === 'demo')).toBe(true);
      const h = await rank.rankHistory(ctx, p);
      expect(h).toHaveLength(12);
      expect(h.every((x) => x.demo && x.provider === 'demo')).toBe(true);
      const rep = rank.buildReport(ctx, await rank.getRankConfig(ctx), h);
      expect(rep.demo).toBe(true);
      expect(rep.keywords.length).toBeGreaterThan(0);
      expect(rep.competitors.every((c) => c.domain.endsWith('.example'))).toBe(true);
      await expect(rank.addKeywords(ctx, ['test'], 'manual', p.keywords)).rejects.toMatchObject({ code: 'demo_read_only' });
      await expect(rank.runWeekly(ctx, p.serp)).rejects.toBeInstanceOf(SeoDataError);
      const sug = await rank.suggestKeywords(ctx, p);
      expect(sug.sources).toEqual(['demo']);
      expect(sug.suggestions.length).toBeGreaterThan(0);
    }
    // cohérence avec le compte démo existant : Plomberie Martin, Paris 11e, positions locales
    const ctx = await contextFor('demo');
    expect(ctx.domain).toBe('plomberie-martin.fr');
  });
});

describe('Tâches de fond (types seodata.* déclarés dans JOB_TYPES : INTEGRATION-V5)', () => {
  it('dispatch met en file (exécutée aussitôt en mémoire) ; collecte différée reprise par le balayage', async () => {
    const ctx = await contextFor('r-job');
    await rank.addKeywords(ctx, ['logiciel paie'], 'manual', null);
    positions = { 'logiciel paie': 4 };
    ready = false;
    expect(jobs.registerSeoDataJobs()).toEqual([...jobs.SEODATA_JOB_TYPES]);
    expect(await jobs.dispatch('seodata.rank.weekly', { businessId: 'r-job' })).toBe('queued');
    const wk = weekKey(new Date());
    const { getDoc } = await import('@/lib/store');
    expect((await getDoc<{ status: string }>(rank.RANK_SNAP, `r-job:${wk}`))!.data.status).toBe('pending');
    expect(await jobs.dispatch('seodata.rank.collect', { businessId: 'r-job', week: wk, round: 1 }, { runAt: new Date(Date.now() + 60_000), dedupeKey: `t-collect:${wk}` })).toBe('queued');
    ready = true;
    const sweep = await jobs.scheduleSeoData();
    expect(sweep.collects).toBeGreaterThanOrEqual(1);
    expect((await getDoc<{ status: string }>(rank.RANK_SNAP, `r-job:${wk}`))!.data.status).toBe('done');
  });

  it('erreur définitive (non connecté) → PermanentJobError (tâche morte, sans reprise) ; quota → reprise', async () => {
    const e = await jobs.handlers['seodata.gsc.sync']({ businessId: 'r-job', mode: 'daily' }).catch((x) => x);
    expect(e.name).toBe('PermanentJobError');
    const { getJob } = await import('@/lib/jobs');
    const { enqueue } = await import('@/lib/jobs');
    const { id } = await enqueue('seodata.gsc.sync', { businessId: 'r-job', mode: 'daily' }, { dedupeKey: 't-gsc-dead' });
    expect((await getJob(id))?.status).toBe('dead');
    const { toJobError } = await import('../http');
    expect(toJobError(new SeoDataError('quota', 'x')).name).not.toBe('PermanentJobError');
  });
});
