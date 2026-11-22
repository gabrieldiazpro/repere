/**
 * Cycle complet de l'agent de contenu sur un faux WordPress : faits → brouillon → « [à compléter] » bloque →
 * modification → validation humaine → création en brouillon chez le client (quota) → mise en ligne (repère, effet) →
 * retrait → corbeille ; export ; démo en lecture seule ; mentions ; journal chaîné.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { isolateStore, localHttp, startFake, basicOk, type Fake, type FakeReq } from '@/lib/publish/__tests__/helpers';

isolateStore('content');

const { setPublishHttp } = await import('@/lib/publish/http');
const { saveConnection, recordTest } = await import('@/lib/publish/connections');
const { getDoc } = await import('@/lib/store');
const { ANNOTATIONS } = await import('@/lib/annotations');
const svc = await import('../service');
const { mergeFacts } = await import('../facts');
const { readContentJournal, verifyContentJournal } = await import('../journal');
type ContentOpportunity = import('../types').ContentOpportunity;
type Actor = import('../types').Actor;

const admin: Actor = { id: 'u-admin', email: 'admin@exemple.fr', role: 'admin' };
let fake: Fake;
let n = 0;
let biz = '';
const items: { id: number; slug: string; status: string; content: string; type: string }[] = [];

beforeAll(async () => {
  fake = await startFake();
  setPublishHttp(localHttp(fake.port));
  fake.hosts.set('wp.test', (r: FakeReq) => {
    if (!basicOk(r.headers, 'ed', 'pw')) return { status: 401, body: {} };
    const m = /^\/wp-json\/wp\/v2\/(pages|posts)(?:\/(\d+))?$/.exec(r.path);
    if (!m) return { status: 404, body: {} };
    const type = m[1];
    const view = (i: (typeof items)[0]) => ({ id: i.id, slug: i.slug, status: i.status, link: `https://wp.test/${i.slug}/`, title: { raw: i.slug }, content: { raw: i.content }, meta: {} });
    if (!m[2] && r.method === 'GET') return { body: items.filter((i) => i.type === type && i.slug === r.query.get('slug') && i.status !== 'trash').map(view) };
    if (!m[2] && r.method === 'POST') {
      const b = JSON.parse(r.body);
      const it = { id: 200 + items.length, slug: b.slug, status: b.status, content: b.content, type };
      items.push(it);
      return { status: 201, body: view(it) };
    }
    const it = items.find((i) => i.id === Number(m[2]));
    if (!it || it.status === 'trash') return { status: 404, body: {} };
    if (r.method === 'POST') it.status = JSON.parse(r.body).status ?? it.status;
    if (r.method === 'DELETE') it.status = 'trash';
    return { body: view(it) };
  });
});
afterAll(async () => {
  setPublishHttp(null);
  await fake.close();
});
beforeEach(async () => {
  biz = `ct-biz-${++n}`;
  await saveConnection(biz, 'wordpress', { siteUrl: 'https://wp.test' }, { username: 'ed', password: 'pw' });
  await recordTest(biz, 'wordpress', { ok: true, detail: 'ok', capabilities: ['rewrite'], info: { seoPlugin: 'none' } });
});

const op: ContentOpportunity = { id: 'op_tarifs1', action: 'create', pageType: 'tarifs', format: 'page', title: 'Nos tarifs à Lyon', target: 'Combien coûte un plombier à Lyon ?', why: 'x', evidence: [{ source: 'questions_ia', text: 'Sur « … », les IA citent Durand.' }], priority: 8, needs: ['prix'], questionIds: ['q1'], competitors: ['Durand'] };
const facts = mergeFacts({ activite: 'Plombier', services: 'Recherche de fuite', prix: 'Déplacement : 49 € TTC', delais: 'Sous 48 h' });
const ctx = { name: 'Plomberie Martin', site: 'https://wp.test', segment: 'local' as const, city: 'Lyon', facts, pages: [], now: new Date('2026-11-22T10:00:00Z'), writer: null };

describe('cycle d’un contenu', () => {
  it('de la proposition à la corbeille, avec garde-fous et journal', async () => {
    const d = await svc.createDraft(biz, op, ctx, admin);
    expect(d.missing.length).toBeGreaterThan(0);
    expect((await svc.createDraft(biz, op, ctx, admin)).id).toBe(d.id); // pas de doublon
    await expect(svc.validateDraft(biz, d.id, admin)).rejects.toThrow(/à compléter/);
    await expect(svc.pushDraft(biz, d.id, admin, { tier: 'essentiel', author: 'Plomberie Martin' })).rejects.toThrow(/validé/);
    await expect(svc.validateDraft(biz, d.id, { id: 'agent' })).rejects.toThrow(/personne/);

    const edited = await svc.editDraft(biz, d.id, { body: d.body.replace(/\[à compléter[^\]]*\]/g, 'Carte bancaire') }, admin, ctx);
    expect(edited.missing).toEqual([]);
    expect(edited.history.length).toBe(2);
    const v = await svc.validateDraft(biz, d.id, admin);
    expect(v.validation?.by.id).toBe('u-admin');
    // une modification après validation fait tomber la validation
    const re = await svc.editDraft(biz, d.id, { metaTitle: 'Tarifs du plombier à Lyon | Plomberie Martin' }, admin, ctx);
    expect(re.status).toBe('draft');
    await svc.validateDraft(biz, d.id, admin);

    await expect(svc.pushDraft(biz, d.id, admin, { tier: 'decouverte', author: 'X' })).rejects.toThrow(/offre Essentiel/);
    const pushed = await svc.pushDraft(biz, d.id, admin, { tier: 'essentiel', author: 'Plomberie Martin' });
    expect(pushed.draft.status).toBe('remote_draft');
    expect(items.find((i) => i.slug === d.slug)?.status).toBe('draft'); // invisible du public
    expect(pushed.draft.consumedAt).toBeTruthy();

    const live = await svc.publishDraft(biz, d.id, admin, { effect: { at: '', audit: { measuredAt: '2026-11-20', mentions: [{ provider: 'chatgpt', queryId: 'q1', run: 0, mentioned: false, rank: null, competitors: ['Durand'] }] } } });
    expect(live.status).toBe('published');
    expect(live.liveUrl).toBe(`https://wp.test/${d.slug}/`);
    expect(live.effect?.baseline.ai).toEqual({ questionIds: ['q1'], cited: 0, total: 1 });
    expect(await getDoc(ANNOTATIONS, `an_content_${d.id}`)).toBeTruthy();

    const off = await svc.unpublishDraft(biz, d.id, admin);
    expect(off.status).toBe('unpublished');
    expect(items.find((i) => i.slug === d.slug)?.status).toBe('draft');
    const gone = await svc.removeDraft(biz, d.id, admin);
    expect(gone.status).toBe('removed');
    expect(items.find((i) => i.slug === d.slug)?.status).toBe('trash');

    const j = await readContentJournal(biz, d.id);
    expect(j.map((e) => e.action)).toEqual(['drafted', 'edited', 'validated', 'edited', 'validated', 'remote.created', 'published', 'unpublished', 'removed']);
    expect(verifyContentJournal(j).ok).toBe(true);
  });

  it('plafond mensuel : au-delà de 2 en Essentiel, ni création ni export', async () => {
    const make = async (k: number) => {
      const d = await svc.createDraft(biz, { ...op, id: `op_q${k}`, title: `Page ${k} tarifs` }, { ...ctx, facts: mergeFacts({ prix: '49 €', services: 'Fuite', delais: '48 h', paiement: 'Carte' }) }, admin);
      await svc.validateDraft(biz, d.id, admin);
      return d;
    };
    const a = await make(1);
    const b = await make(2);
    const c = await make(3);
    await svc.pushDraft(biz, a.id, admin, { tier: 'essentiel', author: 'X' });
    await svc.exportDraft(biz, b.id, admin, { tier: 'essentiel', author: 'X' });
    await expect(svc.pushDraft(biz, c.id, admin, { tier: 'essentiel', author: 'X' })).rejects.toThrow(/Plafond du mois/);
    await expect(svc.exportDraft(biz, c.id, admin, { tier: 'essentiel', author: 'X' })).rejects.toThrow(/Plafond du mois/);
    // le même export peut être retéléchargé sans recompter
    expect((await svc.exportDraft(biz, b.id, admin, { tier: 'essentiel', author: 'X' })).files.length).toBe(4);
    const live = await svc.declareLive(biz, b.id, 'https://wp.test/page-2/', admin);
    expect(live.status).toBe('published');
  });

  it('adresse déjà prise sur le site : refus explicite', async () => {
    items.push({ id: 999, slug: 'deja-la', status: 'publish', content: '', type: 'pages' });
    const d = await svc.createDraft(biz, { ...op, id: 'op_clash', title: 'Déjà là' }, { ...ctx, facts: mergeFacts({ prix: '49 €', services: 'Fuite', delais: '48 h', paiement: 'Carte' }) }, admin);
    await svc.validateDraft(biz, d.id, admin);
    await expect(svc.pushDraft(biz, d.id, admin, { tier: 'accompagne', author: 'X' })).rejects.toThrow(/déjà l’adresse/);
  });

  it('comptes démo : aucune écriture', async () => {
    await expect(svc.createDraft('demo', op, ctx, admin)).rejects.toThrow(/démonstration/);
    await expect(svc.saveFacts('demo', { prix: '1 €' }, admin)).rejects.toThrow(/démonstration/);
  });

  it('faits clés et suivi des mentions', async () => {
    const f = await svc.saveFacts(biz, { prix: ' 49 € ', bidon: 'x' }, admin);
    expect(f.facts).toEqual({ prix: '49 €' });
    const t = await svc.setMentionStatus(biz, 'mn_abc', 'demande', {}, admin);
    expect(t.requestedAt).toBeTruthy();
    const t2 = await svc.setMentionStatus(biz, 'mn_abc', 'obtenu', { url: 'https://pagesjaunes.fr/x' }, admin);
    expect(t2).toMatchObject({ status: 'obtenu', url: 'https://pagesjaunes.fr/x', requestedAt: t.requestedAt });
    await expect(svc.setMentionStatus(biz, 'mn_abc', 'obtenu', { url: 'javascript:alert(1)' }, admin)).rejects.toThrow();
  });
});
