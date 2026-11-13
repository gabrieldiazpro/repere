import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isolateStore } from '@/lib/barometre/__tests__/helpers';
import { CATALOG, LAUNCH_ORDER, barometreMax, launchCatalog } from '@/lib/barometre/catalog';
import { estimateMonthly } from '@/lib/barometre/cost';
import { COLL as BCOLL } from '@/lib/barometre/storage';
import type { BusinessRecord } from '@/lib/db';
import { SEODATA_LIMITS, backlinksPlatformEnabled } from '@/lib/seodata/limits';
import { COSTS } from '@/lib/seodata/cost';
import { putDoc } from '@/lib/store';
import {
  attributionFromLocation,
  barometreOf,
  barometreUtm,
  getAttribution,
  recordAttribution,
  recordSignupAttribution,
  sanitizeAttribution,
} from '../attribution';
import { backlinksIncrementalUsd, breakEvenSubscribers, monthlyRecurringCents, roiRatio, stopDecision } from '../compute';
import { buildRoiReport, isPaying, startDateOf } from '../report';
import { readTabUsage, recordTabView, summarizeUsage } from '../usage';
import { barometreSlugOfPath, classifySource, readVisits, recordBarometreVisit, summarizeVisits } from '../visits';
import { POST as hit } from '@/app/api/v5/roi/hit/route';
import { resetTrackRateLimit } from '@/lib/tracking/handlers';

const NOW = new Date('2026-11-20T10:00:00Z');

beforeEach(() => {
  isolateStore();
  resetTrackRateLimit();
});
afterEach(() => vi.unstubAllEnvs());

describe('attribution : première page / UTM, sans cookie', () => {
  it('lit la première page, le domaine d’origine et les UTM ; ignore la navigation interne', () => {
    const a = attributionFromLocation({ href: 'https://repere-ia.fr/barometre/plombiers-paris?utm_source=LinkedIn&x=1', referrer: 'https://www.lemonde.fr/article', selfHost: 'repere-ia.fr' });
    expect(a).toEqual({ utmSource: 'linkedin', landing: '/barometre/plombiers-paris', referrerHost: 'lemonde.fr' });
    expect(barometreOf(a)).toBe('plombiers-paris');
    const internal = attributionFromLocation({ href: 'https://repere-ia.fr/tarifs', referrer: 'https://repere-ia.fr/', selfHost: 'repere-ia.fr' });
    expect(internal).toEqual({ landing: '/tarifs' });
    expect(barometreOf(internal)).toBeNull();
  });

  it('UTM des liens sortants d’un baromètre → baromètre d’origine', () => {
    const a = attributionFromLocation({ href: `https://repere-ia.fr/audit?${barometreUtm('serruriers-lyon')}`, referrer: '' });
    expect(barometreOf(a)).toBe('serruriers-lyon');
    expect(barometreOf({ landing: '/barometre' })).toBe('index');
  });

  it('valide une origine reçue d’un formulaire public (champs invalides ignorés)', () => {
    expect(sanitizeAttribution(null)).toBeNull();
    expect(sanitizeAttribution({ landing: 'javascript:alert(1)', utmSource: '<script>', referrerHost: 'https://evil.example/x?y' })).toEqual({ referrerHost: 'evil.example' });
    expect(sanitizeAttribution({ landing: '/barometre/plombiers-paris?utm_source=a', utmSource: 'x'.repeat(200) })).toEqual({ landing: '/barometre/plombiers-paris', utmSource: 'x'.repeat(60) });
  });

  it('première origine gardée ; l’espace reprend celle de l’analyse d’origine', async () => {
    await recordAttribution('analysis', 'an_1', { landing: '/barometre/plombiers-paris' }, { now: NOW });
    await recordAttribution('analysis', 'an_1', { landing: '/tarifs' }, { now: NOW });
    expect((await getAttribution('analysis', 'an_1'))!.barometre).toBe('plombiers-paris');
    const rec = await recordSignupAttribution('biz_1', { analysis: 'an_1', attribution: { landing: '/' } }, NOW);
    expect(rec).toMatchObject({ kind: 'business', barometre: 'plombiers-paris', via: { kind: 'analysis', id: 'an_1' } });
    const direct = await recordSignupAttribution('biz_2', { analysis: 'an_inconnue', attribution: { landing: '/' } }, NOW);
    expect(direct).toMatchObject({ barometre: null, attribution: { landing: '/' } });
    expect(direct!.via).toBeUndefined();
    expect(await recordSignupAttribution('biz_3', {}, NOW)).toBeNull();
  });
});

