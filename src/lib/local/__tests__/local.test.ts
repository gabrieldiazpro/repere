import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { AuditResult, MentionResult } from '@/lib/engine/types';
import {
  aggregateZones,
  analyzeReviewThemes,
  auditGbp,
  auditNap,
  buildLocalDemo,
  buildZoneGrid,
  checkPage,
  DEMO_MANUAL,
  DEMO_REVIEWS,
  demoVisibilityMap,
  directoriesFor,
  fillZone,
  GRID_CITIES,
  MAP_CAPS,
  napScore,
  nearestZones,
  normalizeZoneQuestions,
  parseNapEntries,
  parseReviews,
  phonesIn,
  planMap,
  planPosts,
  POST_MAX,
  profileFromManual,
  profileFromPlaces,
  runVisibilityMap,
  sameAddress,
  sameHours,
  toStorableAudit,
  toStorableThemes,
  urlMatchesDirectory,
} from '@/lib/local';

vi.setConfig({ testTimeout: 60_000 });

const NOW = new Date('2026-11-10T10:00:00.000Z');
const FACTS = { adresse: '12 rue Oberkampf, 75011 Paris', telephone: '01 43 55 12 34', site: 'plomberie-martin.fr', horaires: 'Du lundi au vendredi 8 h – 19 h' };
const CTX = { businessId: 'biz_test', businessName: 'Plomberie Martin', trade: 'plombier', facts: FACTS, now: NOW };

beforeAll(() => {
  process.env.DATA_DIR = mkdtempSync(path.join(os.tmpdir(), 'repere-local-'));
});

describe('audit de fiche Google', () => {
  it('note la fiche de démonstration sur 100 avec toute la grille évaluée', () => {
    const a = auditGbp(profileFromManual(DEMO_MANUAL, NOW, 'demo'), CTX);
    expect(a.coverage).toBe(100);
    expect(a.score).toBeGreaterThan(20);
    expect(a.score).toBeLessThan(75);
    expect(a.demo).toBe(true);
    const sum = Object.values(a.groups).reduce((n, g) => n + g.max, 0);
    expect(sum).toBe(100);
    const posts = a.criteria.find((c) => c.id === 'posts')!;
    expect(posts.status).toBe('fail');
    expect(posts.task?.id).toMatch(/^t_/);
    for (const c of a.criteria) expect(c.points).toBeLessThanOrEqual(c.max);
  });

  it('fiche complète et cohérente : score élevé, cohérence OK', () => {
    const a = auditGbp(
      profileFromManual({ name: 'Plomberie Martin', primaryCategory: 'Plombier', secondaryCategories: ['Chauffagiste', 'Dépannage'], descriptionLength: 600, hasHours: true, hoursText: 'Lundi : 08:00–19:00', hasSpecialHours: true, servicesCount: 6, attributesCount: 4, photosCount: 30, lastPhotoDaysAgo: 10, lastPostDaysAgo: 3, website: 'https://www.plomberie-martin.fr/', phone: '+33 1 43 55 12 34', address: '12 r. Oberkampf 75011 Paris', reviewCount: 80, rating: 4.7, lastReviewDaysAgo: 5, replyRate: 0.9 }, NOW),
      CTX,
    );
    expect(a.score).toBe(100);
    expect(a.criteria.filter((c) => c.group === 'coherence').every((c) => c.status === 'ok')).toBe(true);
  });

  it('source Places : critères non lisibles exclus, contenu non stocké', () => {
    const p = profileFromPlaces({ displayName: { text: 'Plomberie Martin' }, primaryTypeDisplayName: { text: 'Plombier' }, types: ['plumber', 'point_of_interest'], rating: 4.6, userRatingCount: 37, photos: [{}, {}, {}], formattedAddress: '12 Rue Oberkampf, 75011 Paris, France', nationalPhoneNumber: '01 43 55 12 34', websiteUri: 'https://plomberie-martin.fr', regularOpeningHours: { weekdayDescriptions: ['lundi: 08:00–19:00'] }, reviews: [{ rating: 5, text: { text: 'Top' }, publishTime: '2026-11-01T00:00:00Z' }] }, 'ChIJabcdefghijk');
    const a = auditGbp(p, CTX);
    expect(a.coverage).toBeLessThan(100);
    expect(a.criteria.find((c) => c.id === 'posts')!.status).toBe('unknown');
    expect(a.contentStored).toBe(false);
    const s = toStorableAudit(a);
    expect(JSON.stringify(s)).not.toContain('37 avis');
    expect(JSON.stringify(s)).not.toContain('4,6');
    expect(s.score).toBe(a.score);
  });

  it('comparateurs NAP', () => {
    expect(sameAddress('12 rue Oberkampf, 75011 Paris', '12 r. Oberkampf 75011 Paris')).toBe(true);
    expect(sameAddress('12 rue Oberkampf, 75011 Paris', '14 rue Oberkampf, 75011 Paris')).toBe(false);
    expect(sameHours('8 h – 19 h', 'Lundi : 08:00–19:00')).toBe(true);
    expect(sameHours('8 h – 19 h', 'Lundi : 09:00–18:00')).toBe(false);
  });
});

