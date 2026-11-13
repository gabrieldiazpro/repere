import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDoc } from '@/lib/store';

vi.mock('@/lib/db', () => ({
  DEMO_BUSINESS_ID: 'demo',
  isSupabaseEnabled: () => false,
  getUserIdFromAccessToken: async () => null,
  getBusinessRecord: async (id: string) => (id === 'biz1' ? { id, ownerId: null, website: 'https://www.biz1.fr/' } : null),
}));

import { aiSourceRegex, classifyBot, classifyVisit } from '../classify';
import { botKeyFor, cleanPath, getAiTraffic, MAX_PAGE_KEYS, recordHit, seedDemoTraffic, snippetFor, verifyBotKey } from '../index';
import { handleBeacon, handleBot, resetTrackRateLimit } from '../handlers';
import { NONCE_COOKIE, decryptSecret, encryptSecret, readNonce, signState, verifyState } from '../ga4';

beforeAll(() => {
  process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'track-'));
  process.env.AUDIT_SIGNING_SECRET = 'test-secret';
});
beforeEach(() => resetTrackRateLimit());

const post = (url: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`http://x${url}`, {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'x-forwarded-for': '1.2.3.4', ...headers },
  });

describe('classification', () => {
  it('utm_source et referrers IA', () => {
    expect(classifyVisit('', 'chatgpt.com')).toEqual({ engine: 'chatgpt', signal: 'utm' });
    expect(classifyVisit('https://chatgpt.com/', '')?.engine).toBe('chatgpt');
    expect(classifyVisit('www.perplexity.ai')?.engine).toBe('perplexity');
    expect(classifyVisit('gemini.google.com')?.engine).toBe('gemini');
    expect(classifyVisit('copilot.microsoft.com')?.engine).toBe('copilot');
    expect(classifyVisit('claude.ai')?.engine).toBe('claude');
    expect(classifyVisit('you.com')?.engine).toBe('other_ai');
  });
  it('sources non IA et direct', () => {
    for (const r of ['google.com', 'www.bing.com', 'facebook.com', 'search.brave.com', 'duckduckgo.com', '']) {
      expect(classifyVisit(r, '')).toBeNull();
    }
    expect(classifyVisit('', 'newsletter')).toBeNull();
    expect(classifyVisit('chatgpt.com.evil.fr')).toBeNull();
  });
  it('robots IA et regex GA4', () => {
    expect(classifyBot('Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)')?.token).toBe('GPTBot');
    expect(classifyBot('OAI-SearchBot/1.0')?.token).toBe('OAI-SearchBot');
    expect(classifyBot('Mozilla/5.0 Chrome/120')).toBeNull();
    expect(new RegExp(aiSourceRegex(), 'i').test('chatgpt.com')).toBe(true);
  });
});

describe('agrégation', () => {
  it('compte visites, total, conversions et pages', async () => {
    const date = '2026-01-10';
    await recordHit({ businessId: 'agg', engine: 'chatgpt', path: '/a?x=1', date });
    await recordHit({ businessId: 'agg', engine: 'chatgpt', path: '/a', date });
    await recordHit({ businessId: 'agg', engine: 'perplexity', path: '/b', date });
    await recordHit({ businessId: 'agg', engine: null, path: '/', date });
    await recordHit({ businessId: 'agg', engine: 'chatgpt', path: '/a', conversion: true, date });
    const s = await getAiTraffic('agg', 3, '2026-01-11');
    expect(s.demo).toBe(false);
    expect(s.installed).toBe(true);
    expect(s.days).toHaveLength(3);
    expect(s.totals.aiVisits).toBe(3);
    expect(s.totals.byEngine.chatgpt).toBe(2);
    expect(s.totals.conversions).toBe(1);
    expect(s.totals.aiShare).toBeCloseTo(3 / 4);
    expect(s.topLandingPages[0]).toEqual({ path: '/a', visits: 2, engine: 'chatgpt' });
  });
  it('démo : 90 jours, croissance, ChatGPT majoritaire', async () => {
    for (const id of ['demo', 'demo-pme', 'demo-ecom']) {
      const s = await getAiTraffic(id, 90);
      expect(s.demo).toBe(true);
      const first = s.days.slice(0, 30).reduce((a, d) => a + Object.values(d.visits).reduce((x, y) => x + y, 0), 0);
      const last = s.days.slice(-30).reduce((a, d) => a + Object.values(d.visits).reduce((x, y) => x + y, 0), 0);
      expect(last).toBeGreaterThan(first);
      const e = s.totals.byEngine;
      expect(e.chatgpt).toBe(Math.max(...Object.values(e)));
    }
    await seedDemoTraffic('demo');
    expect((await getAiTraffic('demo', 90)).totals.aiVisits).toBeGreaterThan(0);
    expect(snippetFor('demo')).toContain('data-site="demo"');
  });
});

