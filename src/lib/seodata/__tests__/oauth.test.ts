/**
 * Connexion Google Search Console de bout en bout, contre de faux serveurs Google locaux :
 * démarrage → retour (état + nonce) → jetons chiffrés → choix de la propriété → import 16 mois → vue d'ensemble →
 * rafraîchissement du jeton → révocation. Plus les refus (état falsifié, autre navigateur, état expiré, démo).
 */
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { BusinessRecord } from '@/lib/db';
import { startFakeServer, type FakeServer } from './fake-server';

const DATA = mkdtempSync(path.join(os.tmpdir(), 'seodata-oauth-'));
process.env.DATA_DIR = DATA;

const BIZ: BusinessRecord = {
  id: 'biz-oauth', name: 'Exemple', trade: 'logiciel', city: 'Paris', website: 'https://exemple.fr', plan: 'accompagne', segment: 'pme', planId: null,
  lastScore: null, createdAt: '2026-01-01T00:00:00Z', ownerId: 'u1', isActive: true, alertThreshold: 5,
};

vi.mock('@/lib/auth', async (orig) => {
  const real = await orig<typeof import('@/lib/auth')>();
  return {
    ...real,
    requireBusiness: vi.fn(async (_req: Request, id: string, opts: { write?: boolean } = {}) => {
      const { isDemoBusinessId } = await import('@/lib/demo-v2');
      if (isDemoBusinessId(id)) {
        if (opts.write) throw new real.HttpError(403, 'Compte de démonstration', 'demo_read_only');
        const { getBusinessRecord } = await import('@/lib/db');
        return { business: await getBusinessRecord(id), role: 'demo', session: null };
      }
      if (id !== BIZ.id) throw new real.HttpError(404);
      return { business: BIZ, role: 'owner', session: null };
    }),
  };
});

const GSC_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
let s: FakeServer;
let tokenMode: 'ok' | 'invalid_grant' = 'ok';