describe('carte de visibilité par zone', () => {
  it('grilles : Paris en arrondissements avec le 11e comme zone du commerce, 15 villes, repli cardinal', () => {
    const g = buildZoneGrid('Paris', '11e');
    expect(g.kind).toBe('arrondissements');
    expect(g.zones).toHaveLength(20);
    expect(g.zones.find((z) => z.home)!.id).toBe('arr-11');
    expect(buildZoneGrid('Lyon').zones).toHaveLength(9);
    expect(buildZoneGrid('Marseille').zones).toHaveLength(16);
    expect(buildZoneGrid('saint-etienne', 'Carnot').zones.find((z) => z.home)!.hint).toBe('Carnot');
    expect(GRID_CITIES).toHaveLength(15);
    const c = buildZoneGrid('Quimper');
    expect(c.kind).toBe('cardinal');
    expect(c.zones).toHaveLength(9);
    expect(c.zones[0].phrase).toBe('dans le centre de Quimper');
    expect(nearestZones(g, 5)[0].id).toBe('arr-11');
  });

  it('questions reformulées avec la zone, budget plafonné par l’offre', () => {
    const plan = planMap({ city: 'Paris', district: '11e', trade: 'plombier' }, 'essentiel', { engines: ['chatgpt', 'perplexity', 'gemini', 'claude'] });
    expect(plan.zones).toHaveLength(MAP_CAPS.essentiel.zones);
    expect(plan.providers).toHaveLength(3);
    expect(plan.budget.calls).toBeLessThanOrEqual(plan.budget.maxCalls);
    expect(plan.queries[0].text).toContain('dans le 11e arrondissement de Paris');
    expect(plan.queries[0].text).not.toContain('{zone}');
    expect(new Set(plan.queries.map((q) => q.id)).size).toBe(plan.queries.length);
    const d = planMap({ city: 'Paris', trade: 'plombier' }, 'decouverte', { engines: ['chatgpt', 'perplexity', 'gemini'] });
    expect(d.budget.calls).toBe(5 * 1 * 1 * 2);
    expect(normalizeZoneQuestions(['Quel plombier pas cher ?'], 'plombier', 2)[0].template).toBe('Quel plombier pas cher {zone} ?');
    expect(fillZone('Qui {zone} ?', plan.zones[0])).toMatch(/^Qui dans le .+\?$/);
  });

  it('agrège taux de mention, rang et concurrent dominant par zone', () => {
    const plan = planMap({ city: 'Lyon', trade: 'plombier' }, 'decouverte', { engines: ['chatgpt'] });
    const q = plan.queries[0].id;
    const m = (mentioned: boolean, rank: number | null, competitors: string[]): MentionResult => ({ provider: 'chatgpt', queryId: q, run: 1, mentioned, rank, competitors });
    const zones = aggregateZones(plan, [m(true, 2, ['A']), m(false, null, ['A', 'B']), { ...m(false, null, []), noRec: true }]);
    const z = zones.find((x) => x.zoneId === plan.queries[0].zoneId)!;
    expect(z.mentionRate).toBe(0.5);
    expect(z.avgRank).toBe(2);
    expect(z.answers).toBe(2);
    expect(z.dominantCompetitor).toEqual({ name: 'A', mentions: 2 });
    expect(z.band).toBe('fort');
    expect(zones.filter((x) => x.zoneId !== z.zoneId).every((x) => x.band === 'na')).toBe(true);
  });

  it('exécute un seul runAudit pour toutes les zones (moteur simulé)', async () => {
    const plan = planMap({ city: 'Paris', district: '11e', trade: 'plombier' }, 'essentiel', { engines: ['chatgpt', 'perplexity', 'gemini'] });
    const run = vi.fn(async (_input: unknown, opts: { queries?: { id?: string }[] }) => {
      const mentions: MentionResult[] = (opts.queries ?? []).map((qq, i) => ({ provider: 'chatgpt', queryId: qq.id!, run: 1, mentioned: i % 2 === 0, rank: i % 2 === 0 ? 1 : null, competitors: ['Concurrent X'] }));
      return { mentions, demo: true } as unknown as AuditResult;
    });
    const { map } = await runVisibilityMap({ businessId: 'biz_test', businessName: 'Plomberie Martin', trade: 'plombier', city: 'Paris', district: '11e' }, plan, { budgetEur: 1, now: NOW, run: run as never });
    expect(run).toHaveBeenCalledTimes(1);
    expect((run.mock.calls[0][1] as { queries: unknown[] }).queries).toHaveLength(plan.queries.length);
    expect(map.zones).toHaveLength(plan.zones.length);
    expect(map.label).toMatch(/Simulation/);
    expect(map.svg.points).toHaveLength(plan.zones.length);
  });

  it('avec le vrai moteur en mode simulé', async () => {
    const plan = planMap({ city: 'Lyon', trade: 'plombier' }, 'decouverte', { engines: ['chatgpt', 'perplexity', 'gemini'] });
    const { map, audit } = await runVisibilityMap({ businessId: 'biz_test', businessName: 'Plomberie Martin', trade: 'plombier', city: 'Lyon' }, plan, { budgetEur: 0.3, forceMock: true, now: NOW });
    expect(audit.queries.map((q) => q.id).sort()).toEqual(plan.queries.map((q) => q.id).sort());
    expect(map.zones.some((z) => z.answers > 0)).toBe(true);
  });

  it('démo déterministe : plus visible près du commerce', () => {
    const plan = planMap({ city: 'Paris', district: '11e', trade: 'plombier' }, 'demo', { engines: ['chatgpt', 'perplexity', 'gemini'] });
    const input = { businessId: 'demo', businessName: 'Plomberie Martin', trade: 'plombier', city: 'Paris', district: '11e' };
    const a = demoVisibilityMap(input, plan, NOW);
    const b = demoVisibilityMap(input, plan, NOW);
    expect(a.zones).toEqual(b.zones);
    const home = a.zones.find((z) => z.home)!;
    const far = a.zones[a.zones.length - 1];
    expect(home.mentionRate!).toBeGreaterThan(far.mentionRate ?? 0);
    expect(a.demo).toBe(true);
  });
});

