/**
 * Formats `autoFix` réels de SEO-AUDIT et GEO-OPT (docs/v5/demandes-PUBLICATION.md) : normalisation, planification,
 * et cycle sur faux WordPress pour les cas qui écrivent (réécritures multiples d'une page, mise à jour de liens, FAQ).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { useMemoryJobs } from '@/lib/jobs/testing';
import { expandAutoFix } from '../autofix';
import { setPublishHttp } from '../http';
import { planChanges, type PlanSite } from '../planner';
import { applyChangeSet, connectPlatform, createChangeSets, editChange, proposeChangeSet, revertChangeSet, validateChangeSet } from '../service';
import { rulesWriter } from '../writer';
import type { Actor, Finding } from '../types';
import { isolateStore, localHttp, routePublicFetch, startFake, type Fake } from './helpers';
import { wordpressFake, type WpState } from './fakes';

isolateStore('autofix');

const admin: Actor = { id: 'u-admin', role: 'admin' };
const f = (id: string, kind: string, payload: unknown, extra: Partial<Finding> = {}): Finding => ({ id, category: 'x', severity: 'medium', title: id, why: '', fix: 'Corriger.', affected: [], affectedCount: 0, impact: 2, effort: 1, autoFix: { kind, payload }, ...extra });

const SITE: PlanSite = {
  businessId: 'b-plan',
  origin: 'https://wp.test',
  name: 'Plomberie Martin',
  robotsTxt: 'User-agent: *\nDisallow: /\n',
  pages: [
    { url: 'https://wp.test/plombier-lyon/', title: 'Plombier Lyon', h1: ['Plombier à Lyon 3e'], text: 'Plomberie Martin intervient à Lyon 3e pour les fuites et les chauffe-eau. Devis gratuit sous 24 heures.', jsonLd: [{ '@context': 'https://schema.org', '@type': 'Plumber', name: 'Plomberie Martin', sameAs: ['https://facebook.com/plomberiemartin'] }], metaRobots: 'noindex, follow' },
    { url: 'https://wp.test/', title: 'Accueil', h1: ['Plomberie Martin'], text: 'Bienvenue chez Plomberie Martin.' },
  ],
};

describe('normalisation des formats SEO-AUDIT', () => {
  it('items → un élément par page / image / redirection ; alias img.alt, robots, sitemap, link.update', () => {
    expect(expandAutoFix(f('a', 'meta.title', { items: [{ url: 'https://wp.test/a', value: 'A', review: true }, { url: 'https://wp.test/b', value: 'B' }] }))).toEqual([
      { kind: 'meta.title', payload: { url: 'https://wp.test/a', value: 'A' } },
      { kind: 'meta.title', payload: { url: 'https://wp.test/b', value: 'B' } },
    ]);
    expect(expandAutoFix(f('a', 'img.alt', { items: [{ url: 'https://wp.test/', src: '/i.jpg', alt: 'Chauffe-eau', review: true }] }))).toEqual([{ kind: 'image.alt', payload: { url: 'https://wp.test/', imageSrc: '/i.jpg', value: 'Chauffe-eau' } }]);
    expect(expandAutoFix(f('a', 'canonical', { items: [{ url: 'https://wp.test/a?x=1', href: 'https://wp.test/a' }] }))?.[0]).toEqual({ kind: 'canonical', payload: { url: 'https://wp.test/a?x=1', value: 'https://wp.test/a' } });
    expect(expandAutoFix(f('a', 'redirect', { items: [{ from: 'https://wp.test/vieux?x=1', to: 'https://wp.test/neuf', status: 301 }] }))?.[0].payload).toEqual({ from: '/vieux?x=1', to: 'https://wp.test/neuf' });
    expect(expandAutoFix(f('a', 'robots', { text: 'User-agent: *\nAllow: /\n', changes: ['x'] }))?.[0]).toEqual({ kind: 'robots.txt', payload: { url: undefined, value: 'User-agent: *\nAllow: /\n', allowBots: undefined } });
    expect(expandAutoFix(f('a', 'sitemap', { url: 'https://wp.test/sitemap.xml', xml: '<urlset></urlset>', count: 0 }))?.[0].kind).toBe('sitemap.xml');
    expect(expandAutoFix(f('a', 'link.update', { items: [{ page: 'https://wp.test/', from: 'http://wp.test/a', to: 'https://wp.test/a' }] }))?.[0]).toEqual({ kind: 'rewrite', payload: { url: 'https://wp.test/', find: 'http://wp.test/a', replace: 'https://wp.test/a', all: true, mode: 'deterministe' } });
    expect(expandAutoFix(f('a', 'inconnu', {}))).toBeNull();
    expect(expandAutoFix({})).toEqual([]);
  });

  it('planification : canonique, meta robots et sitemap (export), redirection http→https écartée, JSON-LD par page', async () => {
    const plan = await planChanges(
      [
        f('seo.canonical.params', 'canonical', { items: [{ url: 'https://wp.test/plombier-lyon/', href: 'https://wp.test/plombier-lyon/' }] }),
        f('seo.noindex.home', 'meta.robots', { items: [{ url: 'https://wp.test/plombier-lyon/', value: 'index, follow' }] }),
        f('seo.sitemap.missing', 'sitemap', { url: 'https://wp.test/sitemap.xml', xml: '<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://wp.test/</loc></url></urlset>', count: 1 }),
        f('seo.https.redirect', 'redirect', { items: [{ from: 'http://wp.test/', to: 'https://wp.test/', status: 301 }] }),
        f('seo.jsonld.org', 'jsonld', { items: [{ url: 'https://wp.test/', type: 'Organization', jsonld: { '@context': 'https://schema.org', '@type': 'Organization', name: 'Plomberie Martin' } }] }),
        f('seo.robots.blockall', 'robots', { text: 'User-agent: *\n# Disallow: / (retiré)\nSitemap: https://wp.test/sitemap.xml\n', changes: [] }),
      ],
      SITE,
      { platform: 'wordpress', capabilities: ['meta.title', 'canonical', 'jsonld', 'rewrite'] },
    );
    const by = Object.fromEntries(plan.changeSets.map((c) => [c.origin.findingId, c]));
    expect(by['seo.canonical.params'].platform).toBe('wordpress');
    expect(by['seo.noindex.home']).toMatchObject({ platform: 'export', risk: 'high' });
    expect(by['seo.noindex.home'].changes[0]).toMatchObject({ before: 'noindex, follow', after: 'index, follow' });
    expect(by['seo.sitemap.missing'].changes[0].target.url).toBe('https://wp.test/sitemap.xml');
    expect(by['seo.https.redirect']).toBeUndefined();
    expect(plan.skipped.find((s) => s.findingId === 'seo.https.redirect')?.reason).toMatch(/Redirection/);
    expect(by['seo.jsonld.org'].changes[0].patch.value).toContain('"@type": "Organization"');
    expect(by['seo.robots.blockall'].changes[0]).toMatchObject({ kind: 'robots.txt', before: 'User-agent: *\nDisallow: /\n' });
  });
});

describe('formats GEO-OPT', () => {
  it('robots.txt « cité, sans entraînement », jsonld objet, fusion sameAs (export), llms.txt', async () => {
    const plan = await planChanges(
      [
        f('geo.acces.robots', 'robots.txt', { url: 'https://wp.test/robots.txt', value: 'User-agent: *\nAllow: /\n\nUser-agent: GPTBot\nDisallow: /\n', alternatives: { cite: '…', citeNoTraining: '…' } }),
        f('geo.entite.jsonld', 'jsonld', { url: 'https://wp.test/', value: { '@context': 'https://schema.org', '@type': 'Plumber', name: 'Plomberie Martin' }, script: '<script…>', notes: 'n' }),
        f('geo.entite.sameas', 'jsonld', { url: 'https://wp.test/plombier-lyon/', merge: { sameAs: ['https://www.instagram.com/plomberiemartin'] } }),
        f('geo.llms.info', 'llms.txt', { url: 'https://wp.test/llms.txt', value: '# Plomberie Martin\n', honest: true }),
      ],
      SITE,
      { platform: 'wordpress', capabilities: ['jsonld', 'faq', 'rewrite'] },
    );
    const by = Object.fromEntries(plan.changeSets.map((c) => [c.origin.findingId, c]));
    expect(by['geo.acces.robots'].changes[0].after).toBe('User-agent: *\nAllow: /\n\nUser-agent: GPTBot\nDisallow: /\n');
    expect(by['geo.entite.jsonld']).toMatchObject({ platform: 'wordpress' });
    expect(by['geo.entite.jsonld'].changes[0].patch).toMatchObject({ op: 'append' });
    const merge = by['geo.entite.sameas'];
    expect(merge.platform).toBe('export'); // remplacement d'un bloc existant : à faire par le client
    expect(merge.changes[0].patch.value).toContain('https://facebook.com/plomberiemartin');
    expect(merge.changes[0].patch.value).toContain('https://www.instagram.com/plomberiemartin');
    expect(by['geo.llms.info'].changes[0].after).toBe('# Plomberie Martin\n');
  });

  let fake: Fake;
  let wp: WpState;
  let restore: () => void;
  let n = 0;
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
    const x = wordpressFake();
    wp = x.state;
    fake.hosts.set('wp.test', x.handler);
    useMemoryJobs();
  });

  async function setup() {
    const biz = `af-${++n}`;
    await connectPlatform(biz, 'wordpress', { config: { siteUrl: 'https://wp.test' }, credentials: { username: wp.user, password: wp.pass } }, admin);
    return biz;
  }

  it('rewrite à plusieurs passages sur la même page : appliqués l’un après l’autre, annulés dans l’ordre inverse', async () => {
    const biz = await setup();
    const plan = await createChangeSets(
      biz,
      [
        f('geo.contenu.passages', 'rewrite', {
          items: [
            { url: 'https://wp.test/plombier-lyon/', passageId: 'p1', before: 'intervient à Lyon 3e', value: 'intervient en moins d’une heure à Lyon 3e', mode: 'ia', notes: 'réponse directe' },
            { url: 'https://wp.test/plombier-lyon/', passageId: 'p2', before: 'Devis gratuit sous 24 heures.', value: 'Le devis est gratuit et envoyé sous 24 heures.', mode: 'deterministe' },
            { url: 'https://wp.test/plombier-lyon/', passageId: 'p3', before: 'les fuites', value: 'les fuites à Paris', mode: 'ia' },
          ],
        }),
      ],
      { ...SITE, businessId: biz, pages: SITE.pages.map((p) => (p.url.endsWith('lyon/') ? { ...p, text: `${p.text} Nous intervenons en moins d’une heure.` } : p)) },
      admin,
      { writer: rulesWriter },
    );
    // « Paris » n'est pas sur la page : passage écarté
    expect(plan.skipped.some((s) => /faits absents/.test(s.reason))).toBe(true);
    const cs = plan.changeSets[0];
    expect(cs.changes).toHaveLength(2);
    await proposeChangeSet(biz, cs.id, admin);
    await validateChangeSet(biz, cs.id, admin);
    const done = await applyChangeSet(biz, cs.id, admin);
    expect(done.changes.map((c) => c.status)).toEqual(['verified', 'verified']);
    expect(wp.pages[0].content).toBe('<p>Plomberie Martin intervient en moins d’une heure à Lyon 3e pour les fuites et les chauffe-eau. Le devis est gratuit et envoyé sous 24 heures.</p>');
    const back = await revertChangeSet(biz, cs.id, admin);
    expect(back.status).toBe('reverted');
    expect(wp.pages[0].content).toBe('<p>Plomberie Martin intervient à Lyon 3e pour les fuites et les chauffe-eau. Devis gratuit sous 24 heures.</p>');
  });

  it('link.update : toutes les occurrences du lien remplacées', async () => {
    const biz = await setup();
    wp.pages[1].content = '<p><a href="http://wp.test/plombier-lyon/">Plombier</a> et <a href="http://wp.test/plombier-lyon/">ici</a>.</p>';
    const plan = await createChangeSets(biz, [f('seo.links.http', 'link.update', { items: [{ page: 'https://wp.test/', from: 'http://wp.test/plombier-lyon/', to: 'https://wp.test/plombier-lyon/' }] })], { ...SITE, businessId: biz }, admin);
    const cs = plan.changeSets[0];
    expect(cs.platform).toBe('wordpress');
    await proposeChangeSet(biz, cs.id, admin);
    await validateChangeSet(biz, cs.id, admin);
    const done = await applyChangeSet(biz, cs.id, admin);
    expect(done.status).toBe('verified');
    expect(wp.pages[1].content).toBe('<p><a href="https://wp.test/plombier-lyon/">Plombier</a> et <a href="https://wp.test/plombier-lyon/">ici</a>.</p>');
  });

  it('FAQ : réponses de la fiche acceptées, « à compléter » bloque la validation jusqu’à la saisie', async () => {
    const biz = await setup();
    const plan = await createChangeSets(
      biz,
      [
        f('geo.contenu.faq', 'faq', {
          url: 'https://wp.test/plombier-lyon/',
          value: [
            { question: 'Quels sont vos horaires ?', answer: 'Du lundi au samedi, de 8 h à 19 h.', from: 'fiche' },
            { question: 'Acceptez-vous les chèques ?', answer: '', from: 'a_completer' },
          ],
          jsonld: {},
          notes: '',
        }),
      ],
      { ...SITE, businessId: biz },
      admin,
    );
    const cs = plan.changeSets[0];
    expect(cs.changes[0].patch.value).toContain('Du lundi au samedi, de 8 h à 19 h.');
    expect(cs.changes[0].patch.value).toContain('[à compléter]');
    const p = await proposeChangeSet(biz, cs.id, admin);
    await expect(validateChangeSet(biz, cs.id, admin)).rejects.toMatchObject({ status: 409, code: 'incomplete' });
    await editChange(biz, cs.id, p.changes[0].id, p.changes[0].patch.value.replace(/\[à compléter\]/g, 'Oui, ainsi que les virements.'), admin);
    await validateChangeSet(biz, cs.id, admin);
    const done = await applyChangeSet(biz, cs.id, admin);
    expect(done.status).toBe('verified');
    expect(wp.pages[0].content).toContain('Oui, ainsi que les virements.');
    expect(wp.pages[0].content).not.toContain('à compléter');
  });
});