describe('visites des pages baromètre', () => {
  it('classe la source et ne garde que des totaux', async () => {
    expect(classifySource({ referrer: 'https://chatgpt.com/', selfHost: 'repere-ia.fr' }).source).toBe('ia');
    expect(classifySource({ referrer: 'https://www.google.fr/', selfHost: 'repere-ia.fr' })).toEqual({ source: 'recherche', host: 'google.fr' });
    expect(classifySource({ referrer: 'https://www.linkedin.com/feed', selfHost: 'repere-ia.fr' }).source).toBe('social');
    expect(classifySource({ referrer: 'https://repere-ia.fr/barometre', selfHost: 'repere-ia.fr' }).source).toBe('interne');
    expect(classifySource({ referrer: 'https://www.leparisien.fr/x', selfHost: 'repere-ia.fr' })).toEqual({ source: 'site', host: 'leparisien.fr' });
    expect(classifySource({ referrer: '', utmSource: 'newsletter' }).source).toBe('campagne');
    expect(classifySource({}).source).toBe('direct');
    expect(barometreSlugOfPath('/barometre/plombiers-paris')).toBe('plombiers-paris');
    expect(barometreSlugOfPath('/barometre')).toBe('index');
    expect(barometreSlugOfPath('/tarifs')).toBeNull();

    expect(await recordBarometreVisit({ path: '/tarifs', now: NOW })).toBe(false);
    await recordBarometreVisit({ path: '/barometre/plombiers-paris', referrer: 'https://www.google.fr/', selfHost: 'repere-ia.fr', now: NOW });
    await recordBarometreVisit({ path: '/barometre/plombiers-paris', referrer: 'https://www.leparisien.fr/a', selfHost: 'repere-ia.fr', now: NOW });
    await recordBarometreVisit({ path: '/barometre', referrer: 'https://repere-ia.fr/', selfHost: 'repere-ia.fr', now: NOW });
    const v = await readVisits('2026-11');
    expect(v).toMatchObject({ total: 3, external: 2, bySlug: { 'plombiers-paris': 2, index: 1 }, bySource: { recherche: 1, site: 1, interne: 1 } });
    expect(v.referrers.map((r) => r.host).sort()).toEqual(['google.fr', 'leparisien.fr']);
    expect(summarizeVisits('2026-10', null).total).toBe(0);
  });

  it('route /api/v5/roi/hit : même origine seulement, rien d’écrit sinon', async () => {
    const req = (origin: string | null, body: unknown) =>
      new Request('https://repere-ia.fr/api/v5/roi/hit', { method: 'POST', headers: { 'content-type': 'application/json', ...(origin ? { origin } : {}) }, body: JSON.stringify(body) });
    expect((await hit(req('https://evil.example', { p: '/barometre/plombiers-paris' }))).status).toBe(204);
    expect((await hit(req(null, { p: '/barometre/plombiers-paris' }))).status).toBe(204);
    expect((await readVisits(new Date().toISOString().slice(0, 7))).total).toBe(0);
    expect((await hit(req('https://repere-ia.fr', { p: '/barometre/plombiers-paris', r: 'https://bing.com/' }))).status).toBe(204);
    expect((await readVisits(new Date().toISOString().slice(0, 7))).bySource).toEqual({ recherche: 1 });
  });
});

describe('usage de l’onglet Liens', () => {
  it('compte les affichages par compte, ignore la démo', async () => {
    await recordTabView('biz_a', 'liens', NOW);
    await recordTabView('biz_a', 'liens', NOW);
    await recordTabView('demo', 'liens', NOW);
    const u = await readTabUsage('liens', '2026-11');
    expect(u).toMatchObject({ views: 2, accounts: 1, byAccount: { biz_a: 2 } });
    expect(summarizeUsage('2026-11', 'liens', { 'liens|x': 3, 'autre|y': 9 }).views).toBe(3);
  });
});