describe('audit NAP', () => {
  const dirs = directoriesFor('plombier', 'biz_test');
  const ref = { name: 'Plomberie Martin', address: FACTS.adresse, phone: FACTS.telephone };

  it('liste par métier (BTP) et contrôle du domaine', () => {
    expect(dirs.map((d) => d.id)).toEqual(expect.arrayContaining(['google', 'pagesjaunes', 'bing', 'houzz']));
    expect(dirs.length).toBeLessThanOrEqual(10);
    expect(directoriesFor('restaurant').map((d) => d.id)).toContain('tripadvisor');
    expect(urlMatchesDirectory('https://www.houzz.fr/pro/x', dirs.find((d) => d.id === 'houzz')!)).toBe(true);
    expect(urlMatchesDirectory('https://evil.example/houzz.fr', dirs.find((d) => d.id === 'houzz')!)).toBe(false);
  });

  it('téléphones et vérification de page', () => {
    expect(phonesIn('Tél. : +33 1 43 55 12 34 ou 06.12.34.56.78')).toEqual(['0143551234', '0612345678']);
    const c = checkPage('Plomberie Martin – 12 rue Oberkampf 75011 Paris – 01 43 55 12 34', ref);
    expect(c).toMatchObject({ name: true, address: true, phone: true });
  });

  it('statuts vérifié / déclaré / absent, incohérences et score', async () => {
    const entries = parseNapEntries(
      [
        { directoryId: 'houzz', url: 'https://www.houzz.fr/pro/plomberie-martin' },
        { directoryId: 'pagesjaunes', present: true, listed: { phone: '01 43 55 99 99' } },
        { directoryId: 'bing', present: false },
        { directoryId: 'google', url: 'https://www.google.com/maps/x' },
        { directoryId: 'inconnu', present: true },
      ],
      dirs,
    );
    expect(entries).toHaveLength(4);
    const fetcher = vi.fn(async (url: string) => (url.includes('houzz') ? { status: 200, contentType: 'text/html', body: '<h1>Plomberie Martin</h1><p>01 43 55 12 34</p>' } : (() => { throw new Error('robots'); })()));
    const a = await auditNap(dirs, entries, ref, { businessId: 'biz_test', fetcher, now: NOW });
    const row = (id: string) => a.rows.find((r) => r.directory.id === id)!;
    expect(row('houzz').status).toBe('verified');
    expect(row('google').status).toBe('declared');
    expect(row('google').check?.fetched).toBe(false);
    expect(row('pagesjaunes').issues[0]).toMatchObject({ field: 'phone', severity: 'haute' });
    expect(row('bing').status).toBe('absent');
    expect(row('facebook').status).toBe('unknown');
    expect(a.score).toBe(napScore(a.rows));
    expect(a.score).toBeGreaterThan(0);
    expect(a.score).toBeLessThan(100);
  });
});