beforeAll(async () => {
  s = await startFakeServer();
  process.env.GOOGLE_CLIENT_ID = 'client-id.apps.googleusercontent.com';
  process.env.GOOGLE_CLIENT_SECRET = 'client-secret';
  process.env.NEXT_PUBLIC_APP_URL = 'https://app.test';
  const { setSeoDataEndpoints } = await import('../http');
  setSeoDataEndpoints({
    googleAuth: `${s.url}/o/oauth2/v2/auth`,
    googleToken: `${s.url}/token`,
    googleRevoke: `${s.url}/revoke`,
    webmasters: `${s.url}/webmasters/v3`,
    searchconsole: `${s.url}/v1`,
  });
  // Jetons (https://oauth2.googleapis.com/token)
  s.on('POST', '/token', (r) => {
    const f = new URLSearchParams(r.body);
    expect(f.get('client_id')).toBe('client-id.apps.googleusercontent.com');
    expect(f.get('client_secret')).toBe('client-secret');
    if (f.get('grant_type') === 'authorization_code') {
      if (f.get('code') !== 'CODE-OK') return { status: 400, json: { error: 'invalid_grant', error_description: 'Malformed auth code.' } };
      expect(f.get('redirect_uri')).toBe('https://app.test/api/v5/connect/google/callback');
      return { json: { access_token: 'ya29.ACCESS-1', expires_in: 3599, refresh_token: '1//REFRESH-SECRET', scope: GSC_SCOPE, token_type: 'Bearer' } };
    }
    if (tokenMode === 'invalid_grant') return { status: 400, json: { error: 'invalid_grant', error_description: 'Token has been expired or revoked.' } };
    expect(f.get('refresh_token')).toBe('1//REFRESH-SECRET');
    return { json: { access_token: 'ya29.ACCESS-2', expires_in: 3599, scope: GSC_SCOPE, token_type: 'Bearer' } };
  });
  s.on('POST', '/revoke', () => ({ json: {} }));
  s.on('GET', '/webmasters/v3/sites', (r) => {
    expect(r.headers.authorization).toMatch(/^Bearer ya29\./);
    return { json: { siteEntry: [{ siteUrl: 'sc-domain:exemple.fr', permissionLevel: 'siteOwner' }, { siteUrl: 'https://autre.fr/', permissionLevel: 'siteFullUser' }, { siteUrl: 'https://pasverifie.fr/', permissionLevel: 'siteUnverifiedUser' }] } };
  });
  s.on('GET', /\/webmasters\/v3\/sites\/.+\/sitemaps$/, () => ({
    json: { sitemap: [{ path: 'https://exemple.fr/sitemap.xml', lastSubmitted: '2026-10-01T10:00:00Z', isPending: false, isSitemapsIndex: false, lastDownloaded: '2026-11-11T03:00:00Z', warnings: '0', errors: '1', contents: [{ type: 'web', submitted: '120', indexed: '0' }] }] },
  }));
  // searchanalytics.query : réponse selon les dimensions demandées
  s.on('POST', /\/webmasters\/v3\/sites\/.+\/searchAnalytics\/query$/, (r) => {
    expect(r.path).toContain('/sites/sc-domain:exemple.fr/');
    const b = r.json as { startDate: string; endDate: string; dimensions: string[]; rowLimit: number; startRow: number; dataState: string };
    expect(b.dataState).toBe('final');
    expect(b.rowLimit).toBeLessThanOrEqual(25_000);
    const dims = b.dimensions.join(',');
    if (dims === 'date') {
      const rows = [];
      for (let d = new Date(`${b.startDate}T00:00:00Z`); d <= new Date(`${b.endDate}T00:00:00Z`); d = new Date(d.getTime() + 86_400_000)) {
        rows.push({ keys: [d.toISOString().slice(0, 10)], clicks: 10, impressions: 200, ctr: 0.05, position: 12.3 });
      }
      return { json: { rows, responseAggregationType: 'byProperty' } };
    }
    if (dims === 'query') return { json: { rows: [{ keys: ['logiciel paie'], clicks: 40, impressions: 900, ctr: 0.0444, position: 8.2 }, { keys: ['paie pme'], clicks: 5, impressions: 400, ctr: 0.0125, position: 14.6 }] } };
    if (dims === 'page') return { json: { rows: [{ keys: ['https://exemple.fr/'], clicks: 45, impressions: 1300, ctr: 0.0346, position: 10.1 }] } };
    if (dims === 'device') return { json: { rows: [{ keys: ['MOBILE'], clicks: 30, impressions: 700, ctr: 0.04, position: 11 }] } };
    if (dims === 'country') return { json: { rows: [{ keys: ['fra'], clicks: 44, impressions: 1250, ctr: 0.035, position: 10 }] } };
    if (dims === 'query,page') return { json: { rows: [{ keys: ['paie pme', 'https://exemple.fr/'], clicks: 5, impressions: 400, ctr: 0.0125, position: 14.6 }] } };
    return { json: {} };
  });
});

afterAll(async () => {
  const { setSeoDataEndpoints } = await import('../http');
  setSeoDataEndpoints(null);
  await s.close();
});