describe('calcul du ROI', () => {
  it('revenu mensuel récurrent d’une offre (mensuel, annuel / 12, ponctuel = 0)', () => {
    expect(monthlyRecurringCents('local_accompagne_month')).toBe(9900);
    expect(monthlyRecurringCents('local_essentiel_year')).toBe(Math.round(29000 / 12));
    expect(monthlyRecurringCents('local_audit_deep')).toBe(0);
    expect(monthlyRecurringCents('inconnu')).toBe(0);
    expect(monthlyRecurringCents(null)).toBe(0);
  });

  it('ratio et seuils de rentabilité', () => {
    expect(roiRatio(99, 92)).toBe(1.08);
    expect(roiRatio(10, 0)).toBeNull();
    // Liens : un abonné Accompagné (99 €) couvre l'engagement (100 $ ≈ 92 €).
    expect(breakEvenSubscribers(92, 99)).toBe(1);
    // Baromètres : 10 ≈ 19,30 € → 1 Essentiel local ; 50 ≈ 96,50 € → 4 Essentiel local ou 1 Accompagné.
    expect(breakEvenSubscribers(estimateMonthly(launchCatalog({}), {}).costEur, 29)).toBe(1);
    expect(breakEvenSubscribers(estimateMonthly(CATALOG, {}).costEur, 29)).toBe(4);
    expect(breakEvenSubscribers(estimateMonthly(CATALOG, {}).costEur, 99)).toBe(1);
  });

  it('coût incrémental des liens : l’engagement est un minimum de dépense', () => {
    expect(backlinksIncrementalUsd(0, 3, 100)).toBe(100);
    expect(backlinksIncrementalUsd(40, 3, 100)).toBe(60);
    expect(backlinksIncrementalUsd(150, 5, 100)).toBe(5);
  });

  it('règle d’arrêt : évaluation 3 mois, puis couper si le ratio cumulé reste < 1', () => {
    const pts = [
      { month: '2026-11', revenueEur: 0, costEur: 19 },
      { month: '2026-12', revenueEur: 10, costEur: 19 },
      { month: '2027-01', revenueEur: 29, costEur: 19 },
    ];
    expect(stopDecision({ startDate: null, points: [] }).status).toBe('inactive');
    const ev = stopDecision({ startDate: '2026-11-02', points: pts.slice(0, 1), now: new Date('2026-12-15T00:00:00Z') });
    expect(ev).toMatchObject({ status: 'evaluation', decisionDate: '2027-02-02' });
    expect(ev.message).toContain('2 février 2027');
    const cut = stopDecision({ startDate: '2026-11-02', points: pts, now: new Date('2027-02-03T00:00:00Z') });
    expect(cut).toMatchObject({ status: 'couper', ratio3m: 0.68 });
    const keep = stopDecision({ startDate: '2026-11-02', points: pts.map((p) => ({ ...p, revenueEur: p.revenueEur + 20 })), now: new Date('2027-02-03T00:00:00Z') });
    expect(keep.status).toBe('continuer');
    expect(stopDecision({ startDate: '2026-11-02', points: pts.slice(1), now: new Date('2027-02-03T00:00:00Z') }).status).toBe('donnees-insuffisantes');
  });

  it('date de démarrage : variable, sinon premier mois avec dépense', () => {
    expect(startDateOf('barometres', [{ month: '2026-10', revenueEur: 0, costEur: 0 }, { month: '2026-11', revenueEur: 0, costEur: 3 }], {})).toBe('2026-11-01');
    expect(startDateOf('liens', [], { ROI_BACKLINKS_START: '2026-12-05' })).toBe('2026-12-05');
    expect(startDateOf('liens', [], {})).toBeNull();
  });
});

const biz = (id: string, plan: string, planId: string | null, isActive = true): BusinessRecord =>
  ({ id, name: id, trade: 'plombier', city: 'Paris', plan, planId, isActive, segment: 'local', createdAt: '2026-11-01T00:00:00Z', lastScore: null, ownerId: null, alertThreshold: 5 }) as unknown as BusinessRecord;

