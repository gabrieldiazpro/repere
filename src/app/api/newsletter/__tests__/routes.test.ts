import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';

const env = process.env as Record<string, string | undefined>;
const DIR = mkdtempSync(path.join(os.tmpdir(), 'repere-newsletter-api-'));
env.DATA_DIR = DIR;
(globalThis as { __repereDocsDir?: string }).__repereDocsDir = DIR;
delete env.SUPABASE_URL;
delete env.NEXT_PUBLIC_SUPABASE_URL;
delete env.SUPABASE_SERVICE_ROLE_KEY;
delete env.RESEND_API_KEY;
env.NEWSLETTER_SECRET = 'secret-de-test-api';

import { POST as subscribe } from '../subscribe/route';
import { GET as confirm } from '../confirm/route';
import { GET as unsubGet, POST as unsubPost } from '../unsubscribe/route';
import { POST as ressource } from '../ressource/route';
import { getSubscriber, listDownloads } from '@/lib/newsletter/store';
import { signToken } from '@/lib/newsletter/tokens';

let ip = 0;
const post = (url: string, body: unknown) =>
  new Request(`http://localhost${url}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.0.0.${++ip}` }, body: JSON.stringify(body) });

let logs: string[] = [];
beforeAll(() => {
  vi.spyOn(console, 'info').mockImplementation((m: unknown) => {
    logs.push(String(m));
  });
});

describe('/api/newsletter', () => {
  it('refuse sans case cochée, sans adresse valide ou avec le piège à robots', async () => {
    expect((await subscribe(post('/api/newsletter/subscribe', { email: 'x@exemple.fr', consent: false }))).status).toBe(400);
    expect((await subscribe(post('/api/newsletter/subscribe', { email: 'x', consent: true }))).status).toBe(400);
    expect((await subscribe(post('/api/newsletter/subscribe', { email: 'x@exemple.fr', consent: true, hp: 'bot' }))).status).toBe(400);
    expect(await getSubscriber('x@exemple.fr')).toBeNull();
  });

  it('inscrit en attente et envoie un e-mail de confirmation', async () => {
    logs = [];
    const res = await subscribe(post('/api/newsletter/subscribe', { email: 'Paul@Exemple.fr', consent: true, source: 'guide', page: '/guides/seo-wix' }));
    expect(res.status).toBe(202);
    const s = await getSubscriber('paul@exemple.fr');
    expect(s).toMatchObject({ status: 'pending', source: 'guide', page: '/guides/seo-wix' });
    expect(logs.join('\n')).toContain('Confirmez votre inscription');
  });

  it('confirme avec un lien signé, refuse un lien modifié', async () => {
    const bad = await confirm(new Request('http://localhost/api/newsletter/confirm?e=paul%40exemple.fr&t=faux'));
    expect(bad.headers.get('location')).toContain('etat=lien-invalide');
    const ok = await confirm(new Request(`http://localhost/api/newsletter/confirm?e=paul%40exemple.fr&t=${signToken('nl-confirm', 'paul@exemple.fr')}`));
    expect(ok.status).toBe(303);
    expect(ok.headers.get('location')).toContain('/veille/lettre?etat=confirme');
    expect((await getSubscriber('paul@exemple.fr'))?.status).toBe('active');
  });

  it('désinscrit en un clic (GET et POST RFC 8058)', async () => {
    const t = signToken('nl-unsub', 'paul@exemple.fr');
    const r = await unsubGet(new Request(`http://localhost/api/newsletter/unsubscribe?e=paul%40exemple.fr&t=${t}`));
    expect(r.headers.get('location')).toContain('etat=desinscrit');
    expect((await getSubscriber('paul@exemple.fr'))?.status).toBe('unsubscribed');
    const p = await unsubPost(new Request(`http://localhost/api/newsletter/unsubscribe?e=paul%40exemple.fr&t=${t}`, { method: 'POST' }));
    expect(p.status).toBe(200);
    const no = await unsubPost(new Request('http://localhost/api/newsletter/unsubscribe?e=paul%40exemple.fr&t=x', { method: 'POST' }));
    expect(no.status).toBe(400);
  });

  it('guide : consentement distinct, lettre seulement si cochée (et en attente)', async () => {
    expect((await ressource(post('/api/newsletter/ressource', { email: 'z@exemple.fr', resource: 'guide-2027', consentGuide: false }))).status).toBe(400);
    logs = [];
    const a = await ressource(post('/api/newsletter/ressource', { email: 'ana@exemple.fr', resource: 'guide-2027', consentGuide: true }));
    expect(a.status).toBe(202);
    expect(await getSubscriber('ana@exemple.fr')).toBeNull();
    expect(logs.join('\n')).toContain('/ressources/guide-2027/lire?e=ana%40exemple.fr');
    const b = await ressource(post('/api/newsletter/ressource', { email: 'bob@exemple.fr', resource: 'guide-2027', consentGuide: true, newsletter: true }));
    expect(b.status).toBe(202);
    expect((await getSubscriber('bob@exemple.fr'))?.status).toBe('pending');
    const d = await listDownloads();
    expect(d.map((x) => [x.email, x.newsletter])).toEqual(expect.arrayContaining([['ana@exemple.fr', false], ['bob@exemple.fr', true]]));
  });
});