describe('calendrier de posts', () => {
  it('1 post par semaine, texte prêt à coller, rappels', async () => {
    const { posts, reminders } = await planPosts({ businessId: 'biz_test', businessName: 'Plomberie Martin', trade: 'plombier', city: 'Paris', services: 'Dépannage de fuite, débouchage', phone: '01 43 55 12 34' }, { from: NOW, count: 6 });
    expect(posts).toHaveLength(6);
    expect(reminders).toHaveLength(6);
    expect(new Date(`${posts[0].date}T00:00:00Z`).getUTCDay()).toBe(2);
    for (let i = 1; i < posts.length; i++) expect(Date.parse(posts[i].date) - Date.parse(posts[i - 1].date)).toBe(7 * 86_400_000);
    for (const p of posts) {
      expect(p.text.length).toBeLessThanOrEqual(POST_MAX);
      expect(p.status).toBe('planned');
      expect(p.text).not.toMatch(/\d+ ?%|promo/i);
    }
    expect(posts.some((p) => p.type === 'evenement')).toBe(true); // décembre : horaires des fêtes
    expect(posts.map((p) => p.type)).toContain('conseil');
  });
});

describe('thèmes des avis', () => {
  it('thèmes positifs et négatifs par règles, brouillons de réponse', () => {
    const r = analyzeReviewThemes(DEMO_REVIEWS, { businessId: 'demo', businessName: 'Plomberie Martin', source: 'demo', replies: 3 });
    expect(r.analyzed).toBe(DEMO_REVIEWS.length);
    expect(r.averageRating).toBe(DEMO_MANUAL.rating);
    expect(r.analyzed).toBe(DEMO_MANUAL.reviewCount);
    const ids = r.themes.map((t) => t.id);
    expect(ids).toEqual(expect.arrayContaining(['rapidite', 'prix', 'qualite', 'communication']));
    expect(r.themes.find((t) => t.id === 'communication')!.negative).toBeGreaterThan(0);
    expect(r.replies).toHaveLength(3);
    expect(r.replies![0].tone).toBe('negatif');
    expect(r.replies![0].draft).toMatch(/^Bonjour,/);
    expect(r.weaknesses.length).toBeGreaterThan(0);
  });

  it('texte collé et règles de stockage Places', () => {
    const list = parseReviews('★★★★★ Super travail, rapide.\n\n2/5 injoignable et en retard');
    expect(list).toEqual([{ text: '★★★★★ Super travail, rapide.', rating: 5 }, { text: '2/5 injoignable et en retard', rating: 2 }]);
    const r = analyzeReviewThemes(list, { businessId: 'x', source: 'places' });
    const s = toStorableThemes(r);
    expect(s.replies).toBeUndefined();
    expect(s.themes.every((t) => t.examples.length === 0)).toBe(true);
  });
});