const get = (p: string, headers: Record<string, string> = {}) => new Request(`https://app.test${p}`, { headers });
const post = (p: string, body: unknown) => new Request(`https://app.test${p}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

describe('OAuth Google Search Console (simulation complète)', () => {
  let state = '';
  let nonce = '';

  it('démarrage : URL de consentement (lecture seule, hors ligne) + cookie HttpOnly du nonce', async () => {
    const { GET } = await import('@/app/api/v5/connect/google/start/route');
    const res = await GET(get('/api/v5/connect/google/start?businessId=biz-oauth'));
    expect(res.status).toBe(200);
    const { url } = (await res.json()) as { url: string };
    const u = new URL(url);
    expect(u.searchParams.get('scope')).toBe(GSC_SCOPE);
    expect(u.searchParams.get('access_type')).toBe('offline');
    expect(u.searchParams.get('redirect_uri')).toBe('https://app.test/api/v5/connect/google/callback');
    state = u.searchParams.get('state')!;
    const cookie = res.headers.get('set-cookie')!;
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Path=\/api\/v5\/connect\/google/);
    nonce = cookie.match(/repere_gsc_nonce=([^;]+)/)![1];
    expect(state).not.toContain(nonce);
  });

  it('retour refusé : état falsifié, autre navigateur (sans nonce), état expiré', async () => {
    const { GET } = await import('@/app/api/v5/connect/google/callback/route');
    const cb = (st: string, ck?: string) => GET(get(`/api/v5/connect/google/callback?code=CODE-OK&state=${encodeURIComponent(st)}`, ck ? { cookie: ck } : {}));
    expect((await cb(state)).headers.get('location')).toBe('https://app.test/app/seo?gsc=invalid_state');
    expect((await cb(`${state.slice(0, -2)}xx`, `repere_gsc_nonce=${nonce}`)).headers.get('location')).toMatch(/invalid_state/);
    expect((await cb(state, 'repere_gsc_nonce=AUTRE-NONCE-DU-NAVIGATEUR')).headers.get('location')).toMatch(/invalid_state/);
    const { signState } = await import('../google-oauth');
    expect((await cb(signState('biz-oauth', nonce, Date.now() - 11 * 60_000), `repere_gsc_nonce=${nonce}`)).headers.get('location')).toMatch(/invalid_state/);
    // refus de l'utilisateur chez Google
    const denied = await GET(get(`/api/v5/connect/google/callback?error=access_denied&state=${encodeURIComponent(state)}`, { cookie: `repere_gsc_nonce=${nonce}` }));
    expect(denied.headers.get('location')).toMatch(/gsc=denied/);
  });

  it('retour accepté : jetons chiffrés au repos, propriétés vérifiées listées, choix demandé', async () => {
    const { GET } = await import('@/app/api/v5/connect/google/callback/route');
    const res = await GET(get(`/api/v5/connect/google/callback?code=CODE-OK&state=${encodeURIComponent(state)}`, { cookie: `repere_gsc_nonce=${nonce}` }));
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('https://app.test/app/seo?gsc=choose_property');
    expect(res.headers.get('set-cookie')).toMatch(/Max-Age=0/);
    const { getConnection } = await import('../google-oauth');
    const c = (await getConnection('biz-oauth'))!;
    expect(c.sites.map((x) => x.siteUrl)).toEqual(['sc-domain:exemple.fr', 'https://autre.fr/']);
    expect(c.siteUrl).toBeNull();
    // aucun jeton en clair, ni en mémoire ni sur disque
    expect(JSON.stringify(c)).not.toContain('REFRESH-SECRET');
    expect(JSON.stringify(c)).not.toContain('ACCESS-1');
    await new Promise((r) => setTimeout(r, 50));
    const files = readdirSync(DATA).filter((f) => f.startsWith('doc-seodata'));
    for (const f of files) expect(readFileSync(path.join(DATA, f), 'utf8')).not.toContain('REFRESH-SECRET');
    // la vue publique ne contient aucun jeton
    const { GET: props } = await import('@/app/api/v5/connect/google/properties/route');
    const view = await (await props(get('/api/v5/connect/google/properties?businessId=biz-oauth'))).text();
    expect(view).not.toMatch(/Enc|REFRESH|ACCESS/);
  });

  it('choix de la propriété → import des 16 mois → vue d’ensemble', async () => {
    const { POST } = await import('@/app/api/v5/connect/google/properties/route');
    expect((await POST(post('/api/v5/connect/google/properties', { businessId: 'biz-oauth', siteUrl: 'https://inconnu.fr/' }))).status).toBe(400);
    s.requests.length = 0;
    const res = await POST(post('/api/v5/connect/google/properties', { businessId: 'biz-oauth', siteUrl: 'sc-domain:exemple.fr' }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { siteUrl: string; import: string; importedAt: string | null };
    expect(body.siteUrl).toBe('sc-domain:exemple.fr');
    expect(body.import).toBe('queued'); // seodata.* dans JOB_TYPES (INTEGRATION-V5) : file mémoire, exécutée aussitôt
    const q = s.requests.filter((r) => r.path.endsWith('/searchAnalytics/query'));
    // 1 (jours) + 16 mois × 2 (requêtes, pages) + 6 (28 jours) = 39 requêtes
    expect(q).toHaveLength(39);
    const daily = q.find((r) => (r.json as { dimensions: string[] }).dimensions.join() === 'date')!.json as { startDate: string; endDate: string };
    const span = (Date.parse(daily.endDate) - Date.parse(daily.startDate)) / 86_400_000;
    expect(span).toBeGreaterThanOrEqual(16 * 30);
    const { GET } = await import('@/app/api/v5/seodata/search-console/route');
    const o = (await (await GET(get('/api/v5/seodata/search-console?businessId=biz-oauth'))).json()) as Record<string, unknown> & { totals: { clicks: number; impressions: number; position: number }; source: { provider: string; demo: boolean }; topQueries: unknown[]; monthly: unknown[]; sitemaps: { errors: number }[] };
    expect(o.available).toBe(true);
    expect(o.source).toMatchObject({ provider: 'google-search-console', demo: false });
    expect(o.totals).toEqual({ clicks: 280, impressions: 5600, ctr: 0.05, position: 12.3 });
    expect(o.topQueries).toHaveLength(2);
    expect(o.monthly.length).toBeGreaterThanOrEqual(16);
    expect(o.sitemaps[0].errors).toBe(1);
  });

  it('jeton d’accès expiré : rafraîchi avec le jeton de rafraîchissement', async () => {
    const { getConnection, saveConnection, accessToken } = await import('../google-oauth');
    const c = (await getConnection('biz-oauth'))!;
    await saveConnection({ ...c, accessExpiresAt: Date.now() - 1000 });
    expect(await accessToken('biz-oauth')).toBe('ya29.ACCESS-2');
    expect(await accessToken('biz-oauth')).toBe('ya29.ACCESS-2'); // mis en cache (chiffré)
    expect(s.requests.filter((r) => r.path === '/token' && new URLSearchParams(r.body).get('grant_type') === 'refresh_token')).toHaveLength(1);
  });

  it('accès retiré chez Google (invalid_grant) : connexion « révoquée », erreur d’authentification définitive', async () => {
    const { getConnection, saveConnection, accessToken } = await import('../google-oauth');
    const c = (await getConnection('biz-oauth'))!;
    await saveConnection({ ...c, accessExpiresAt: 0 });
    tokenMode = 'invalid_grant';
    const e = await accessToken('biz-oauth').catch((x) => x);
    expect(e.code).toBe('auth');
    expect((await getConnection('biz-oauth'))!.status).toBe('revoked');
    const { toJobError } = await import('../http');
    expect(toJobError(e).name).toBe('PermanentJobError');
    tokenMode = 'ok';
    await saveConnection({ ...(await getConnection('biz-oauth'))!, status: 'active' });
  });

  it('révocation : appel Google /revoke puis suppression de la connexion et des données', async () => {
    const { POST } = await import('@/app/api/v5/connect/google/revoke/route');
    s.requests.length = 0;
    const res = await POST(post('/api/v5/connect/google/revoke', { businessId: 'biz-oauth' }));
    expect(await res.json()).toEqual({ connected: false, revokedAtGoogle: true });
    const rv = s.requests.find((r) => r.path === '/revoke')!;
    expect(rv.query.get('token')).toBe('1//REFRESH-SECRET');
    const { getConnection } = await import('../google-oauth');
    expect(await getConnection('biz-oauth')).toBeNull();
    const { loadStored } = await import('../searchconsole');
    const st = await loadStored('biz-oauth');
    expect(st.daily).toBeNull();
    expect(st.recent).toBeNull();
    expect(st.months).toHaveLength(0);
  });

  it('compte démo : aucune connexion possible ; plateforme sans identifiants Google : 503', async () => {
    const { GET } = await import('@/app/api/v5/connect/google/start/route');
    expect((await GET(get('/api/v5/connect/google/start?businessId=demo'))).status).toBe(403);
    delete process.env.GOOGLE_CLIENT_ID;
    const r = await GET(get('/api/v5/connect/google/start?businessId=biz-oauth'));
    expect(r.status).toBe(503);
    expect(await r.json()).toMatchObject({ enabled: false, code: 'not_configured' });
    process.env.GOOGLE_CLIENT_ID = 'client-id.apps.googleusercontent.com';
  });
});

describe('Search Console : pagination searchanalytics.query (25 000 lignes par appel)', () => {
  it('enchaîne startRow jusqu’à une page incomplète', async () => {
    const { GoogleSearchConsole } = await import('../searchconsole');
    const starts: number[] = [];
    s.on('POST', /\/webmasters\/v3\/sites\/pagination\/searchAnalytics\/query$/, (r) => {
      const b = r.json as { startRow: number; rowLimit: number };
      starts.push(b.startRow);
      const n = b.startRow === 0 ? b.rowLimit : 7;
      return { json: { rows: Array.from({ length: n }, (_, i) => ({ keys: [`q${b.startRow + i}`], clicks: 1, impressions: 2, ctr: 0.5, position: 3 })) } };
    });
    const rows = await new GoogleSearchConsole(async () => 'ya29.T').query('pagination', { startDate: '2026-10-01', endDate: '2026-10-31', dimensions: ['query'] }, 60_000);
    expect(starts).toEqual([0, 25_000]);
    expect(rows).toHaveLength(25_007);
  });
});
