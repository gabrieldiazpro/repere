/**
 * ROBUSTESSE (V6) — l'analyse 60 s (vrais modules CRAWL → SEO + GEO) sur les faux sites « web réel » :
 * aucune note sur un site non lu, un état et un message en français pour chaque cas dégradé, conseils adaptés à la
 * plateforme, budget total tenu. Aucune sortie réseau (fakesites.ts), IA coupée.
 */
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startFakeSites, type FakeServer } from '@/lib/crawl/__tests__/fakesites';
import { resetHardState } from '@/lib/crawl/__tests__/hardsites';
import { collectAnalysis, runFullAnalysis } from '../run';
import { accessReport, adaptFinding, platformTip } from '../access';
import { nameFromDomain } from '../detect';
import type { FullAnalysis } from '../types';
import type { Finding, PlatformInfo } from '@/lib/crawl/types';
import { clearAiKeys } from './fakeSite';

let srv: FakeServer;
beforeAll(async () => {
  clearAiKeys();
  process.env.DATA_DIR = await fs.mkdtemp(path.join(os.tmpdir(), 'repere-robustesse-'));
  srv = await startFakeSites();
});
afterAll(async () => {
  await srv.close();
});

const run = async (url: string, budget = { budgetMs: 20_000, crawlBudgetMs: 8_000 }): Promise<FullAnalysis> => {
  resetHardState();
  const a = await collectAnalysis(runFullAnalysis({ url }, { ...budget, modules: { aiCheck: async () => null } }));
  expect(a).not.toBeNull();
  return a!;
};