describe('démo Plomberie Martin', () => {
  it('construit les 5 livrables sans réseau et de façon déterministe', async () => {
    const d = (await buildLocalDemo('demo', NOW))!;
    expect(d.gbp.demo).toBe(true);
    expect(d.map.demo).toBe(true);
    expect(d.map.zones.find((z) => z.home)?.label).toBe('Paris 11e');
    expect(d.nap.rows.find((r) => r.directory.id === 'houzz')!.status).toBe('verified');
    expect(d.nap.issues.some((i) => i.directoryId === 'pagesjaunes' && i.field === 'address')).toBe(true);
    expect(d.posts).toHaveLength(4);
    expect(d.themes.source).toBe('demo');
    const again = (await buildLocalDemo('demo', NOW))!;
    expect(again.gbp.score).toBe(d.gbp.score);
    expect(again.nap.score).toBe(d.nap.score);
    expect(await buildLocalDemo('biz_test')).toBeNull();
    expect((await buildLocalDemo('demo-pme', NOW))?.gbp.criteria.length).toBeGreaterThan(10);
  });
});

describe('stockage et rappels', () => {
  it('enregistre un audit Places sans contenu Google et traite les rappels dus', async () => {
    const repo = await import('@/lib/local/repo');
    const a = auditGbp(profileFromPlaces({ displayName: { text: 'Plomberie Martin' }, rating: 4.6, userRatingCount: 37 }, 'ChIJabcdefghijk'), CTX);
    await repo.saveGbpAudit(a);
    const stored = (await repo.latestGbpAudit('biz_test'))!;
    expect(stored.contentStored).toBe(false);
    expect(JSON.stringify(stored)).not.toContain('37 avis');
    await expect(repo.saveGbpAudit({ ...a, businessId: 'demo' })).rejects.toThrow();

    const { posts, reminders } = await planPosts({ businessId: 'biz_test', businessName: 'Plomberie Martin', trade: 'plombier', city: 'Paris' }, { from: new Date('2026-10-01T00:00:00Z'), count: 2 });
    await repo.savePosts(posts, reminders);
    await repo.updatePost('biz_test', posts[1].id, { status: 'published' });
    const notify = vi.fn(async () => ({ id: 'n' }) as never);
    const send = vi.fn();
    const rep = await repo.processDueReminders(NOW, { notify, send: send as never });
    expect(rep.due).toBe(1);
    expect(rep.notified).toBe(1);
    expect(send).not.toHaveBeenCalled(); // pas de contact e-mail connu
    const again = await repo.processDueReminders(NOW, { notify, send: send as never });
    expect(again.due).toBe(0);
    expect((await repo.listPosts('biz_test')).find((p) => p.id === posts[0].id)?.reminded).toBe(true);
  });
});
