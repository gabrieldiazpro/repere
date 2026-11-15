/**
 * Connecteur Wix contre un faux serveur local qui imite les réponses documentées (wixfake.ts) : connexion par clé API
 * ou app, balises SEO (pages statiques publiées, articles, produits), données structurées, redirections, robots.txt,
 * llms.txt, retour arrière, droits, chemins alternatifs documentés, export guidé pour le reste. Aucun réseau sortant.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { useMemoryJobs } from '@/lib/jobs/testing';
import { setPublishHttp } from '../http';
import { rulesWriter } from '../writer';
import { readZip } from '../zip';
import { applyChangeSet, connectPlatform, createChangeSets, exportChangeSet, proposeChangeSet, revertChangeSet, validateChangeSet } from '../service';
import { jsonLdScripts, resetWixTokens, wixConnector, wixPath, WIX_GUIDED, WIX_KINDS } from '../connectors/wix';
import type { Actor, Change, ChangeSet, Finding } from '../types';
import type { PlanSite } from '../planner';
import { isolateStore, localHttp, routePublicFetch, startFake, type Fake } from './helpers';
import { wixFake, type WixState } from './wixfake';

isolateStore('wix');

const admin: Actor = { id: 'u-admin', role: 'owner' };
const ORIGIN = 'https://ceramique.test';
let fake: Fake;
let restore: () => void;
let st: WixState;
let n = 0;
let biz = '';

const finding = (o: Partial<Finding> & Pick<Finding, 'id'>): Finding => ({ category: 'contenu', severity: 'high', title: o.id, why: '', fix: 'Corriger.', affected: [], affectedCount: 0, impact: 2, effort: 1, ...o });

const site = (b: string): PlanSite => ({
  businessId: b,
  origin: ORIGIN,
  name: 'Atelier Terre',
  robotsTxt: st.robots.content,
  llmsTxt: null,
  pages: [
    { url: `${ORIGIN}/`, title: 'Accueil | Atelier Terre', h1: ['Céramiste à Nantes'], text: 'Atelier Terre, céramiste à Nantes : bols et tasses en grès, émaillés à la main.', images: [{ src: `${ORIGIN}/media/bol-bleu.jpg`, alt: '' }] },
    { url: `${ORIGIN}/atelier`, title: 'Atelier | Atelier Terre', h1: ['L’atelier de céramique'], text: 'L’atelier de céramique est ouvert à Nantes le samedi. Cours de tournage pour débutants.' },
    { url: `${ORIGIN}/post/emailler-un-bol`, title: 'Émailler un bol | Atelier Terre', h1: ['Émailler un bol'], text: 'Les étapes pour émailler un bol en grès.' },
    { url: `${ORIGIN}/product-page/bol-gres`, title: 'Bol en grès | Atelier Terre', h1: ['Bol en grès'], text: 'Bol en grès émaillé, tourné à la main à Nantes.' },
  ],
});

const connect = (b: string, key = st.apiKey) => connectPlatform(b, 'wix', { config: { siteUrl: ORIGIN, siteId: st.siteId }, credentials: { apiKey: key } }, admin);

async function cycle(cs: ChangeSet): Promise<ChangeSet> {
  await proposeChangeSet(biz, cs.id, admin);
  await validateChangeSet(biz, cs.id, admin);
  return applyChangeSet(biz, cs.id, admin);
}

const tag = (items: WixState['items'], id: string, pred: (t: { type: string; props?: Record<string, string> }) => boolean, where: 'draft' | 'live' = 'live') => items.find((x) => x.id === id)?.[where].find(pred);

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
  const f = wixFake();
  st = f.state;
  fake.hosts.set('www.wixapis.com', f.api);
  fake.hosts.set('ceramique.test', f.site);
  useMemoryJobs();
  resetWixTokens();
  biz = `wix-biz-${++n}`;
});
afterEach(() => {
  delete process.env.WIX_APP_ID;
  delete process.env.WIX_APP_SECRET;
});

describe('Wix — connexion', () => {
  it('clé API : droits réels testés, capacités honnêtes, secret jamais renvoyé', async () => {
    const r = await connect(biz);
    expect(r.test.ok).toBe(true);
    expect(r.test.capabilities).toEqual([...WIX_KINDS]);
    expect(r.test.capabilities).not.toContain('image.alt');
    expect(r.test.detail).toMatch(/guidés/);
    expect(JSON.stringify(r)).not.toContain(st.apiKey);
    expect(r.connection.hint.endsWith(st.apiKey.slice(-4))).toBe(true);
    expect(st.calls.every((c) => !c.startsWith('PATCH') && !c.startsWith('PUT') && !c.startsWith('POST'))).toBe(true); // le test n'écrit rien
  });

  it('clé en lecture seule : aucune capacité ; clé refusée ; saisie invalide', async () => {
    st.manage = false;
    const ro = await connect(biz);
    expect(ro.test).toMatchObject({ ok: false, capabilities: [] });
    expect(ro.test.detail).toMatch(/Gérer les paramètres SEO/);
    st.manage = true;
    const bad = await connect(`${biz}-b`, `${st.apiKey}x`);
    expect(bad.test.ok).toBe(false);
    expect(bad.test.detail).toMatch(/identifiants refusés/);
    await expect(connectPlatform(biz, 'wix', { config: { siteUrl: ORIGIN, siteId: 'mon-site' }, credentials: { apiKey: st.apiKey } }, admin)).rejects.toMatchObject({ status: 400 });
    await expect(connectPlatform(biz, 'wix', { config: { siteUrl: 'http://ceramique.test', siteId: st.siteId }, credentials: { apiKey: st.apiKey } }, admin)).rejects.toMatchObject({ status: 400 });
  });

  it('app Repéré (OAuth client_credentials) : refusée sans app configurée ; sinon jeton créé une fois puis réutilisé', async () => {
    await expect(connectPlatform(biz, 'wix', { config: { siteUrl: ORIGIN, instanceId: st.app.instanceId }, credentials: {} }, admin)).rejects.toMatchObject({ status: 400 });
    process.env.WIX_APP_ID = st.app.clientId;
    process.env.WIX_APP_SECRET = st.app.secret;
    const r = await connectPlatform(biz, 'wix', { config: { siteUrl: ORIGIN, instanceId: st.app.instanceId }, credentials: {} }, admin);
    expect(r.test.ok).toBe(true);
    expect(r.test.info?.mode).toBe('app');
    expect(st.tokensIssued).toBe(1);
    expect(st.calls.filter((c) => c === 'POST /oauth2/token')).toHaveLength(1);
  });
});

describe('Wix — balises SEO', () => {
  it('titres de deux pages statiques : publiés (publish: true), autres balises gardées, relus en ligne, retour arrière', async () => {
    await connect(biz);
    const plan = await createChangeSets(biz, [finding({ id: 'seo.title.too_short', affected: [{ url: `${ORIGIN}/` }, { url: `${ORIGIN}/atelier` }] })], site(biz), admin, { writer: rulesWriter });
    expect(plan.changeSets[0].platform).toBe('wix');
    const cs = await cycle(plan.changeSets[0]);
    expect(cs.status).toBe('verified');
    expect(cs.changes.every((c) => c.verification?.some((v) => v.method === 'page' && v.ok))).toBe(true);
    expect(tag(st.items, 'c1dmp', (t) => t.type === 'title')).toMatchObject({ children: 'Céramiste à Nantes | Atelier Terre' });
    expect(tag(st.items, 'c1dmp', (t) => t.props?.property === 'og:image')).toBeTruthy(); // la liste complète a été renvoyée
    const r = await revertChangeSet(biz, cs.id, admin);
    expect(r.status).toBe('reverted');
    expect(st.items.find((x) => x.id === 'c1dmp')?.live).toHaveLength(1); // og:image seul
    expect(st.calls).toContain('POST /seo-metatags-server/v1/item-seo-tags/STATIC_PAGE/ddgf4/reset-to-default'); // plus aucune balise propre
  });

  it('article de blog (slug) et produit d’un catalogue V1 (repli par l’URL canonique) : description en ligne', async () => {
    st.catalogV1 = true;
    await connect(biz);
    const desc = (url: string, value: string) => finding({ id: `seo.meta_description.missing.${url.length}`, autoFix: { kind: 'meta.description', payload: { url, value } } });
    const plan = await createChangeSets(biz, [desc(`${ORIGIN}/post/emailler-un-bol`, 'Les étapes pour émailler un bol en grès, expliquées par Atelier Terre à Nantes.'), desc(`${ORIGIN}/product-page/bol-gres`, 'Bol en grès émaillé, tourné à la main à Nantes par Atelier Terre.')], site(biz), admin, { writer: rulesWriter });
    for (const cs of plan.changeSets) expect((await cycle(cs)).status).toBe('verified');
    expect(st.calls).toContain('GET /v3/posts/slugs/emailler-un-bol');
    expect(st.calls.some((c) => c.startsWith('GET /seo-metatags-server/v1/item-seo-tags/STORES_PRODUCT?'))).toBe(true);
    expect(tag(st.items, 'p3c2d1e0-0000-4000-8000-000000000002', (t) => t.props?.name === 'description')?.props?.content).toMatch(/^Bol en grès/);
  });

  it('données structurées : bloc JSON-LD propre à la page (sans commentaires), relu à l’identique, retiré au retour arrière', async () => {
    await connect(biz);
    const ld = { '@context': 'https://schema.org', '@type': 'LocalBusiness', name: 'Atelier Terre', address: { '@type': 'PostalAddress', addressLocality: 'Nantes' } };
    const plan = await createChangeSets(biz, [finding({ id: 'geo.schema.localbusiness', autoFix: { kind: 'jsonld', payload: { url: `${ORIGIN}/`, value: JSON.stringify(ld) } } })], site(biz), admin);
    const p = await proposeChangeSet(biz, plan.changeSets[0].id, admin);
    expect(p.changes[0].after).not.toContain('<!--');
    expect(jsonLdScripts(p.changes[0].after ?? '')).toHaveLength(1);
    await validateChangeSet(biz, p.id, admin);
    const cs = await applyChangeSet(biz, p.id, admin);
    expect(cs.status).toBe('verified');
    expect(tag(st.items, 'c1dmp', (t) => t.type === 'script')).toBeTruthy();
    await revertChangeSet(biz, cs.id, admin);
    expect(tag(st.items, 'c1dmp', (t) => t.type === 'script')).toBeUndefined();
  });

  it('site jamais publié : échec lisible, rien n’est annoncé comme fait', async () => {
    st.published = false;
    await connect(biz);
    const plan = await createChangeSets(biz, [finding({ id: 'seo.title.too_short', affected: [{ url: `${ORIGIN}/atelier` }] })], site(biz), admin, { writer: rulesWriter });
    const cs = await cycle(plan.changeSets[0]);
    expect(cs.status).toBe('failed');
    expect(cs.changes[0].error).toMatch(/jamais été publié/);
  });

  it('chemins alternatifs de la documentation (exemples curl) : acceptés', async () => {
    st.seoBase = '/promote/seo/v1';
    st.txtBase = '/promote-seo-txt-file-server/v2';
    expect((await connect(biz)).test.ok).toBe(true);
    const plan = await createChangeSets(biz, [finding({ id: 'seo.title.too_short', affected: [{ url: `${ORIGIN}/atelier` }] })], site(biz), admin, { writer: rulesWriter });
    expect((await cycle(plan.changeSets[0])).status).toBe('verified');
  });
});

describe('Wix — redirections et fichiers', () => {
  it('redirection 301 : cible ramenée à un chemin, vérifiée en ligne, supprimée au retour arrière', async () => {
    await connect(biz);
    const plan = await createChangeSets(biz, [finding({ id: 'seo.redirect.old', autoFix: { kind: 'redirect', payload: { from: '/ancien-atelier', to: `${ORIGIN}/atelier` } } })], site(biz), admin);
    const cs = await cycle(plan.changeSets[0]);
    expect(cs.status).toBe('verified');
    expect(st.redirects).toEqual([{ id: 'red-1', from: '/ancien-atelier', to: '/atelier' }]);
    expect(cs.changes[0].remoteRef).toBe('red-1');
    await revertChangeSet(biz, cs.id, admin);
    expect(st.redirects).toEqual([]);
  });

  it('redirection qui ferait disparaître une autre (Wix ne chaîne pas) : refusée, rien d’écrit', async () => {
    st.redirects.push({ id: 'red-old', from: '/atelier', to: '/cours' });
    await connect(biz);
    const plan = await createChangeSets(biz, [finding({ id: 'seo.redirect.old', autoFix: { kind: 'redirect', payload: { from: '/ancien-atelier', to: '/atelier' } } })], site(biz), admin);
    const cs = await cycle(plan.changeSets[0]);
    expect(cs.status).toBe('failed');
    expect(cs.changes[0].error).toMatch(/Wix la supprimerait/);
    expect(st.redirects).toEqual([{ id: 'red-old', from: '/atelier', to: '/cours' }]);
  });

  it('robots.txt (contenu Wix par défaut) puis retour au contenu par défaut ; llms.txt marqué « modifié à la main »', async () => {
    await connect(biz);
    const plan = await createChangeSets(
      biz,
      [finding({ id: 'geo.acces.robots', autoFix: { kind: 'robots.txt', payload: { allowBots: ['GPTBot'] } } }), finding({ id: 'geo.llms.missing' })],
      site(biz),
      admin,
    );
    const [robots, llms] = plan.changeSets;
    expect([robots.platform, llms.platform]).toEqual(['wix', 'wix']);
    const r = await cycle(robots);
    expect(r.status).toBe('verified');
    expect(st.robots.default).toBe(false);
    expect(st.robots.content).toContain('User-agent: GPTBot\nAllow: /');
    await revertChangeSet(biz, r.id, admin);
    expect(st.robots.default).toBe(true);
    const l = await cycle(llms);
    expect(l.status).toBe('verified');
    expect(st.llms).toMatchObject({ default: false, manuallyEdited: true });
    expect((await revertChangeSet(biz, l.id, admin)).status).toBe('reverted');
  });
});

describe('Wix — ce qui reste guidé', () => {
  it('texte d’image : export avec le pas à pas dans l’éditeur Wix', async () => {
    await connect(biz);
    const plan = await createChangeSets(biz, [finding({ id: 'seo.img.alt.missing', autoFix: { kind: 'image.alt', payload: { url: `${ORIGIN}/`, imageSrc: `${ORIGIN}/media/bol-bleu.jpg`, value: 'Bol en grès émaillé bleu, tourné à la main' } } })], site(biz), admin, { writer: rulesWriter });
    expect(plan.changeSets[0].platform).toBe('export');
    await proposeChangeSet(biz, plan.changeSets[0].id, admin);
    const files = readZip((await exportChangeSet(biz, plan.changeSets[0].id)).zip);
    expect(files[0].content).toMatch(/Que représente cette image/);
  });

  it('le connecteur refuse lui-même ce que l’API Wix ne permet pas', async () => {
    expect(WIX_GUIDED.some((k) => WIX_KINDS.includes(k))).toBe(false);
    const ch = { kind: 'image.alt', target: { url: `${ORIGIN}/` }, patch: { op: 'set', value: 'x' } } as Change;
    await expect(wixConnector.locate({ businessId: biz, http: localHttp(fake.port), credentials: { apiKey: st.apiKey }, config: { siteId: st.siteId }, now: () => new Date() }, ch)).rejects.toMatchObject({ status: 422 });
  });

  it('adresses Wix par défaut reconnues', () => {
    expect(wixPath('/post/mon-article')).toMatchObject({ itemType: 'BLOG_POST', slug: 'mon-article' });
    expect(wixPath('/fr/product-page/bol')).toMatchObject({ itemType: 'STORES_PRODUCT', slug: 'bol' });
    expect(wixPath('/contact')).toMatchObject({ itemType: 'STATIC_PAGE' });
  });
});