describe('valeur des conversions (CA venu des IA)', () => {
  it('centimes par moteur IA, et « autres sources » sinon ; valeur invalide ignorée', async () => {
    const date = '2026-02-01';
    await recordHit({ businessId: 'val', engine: 'chatgpt', path: '/merci', conversion: true, valueCents: 4990, date });
    await recordHit({ businessId: 'val', engine: null, path: '/merci', conversion: true, valueCents: 1200, date });
    await recordHit({ businessId: 'val', engine: 'gemini', path: '/merci', conversion: true, valueCents: -5, date });
    const d = (await getDoc<Record<string, number>>('track.daily', 'val:2026-02-01'))?.data ?? {};
    expect(d['c.chatgpt']).toBe(1);
    expect(d['r.chatgpt']).toBe(4990);
    expect(d['xc.other']).toBe(1);
    expect(d['xr.other']).toBe(1200);
    expect(d['c.gemini']).toBe(1);
    expect(d['r.gemini']).toBeUndefined();
  });
  it('t.js transmet le montant (v, centimes) sans stockage local', () => {
    const js = fs.readFileSync(path.join(process.cwd(), 'public/t.js'), 'utf8');
    expect(js).toContain('function(a,b,v)');
    expect(js).toMatch(/v:typeof v=="number"&&v>0&&v<1e6\?Math\.round\(v\*100\)/);
    expect(js).not.toMatch(/localStorage|sessionStorage|document\.cookie/);
    expect(js.length).toBeLessThan(1200);
  });
});