describe('tableau de ROI (mesuré, sans donnée inventée)', () => {
  it('sans aucune donnée : tout à zéro, ratio vide, source non démarrée', async () => {
    const r = await buildRoiReport({ now: NOW, listPaid: async () => [], getBusiness: async () => null, env: {} });
    expect(r.barometres).toMatchObject({ costEur: 0, mrrEur: 0, ratio: null, signupsTotal: 0, launchCount: 10, enabled: false });
    expect(r.barometres.stop.status).toBe('inactive');
    expect(r.barometres.links.state).toBe('off');
    expect(r.liens).toMatchObject({ enabled: false, costEur: 0, subscribers: 0, ratio: null });
  });

  it('baromètres : coût du registre, MRR des seuls abonnés payants attribués, ratio', async () => {
    await putDoc(BCOLL.budget, '2026-11', { period: '2026-11', spentEur: 19.3, bySlug: {} });
    await recordAttribution('business', 'b_paid', { landing: '/barometre/plombiers-paris' }, { now: NOW });
    await recordAttribution('business', 'b_free', { landing: '/barometre/plombiers-paris' }, { now: NOW });
    await recordAttribution('business', 'b_other', { landing: '/tarifs' }, { now: NOW });
    await recordAttribution('analysis', 'an_x', { utmMedium: 'barometre', utmCampaign: 'serruriers-lyon' }, { now: NOW });
    const records: Record<string, BusinessRecord> = {
      b_paid: biz('b_paid', 'essentiel', 'local_essentiel_month'),
      b_free: biz('b_free', 'free', 'local_decouverte'),
      b_other: biz('b_other', 'accompagne', 'local_accompagne_month'),
    };
    const r = await buildRoiReport({ now: NOW, listPaid: async () => [], getBusiness: async (id) => records[id] ?? null, env: {} });
    expect(r.barometres).toMatchObject({ costEur: 19.3, mrrEur: 29, paid: 1, signupsTotal: 2, analyses: 1, ratio: 1.5 });
    expect(r.barometres.bySlug.find((x) => x.slug === 'plombiers-paris')).toMatchObject({ signups: 2, paid: 1, mrrEur: 29 });
    expect(r.barometres.stop).toMatchObject({ status: 'evaluation', startDate: '2026-11-01' });
    // Relevé mensuel enregistré : la décision à 3 mois se fera sur des mesures.
    const again = await buildRoiReport({ now: new Date('2027-02-10T00:00:00Z'), listPaid: async () => [], getBusiness: async () => null, env: {} });
    expect(again.barometres.history.map((p) => p.month)).toContain('2026-11');
  });

  it('liens : engagement compté seulement si activés, MRR Accompagné + Agence, usage réel', async () => {
    vi.stubEnv('SEODATA_BACKLINKS_ENABLED', '1');
    await putDoc(COSTS, 'b_acc:2026-11', { businessId: 'b_acc', month: '2026-11', spentUsd: 4, calls: 4, byOp: { 'backlinks.summary': { calls: 1, usd: 0.02 }, 'serp.organic': { calls: 3, usd: 3.98 } }, refused: 0, updatedAt: NOW.toISOString() });
    await recordTabView('b_acc', 'liens', NOW);
    const paid = [biz('b_acc', 'accompagne', 'local_accompagne_month'), biz('b_ag', 'agency', 'agency_month'), biz('b_ess', 'essentiel', 'pme_essentiel_month'), biz('b_off', 'accompagne', 'local_accompagne_month', false)];
    const r = await buildRoiReport({ now: NOW, listPaid: async () => paid, getBusiness: async () => null, env: { SEODATA_BACKLINKS_ENABLED: '1' } });
    expect(r.liens.enabled).toBe(true);
    expect(r.liens.costEur).toBeCloseTo((100 - 3.98) * 0.92, 1);
    expect(r.liens).toMatchObject({ subscribers: 2, mrrEur: 99 + 149, activeSubscribers: 1 });
    expect(r.liens.ratio).toBeGreaterThan(2);
    expect(isPaying(biz('demo', 'accompagne', 'local_accompagne_month'))).toBe(false);
  });
});

describe('lancement progressif et liens réservés', () => {
  it('10 baromètres par défaut, dans l’ordre de lancement ; BAROMETRE_MAX étend', () => {
    expect(LAUNCH_ORDER).toHaveLength(10);
    for (const s of LAUNCH_ORDER) expect(CATALOG.some((d) => d.slug === s)).toBe(true);
    const l = launchCatalog({});
    expect(l.map((d) => d.slug)).toEqual([...LAUNCH_ORDER]);
    expect(l.map((d) => d.priority)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(estimateMonthly(l, {}).costEur).toBeGreaterThan(18);
    expect(estimateMonthly(l, {}).costEur).toBeLessThan(20);
    expect(launchCatalog({ BAROMETRE_MAX: '12' })).toHaveLength(12);
    expect(barometreMax({ BAROMETRE_MAX: '500' })).toBe(50);
    expect(barometreMax({ BAROMETRE_MAX: 'abc' })).toBe(10);
  });

  it('liens entrants : Accompagné et Agence seulement, interrupteur plateforme coupé par défaut', () => {
    expect(SEODATA_LIMITS.decouverte.backlinks).toBe(false);
    expect(SEODATA_LIMITS.essentiel_local.backlinks).toBe(false);
    expect(SEODATA_LIMITS.essentiel.backlinks).toBe(false);
    expect(SEODATA_LIMITS.accompagne.backlinks).toBe(true);
    expect(SEODATA_LIMITS.agence.backlinks).toBe(true);
    expect(backlinksPlatformEnabled({})).toBe(false);
    expect(backlinksPlatformEnabled({ SEODATA_BACKLINKS_ENABLED: '1' })).toBe(true);
  });
});
