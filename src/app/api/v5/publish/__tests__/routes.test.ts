/**
 * Routes /api/v5/publish : démo en lecture seule, rôles (member ne peut pas valider ni appliquer), cycle complet par
 * HTTP contre un faux WordPress local, export ZIP, secrets jamais renvoyés.
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'repere-publish-routes-'));
for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_SUPABASE_URL', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'MISTRAL_API_KEY']) delete process.env[k];

import { createBusiness, addMembership } from '@/lib/db';
import { localSessionCookies } from '@/lib/auth/session';
import { resetRateLimit } from '@/lib/ratelimit';
import { useMemoryJobs } from '@/lib/jobs/testing';
import { setPublishHttp } from '@/lib/publish/http';
import { readZip } from '@/lib/publish/zip';
import { localHttp, routePublicFetch, startFake, type Fake } from '@/lib/publish/__tests__/helpers';
import { wordpressFake, type WpState } from '@/lib/publish/__tests__/fakes';
import * as conns from '../connections/route';
import * as connTest from '../connections/test/route';
import * as sets from '../changesets/route';
import * as one from '../changesets/[id]/route';
import * as exp from '../changesets/[id]/export/route';

let fake: Fake;
let wp: WpState;
let restore: () => void;
let ip = 0;

const req = (method: string, url: string, body?: unknown, cookie?: string) =>
  new Request(`http://localhost${url}`, {
    method,
    headers: { 'content-type': 'application/json', 'x-forwarded-for': `203.0.113.${++ip % 250}`, ...(cookie ? { cookie } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const cookieFor = (uid: string, email: string) => localSessionCookies(uid, email).map((c) => `${c.name}=${c.value}`).join('; ');
const j = async (r: Response) => ({ status: r.status, body: (await r.json()) as Record<string, any> }); // eslint-disable-line @typescript-eslint/no-explicit-any -- réponses JSON libres des routes

const SITE = {
  origin: 'https://wp.test',
  name: 'Plomberie Martin',
  pages: [{ url: 'https://wp.test/plombier-lyon/', title: 'Plombier Lyon', h1: ['Plombier à Lyon 3e'], text: 'Plomberie Martin intervient à Lyon 3e pour les fuites. Devis gratuit sous 24 heures.' }],
};
const FINDINGS = [{ id: 'seo.title.too_short', title: 'Titre trop court', fix: 'Allonger le titre.', affected: [{ url: 'https://wp.test/plombier-lyon/' }] }];

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
  resetRateLimit();
});

describe('démo', () => {
  it('lecture des exemples étiquetés démo ; toute action refusée', async () => {
    const list = await j(await sets.GET(req('GET', '/api/v5/publish/changesets?businessId=demo')));
    expect(list.status).toBe(200);
    expect(list.body.demo).toBe(true);
    expect(list.body.changeSets.length).toBeGreaterThan(0);
    expect(list.body.changeSets.every((c: { demo: boolean; title: string }) => c.demo && c.title.startsWith('[Démo]'))).toBe(true);
    const g = await j(await one.GET(req('GET', '/api/v5/publish/changesets/cs_demo_title?businessId=demo'), ctx('cs_demo_title')));
    expect(g.body.changeSet.id).toBe('cs_demo_title');
    for (const action of ['propose', 'validate', 'apply', 'revert']) {
      const r = await j(await one.POST(req('POST', '/api/v5/publish/changesets/cs_demo_title', { businessId: 'demo', action }), ctx('cs_demo_title')));
      expect(r.status).toBe(403);
      expect(r.body.code).toBe('demo_read_only');
    }
    expect((await sets.POST(req('POST', '/api/v5/publish/changesets', { businessId: 'demo', findings: FINDINGS, site: SITE }))).status).toBe(403);
    expect((await conns.POST(req('POST', '/api/v5/publish/connections', { businessId: 'demo', platform: 'wordpress', config: {}, credentials: {} }))).status).toBe(403);
  });
});

describe('cycle par HTTP (bac à sable local, propriétaire)', () => {
  it('connecter → planifier → proposer → valider → appliquer → exporter → annuler', async () => {
    const b = await createBusiness({ name: 'Plomberie Martin', trade: 'plombier', city: 'Lyon', plan: 'essentiel' } as Parameters<typeof createBusiness>[0]);
    const c = await j(await conns.POST(req('POST', '/api/v5/publish/connections', { businessId: b.id, platform: 'wordpress', config: { siteUrl: 'https://wp.test' }, credentials: { username: wp.user, password: wp.pass } })));
    expect(c.status).toBe(201);
    expect(c.body.test.ok).toBe(true);
    expect(JSON.stringify(c.body)).not.toContain(wp.pass);
    const listC = await j(await conns.GET(req('GET', `/api/v5/publish/connections?businessId=${b.id}`)));
    expect(listC.body.connections[0]).toMatchObject({ platform: 'wordpress', config: { siteUrl: 'https://wp.test' } });
    expect(JSON.stringify(listC.body)).not.toContain(wp.pass);
    expect(listC.body.platforms.map((p: { id: string }) => p.id)).not.toContain('gbp');
    expect((await j(await connTest.POST(req('POST', '/api/v5/publish/connections/test', { businessId: b.id, platform: 'wordpress' })))).body.test.ok).toBe(true);

    expect((await sets.POST(req('POST', '/api/v5/publish/changesets', { businessId: b.id, findings: [{ nope: 1 }], site: SITE }))).status).toBe(400);
    const plan = await j(await sets.POST(req('POST', '/api/v5/publish/changesets', { businessId: b.id, findings: FINDINGS, site: SITE })));
    expect(plan.status).toBe(201);
    const id = plan.body.changeSets[0].id as string;
    const act = async (action: string, extra: Record<string, unknown> = {}) => j(await one.POST(req('POST', `/api/v5/publish/changesets/${id}`, { businessId: b.id, action, ...extra }), ctx(id)));
    expect((await act('apply')).status).toBe(409);
    expect((await act('propose')).body.changeSet.status).toBe('proposed');
    expect((await act('validate')).body.changeSet.validation.by.id).toBe('sandbox-owner');
    const applied = await act('apply');
    expect(applied.body.changeSet.status).toBe('verified');
    expect(wp.pages[0].meta._yoast_wpseo_title).toBe('Plombier à Lyon 3e | Plomberie Martin');
    const zip = await exp.GET(req('GET', `/api/v5/publish/changesets/${id}/export?businessId=${b.id}`), ctx(id));
    expect(zip.headers.get('content-type')).toBe('application/zip');
    expect(readZip(Buffer.from(await zip.arrayBuffer())).map((f) => f.name)).toEqual(['LISEZ-MOI.txt', 'balises.csv']);
    const g = await j(await one.GET(req('GET', `/api/v5/publish/changesets/${id}?businessId=${b.id}`), ctx(id)));
    expect(g.body.journal.map((e: { action: string }) => e.action)).toContain('change.applied');
    expect((await act('revert')).body.changeSet.status).toBe('reverted');
    expect(wp.pages[0].meta._yoast_wpseo_title).toBe('');
    expect((await act('dance')).status).toBe(400);
    expect((await one.GET(req('GET', `/api/v5/publish/changesets/pas-un-id?businessId=${b.id}`), ctx('pas-un-id'))).status).toBe(400);
  });
});

describe('rôles', () => {
  it('membre : peut planifier et proposer, pas valider, appliquer ni connecter ; lecteur : lecture seule', async () => {
    const b = await createBusiness({ name: 'Plomberie Martin', trade: 'plombier', city: 'Lyon', plan: 'essentiel' } as Parameters<typeof createBusiness>[0]);
    await addMembership(b.id, 'u-owner', 'owner', 'owner@exemple.fr');
    await addMembership(b.id, 'u-member', 'member', 'member@exemple.fr');
    await addMembership(b.id, 'u-viewer', 'viewer', 'viewer@exemple.fr');
    const owner = cookieFor('u-owner', 'owner@exemple.fr');
    const member = cookieFor('u-member', 'member@exemple.fr');
    const viewer = cookieFor('u-viewer', 'viewer@exemple.fr');
    expect((await sets.GET(req('GET', `/api/v5/publish/changesets?businessId=${b.id}`))).status).toBe(401);
    expect((await conns.POST(req('POST', '/api/v5/publish/connections', { businessId: b.id, platform: 'wordpress', config: { siteUrl: 'https://wp.test' }, credentials: { username: wp.user, password: wp.pass } }, member))).status).toBe(403);
    expect((await conns.POST(req('POST', '/api/v5/publish/connections', { businessId: b.id, platform: 'wordpress', config: { siteUrl: 'https://wp.test' }, credentials: { username: wp.user, password: wp.pass } }, owner))).status).toBe(201);
    expect((await sets.POST(req('POST', '/api/v5/publish/changesets', { businessId: b.id, findings: FINDINGS, site: SITE }, viewer))).status).toBe(403);
    const plan = await j(await sets.POST(req('POST', '/api/v5/publish/changesets', { businessId: b.id, findings: FINDINGS, site: SITE }, member)));
    const id = plan.body.changeSets[0].id as string;
    const act = async (action: string, cookie: string) => one.POST(req('POST', `/api/v5/publish/changesets/${id}`, { businessId: b.id, action }, cookie), ctx(id));
    expect((await act('propose', member)).status).toBe(200);
    expect((await act('validate', member)).status).toBe(403);
    expect((await act('validate', owner)).status).toBe(200);
    expect((await act('apply', member)).status).toBe(403);
    expect(wp.writes).toBe(0);
    const ok = await j(await act('apply', owner));
    expect(ok.body.changeSet.status).toBe('verified');
    expect(ok.body.changeSet.validation.by).toMatchObject({ id: 'u-owner', email: 'owner@exemple.fr' });
    expect((await sets.GET(req('GET', `/api/v5/publish/changesets?businessId=${b.id}`, undefined, viewer))).status).toBe(200);
  });
});
