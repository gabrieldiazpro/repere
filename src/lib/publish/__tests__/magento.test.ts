/**
 * Connecteur Magento / Adobe Commerce contre un faux serveur local (magentofake.ts) : connexion OAuth 1.0a signée ou
 * jeton seul, droits réels, titres/descriptions de produits, catégories et pages CMS, textes d'images produit,
 * réécriture de texte produit, relecture publique, retour arrière, export guidé (redirections). Aucun réseau sortant.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { useMemoryJobs } from '@/lib/jobs/testing';
import { setPublishHttp } from '../http';
import { rulesWriter } from '../writer';
import { applyChangeSet, connectPlatform, createChangeSets, getChangeSet, proposeChangeSet, revertChangeSet, validateChangeSet } from '../service';
import { magentoConnector, magentoPath, oauthBaseString, oauthHeader, parseOAuthHeader, rfc3986, searchQuery, MAGENTO_KINDS, MAGENTO_STEPS } from '../connectors/magento';
import { connectorFor } from '../connectors';
import { PLATFORMS, type Actor, type ChangeSet, type Finding } from '../types';
import type { PlanSite } from '../planner';
import { isolateStore, localHttp, routePublicFetch, startFake, type Fake } from './helpers';
import { magentoFake, type MagentoState } from './magentofake';

isolateStore('magento');

const admin: Actor = { id: 'u-admin', role: 'owner' };
const ORIGIN = 'https://boutique.test';
let fake: Fake;
let restore: () => void;
let st: MagentoState;
let n = 0;
let biz = '';

const finding = (o: Partial<Finding> & Pick<Finding, 'id'>): Finding => ({ category: 'contenu', severity: 'high', title: o.id, why: '', fix: 'Corriger.', affected: [], affectedCount: 0, impact: 2, effort: 1, ...o });

const site = (b: string): PlanSite => ({
  businessId: b,
  origin: ORIGIN,
  name: 'Maroquinerie Lenoir',
  pages: [
    { url: `${ORIGIN}/`, title: 'Accueil', h1: ['Maroquinerie artisanale'], text: 'Maroquinerie artisanale à Limoges.' },
    { url: `${ORIGIN}/sac-cabas-cuir-noir.html`, title: 'Sac cabas en cuir noir', h1: ['Sac cabas en cuir noir'], text: 'Sac cabas en cuir pleine fleur, cousu à Limoges. Doublure en coton.', images: [{ src: `${ORIGIN}/media/catalog/product/cache/9f1e/s/a/sac-cabas-noir.jpg`, alt: '' }] },
    { url: `${ORIGIN}/femme/sacs.html`, title: 'Sacs', h1: ['Sacs'], text: 'Nos sacs en cuir.' },
    { url: `${ORIGIN}/livraison`, title: 'Livraison', h1: ['Livraison'], text: 'Livraison en 48 heures en France.' },
  ],
});

const oauthCreds = () => ({ ...st.keys });
const connect = (b: string, credentials: Record<string, string> = oauthCreds(), config: Record<string, string> = {}) => connectPlatform(b, 'magento', { config: { siteUrl: ORIGIN, ...config }, credentials }, admin);

async function cycle(cs: ChangeSet): Promise<ChangeSet> {
  await proposeChangeSet(biz, cs.id, admin);
  await validateChangeSet(biz, cs.id, admin);
  return applyChangeSet(biz, cs.id, admin);
}

const setFix = (kind: 'meta.title' | 'meta.description', url: string, value: string) => finding({ id: `${kind}.${url}`, autoFix: { kind, payload: { url, value } } });

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
  const f = magentoFake();
  st = f.state;
  fake.hosts.set('boutique.test', f.handler);
  useMemoryJobs();
  biz = `mag-biz-${++n}`;
});

describe('Magento — enregistrement et outils', () => {
  it('plateforme déclarée, connecteur enregistré, pas à pas pour tout ce qui reste guidé', () => {
    expect(PLATFORMS).toContain('magento');
    expect(connectorFor('magento')).toBe(magentoConnector);
    for (const k of ['redirect', 'robots.txt', 'llms.txt'] as const) expect(MAGENTO_STEPS[k]).toBeTruthy();
    expect(MAGENTO_KINDS).not.toContain('redirect');
  });

  it('adresses : code de magasin, index.php, suffixe .html, page d’accueil', () => {
    expect(magentoPath('https://b.test/fr/femme/sacs.html', 'fr')).toEqual({ path: 'femme/sacs', last: 'sacs', html: true });
    expect(magentoPath('https://b.test/index.php/livraison', 'default')).toEqual({ path: 'livraison', last: 'livraison', html: false });
    expect(magentoPath('https://b.test/', 'default')).toEqual({ path: '', last: '', html: false });
    expect(searchQuery('url_key', 'a b')).toBe('searchCriteria%5BfilterGroups%5D%5B0%5D%5Bfilters%5D%5B0%5D%5Bfield%5D=url_key&searchCriteria%5BfilterGroups%5D%5B0%5D%5Bfilters%5D%5B0%5D%5Bvalue%5D=a%20b&searchCriteria%5BfilterGroups%5D%5B0%5D%5Bfilters%5D%5B0%5D%5BconditionType%5D=eq&searchCriteria%5BpageSize%5D=5');
  });

  it('OAuth 1.0a : chaîne de base conforme à RFC 5849 (requête incluse, triée) et en-tête complet', () => {
    const base = oauthBaseString('get', 'https://Boutique.test/rest/default/V1/products?b=2&a=1', { oauth_nonce: 'n', oauth_token: 't' });
    expect(base).toBe(`GET&${rfc3986('https://boutique.test/rest/default/V1/products')}&${rfc3986('a=1&b=2&oauth_nonce=n&oauth_token=t')}`);
    const h = parseOAuthHeader(oauthHeader('GET', 'https://boutique.test/x', { consumerKey: 'ck', consumerSecret: 'cs', accessToken: 'at', accessTokenSecret: 'ts' }, new Date('2026-11-22T10:00:00Z'), 'abc'));
    expect(h).toMatchObject({ oauth_consumer_key: 'ck', oauth_token: 'at', oauth_nonce: 'abc', oauth_signature_method: 'HMAC-SHA256', oauth_timestamp: '1795341600', oauth_version: '1.0' });
    expect(h.oauth_signature).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });
});

describe('Magento — connexion', () => {
  it('quatre jetons : appels signés acceptés, capacités honnêtes, secrets jamais renvoyés, rien d’écrit au test', async () => {
    const r = await connect(biz);
    expect(r.test.ok).toBe(true);
    expect(r.test.capabilities).toEqual(expect.arrayContaining(['meta.title', 'meta.description', 'rewrite', 'image.alt']));
    expect(r.test.capabilities).not.toContain('redirect');
    expect(r.test.detail).toMatch(/guidés/);
    expect(r.test.info?.mode).toBe('oauth');
    const json = JSON.stringify(r);
    for (const s of [st.keys.consumerSecret, st.keys.accessTokenSecret, st.keys.accessToken]) expect(json).not.toContain(s);
    expect(st.calls.every((c) => c.startsWith('GET'))).toBe(true);
  });

  it('mauvais secret : refus lisible, aucune capacité ; saisie incomplète refusée', async () => {
    const bad = await connect(biz, { ...oauthCreds(), consumerSecret: 'e'.repeat(32) });
    expect(bad.test).toMatchObject({ ok: false, capabilities: [] });
    expect(bad.test.detail).toMatch(/Active/);
    await expect(connect(`${biz}-x`, { accessToken: st.keys.accessToken, consumerKey: st.keys.consumerKey })).rejects.toMatchObject({ status: 400 });
    await expect(connect(`${biz}-y`, oauthCreds(), { storeCode: 'fr-FR' })).rejects.toMatchObject({ status: 400 });
    await expect(connectPlatform(biz, 'magento', { config: { siteUrl: 'http://boutique.test' }, credentials: oauthCreds() }, admin)).rejects.toMatchObject({ status: 400 });
  });

  it('jeton seul : refusé tant que le réglage Bearer est désactivé (2.4.4+), accepté s’il est activé', async () => {
    const off = await connect(biz, { accessToken: st.keys.accessToken });
    expect(off.test.ok).toBe(false);
    expect(off.test.detail).toMatch(/jetons Bearer/);
    st.bearerEnabled = true;
    const on = await connect(`${biz}-b`, { accessToken: st.keys.accessToken });
    expect(on.test.ok).toBe(true);
    expect(on.test.info?.mode).toBe('bearer');
  });

  it('ressource non cochée (Pages) : connecté, mais signalé ; vue de magasin inconnue : message clair', async () => {
    st.acl.delete('cms');
    const r = await connect(biz);
    expect(r.test.ok).toBe(true);
    expect(r.test.detail).toMatch(/non cochées.*Pages/);
    const store = await connect(`${biz}-s`, oauthCreds(), { storeCode: 'boutique_be' });
    expect(store.test.ok).toBe(false);
  });
});

describe('Magento — modifications', () => {
  it('titre d’un produit : écrit dans la vue de magasin, relu en ligne, mots-clés intacts, retour arrière', async () => {
    await connect(biz);
    const plan = await createChangeSets(biz, [setFix('meta.title', `${ORIGIN}/sac-cabas-cuir-noir.html`, 'Sac cabas en cuir noir cousu à Limoges | Maroquinerie Lenoir')], site(biz), admin, { writer: rulesWriter });
    expect(plan.changeSets[0].platform).toBe('magento');
    const cs = await cycle(plan.changeSets[0]);
    expect(cs.status).toBe('verified');
    expect(cs.changes[0].verification?.some((v) => v.method === 'page' && v.ok)).toBe(true);
    expect(st.products[0].attrs.meta_title).toBe('Sac cabas en cuir noir cousu à Limoges | Maroquinerie Lenoir');
    expect(st.products[0].attrs.meta_keyword).toBe('sac, cuir');
    expect(st.calls).toContain('PUT /products/SAC-01');
    const rv = await revertChangeSet(biz, cs.id, admin);
    expect(rv.status).toBe('reverted');
    expect(st.products[0].attrs.meta_title).toBe('');
  });

  it('description d’une catégorie et d’une page CMS : la page CMS est renvoyée entière (contenu conservé)', async () => {
    await connect(biz);
    const plan = await createChangeSets(
      biz,
      [setFix('meta.description', `${ORIGIN}/femme/sacs.html`, 'Sacs en cuir pour femme, fabriqués à Limoges par Maroquinerie Lenoir.'), setFix('meta.description', `${ORIGIN}/livraison`, 'Livraison en 48 heures en France pour toutes les commandes Maroquinerie Lenoir.')],
      site(biz),
      admin,
      { writer: rulesWriter },
    );
    for (const cs of plan.changeSets) expect((await cycle(cs)).status).toBe('verified');
    expect(st.categories[0].attrs.meta_description).toMatch(/^Sacs en cuir/);
    const livraison = st.cms.find((c) => c.identifier === 'livraison')!;
    expect(livraison.meta_description).toMatch(/^Livraison en 48 heures/);
    expect(livraison.content).toBe('<p>Livraison en 48 heures en France.</p>');
    expect(livraison.title).toBe('Livraison');
  });

  it('texte alternatif d’une image produit : label de la galerie, relu sur la page ; retour à la valeur héritée (null)', async () => {
    await connect(biz);
    const plan = await createChangeSets(biz, [finding({ id: 'seo.img.alt', autoFix: { kind: 'image.alt', payload: { url: `${ORIGIN}/sac-cabas-cuir-noir.html`, imageSrc: `${ORIGIN}/media/catalog/product/cache/9f1e/s/a/sac-cabas-noir.jpg`, value: 'Sac cabas en cuir noir, vue de face' } } })], site(biz), admin, { writer: rulesWriter });
    const cs = await cycle(plan.changeSets[0]);
    expect(cs.status).toBe('verified');
    expect(st.products[0].media[0].label).toBe('Sac cabas en cuir noir, vue de face');
    await revertChangeSet(biz, cs.id, admin);
    expect(st.products[0].media[0].label).toBeNull();
  });

  it('droit d’écriture des images manquant : échec lisible, rien d’annoncé comme fait', async () => {
    st.acl.delete('catalog');
    await connect(biz);
    const plan = await createChangeSets(biz, [finding({ id: 'seo.img.alt', autoFix: { kind: 'image.alt', payload: { url: `${ORIGIN}/sac-cabas-cuir-noir.html`, imageSrc: `${ORIGIN}/media/catalog/product/cache/9f1e/s/a/sac-cabas-noir.jpg`, value: 'Sac cabas en cuir noir' } } })], site(biz), admin, { writer: rulesWriter });
    const cs = await cycle(plan.changeSets[0]);
    expect(cs.status).toBe('failed');
    expect(cs.changes[0].error).toMatch(/ressource non cochée/);
    expect(st.products[0].media[0].label).toBeNull();
  });

  it('réécriture d’un passage de la description produit, visible en ligne', async () => {
    await connect(biz);
    const plan = await createChangeSets(biz, [finding({ id: 'geo.rewrite', autoFix: { kind: 'rewrite', payload: { url: `${ORIGIN}/sac-cabas-cuir-noir.html`, find: 'Doublure en coton.', replace: 'Doublure en coton, cousu à Limoges.', mode: 'deterministe' } } })], site(biz), admin, { writer: rulesWriter });
    const cs = await cycle(plan.changeSets[0]);
    expect(cs.status).toBe('verified');
    expect(st.products[0].attrs.description).toContain('Doublure en coton, cousu à Limoges.');
  });

  it('redirection : aucune route REST du cœur → export guidé, rien écrit chez Magento', async () => {
    await connect(biz);
    const plan = await createChangeSets(biz, [finding({ id: 'seo.redirect.old', autoFix: { kind: 'redirect', payload: { from: '/ancien-sac.html', to: '/sac-cabas-cuir-noir.html' } } })], site(biz), admin);
    expect(plan.changeSets[0].platform).toBe('export');
    expect(st.calls.some((c) => !c.startsWith('GET'))).toBe(false);
  });

  it('page introuvable : erreur claire, invitation à l’export', async () => {
    await connect(biz);
    const plan = await createChangeSets(biz, [setFix('meta.title', `${ORIGIN}/page-inconnue`, 'Titre de test pour une page inconnue | Maroquinerie Lenoir')], site(biz), admin, { writer: rulesWriter });
    await expect(proposeChangeSet(biz, plan.changeSets[0].id, admin)).rejects.toThrow(/Aucune modification applicable/);
    const cs = await getChangeSet(biz, plan.changeSets[0].id);
    expect(cs?.changes[0].error).toMatch(/introuvable dans Magento.*export/);
  });
});