describe('sites illisibles : aucun score, un état et un message utiles', () => {
  const cases: [string, string, RegExp][] = [
    ['https://robots-tout.test/', 'blocked_robots', /bloque les robots : voici comment autoriser RepereBot/],
    ['https://bloque.test/', 'blocked_robots', /autoriser RepereBot/],
    ['https://cloudflare.test/', 'blocked_firewall', /Cloudflare a refusé notre robot/],
    ['https://accueil-404.test/', 'http_error', /page introuvable/],
    ['https://maintenance.test/', 'maintenance', /maintenance/],
    ['https://parking.test/', 'parked', /parking/],
    ['https://shopify-mdp.test/', 'password_protected', /mot de passe/],
    ['https://boucle-accueil.test/', 'redirect_loop', /boucle/],
    ['https://vide.test/', 'empty', /vide/],
    ['https://binaire.test/', 'not_html', /ne renvoie pas une page web/],
  ];
  it.each(cases)('%s → %s', async (url, state, title) => {
    const a = await run(url);
    expect(a.access).toMatchObject({ state, readable: false, tone: 'block' });
    expect(a.access!.title).toMatch(title);
    expect(a.access!.message.length).toBeGreaterThan(40);
    expect(a.scores).toEqual({ seo: null, geo: null, global: null });
    expect(a.seo).toBeNull();
    expect(a.geo).toBeNull();
    expect(a.modules.seo).toMatchObject({ status: 'skipped' });
    expect(a.verdict).toMatch(/Nous n'avons pas pu lire le site/);
    expect(a.verdict).not.toMatch(/n'a pas répondu/); // plus de faux motif
    expect(a.priorities[0]).toMatchObject({ id: `access.${state}`, severity: 'critical' });
  }, 25_000);

  it('robots.txt « Disallow: / » : la marche à suivre donne les lignes à ajouter et prévient que Google est bloqué aussi', async () => {
    const a = await run('https://robots-tout.test/');
    expect(a.access!.message).toMatch(/y compris Google/);
    expect(a.access!.howTo.join(' ')).toMatch(/User-agent: RepereBot.*Allow: \//);
  });

  it('accueil qui ne répond pas : état timeout, analyse terminée sous le budget', async () => {
    const t = Date.now();
    const a = await run('https://ttfb-lent.test/', { budgetMs: 14_000, crawlBudgetMs: 4_000 });
    expect(Date.now() - t).toBeLessThan(15_000);
    expect(a.access?.state).toBe('timeout');
    expect(a.scores.global).toBeNull();
  }, 20_000);

  it('adresse qui redirige vers une IP interne : refusée sans connexion', async () => {
    const out: string[] = [];
    for await (const e of runFullAnalysis({ url: 'https://piege.test/' }, { budgetMs: 10_000, modules: { aiCheck: async () => null } })) if (e.type === 'error') out.push(e.message);
    expect(out[0]).toMatch(/site public/);
  });
});

describe('sites lisibles mais particuliers', () => {
  it('SPA vide : état js_only, scores calculés sur le HTML brut, message « nous voyons ce que voient les robots d’IA »', async () => {
    const a = await run('https://spa-vide.test/');
    expect(a.access).toMatchObject({ state: 'js_only', readable: true, tone: 'warn' });
    expect(a.access!.title).toMatch(/Site construit en JavaScript : nous voyons ce que voient la plupart des robots d’IA/);
    expect(a.scores.seo).toBeTypeOf('number');
    expect(a.priorities[0].id).toBe('access.js_only');
    expect(a.verdict).toMatch(/JavaScript/);
  }, 25_000);

  it('cookie obligatoire, meta refresh : site lu, signaux en clair', async () => {
    const c = await run('https://cookie.test/');
    expect(c.access?.readable).toBe(true);
    expect(c.access!.notes.join(' ')).toMatch(/cookie/);
    expect(c.crawl!.pagesFetched).toBeGreaterThanOrEqual(3);
    const m = await run('https://meta-refresh.test/');
    expect(m.modules.detect.status).toBe('ok'); // page d'accueil lue après la redirection meta refresh
    expect(m.crawl!.pagesFetched).toBeGreaterThanOrEqual(2);
    expect(m.access!.notes.join(' ')).toMatch(/meta refresh/);
  }, 30_000);

  it('limitation 429 en cours de route : arrêt poli, pas de faux « liens cassés »', async () => {
    const a = await run('https://limite.test/');
    expect(a.access!.notes.join(' ')).toMatch(/HTTP 429/);
    const ids = (a.seo?.sections ?? []).flatMap((s) => s.findings.map((f) => f.id));
    expect(ids).not.toContain('seo.broken.internal');
  }, 25_000);

  it('WordPress : plateforme exposée et conseils adaptés (où modifier, et que Repéré peut le faire)', async () => {
    const a = await run('https://wordpress.test/');
    expect(a.access?.platform).toMatchObject({ id: 'wordpress', name: 'WordPress', publishable: true, ecommerce: true });
    const meta = a.priorities.find((p) => /^seo\.(meta|title)\./.test(p.id));
    if (meta) expect(meta.fix).toMatch(/Sur WordPress/);
  }, 25_000);

  it('domaine accentué : marque lisible, pas de « Xn-- »', async () => {
    expect(nameFromDomain('https://xn--boulangerie-lonore-mwbb.fr/')).toBe('Boulangerie Éléonore');
    const a = await run('https://boulangerie-éléonore.test/');
    expect(a.detected.brand).not.toMatch(/^Xn/i);
    expect(a.access?.readable).toBe(true);
  }, 25_000);
});

describe('budget total', () => {
  it('site aux pages lentes : résultat (même partiel) avant la fin du budget', async () => {
    const t = Date.now();
    const a = await run('https://goutte.test/', { budgetMs: 15_000, crawlBudgetMs: 6_000 });
    expect(Date.now() - t).toBeLessThan(15_500);
    expect(a.access?.readable).toBe(true);
    expect(a.scores.seo).toBeTypeOf('number');
  }, 20_000);
});

describe('access.ts (unitaire)', () => {
  const wix: PlatformInfo = { id: 'wix', name: 'Wix', confidence: 'high', evidence: ['meta generator Wix.com'] };
  const f: Finding = { id: 'seo.meta.missing', category: 'contenu', severity: 'medium', title: 't', why: 'w', fix: 'Rédigez une description.', affected: [], affectedCount: 1, impact: 2, effort: 1, autoFix: { kind: 'meta', payload: {} } };
  it('adaptFinding ajoute l’endroit exact et la possibilité d’agir, sans doublon', () => {
    const x = adaptFinding(f, wix);
    expect(x.fix).toMatch(/Sur Wix : dans l’éditeur, Pages/);
    expect(x.fix).toMatch(/Repéré peut l’appliquer pour vous sur Wix/);
    expect(adaptFinding(x, wix).fix).toBe(x.fix);
    expect(adaptFinding(f, null)).toBe(f);
    expect(platformTip('seo.robots.blocks_all', { ...wix, id: 'shopify', name: 'Shopify' })).toMatch(/robots\.txt\.liquid/);
    expect(platformTip('seo.whatever', wix)).toBeNull();
  });
  it('crawl absent : état déduit du message, jamais « ok »', () => {
    expect(accessReport(null, 'délai dépassé').state).toBe('timeout');
    expect(accessReport(null, 'Nom de domaine introuvable.').state).toBe('dns');
    expect(accessReport(null, 'Cette adresse ne pointe pas vers un site public.').state).toBe('blocked_address');
    expect(accessReport(null).readable).toBe(false);
  });
});
