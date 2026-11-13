/**
 * Cycle complet sur un faux WordPress (REST + Yoast exposé / Rank Math) : connecter → planifier → proposer → valider →
 * appliquer → vérifier (API + page publique) → annuler ; échecs partiels, conflits, idempotence, aucune écriture sans
 * validation, journal chaîné, repère sur les courbes, remesure programmée.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { getDoc } from '@/lib/store';
import { ANNOTATIONS } from '@/lib/annotations';
import { listLocalJobs, useMemoryJobs } from '@/lib/jobs/testing';
import { setPublishHttp } from '../http';
import { readJournal, verifyJournal } from '../journal';
import { rulesWriter } from '../writer';
import { applyChangeSet, connectPlatform, createChangeSets, getChangeSet, proposeChangeSet, revertChangeSet, validateChangeSet, verifyChangeSet, editChange, rejectChangeSet } from '../service';
import type { Actor, Finding } from '../types';
import type { PlanSite } from '../planner';
import { isolateStore, localHttp, routePublicFetch, startFake, type Fake } from './helpers';
import { wordpressFake, type WpState } from './fakes';

isolateStore('wp');

const admin: Actor = { id: 'u-admin', email: 'admin@exemple.fr', role: 'admin' };
let fake: Fake;
let wp: WpState;
let restore: () => void;
let n = 0;
let biz = '';

const site = (b: string): PlanSite => ({
  businessId: b,
  origin: 'https://wp.test',
  name: 'Plomberie Martin',
  city: 'Lyon',
  pages: [
    { url: 'https://wp.test/plombier-lyon/', title: 'Plombier Lyon – Plomberie Martin', h1: ['Plombier à Lyon 3e'], text: 'Plomberie Martin intervient à Lyon 3e pour les fuites et les chauffe-eau. Devis gratuit sous 24 heures. Nous dépannons aussi le dimanche matin.', images: [] },
    { url: 'https://wp.test/', title: 'Accueil – Plomberie Martin', h1: ['Plomberie Martin, dépannage à Lyon'], text: 'Bienvenue chez Plomberie Martin. Dépannage de plomberie à Lyon, devis gratuit.', images: [{ src: 'https://wp.test/wp-content/uploads/2026/01/chauffe-eau-thermodynamique-300x200.jpg', alt: '' }] },
  ],
});

const finding = (o: Partial<Finding> & Pick<Finding, 'id'>): Finding => ({
  category: 'contenu',
  severity: 'high',
  title: 'Constat',
  why: 'Parce que.',
  fix: 'Corriger.',
  affected: [],
  affectedCount: 0,
  impact: 2,
  effort: 1,
  ...o,
});

async function connect(b: string) {
  return connectPlatform(b, 'wordpress', { config: { siteUrl: 'wp.test' }, credentials: { username: wp.user, password: 'abcd EFGH ijkl MNOP qrst UVWX' } }, admin);
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
  const f = wordpressFake();
  wp = f.state;
  fake.hosts.set('wp.test', f.handler);
  useMemoryJobs();
  biz = `wp-biz-${++n}`;
});

describe('connexion WordPress', () => {
  it('teste les droits réels et détecte Yoast exposé', async () => {
    const r = await connect(biz);
    expect(r.test.ok).toBe(true);
    expect(r.test.capabilities).toEqual(expect.arrayContaining(['meta.title', 'meta.description', 'canonical', 'image.alt', 'jsonld', 'faq', 'rewrite']));
    expect(r.connection.hint).toMatch(/editrice · …UVWX/);
    expect(JSON.stringify(r)).not.toContain('qrstUVWX'); // le secret n'est jamais renvoyé
  });

  it('mauvais mot de passe : échec lisible, aucune capacité', async () => {
    const r = await connectPlatform(biz, 'wordpress', { config: { siteUrl: 'https://wp.test' }, credentials: { username: wp.user, password: 'xxxx xxxx xxxx xxxx xxxx xxxx' } }, admin);
    expect(r.test.ok).toBe(false);
    expect(r.test.detail).toMatch(/identifiants refusés/);
    expect(r.test.capabilities).toEqual([]);
  });

  it('champs Yoast non exposés : les méta partent à l’export', async () => {
    wp.exposeMeta = false;
    const r = await connect(biz);
    expect(r.test.capabilities).not.toContain('meta.title');
    expect(r.test.detail).toMatch(/extension d’aide/);
    const plan = await createChangeSets(biz, [finding({ id: 'seo.title.too_short', affected: [{ url: 'https://wp.test/plombier-lyon/' }] })], site(biz), admin, { writer: rulesWriter });
    expect(plan.changeSets[0].platform).toBe('export');
  });
});

describe('cycle complet', () => {
  it('proposer → valider → appliquer → vérifier → annuler, avec journal, repère et remesure', async () => {
    await connect(biz);
    const plan = await createChangeSets(
      biz,
      [
        finding({ id: 'seo.title.too_short', title: 'Le titre de la page est trop court', affected: [{ url: 'https://wp.test/plombier-lyon/' }] }),
        finding({ id: 'seo.meta_description.missing', title: 'Méta-description absente', autoFix: { kind: 'meta.description', payload: { url: 'https://wp.test/plombier-lyon/', value: 'Plomberie Martin intervient à Lyon 3e pour les fuites et les chauffe-eau. Devis gratuit sous 24 heures.' } } }),
      ],
      site(biz),
      admin,
      { writer: rulesWriter },
    );
    expect(plan.changeSets).toHaveLength(2);
    const cs0 = plan.changeSets[0];
    expect(cs0.platform).toBe('wordpress');
    expect(cs0.status).toBe('draft');
    expect(cs0.origin.findingId).toBe('seo.title.too_short');
    expect(cs0.changes[0].after).toBe('Plombier à Lyon 3e | Plomberie Martin');

    // Aucune écriture sans validation
    await expect(applyChangeSet(biz, cs0.id, admin)).rejects.toMatchObject({ status: 409 });
    const proposed = await proposeChangeSet(biz, cs0.id, admin);
    expect(proposed.status).toBe('proposed');
    expect(proposed.changes[0].before).toBe('');
    expect(proposed.changes[0].beforeSource).toBe('platform');
    expect(proposed.changes[0].target.resource).toEqual({ type: 'page', id: '7' });
    await expect(applyChangeSet(biz, cs0.id, admin)).rejects.toMatchObject({ status: 409 });
    await expect(validateChangeSet(biz, cs0.id, { id: 'agent' })).rejects.toMatchObject({ status: 403 });
    expect(wp.writes).toBe(0);

    const validated = await validateChangeSet(biz, cs0.id, admin, { note: 'ok' });
    expect(validated.validation).toMatchObject({ by: { id: 'u-admin' } });
    const now = new Date();
    const applied = await applyChangeSet(biz, cs0.id, admin, { now });
    expect(applied.status).toBe('verified');
    expect(wp.pages[0].meta._yoast_wpseo_title).toBe('Plombier à Lyon 3e | Plomberie Martin');
    const v = applied.changes[0].verification ?? [];
    expect(v.map((x) => [x.method, x.ok])).toEqual([
      ['api', true],
      ['page', true],
    ]);
    expect(wp.writes).toBe(1);

    // Repère sur les courbes + remesure ciblée J+7 (dédoublonnée)
    const an = await getDoc<{ label: string; date: string; kind: string }>(ANNOTATIONS, `an_pub_${cs0.id}`);
    expect(an?.data).toMatchObject({ date: now.toISOString().slice(0, 10), kind: 'action' });
    expect(an?.data.label).toMatch(/^Publié : /);
    const jobs = await listLocalJobs('siteaudit.run');
    expect(jobs).toHaveLength(1);
    expect(Date.parse(jobs[0].runAt) - now.getTime()).toBe(7 * 86_400_000);
    expect(jobs[0].status).toBe('queued');
    expect(jobs[0].payload).toMatchObject({ businessId: biz, url: 'https://wp.test/plombier-lyon/', changeSetId: cs0.id });

    // Idempotence : réappliquer est refusé, rien n'est réécrit
    await expect(applyChangeSet(biz, cs0.id, admin)).rejects.toMatchObject({ status: 409 });
    expect(wp.writes).toBe(1);

    // Retour arrière : l'avant exact est rétabli, la page publique aussi
    const reverted = await revertChangeSet(biz, cs0.id, admin);
    expect(reverted.status).toBe('reverted');
    expect(wp.pages[0].meta._yoast_wpseo_title).toBe('');
    expect(reverted.changes[0].status).toBe('reverted');
    expect(await getDoc(ANNOTATIONS, `an_pubrev_${cs0.id}`)).not.toBeNull();
    await expect(revertChangeSet(biz, cs0.id, admin)).rejects.toMatchObject({ status: 409 });

    // Journal immuable et chaîné
    const j = await readJournal(biz, cs0.id);
    expect(j.map((e) => e.action)).toEqual(['created', 'proposed', 'validated', 'apply.started', 'change.applied', 'change.verified', 'remeasure.scheduled', 'verified', 'change.reverted', 'reverted']);
    expect(j.find((e) => e.action === 'change.applied')).toMatchObject({ before: '', after: 'Plombier à Lyon 3e | Plomberie Martin', actor: { id: 'u-admin' } });
    expect(verifyJournal(j).ok).toBe(true);
    const tampered = j.map((e) => (e.action === 'change.applied' ? { ...e, after: 'autre chose' } : e));
    expect(verifyJournal(tampered)).toEqual({ ok: false, brokenAt: 5 });
    expect(verifyJournal(j.filter((e) => e.seq !== 3)).ok).toBe(false);
  });

  it('valeur déjà en place : aucune écriture (idempotent) ; proposition sans objet refusée', async () => {
    await connect(biz);
    wp.pages[0].meta._yoast_wpseo_title = 'Plombier à Lyon 3e | Plomberie Martin';
    const plan = await createChangeSets(biz, [finding({ id: 'seo.title.too_short', affected: [{ url: 'https://wp.test/plombier-lyon/' }] })], site(biz), admin, { writer: rulesWriter });
    await expect(proposeChangeSet(biz, plan.changeSets[0].id, admin)).rejects.toMatchObject({ status: 409, code: 'nothing_to_apply' });
    expect((await getChangeSet(biz, plan.changeSets[0].id))?.changes[0].status).toBe('skipped');
    expect(wp.writes).toBe(0);
  });

  it('valeur modifiée sur le site entre validation et application : conflit, rien n’est écrasé', async () => {
    await connect(biz);
    const plan = await createChangeSets(biz, [finding({ id: 'seo.title.too_short', affected: [{ url: 'https://wp.test/plombier-lyon/' }] })], site(biz), admin, { writer: rulesWriter });
    const id = plan.changeSets[0].id;
    await proposeChangeSet(biz, id, admin);
    await validateChangeSet(biz, id, admin);
    wp.pages[0].meta._yoast_wpseo_title = 'Titre saisi à la main par le client';
    const cs = await applyChangeSet(biz, id, admin);
    expect(cs.status).toBe('failed');
    expect(cs.changes[0]).toMatchObject({ status: 'failed' });
    expect(cs.changes[0].error).toMatch(/a changé sur le site/);
    expect(wp.pages[0].meta._yoast_wpseo_title).toBe('Titre saisi à la main par le client');
    expect(wp.writes).toBe(0);
  });

  it('échec partiel puis reprise : seul le changement en échec est rejoué', async () => {
    await connect(biz);
    const plan = await createChangeSets(
      biz,
      [finding({ id: 'seo.title.too_short', affected: [{ url: 'https://wp.test/plombier-lyon/' }, { url: 'https://wp.test/' }] })],
      site(biz),
      admin,
      { writer: rulesWriter },
    );
    const id = plan.changeSets[0].id;
    expect(plan.changeSets[0].changes).toHaveLength(2);
    await proposeChangeSet(biz, id, admin);
    await validateChangeSet(biz, id, admin);
    wp.failures.set('POST /wp-json/wp/v2/pages/2', 1);
    const first = await applyChangeSet(biz, id, admin);
    expect(first.status).toBe('partially_applied');
    expect(first.changes.map((c) => c.status)).toEqual(['verified', 'failed']);
    expect(first.changes[1].error).toMatch(/erreur 500/);
    expect(wp.writes).toBe(1);
    const second = await applyChangeSet(biz, id, admin);
    expect(second.status).toBe('verified');
    expect(wp.writes).toBe(2);
    expect(wp.pages[1].meta._yoast_wpseo_title).toBe('Plomberie Martin, dépannage à Lyon');
    // Retour arrière d'un seul changement
    const partial = await revertChangeSet(biz, id, admin, { changeIds: [second.changes[1].id] });
    expect(partial.changes.map((c) => c.status)).toEqual(['verified', 'reverted']);
    expect(partial.status).toBe('verified');
    expect(wp.pages[1].meta._yoast_wpseo_title).toBe('');
    expect(wp.pages[0].meta._yoast_wpseo_title).not.toBe('');
  });

  it('retour arrière refusé si le site a été modifié depuis (sauf forçage)', async () => {
    await connect(biz);
    const plan = await createChangeSets(biz, [finding({ id: 'seo.title.too_short', affected: [{ url: 'https://wp.test/plombier-lyon/' }] })], site(biz), admin, { writer: rulesWriter });
    const id = plan.changeSets[0].id;
    await proposeChangeSet(biz, id, admin);
    await validateChangeSet(biz, id, admin);
    await applyChangeSet(biz, id, admin);
    wp.pages[0].meta._yoast_wpseo_title = 'Retouché ensuite';
    const r = await revertChangeSet(biz, id, admin);
    expect(r.status).toBe('verified');
    expect(r.changes[0].error).toMatch(/Modifié depuis/);
    expect(wp.pages[0].meta._yoast_wpseo_title).toBe('Retouché ensuite');
    const forced = await revertChangeSet(biz, id, admin, { force: true });
    expect(forced.status).toBe('reverted');
    expect(wp.pages[0].meta._yoast_wpseo_title).toBe('');
  });

  it('modifier un texte après validation annule la validation ; rejet', async () => {
    await connect(biz);
    const plan = await createChangeSets(biz, [finding({ id: 'seo.title.too_short', affected: [{ url: 'https://wp.test/plombier-lyon/' }] })], site(biz), admin, { writer: rulesWriter });
    const id = plan.changeSets[0].id;
    await proposeChangeSet(biz, id, admin);
    await validateChangeSet(biz, id, admin);
    const edited = await editChange(biz, id, plan.changeSets[0].changes[0].id, 'Plombier à Lyon 3e, devis gratuit', admin);
    expect(edited.status).toBe('proposed');
    expect(edited.validation).toBeUndefined();
    expect(edited.changes[0]).toMatchObject({ after: 'Plombier à Lyon 3e, devis gratuit', generatedBy: 'user' });
    await expect(applyChangeSet(biz, id, admin)).rejects.toMatchObject({ status: 409 });
    const rej = await rejectChangeSet(biz, id, admin, 'Pas maintenant');
    expect(rej.status).toBe('rejected');
    await expect(validateChangeSet(biz, id, admin)).rejects.toMatchObject({ status: 409 });
    expect(wp.writes).toBe(0);
  });

  it('constat déjà en cours : pas de doublon', async () => {
    await connect(biz);
    const f = [finding({ id: 'seo.title.too_short', affected: [{ url: 'https://wp.test/plombier-lyon/' }] })];
    const a = await createChangeSets(biz, f, site(biz), admin, { writer: rulesWriter });
    const b = await createChangeSets(biz, f, site(biz), admin, { writer: rulesWriter });
    expect(b.changeSets[0].id).toBe(a.changeSets[0].id);
  });

  it('alt d’image (médiathèque), FAQ et JSON-LD dans le contenu, vérifiés sur la page publique', async () => {
    await connect(biz);
    const plan = await createChangeSets(
      biz,
      [
        finding({ id: 'seo.images.alt_missing', category: 'images', affected: [{ url: 'https://wp.test/', detail: 'https://wp.test/wp-content/uploads/2026/01/chauffe-eau-thermodynamique-300x200.jpg' }] }),
        finding({
          id: 'geo.faq.missing',
          autoFix: { kind: 'faq', payload: { url: 'https://wp.test/plombier-lyon/', faq: [{ question: 'Le devis est-il gratuit ?', answer: 'Oui, devis gratuit sous 24 heures.' }, { question: 'Intervenez-vous à Paris ?', answer: 'Oui, partout à Paris en 30 minutes.' }] } },
        }),
        finding({ id: 'geo.jsonld.localbusiness', autoFix: { kind: 'jsonld', payload: { url: 'https://wp.test/plombier-lyon/', value: '{"@context":"https://schema.org","@type":"Plumber","name":"Plomberie Martin"}' } } }),
      ],
      site(biz),
      admin,
      { writer: rulesWriter },
    );
    // La question dont la réponse n'est pas dans la page est écartée (aucun fait inventé).
    expect(plan.skipped.some((s) => s.findingId === 'geo.faq.missing' && /écartée/.test(s.reason))).toBe(true);
    for (const cs of plan.changeSets) {
      expect(cs.platform).toBe('wordpress');
      await proposeChangeSet(biz, cs.id, admin);
      await validateChangeSet(biz, cs.id, admin);
      const done = await applyChangeSet(biz, cs.id, admin);
      expect(done.status, cs.origin.findingId).toBe('verified');
    }
    expect(wp.media[0].alt_text).toBe('Chauffe eau thermodynamique');
    expect(wp.pages[0].content).toContain('"@type": "FAQPage"');
    expect(wp.pages[0].content).not.toContain('Paris');
    expect(wp.pages[0].content).toContain('"@type": "Plumber"');
    // Annuler la FAQ rétablit le contenu exact d'avant (le JSON-LD ajouté ensuite reste en conflit → refusé)
    const faqCs = plan.changeSets.find((c) => c.origin.findingId === 'geo.faq.missing')!;
    const r = await revertChangeSet(biz, faqCs.id, admin);
    expect(r.changes[0].error).toMatch(/Modifié depuis/);
  });

  it('Rank Math : écriture par rankmath/v1/updateMeta', async () => {
    wp.plugin = 'rankmath';
    for (const p of wp.pages) p.meta = { rank_math_title: '', rank_math_description: '', rank_math_canonical_url: '' };
    const c = await connect(biz);
    expect(c.test.info?.seoPlugin).toBe('rankmath');
    const plan = await createChangeSets(biz, [finding({ id: 'seo.title.too_short', affected: [{ url: 'https://wp.test/plombier-lyon/' }] })], site(biz), admin, { writer: rulesWriter });
    const id = plan.changeSets[0].id;
    await proposeChangeSet(biz, id, admin);
    await validateChangeSet(biz, id, admin);
    const cs = await applyChangeSet(biz, id, admin);
    expect(cs.status).toBe('verified');
    expect(wp.pages[0].meta.rank_math_title).toBe('Plombier à Lyon 3e | Plomberie Martin');
    expect(fake.log.some((l) => l.includes('/wp-json/rankmath/v1/updateMeta'))).toBe(true);
    await verifyChangeSet(biz, id, admin);
  });
});