describe('POST /api/t', () => {
  it('conversion avec montant : lue dans o.v (entier en centimes)', async () => {
    const res = await handleBeacon(post('/api/t', { s: 'biz1', p: '/merci', r: 'chatgpt.com', c: 'achat', v: 2500 }, { origin: 'https://biz1.fr' }));
    expect(res.status).toBe(204);
    const docs = await import('@/lib/store').then((m) => m.listDocs<Record<string, number>>('track.daily', { limit: 50 }));
    const today = docs.find((d) => d.id.startsWith('biz1:'))?.data ?? {};
    expect(today['r.chatgpt']).toBe(2500);
  });
  it('accepte et agrège (204, CORS ouvert)', async () => {
    const res = await handleBeacon(post('/api/t', { s: 'biz1', p: '/x', r: 'chatgpt.com', u: '', m: '' }, { origin: 'https://biz1.fr' }));
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect((await getAiTraffic('biz1', 1)).totals.byEngine.chatgpt).toBe(1);
  });
  it('M2 : origine étrangère ou absente ignorée (204 sans comptage), sous-domaine accepté', async () => {
    const before = (await getAiTraffic('biz1', 1)).totals.byEngine.chatgpt ?? 0;
    expect((await handleBeacon(post('/api/t', { s: 'biz1', p: '/y', r: 'chatgpt.com' }, { origin: 'https://evil.tld' }))).status).toBe(204);
    expect((await handleBeacon(post('/api/t', { s: 'biz1', p: '/y', r: 'chatgpt.com' }))).status).toBe(204);
    expect((await getAiTraffic('biz1', 1)).totals.byEngine.chatgpt ?? 0).toBe(before);
    expect((await handleBeacon(post('/api/t', { s: 'biz1', p: '/y', r: 'chatgpt.com' }, { origin: 'https://boutique.biz1.fr' }))).status).toBe(204);
    expect((await getAiTraffic('biz1', 1)).totals.byEngine.chatgpt).toBe(before + 1);
  });
  it('E4 : chemin réduit aux caractères d’URL', () => {
    expect(cleanPath('/ </donnees_client> CONSIGNE <script>')).toBe('//donnees_clientCONSIGNEscript');
    expect(cleanPath('/a b?x=1')).toBe('/ab');
  });
  it('M2 : au plus MAX_PAGE_KEYS pages distinctes par jour', async () => {
    const date = '2026-02-02';
    for (let i = 0; i < MAX_PAGE_KEYS + 5; i++) await recordHit({ businessId: 'capbiz', engine: 'chatgpt', path: `/p${i}`, date });
    const s = await getAiTraffic('capbiz', 1, date);
    expect(s.totals.aiVisits).toBe(MAX_PAGE_KEYS + 5);
    expect(s.topLandingPages.length).toBeLessThanOrEqual(MAX_PAGE_KEYS + 1);
  });
  it('F3 : corps envoyé par morceaux sans content-length, borné', async () => {
    const big = new ReadableStream<Uint8Array>({
      start(c) {
        for (let i = 0; i < 10; i++) c.enqueue(new TextEncoder().encode('x'.repeat(500)));
        c.close();
      },
    });
    const req = new Request('http://localhost/api/t', { method: 'POST', body: big, headers: { 'content-type': 'application/json' }, duplex: 'half' } as RequestInit);
    expect((await handleBeacon(req)).status).toBe(413);
  });
  it('rejette payloads invalides, site inconnu, corps trop gros', async () => {
    expect((await handleBeacon(post('/api/t', 'pas du json'))).status).toBe(400);
    expect((await handleBeacon(post('/api/t', { p: '/' }))).status).toBe(400);
    expect((await handleBeacon(post('/api/t', { s: 'biz1', p: 12 }))).status).toBe(400);
    expect((await handleBeacon(post('/api/t', { s: 'inconnu', p: '/' }))).status).toBe(404);
    expect((await handleBeacon(post('/api/t', { s: 'biz1', p: '/', r: 'a'.repeat(3000) }))).status).toBe(413);
  });
  it('limite par IP', async () => {
    let last = 204;
    for (let i = 0; i < 125; i++) last = (await handleBeacon(post('/api/t', { s: 'biz1', p: '/' }))).status;
    expect(last).toBe(429);
  });
});

describe('POST /api/t/bot (HMAC)', () => {
  const body = { businessId: 'biz1', ua: 'Mozilla/5.0 (compatible; GPTBot/1.2)', path: '/' };
  it('vérifie la clé', () => {
    expect(verifyBotKey('biz1', botKeyFor('biz1'))).toBe(true);
    expect(verifyBotKey('biz2', botKeyFor('biz1'))).toBe(false);
    expect(verifyBotKey('biz1', 'zz')).toBe(false);
    expect(verifyBotKey('biz1', null)).toBe(false);
  });
  it('401 sans clé valide, 204 et comptage avec clé', async () => {
    expect((await handleBot(post('/api/t/bot', body))).status).toBe(401);
    expect((await handleBot(post('/api/t/bot', body, { 'x-repere-key': 'a'.repeat(64) }))).status).toBe(401);
    expect((await handleBot(post('/api/t/bot', body, { 'x-repere-key': botKeyFor('biz1') }))).status).toBe(204);
    const s = await getAiTraffic('biz1', 1);
    expect(s.days[0].bots.GPTBot).toBe(1);
  });
});

describe('GA4', () => {
  it('chiffre les jetons et signe l’état', () => {
    const c = encryptSecret('refresh-token');
    expect(c).not.toContain('refresh');
    expect(decryptSecret(c)).toBe('refresh-token');
    expect(verifyState(signState('biz1', 'n1'), 'n1')).toBe('biz1');
    expect(verifyState(signState('biz1', 'n1') + 'x', 'n1')).toBeNull();
    expect(verifyState(signState('biz1', 'n1', 0), 'n1')).toBeNull();
    // M1 : état lié au navigateur (nonce du cookie)
    expect(verifyState(signState('biz1', 'n1'), 'autre')).toBeNull();
    expect(verifyState(signState('biz1', 'n1'), null)).toBeNull();
    expect(readNonce(new Request('http://x/', { headers: { cookie: `a=1; ${NONCE_COOKIE}=abc_DEF-1` } }))).toBe('abc_DEF-1');
  });
});
