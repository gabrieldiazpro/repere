/**
 * Connecteurs Shopify, Webflow, PrestaShop, Google Business Profile et export, chacun contre un faux serveur local
 * reproduisant l'API documentée : cycle proposer → valider → appliquer → vérifier → annuler, droits, échecs.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { useMemoryJobs } from '@/lib/jobs/testing';
import { setPublishHttp } from '../http';
import { rulesWriter } from '../writer';
import { readZip } from '../zip';
import { applyChangeSet, connectPlatform, createChangeSets, exportChangeSet, proposeChangeSet, revertChangeSet, validateChangeSet, verifyChangeSet } from '../service';
import type { Actor, ChangeSet, Finding } from '../types';
import type { PlanSite } from '../planner';
import { isolateStore, localHttp, routePublicFetch, startFake, type Fake } from './helpers';
import { gbpFake, prestashopFake, shopifyFake, webflowFake } from './fakes';

isolateStore('connectors');

const admin: Actor = { id: 'u-admin', role: 'owner' };
let fake: Fake;
let restore: () => void;
let n = 0;
let biz = '';

const finding = (o: Partial<Finding> & Pick<Finding, 'id'>): Finding => ({ category: 'contenu', severity: 'high', title: o.id, why: '', fix: 'Corriger.', affected: [], affectedCount: 0, impact: 2, effort: 1, ...o });

async function cycle(cs: ChangeSet): Promise<ChangeSet> {
  await proposeChangeSet(biz, cs.id, admin);
  await validateChangeSet(biz, cs.id, admin);
  return applyChangeSet(biz, cs.id, admin);
}

beforeAll(async () => {
  fake = await startFake();
  setPublishHttp(localHttp(fake.port));
  restore = routePublicFetch(fake.port);
});
afterAll(async () => {
  setPublishHttp(null);
  restore();
  await fake.close();
});
beforeEach(() => {
  useMemoryJobs();
  biz = `conn-biz-${++n}`;
});

describe('Shopify', () => {
  const shopSite = (b: string): PlanSite => ({
    businessId: b,
    origin: 'https://boutique-test.myshopify.com',
    name: 'Maison Sora',
    pages: [
      { url: 'https://boutique-test.myshopify.com/products/creme-solaire', title: 'Crème solaire bio SPF 50 – Maison Sora', h1: ['Crème solaire bio SPF 50'], text: 'Crème minérale, 50 ml. Filtre minéral, fabriquée à Nantes.' },
      { url: 'https://boutique-test.myshopify.com/pages/a-propos', title: 'À propos – Maison Sora', h1: ['À propos de Maison Sora'], text: 'Maison Sora fabrique ses crèmes à Nantes depuis le premier jour, en petites séries.' },
    ],
  });
  let st: ReturnType<typeof shopifyFake>['state'];
  beforeEach(() => {
    const f = shopifyFake();
    st = f.state;
    fake.hosts.set('boutique-test.myshopify.com', f.handler);
  });

  it('jeton d’app : capacités selon les portées, produit (seo) et page (métachamps global.*), retour arrière', async () => {
    const c = await connectPlatform(biz, 'shopify', { config: { shop: 'boutique-test' }, credentials: { token: st.token } }, admin);
    expect(c.test.ok).toBe(true);
    expect(c.test.capabilities).toEqual(['meta.title', 'meta.description', 'rewrite', 'redirect']);
    const plan = await createChangeSets(
      biz,
      [
        finding({ id: 'seo.title.too_long', affected: [{ url: 'https://boutique-test.myshopify.com/products/creme-solaire' }] }),
        finding({ id: 'seo.meta_description.missing', affected: [{ url: 'https://boutique-test.myshopify.com/pages/a-propos' }] }),
      ],
      shopSite(biz),
      admin,
      { writer: rulesWriter },
    );
    expect(plan.changeSets.map((c) => c.platform)).toEqual(['shopify', 'shopify']);
    const [prod, page] = plan.changeSets;
    const p1 = await cycle(prod);
    expect(p1.status).toBe('verified');
    expect(st.products[0].seoTitle).toBe('Crème solaire bio SPF 50 | Maison Sora');
    const p2 = await cycle(page);
    expect(p2.status).toBe('verified');
    expect(p2.changes[0].before).toBeNull(); // métachamp absent avant
    expect(st.pages[0].metafields.description_tag).toBe('Maison Sora fabrique ses crèmes à Nantes depuis le premier jour, en petites séries.');
    await revertChangeSet(biz, page.id, admin);
    expect(st.pages[0].metafields).not.toHaveProperty('description_tag'); // « absent » rétabli
    await revertChangeSet(biz, prod.id, admin);
    expect(st.products[0].seoTitle).toBeNull();
    expect(st.calls).toContain('metafieldsDelete');
  });

  it('redirection : création, vérification publique, suppression au retour arrière', async () => {
    await connectPlatform(biz, 'shopify', { config: { shop: 'boutique-test.myshopify.com' }, credentials: { token: st.token } }, admin);
    const plan = await createChangeSets(biz, [finding({ id: 'seo.links.broken', autoFix: { kind: 'redirect', payload: { from: '/products/ancienne-creme', to: '/products/creme-solaire' } } })], shopSite(biz), admin);
    const cs = await cycle(plan.changeSets[0]);
    expect(cs.status).toBe('verified');
    expect(st.redirects).toEqual([expect.objectContaining({ path: '/products/ancienne-creme', target: '/products/creme-solaire' })]);
    expect(cs.changes[0].remoteRef).toMatch(/^gid:\/\/shopify\/UrlRedirect\//);
    const r = await revertChangeSet(biz, cs.id, admin);
    expect(r.status).toBe('reverted');
    expect(st.redirects).toEqual([]);
  });

  it('redirection vers un autre site : refusée par le planificateur', async () => {
    const plan = await createChangeSets(biz, [finding({ id: 'x', autoFix: { kind: 'redirect', payload: { from: '/a', to: 'https://autre-site.example/b' } } })], shopSite(biz), admin);
    expect(plan.changeSets).toEqual([]);
    expect(plan.skipped[0].reason).toMatch(/même site/);
  });

  it('boutique en lecture seule : aucune capacité, tout part à l’export ; refus de droits remonté proprement', async () => {
    st.scopes = ['read_products', 'read_orders'];
    const c = await connectPlatform(biz, 'shopify', { config: { shop: 'boutique-test' }, credentials: { token: st.token } }, admin);
    expect(c.test.ok).toBe(false);
    expect(c.test.detail).toMatch(/lecture seule/);
    const plan = await createChangeSets(biz, [finding({ id: 'seo.title.too_long', affected: [{ url: 'https://boutique-test.myshopify.com/products/creme-solaire' }] })], shopSite(biz), admin, { writer: rulesWriter });
    expect(plan.changeSets[0].platform).toBe('export');
  });

  it('jeton invalide : saisie refusée', async () => {
    await expect(connectPlatform(biz, 'shopify', { config: { shop: 'boutique-test' }, credentials: { token: 'abc' } }, admin)).rejects.toMatchObject({ status: 400 });
    await expect(connectPlatform(biz, 'shopify', { config: { shop: 'https://evil.example.com' }, credentials: {} }, admin)).rejects.toMatchObject({ status: 400 });
  });
});

describe('Webflow', () => {
  let st: ReturnType<typeof webflowFake>['state'];
  beforeEach(() => {
    const f = webflowFake();
    st = f.state;
    fake.hosts.set('api.webflow.com', f.handler);
    fake.hosts.set('studio-wf.test', f.handler);
  });

  it('titre + description de deux pages : une seule publication, page publique relue, retour arrière publié', async () => {
    const c = await connectPlatform(biz, 'webflow', { config: { siteId: st.siteId }, credentials: { token: st.token } }, admin);
    expect(c.test.ok).toBe(true);
    const site: PlanSite = {
      businessId: biz,
      origin: 'https://studio-wf.test',
      name: 'Studio WF',
      pages: [
        { url: 'https://studio-wf.test/', title: 'Accueil', h1: ['Studio graphique à Bordeaux'], text: 'Studio graphique à Bordeaux. Identités visuelles et sites pour les artisans et commerçants.' },
        { url: 'https://studio-wf.test/tarifs', title: 'Tarifs', h1: ['Nos tarifs de création graphique'], text: 'Studio graphique à Bordeaux. Logo, charte et site : tarifs détaillés par prestation.' },
      ],
    };
    const plan = await createChangeSets(biz, [finding({ id: 'seo.title.too_short', affected: [{ url: 'https://studio-wf.test/' }, { url: 'https://studio-wf.test/tarifs' }] })], site, admin, { writer: rulesWriter });
    const cs = await cycle(plan.changeSets[0]);
    expect(cs.status).toBe('verified');
    expect(st.publishCount).toBe(1);
    expect(st.pages.map((p) => p.seo.title)).toEqual(['Studio graphique à Bordeaux | Studio WF', 'Nos tarifs de création graphique | Studio WF']);
    expect(st.pages[0].seo.description).toBe(''); // l'autre champ SEO n'est pas effacé
    const r = await revertChangeSet(biz, cs.id, admin);
    expect(r.status).toBe('reverted');
    expect(st.publishCount).toBe(2);
    expect(st.pages.map((p) => p.seo.title)).toEqual(['Accueil', 'Tarifs']);
  });

  it('jeton refusé : test en échec', async () => {
    const c = await connectPlatform(biz, 'webflow', { config: { siteId: st.siteId }, credentials: { token: 'wf_mauvais_jeton_0123456789abcdef' } }, admin);
    expect(c.test).toMatchObject({ ok: false, capabilities: [] });
    expect(c.test.detail).toMatch(/identifiants refusés/);
  });
});

describe('PrestaShop', () => {
  let st: ReturnType<typeof prestashopFake>['state'];
  const site = (b: string): PlanSite => ({
    businessId: b,
    origin: 'https://boutique-ps.test',
    name: 'Boutique PS',
    pages: [{ url: 'https://boutique-ps.test/mugs/12-mug-personnalisable.html', title: 'Customizable mug', h1: ['Mug personnalisable en céramique'], text: 'Mug en céramique blanche, 33 cl, personnalisable avec votre photo ou votre texte. Passe au lave-vaisselle.' }],
  });
  beforeEach(() => {
    const f = prestashopFake();
    st = f.state;
    fake.hosts.set('boutique-ps.test', f.handler);
  });

  it('PATCH XML : seule la langue visée change ; retour arrière', async () => {
    const c = await connectPlatform(biz, 'prestashop', { config: { siteUrl: 'https://boutique-ps.test', languageId: '1' }, credentials: { apiKey: st.apiKey } }, admin);
    expect(c.test.ok).toBe(true);
    st.products['12'].meta_title['2'] = 'Mug personnalisable';
    const plan = await createChangeSets(biz, [finding({ id: 'seo.meta_description.missing', affected: [{ url: 'https://boutique-ps.test/mugs/12-mug-personnalisable.html' }] })], site(biz), admin, { writer: rulesWriter });
    const cs = await cycle(plan.changeSets[0]);
    expect(cs.status).toBe('verified');
    expect(st.patches).toBe(1);
    expect(st.products['12'].meta_description['1']).toMatch(/^Mug en céramique blanche, 33 cl/);
    expect(st.products['12'].meta_title).toEqual({ '1': 'Customizable mug', '2': 'Mug personnalisable' });
    await revertChangeSet(biz, cs.id, admin);
    expect(st.products['12'].meta_description['1']).toBe('');
  });

  it('PATCH absent (405) : repli PUT du XML complet, sans champs en lecture seule', async () => {
    st.patchSupported = false;
    await connectPlatform(biz, 'prestashop', { config: { siteUrl: 'boutique-ps.test' }, credentials: { apiKey: st.apiKey } }, admin);
    const plan = await createChangeSets(biz, [finding({ id: 'seo.title.too_short', affected: [{ url: 'https://boutique-ps.test/mugs/12-mug-personnalisable.html' }] })], site(biz), admin, { writer: rulesWriter });
    const cs = await cycle(plan.changeSets[0]);
    expect(cs.status).toBe('verified');
    expect(st.puts).toBe(1);
    expect(st.products['12'].meta_title['1']).toBe('Mug personnalisable en céramique | Boutique PS');
  });

  it('clé refusée / mal formée', async () => {
    await expect(connectPlatform(biz, 'prestashop', { config: { siteUrl: 'https://boutique-ps.test' }, credentials: { apiKey: 'courte' } }, admin)).rejects.toMatchObject({ status: 400 });
    const c = await connectPlatform(biz, 'prestashop', { config: { siteUrl: 'https://boutique-ps.test' }, credentials: { apiKey: 'ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ' } }, admin);
    expect(c.test.ok).toBe(false);
  });
});

describe('Google Business Profile (derrière drapeau)', () => {
  let st: ReturnType<typeof gbpFake>['state'];
  beforeEach(() => {
    const f = gbpFake();
    st = f.state;
    fake.hosts.set('mybusinessbusinessinformation.googleapis.com', f.handler);
  });
  afterEach(() => {
    delete process.env.PUBLISH_GBP_ENABLED;
  });

  it('désactivé sans PUBLISH_GBP_ENABLED : connexion refusée, changements de fiche à l’export', async () => {
    await expect(connectPlatform(biz, 'gbp', { config: { locationId: 'locations/1234567890' }, credentials: { accessToken: st.token } }, admin)).rejects.toMatchObject({ status: 503 });
    const plan = await createChangeSets(biz, [finding({ id: 'local.gbp.description', autoFix: { kind: 'gbp.description', payload: { value: 'Plomberie Martin, plombier à Lyon 3e : dépannage, chauffe-eau et devis gratuit sous 24 heures, du lundi au samedi.' } } })], { businessId: biz, origin: 'https://wp.test', pages: [] }, admin);
    expect(plan.changeSets[0].platform).toBe('export');
  });

  it('activé : description et horaires appliqués puis annulés', async () => {
    process.env.PUBLISH_GBP_ENABLED = '1';
    const c = await connectPlatform(biz, 'gbp', { config: { locationId: 'accounts/42/locations/1234567890' }, credentials: { accessToken: st.token } }, admin);
    expect(c.test.ok).toBe(true);
    const hours = { periods: [{ openDay: 'MONDAY', closeDay: 'MONDAY', openTime: { hours: 9 }, closeTime: { hours: 19 } }] };
    const plan = await createChangeSets(
      biz,
      [
        finding({ id: 'local.gbp.description', autoFix: { kind: 'gbp.description', payload: { value: 'Plomberie Martin, plombier à Lyon 3e : dépannage, chauffe-eau et devis gratuit sous 24 heures, du lundi au samedi.' } } }),
        finding({ id: 'local.gbp.hours', autoFix: { kind: 'gbp.hours', payload: { hours } } }),
      ],
      { businessId: biz, origin: 'https://wp.test', pages: [] },
      admin,
    );
    expect(plan.changeSets.map((c) => c.platform)).toEqual(['gbp', 'gbp']);
    for (const cs of plan.changeSets) expect((await cycle(cs)).status).toBe('verified');
    expect(st.location.profile.description).toMatch(/^Plomberie Martin/);
    expect(st.location.regularHours).toEqual(hours);
    for (const cs of plan.changeSets) expect((await revertChangeSet(biz, cs.id, admin)).status).toBe('reverted');
    expect(st.location.profile.description).toBe('');
    expect((st.location.regularHours as { periods: { openTime: { hours: number } }[] }).periods[0].openTime.hours).toBe(8);
  });
});

describe('Export (site sans API)', () => {
  it('llms.txt + robots.txt : archive avec instructions et « avant », vérification après dépôt', async () => {
    let deployed: Record<string, string> = { '/robots.txt': 'User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nAllow: /\nSitemap: https://vitrine.test/sitemap.xml\n' };
    fake.hosts.set('vitrine.test', (r) => (deployed[r.path] !== undefined ? { headers: { 'content-type': 'text/plain' }, body: deployed[r.path] } : { status: 404, body: '' }));
    const site: PlanSite = {
      businessId: biz,
      origin: 'https://vitrine.test',
      name: 'Fleurs de Lise',
      robotsTxt: deployed['/robots.txt'],
      llmsTxt: null,
      pages: [
        { url: 'https://vitrine.test/', title: 'Fleurs de Lise, fleuriste à Lille', metaDescription: 'Bouquets de saison et compositions sur commande à Lille.' },
        { url: 'https://vitrine.test/mariage', title: 'Fleurs de mariage', metaDescription: 'Bouquets de mariée et décoration florale.' },
      ],
    };
    const plan = await createChangeSets(
      biz,
      [finding({ id: 'geo.llms.missing', title: 'Pas de fichier llms.txt' }), finding({ id: 'geo.acces.robots', title: 'GPTBot est bloqué', autoFix: { kind: 'robots.txt', payload: { allowBots: ['GPTBot'] } } })],
      site,
      admin,
    );
    expect(plan.changeSets.map((c) => c.platform)).toEqual(['export', 'export']);
    const [llms, robots] = plan.changeSets;
    expect(llms.changes[0].after).toBe('# Fleurs de Lise\n\n> Bouquets de saison et compositions sur commande à Lille.\n\n## Pages principales\n\n- [Fleurs de Lise, fleuriste à Lille](https://vitrine.test/): Bouquets de saison et compositions sur commande à Lille.\n- [Fleurs de mariage](https://vitrine.test/mariage): Bouquets de mariée et décoration florale.\n');
    expect(robots.changes[0].after).toBe('User-agent: *\nAllow: /\nSitemap: https://vitrine.test/sitemap.xml\n\nUser-agent: GPTBot\nAllow: /\n');
    await expect(applyChangeSet(biz, robots.id, admin)).rejects.toMatchObject({ status: 409 });
    const p = await proposeChangeSet(biz, robots.id, admin);
    expect(p.changes[0].before).toBe(deployed['/robots.txt']); // relu en ligne
    await validateChangeSet(biz, robots.id, admin);
    const applied = await applyChangeSet(biz, robots.id, admin);
    expect(applied.status).toBe('applied'); // fichiers prêts, pas encore en ligne
    expect(applied.changes[0].verification?.map((v) => v.method)).toEqual(['manual', 'page']);
    const { zip, filename } = await exportChangeSet(biz, robots.id);
    expect(filename).toBe(`repere-${robots.id}.zip`);
    const files = readZip(zip);
    expect(files.map((f) => f.name)).toEqual(['LISEZ-MOI.txt', 'robots.txt', 'avant/robots.txt']);
    expect(files[0].content).toMatch(/déposez le fichier robots\.txt à la racine/);
    expect(files[2].content).toBe(deployed['/robots.txt']);
    // Le client dépose le fichier → « Vérifier »
    deployed = { '/robots.txt': files[1].content };
    const v = await verifyChangeSet(biz, robots.id, admin);
    expect(v.status).toBe('verified');
    await expect(exportChangeSet(biz, llms.id)).rejects.toMatchObject({ status: 409 }); // brouillon : rien à exporter
  });
});
