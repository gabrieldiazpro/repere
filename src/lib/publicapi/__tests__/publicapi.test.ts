/**
 * API publique (V8) : clés hachées, isolation entre espaces, droits et offres, pagination, erreurs, OpenAPI, MCP,
 * webhooks. Base locale en mémoire (aucun réseau, aucun Supabase).
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.setConfig({ testTimeout: 60_000 });
const dir = mkdtempSync(path.join(tmpdir(), 'repere-papi-'));
process.env.DATA_DIR = dir;
(globalThis as { __repereDocsDir?: string }).__repereDocsDir = dir;
for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_SUPABASE_URL', 'PUBLIC_API_KEY_PEPPER', 'PUBLIC_MCP_ALLOWED_ORIGINS']) delete process.env[k];
process.env.NEXT_PUBLIC_APP_URL = 'https://app.exemple.fr';

const db = await import('@/lib/db');
const { createMockAudit } = await import('@/lib/engine');
const { getDoc, listDocs } = await import('@/lib/store');
const keys = await import('../keys');
const { handlePublicApi } = await import('../router');
const { handleMcp, TOOLS, decodeHeaderValue } = await import('../mcp');
const { buildOpenApi } = await import('../openapi');
const { ROUTES, matchPath } = await import('../routes');
const { decodeCursor, encodeCursor, paginate, parsePage } = await import('../pagination');
const { scoreDropBeyondMargin, extraWebhookEvents } = await import('../webhooks');
const { apiAllowed } = await import('../access');
const { createPrompt } = await import('@/lib/prompts/repo');
const { resetRateLimit } = await import('@/lib/ratelimit');

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- corps JSON lus librement dans les tests
type Json = Record<string, any>;
const U1 = '11111111-1111-4111-8111-111111111111';
const U2 = '22222222-2222-4222-8222-222222222222';
const U3 = '33333333-3333-4333-8333-333333333333';

type B = Awaited<ReturnType<typeof db.createBusiness>>;
let A: B, Bz: B, C: B, D: B, E: B, Low: B;
let tokA = '', tokARead = '', tokAgency = '', tokLow = '', tokB = '';
let promptB = '';

async function seed(name: string, plan: 'accompagne' | 'agency' | 'essentiel', owner: string, audits = 1): Promise<B> {
  const b = await db.createBusiness({ name, trade: 'plombier', city: 'Lyon', plan, ownerId: owner, contactEmail: 'contact@exemple.fr' });
  await db.addMembership(b.id, owner, 'owner');
  for (let i = 0; i < audits; i++) await db.saveAudit(createMockAudit({ businessName: name, trade: 'plombier', city: 'Lyon' }, `${name}-${i}`), { businessId: b.id, trigger: 'manual' });
  return b;
}

function req(pathname: string, token: string | null, init: RequestInit = {}): Request {
  const h = new Headers(init.headers);
  if (token) h.set('authorization', `Bearer ${token}`);
  return new Request(`https://app.exemple.fr/api/public${pathname}`, { ...init, headers: h });
}
async function call(pathname: string, token: string | null, init: RequestInit = {}) {
  const segs = new URL(`https://x${pathname.split('?')[0]}`).pathname.split('/').filter(Boolean).map(decodeURIComponent);
  const res = await handlePublicApi(req(pathname, token, init), segs);
  const text = await res.text();
  return { res, status: res.status, body: text ? (JSON.parse(text) as Json) : null };
}

beforeAll(async () => {
  A = await seed('Plomberie Alpha', 'accompagne', U1);
  Bz = await seed('Plomberie Bravo', 'accompagne', U2);
  C = await seed('Client Charlie', 'agency', U3);
  D = await seed('Client Delta', 'agency', U3);
  E = await seed('Perso Echo', 'essentiel', U3); // même utilisateur, hors offre Agence
  Low = await seed('Essentiel Foxtrot', 'essentiel', U1);
  tokA = (await keys.createApiKey({ scope: { kind: 'space', businessId: A.id }, access: 'write', label: 'Écriture A', createdBy: { userId: U1, email: 'a@exemple.fr' } })).token;
  tokARead = (await keys.createApiKey({ scope: { kind: 'space', businessId: A.id }, access: 'read', label: 'Lecture A', createdBy: { userId: U1 } })).token;
  tokB = (await keys.createApiKey({ scope: { kind: 'space', businessId: Bz.id }, access: 'write', createdBy: { userId: U2 } })).token;
  tokAgency = (await keys.createApiKey({ scope: { kind: 'agency', userId: U3 }, access: 'read', createdBy: { userId: U3 } })).token;
  tokLow = (await keys.createApiKey({ scope: { kind: 'space', businessId: Low.id }, access: 'read', createdBy: { userId: U1 } })).token;
  promptB = (await createPrompt(Bz, { text: 'Quel plombier choisir à Lyon pour une fuite ?' })).id;
  await createPrompt(A, { text: 'Plombier de confiance à Lyon ?' });
});

describe('clés d’API', () => {
  it('format, empreinte et comparaison en temps constant', async () => {
    const g = keys.generateKey();
    expect(g.token).toMatch(keys.KEY_RE);
    expect(keys.parseKey(g.token)).toEqual({ kind: 'live', id: g.id, secret: g.secret });
    expect(keys.parseKey('rp_live_court')).toBeNull();
    expect(keys.parseKey(keys.DEMO_API_KEY)?.kind).toBe('demo');
    expect(keys.hashSecret(g.id, g.secret)).toHaveLength(64);
    expect(keys.hashSecret(g.id, g.secret)).not.toContain(g.secret);
    expect(keys.safeEqual('abc', 'abc')).toBe(true);
    expect(keys.safeEqual('abc', 'abd')).toBe(false);
    expect(keys.safeEqual('abc', 'abcd')).toBe(false);
  });

  it('stocke seulement l’empreinte, jamais le jeton', async () => {
    const p = keys.parseKey(tokA)!;
    const doc = await getDoc<Record<string, unknown>>(keys.KEYS_COLLECTION, p.id);
    expect(JSON.stringify(doc)).not.toContain(p.secret);
    expect(doc?.data.hash).toBe(keys.hashSecret(p.id, p.secret));
    const list = await keys.listApiKeys({ kind: 'space', businessId: A.id });
    expect(list.map((k) => k.label)).toEqual(expect.arrayContaining(['Écriture A', 'Lecture A']));
    expect(JSON.stringify(list)).not.toContain(p.secret);
    expect(JSON.stringify(list)).not.toContain('hash');
  });

  it('refuse un secret faux, une clé inconnue, une clé révoquée', async () => {
    const p = keys.parseKey(tokA)!;
    expect(await keys.verifyApiKey(`rp_live_${p.id}_${'x'.repeat(43)}`)).toBeNull();
    expect(await keys.verifyApiKey(`rp_live_zzzzzzzzzzzz_${p.secret}`)).toBeNull();
    const { token, key } = await keys.createApiKey({ scope: { kind: 'space', businessId: A.id }, access: 'read', createdBy: { userId: U1 } });
    expect(await keys.verifyApiKey(token)).not.toBeNull();
    // Révocation par un autre espace : refusée.
    expect(await keys.revokeApiKey({ kind: 'space', businessId: Bz.id }, key.id, 'x')).toBe(false);
    expect(await keys.revokeApiKey({ kind: 'space', businessId: A.id }, key.id, 'a@exemple.fr')).toBe(true);
    expect(await keys.verifyApiKey(token)).toBeNull();
    const r = await call('/v1/me', token);
    expect(r.status).toBe(401);
    expect(r.res.headers.get('www-authenticate')).toMatch(/Bearer/);
  });

  it('borne le nombre de clés actives', async () => {
    const scope = { kind: 'space' as const, businessId: Bz.id };
    for (let i = (await keys.listApiKeys(scope)).length; i < keys.MAX_ACTIVE_KEYS; i++) await keys.createApiKey({ scope, access: 'read', createdBy: { userId: U2 } });
    await expect(keys.createApiKey({ scope, access: 'read', createdBy: { userId: U2 } })).rejects.toThrow(/au maximum/);
  });
});

describe('isolation entre espaces', () => {
  it('une clé d’espace ne voit que son espace', async () => {
    const r = await call('/v1/spaces', tokA);
    expect(r.status).toBe(200);
    expect(r.body!.data.map((s: { id: string }) => s.id)).toEqual([A.id]);
    for (const p of ['', '/scores', '/scores/history', '/questions', '/competitors', '/sources', '/findings', '/priorities', '/proposals', '/reports', '/measurements']) {
      const x = await call(`/v1/spaces/${Bz.id}${p}`, tokA);
      expect(x.status, p).toBe(404);
      expect(x.body!.error.code).toBe('not_found');
      expect(JSON.stringify(x.body)).not.toContain('Bravo');
    }
  });

  it('un espace inexistant et un espace d’autrui répondent pareil (pas d’oracle)', async () => {
    const other = await call(`/v1/spaces/${Bz.id}`, tokA);
    const none = await call('/v1/spaces/inexistant-123', tokA);
    expect(other.status).toBe(none.status);
    expect(other.body!.error.message).toBe(none.body!.error.message);
  });

  it('impossible de lire ou supprimer la question d’un autre espace via son propre espace', async () => {
    expect((await call(`/v1/spaces/${A.id}/questions/${promptB}`, tokA)).status).toBe(404);
    expect((await call(`/v1/spaces/${A.id}/questions/${promptB}/answers`, tokA)).status).toBe(404);
    expect((await call(`/v1/spaces/${A.id}/questions/${promptB}`, tokA, { method: 'DELETE' })).status).toBe(404);
    expect((await call(`/v1/spaces/${Bz.id}/questions/${promptB}`, tokB)).status).toBe(200);
  });

  it('une mesure d’un autre espace n’est pas lisible par measurementId', async () => {
    const bAudit = (await db.listAuditsForBusiness(Bz.id))[0];
    const qa = (await call(`/v1/spaces/${A.id}/questions`, tokA)).body!.data[0];
    const r = await call(`/v1/spaces/${A.id}/questions/${qa.id}/answers?measurementId=${bAudit.id}`, tokA);
    expect(r.status).toBe(404);
  });

  it('clé d’agence : seulement les espaces en offre Agence de son créateur', async () => {
    const r = await call('/v1/spaces', tokAgency);
    expect(r.body!.data.map((s: { id: string }) => s.id).sort()).toEqual([C.id, D.id].sort());
    expect((await call(`/v1/spaces/${E.id}`, tokAgency)).status).toBe(404);
    expect((await call(`/v1/spaces/${A.id}`, tokAgency)).status).toBe(404);
    expect((await call(`/v1/spaces/${C.id}/scores`, tokAgency)).status).toBe(200);
  });

  it('le créateur qui perd son rôle d’administrateur perd la clé', async () => {
    const X = await seed('Espace Golf', 'accompagne', U2, 0);
    const t = (await keys.createApiKey({ scope: { kind: 'space', businessId: X.id }, access: 'read', createdBy: { userId: U1 } })).token;
    await db.addMembership(X.id, U1, 'admin');
    expect((await call('/v1/me', t)).status).toBe(200);
    await db.removeMembership(X.id, U1);
    expect((await call('/v1/me', t)).status).toBe(401);
    await db.addMembership(X.id, U1, 'viewer');
    expect((await call('/v1/me', t)).status).toBe(401);
  });
});

describe('offres et droits', () => {
  it('réservée à Accompagné, Agence et démo', async () => {
    expect(apiAllowed({ tier: 'accompagne' })).toBe(true);
    expect(apiAllowed({ tier: 'agence' })).toBe(true);
    expect(apiAllowed({ tier: 'demo' })).toBe(true);
    expect(apiAllowed({ tier: 'essentiel' })).toBe(false);
    expect(apiAllowed({ tier: 'decouverte' })).toBe(false);
    const r = await call('/v1/spaces', tokLow);
    expect(r.status).toBe(402);
    expect(r.body!.error.code).toBe('plan_required');
  });

  it('clé en lecture seule : écritures refusées (403)', async () => {
    const r = await call(`/v1/spaces/${A.id}/questions`, tokARead, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: 'Une question en lecture seule ?' }) });
    expect(r.status).toBe(403);
    expect(r.body!.error.code).toBe('insufficient_scope');
  });

  it('écritures sûres : ajouter puis supprimer une question', async () => {
    const r = await call(`/v1/spaces/${A.id}/questions`, tokA, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: 'Quel plombier ouvert le dimanche à Lyon ?' }) });
    expect(r.status).toBe(201);
    const id = r.body!.data.id as string;
    expect(r.body!.data.text).toMatch(/dimanche/);
    const dup = await call(`/v1/spaces/${A.id}/questions`, tokA, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: 'Quel plombier ouvert le dimanche à Lyon ?' }) });
    expect(dup.status).toBe(409);
    expect(dup.body!.error.code).toBe('conflict');
    const del = await call(`/v1/spaces/${A.id}/questions/${id}`, tokA, { method: 'DELETE' });
    expect(del.status).toBe(200);
    expect((await call(`/v1/spaces/${A.id}/questions/${id}`, tokA)).status).toBe(404);
  });

  it('corps invalide : 400 propre', async () => {
    const r = await call(`/v1/spaces/${A.id}/questions`, tokA, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: 'x' });
    expect(r.status).toBe(400);
    const r2 = await call(`/v1/spaces/${A.id}/questions`, tokA, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' });
    expect(r2.body!.error.code).toBe('invalid_request');
    const r3 = await call(`/v1/spaces/${A.id}/questions`, tokA, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    expect(r3.status).toBe(400);
  });

  it('nouvelle mesure : bornée par l’offre', async () => {
    const W = await seed('Espace Hotel', 'accompagne', U1, 2); // deux mesures récentes
    const t = (await keys.createApiKey({ scope: { kind: 'space', businessId: W.id }, access: 'write', createdBy: { userId: U1 } })).token;
    const r = await call(`/v1/spaces/${W.id}/measurements`, t, { method: 'POST' });
    expect(r.status).toBe(402);
    expect(r.body!.error.code).toBe('quota_exceeded');
    expect(r.body!.error.details.nextAllowedAt).toBeTruthy();
    const Y = await seed('Espace India', 'accompagne', U1, 1);
    const t2 = (await keys.createApiKey({ scope: { kind: 'space', businessId: Y.id }, access: 'write', createdBy: { userId: U1 } })).token;
    const ok = await call(`/v1/spaces/${Y.id}/measurements`, t2, { method: 'POST' });
    expect(ok.status).toBe(202);
    expect(ok.body!.data.status).toBe('queued');
  });
});

describe('clé de démonstration', () => {
  it('lit les comptes démo, étiquetés, et rien d’autre', async () => {
    const r = await call('/v1/spaces', keys.DEMO_API_KEY);
    expect(r.status).toBe(200);
    expect(r.body!.data.map((s: { id: string }) => s.id)).toEqual(['demo', 'demo-pme', 'demo-ecom']);
    expect(r.body!.data.every((s: { demo: boolean }) => s.demo)).toBe(true);
    expect(r.res.headers.get('x-repere-demo')).toBe('true');
    expect((await call(`/v1/spaces/${A.id}`, keys.DEMO_API_KEY)).status).toBe(404);
    const s = await call('/v1/spaces/demo/scores', keys.DEMO_API_KEY);
    expect(s.body!.data.aiVisibility.demo).toBe(true);
    expect(s.body!.data.aiVisibility.score.low).toBeLessThanOrEqual(s.body!.data.aiVisibility.score.value);
    expect(s.body!.data.seo.demo).toBe(true);
  });

  it('écritures refusées', async () => {
    const r = await call('/v1/spaces/demo/measurements', keys.DEMO_API_KEY, { method: 'POST' });
    expect(r.status).toBe(403);
    expect(r.body!.error.code).toBe('demo_read_only');
  });

  it('données lisibles : questions avec marges, concurrents, constats, propositions, rapports', async () => {
    const q = await call('/v1/spaces/demo/questions?limit=2', keys.DEMO_API_KEY);
    expect(q.body!.data).toHaveLength(2);
    const pr = q.body!.data.flatMap((x: { latest: { byProvider: { low: number; high: number; rate: number }[] } | null }) => x.latest?.byProvider ?? []);
    for (const p of pr) expect(p.low <= p.rate && p.rate <= p.high).toBe(true);
    const c = await call('/v1/spaces/demo/competitors', keys.DEMO_API_KEY);
    expect(c.body!.data.actors.length).toBeGreaterThan(0);
    const f = await call('/v1/spaces/demo/findings?limit=5', keys.DEMO_API_KEY);
    expect(f.status).toBe(200);
    const pri = f.body!.data.map((x: { priority: number }) => x.priority);
    expect([...pri].sort((a, b) => b - a)).toEqual(pri);
    const props = await call('/v1/spaces/demo/proposals', keys.DEMO_API_KEY);
    expect(props.status).toBe(200);
    for (const x of props.body!.data) expect(x.reviewUrl).toBe('https://app.exemple.fr/app/agent');
    const rep = await call('/v1/spaces/demo/reports', keys.DEMO_API_KEY);
    expect(rep.body!.data[0].kind).toBe('monthly');
  });
});

describe('pagination, erreurs, journal', () => {
  it('curseur opaque lié à la liste', () => {
    const c = encodeCursor(25, '/v1/a');
    expect(decodeCursor(c, '/v1/a')).toBe(25);
    expect(() => decodeCursor(c, '/v1/b')).toThrow(/Curseur/);
    expect(() => decodeCursor('nimporte', '/v1/a')).toThrow();
    const page = paginate([1, 2, 3, 4, 5], parsePage(new URLSearchParams('limit=2'), 's'));
    expect(page.data).toEqual([1, 2]);
    expect(page.pagination).toMatchObject({ total: 5, hasMore: true });
    const p2 = paginate([1, 2, 3, 4, 5], parsePage(new URLSearchParams(`limit=2&cursor=${page.pagination.nextCursor}`), 's'));
    expect(p2.data).toEqual([3, 4]);
    expect(() => parsePage(new URLSearchParams('limit=500'), 's')).toThrow(/limit/);
  });

  it('pagination de bout en bout', async () => {
    const one = await call('/v1/spaces/demo/questions?limit=1', keys.DEMO_API_KEY);
    const next = one.body!.pagination.nextCursor as string;
    const two = await call(`/v1/spaces/demo/questions?limit=1&cursor=${next}`, keys.DEMO_API_KEY);
    expect(two.body!.data[0].id).not.toBe(one.body!.data[0].id);
    const bad = await call(`/v1/spaces/demo/sources?cursor=${next}`, keys.DEMO_API_KEY);
    expect(bad.status).toBe(400);
  });

  it('erreurs : format unique, 401, 404 de route, 405 avec Allow', async () => {
    const r = await call('/v1/spaces', null);
    expect(r.status).toBe(401);
    expect(r.body!.error).toMatchObject({ code: 'unauthorized', status: 401 });
    expect(r.body!.error.requestId).toMatch(/^req_/);
    expect((await call('/v1/inconnu', tokA)).status).toBe(404);
    const m = await call('/v1/spaces', tokA, { method: 'DELETE' });
    expect(m.status).toBe(405);
    expect(m.res.headers.get('allow')).toBe('GET');
    expect((await call('/v1/me', 'pas-une-cle')).status).toBe(401);
  });

  it('journal d’utilisation sans jeton ni corps', async () => {
    await call('/v1/me', tokARead);
    const id = keys.parseKey(tokARead)!.id;
    const log = await getDoc<{ entries: { path: string; status: number }[] }>('publicapi.log', id);
    expect(log?.data.entries[0]).toMatchObject({ path: '/v1/me', status: 200 });
    expect(JSON.stringify(log)).not.toContain(keys.parseKey(tokARead)!.secret);
    const usage = await listDocs<Record<string, number>>('publicapi.usage', { businessId: A.id });
    expect(usage.some((d) => d.id.startsWith(id))).toBe(true);
  });

  it('limite de débit : 429 avec Retry-After', async () => {
    const t = (await keys.createApiKey({ scope: { kind: 'space', businessId: A.id }, access: 'write', createdBy: { userId: U1 } })).token;
    let last = 0;
    for (let i = 0; i < 21; i++) last = (await call(`/v1/spaces/${A.id}/questions/inconnue`, t, { method: 'DELETE' })).status;
    expect(last).toBe(429);
    const r = await call(`/v1/spaces/${A.id}/questions/inconnue`, t, { method: 'DELETE' });
    expect(r.res.headers.get('retry-after')).toBeTruthy();
    expect(r.body!.error.code).toBe('rate_limited');
    resetRateLimit('papi-w');
  });
});

describe('OpenAPI 3.1', () => {
  it('générée depuis la table des routes', async () => {
    const doc = buildOpenApi('https://app.exemple.fr') as Json;
    expect(doc.openapi).toBe('3.1.0');
    expect(doc.servers[0].url).toBe('https://app.exemple.fr/api/public');
    for (const r of ROUTES) {
      const op = doc.paths[r.path][r.method.toLowerCase()];
      expect(op.operationId).toBe(r.operationId);
      expect(op.security).toEqual([{ bearerKey: [] }]);
      const ok = op.responses[String(r.responseStatus ?? 200)];
      expect(ok).toBeTruthy();
      for (const p of r.path.match(/\{(\w+)\}/g) ?? []) expect(op.parameters.some((x: { name: string; in: string }) => x.in === 'path' && `{${x.name}}` === p)).toBe(true);
    }
    // Toutes les références de schémas existent.
    const refs = JSON.stringify(doc).match(/#\/components\/schemas\/\w+/g) ?? [];
    for (const ref of refs) expect(doc.components.schemas[ref.split('/').pop()!], ref).toBeTruthy();
    expect(Object.keys(doc.webhooks)).toEqual(['audit.completed', 'score.dropped', 'proposal.pending']);
    // Aucune route de validation des propositions.
    expect(ROUTES.some((r) => r.method !== 'GET' && /proposals/.test(r.path))).toBe(false);
  });

  it('servie sans clé', async () => {
    const r = await call('/v1/openapi.json', null);
    expect(r.status).toBe(200);
    expect(r.body!.openapi).toBe('3.1.0');
    expect(r.res.headers.get('access-control-allow-origin')).toBe('*');
    expect(matchPath('/v1/spaces/abc/questions/q1')[0].params).toEqual({ spaceId: 'abc', questionId: 'q1' });
  });
});

// ---------------------------------------------------------------------------
// MCP
// ---------------------------------------------------------------------------
const MODERN = '2026-07-28';
function mcpReq(body: unknown, token: string | null, headers: Record<string, string> = {}, method = 'POST'): Request {
  const h = new Headers({ 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...headers });
  if (token) h.set('authorization', `Bearer ${token}`);
  return new Request('https://app.exemple.fr/api/mcp', { method, headers: h, ...(method === 'POST' ? { body: JSON.stringify(body) } : {}) });
}
const meta = { 'io.modelcontextprotocol/protocolVersion': MODERN, 'io.modelcontextprotocol/clientInfo': { name: 'test', version: '1' }, 'io.modelcontextprotocol/clientCapabilities': {} };
function modern(method: string, params: Record<string, unknown> = {}, id = 1) {
  return { jsonrpc: '2.0', id, method, params: { ...params, _meta: meta } };
}
function modernHeaders(method: string, name?: string): Record<string, string> {
  return { 'mcp-protocol-version': MODERN, 'mcp-method': method, ...(name ? { 'mcp-name': name } : {}) };
}
async function mcp(body: unknown, token: string | null, headers: Record<string, string> = {}, method = 'POST') {
  const res = await handleMcp(mcpReq(body, token, headers, method));
  const text = await res.text();
  return { res, status: res.status, body: text ? (JSON.parse(text) as Json) : null };
}

describe('serveur MCP', () => {
  it('client ancien : initialize puis tools/list', async () => {
    const r = await mcp({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'x', version: '1' } } }, keys.DEMO_API_KEY);
    expect(r.status).toBe(200);
    expect(r.body!.result.protocolVersion).toBe('2025-06-18');
    expect(r.body!.result.capabilities.tools).toBeTruthy();
    expect(r.res.headers.get('mcp-session-id')).toBeNull();
    const n = await mcp({ jsonrpc: '2.0', method: 'notifications/initialized' }, keys.DEMO_API_KEY, { 'mcp-protocol-version': '2025-06-18' });
    expect(n.status).toBe(202);
    const l = await mcp({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, keys.DEMO_API_KEY, { 'mcp-protocol-version': '2025-06-18' });
    expect(l.body!.result.tools.map((t: { name: string }) => t.name)).toEqual(TOOLS.map((t) => t.name));
    expect(l.body!.result.resultType).toBeUndefined();
    const v = await mcp({ jsonrpc: '2.0', id: 3, method: 'initialize', params: { protocolVersion: '1999-01-01' } }, keys.DEMO_API_KEY);
    expect(v.body!.result.protocolVersion).toBe('2025-11-25');
  });

  it('client moderne (2026-07-28) : discover, en-têtes obligatoires, erreurs normalisées', async () => {
    const d = await mcp(modern('server/discover'), keys.DEMO_API_KEY, modernHeaders('server/discover'));
    expect(d.body!.result.supportedVersions).toContain(MODERN);
    expect(d.body!.result.resultType).toBe('complete');
    const l = await mcp(modern('tools/list'), keys.DEMO_API_KEY, modernHeaders('tools/list'));
    expect(l.body!.result.resultType).toBe('complete');
    for (const t of l.body!.result.tools) {
      expect(t.inputSchema.type).toBe('object');
      expect(t.annotations.readOnlyHint).toBe(true);
    }
    const miss = await mcp(modern('tools/list'), keys.DEMO_API_KEY, { 'mcp-protocol-version': MODERN });
    expect(miss.status).toBe(400);
    expect(miss.body!.error.code).toBe(-32020);
    const wrong = await mcp(modern('tools/call', { name: 'scores', arguments: { espace: 'demo' } }), keys.DEMO_API_KEY, modernHeaders('tools/call', 'concurrents'));
    expect(wrong.body!.error.code).toBe(-32020);
    const b64 = await mcp(modern('tools/call', { name: 'scores', arguments: { espace: 'demo' } }), keys.DEMO_API_KEY, modernHeaders('tools/call', `=?base64?${Buffer.from('scores').toString('base64')}?=`));
    expect(b64.status).toBe(200);
    const unsupported = await mcp({ ...modern('tools/list'), params: { _meta: { ...meta, 'io.modelcontextprotocol/protocolVersion': '1900-01-01' } } }, keys.DEMO_API_KEY, { ...modernHeaders('tools/list'), 'mcp-protocol-version': '1900-01-01' });
    expect(unsupported.status).toBe(400);
    expect(unsupported.body!.error.code).toBe(-32022);
    expect(unsupported.body!.error.data.supported).toContain(MODERN);
    const unknown = await mcp(modern('resources/list'), keys.DEMO_API_KEY, modernHeaders('resources/list'));
    expect(unknown.status).toBe(404);
    expect(unknown.body!.error.code).toBe(-32601);
    const noMeta = await mcp({ jsonrpc: '2.0', id: 9, method: 'tools/list' }, keys.DEMO_API_KEY, modernHeaders('tools/list'));
    expect(noMeta.body!.error.code).toBe(-32020);
    expect(decodeHeaderValue('=?base64?SGVsbG8sIOS4lueVjA==?=')).toBe('Hello, 世界');
  });

  it('transport : GET/DELETE 405, lots refusés, Origin contrôlée, clé obligatoire', async () => {
    expect((await mcp(null, keys.DEMO_API_KEY, {}, 'GET')).status).toBe(405);
    expect((await mcp(null, keys.DEMO_API_KEY, {}, 'DELETE')).status).toBe(405);
    expect((await mcp([modern('tools/list')], keys.DEMO_API_KEY)).status).toBe(400);
    const evil = await mcp(modern('tools/list'), keys.DEMO_API_KEY, { ...modernHeaders('tools/list'), origin: 'https://attaquant.exemple' });
    expect(evil.status).toBe(403);
    const okOrigin = await mcp(modern('tools/list'), keys.DEMO_API_KEY, { ...modernHeaders('tools/list'), origin: 'https://claude.ai' });
    expect(okOrigin.status).toBe(200);
    const anon = await mcp(modern('tools/list'), null, modernHeaders('tools/list'));
    expect(anon.status).toBe(401);
    expect(anon.res.headers.get('www-authenticate')).toMatch(/Bearer/);
  });

  it('outils : réponses étiquetées démo, marges citées', async () => {
    const call1 = async (name: string, args: Record<string, unknown>) => (await mcp(modern('tools/call', { name, arguments: args }), keys.DEMO_API_KEY, modernHeaders('tools/call', name))).body!.result;
    const list = await call1('lister_espaces', {});
    expect(list.structuredContent.spaces).toHaveLength(3);
    const s = await call1('scores', { espace: 'demo' });
    expect(s.isError).toBe(false);
    expect(s.content[0].text).toMatch(/intervalle à 90 %/);
    expect(s.content[0].text).toMatch(/démonstration/);
    const q = await call1('questions_reponses', { espace: 'demo', limite: 3 });
    expect(q.structuredContent.questions.length).toBeLessThanOrEqual(3);
    const qid = q.structuredContent.questions[0].id;
    const qa = await call1('questions_reponses', { espace: 'demo', question: qid });
    expect(qa.structuredContent.question.id).toBe(qid);
    expect((await call1('priorites', { espace: 'demo-pme' })).isError).toBe(false);
    expect((await call1('concurrents', { espace: 'demo-ecom' })).structuredContent.competitors).toBeTruthy();
    const none = await call1('scores', {});
    expect(none.isError).toBe(true);
    expect(none.content[0].text).toMatch(/indiquez « espace »/);
  });

  it('isolation par MCP : aucun espace hors de la clé', async () => {
    const r = await mcp(modern('tools/call', { name: 'scores', arguments: { espace: Bz.id } }), tokA, modernHeaders('tools/call', 'scores'));
    expect(r.body!.result.isError).toBe(true);
    expect(r.body!.result.content[0].text).toBe('Espace introuvable.');
    const own = await mcp(modern('tools/call', { name: 'scores', arguments: {} }), tokA, modernHeaders('tools/call', 'scores'));
    expect(own.body!.result.isError).toBe(false);
    expect(own.body!.result.content[0].text).toContain('Plomberie Alpha');
    expect(own.body!.result.content[0].text).not.toContain('Bravo');
    const demoFromReal = await mcp(modern('tools/call', { name: 'scores', arguments: { espace: 'demo' } }), tokA, modernHeaders('tools/call', 'scores'));
    expect(demoFromReal.body!.result.isError).toBe(true);
    const unknownTool = await mcp(modern('tools/call', { name: 'valider_proposition', arguments: {} }), tokA, modernHeaders('tools/call', 'valider_proposition'));
    expect(unknownTool.body!.error.code).toBe(-32602);
  });
});

describe('webhooks', () => {
  const a = (score: number, low: number, high: number) => ({ score, range: { low, high } });
  it('baisse au-delà de la marge seulement', () => {
    expect(scoreDropBeyondMargin(null, a(40, 35, 45))).toBeNull();
    expect(scoreDropBeyondMargin(a(52, 47, 57), a(48, 43, 53))).toBeNull(); // dans la marge
    expect(scoreDropBeyondMargin(a(52, 47, 57), a(60, 55, 65))).toBeNull(); // hausse
    expect(scoreDropBeyondMargin(a(52, 47, 57), a(41, 36, 46))).toEqual({ from: { score: 52, low: 47, high: 57 }, to: { score: 41, low: 36, high: 46 }, delta: -11 });
  });

  it('événements supplémentaires selon la notification', async () => {
    const mk = (id: string, score: number, low: number, high: number, at: string) =>
      ({ ...createMockAudit({ businessName: 'X', trade: 'plombier', city: 'Lyon' }, 'seed-fixe'), id, score, range: { low, high }, measuredAt: at, createdAt: at }) as never;
    const drop = await extraWebhookEvents('b', { type: 'audit_done' }, { listAudits: async () => [mk('a1', 60, 55, 65, '2026-10-01T00:00:00Z'), mk('a2', 40, 35, 45, '2026-11-01T00:00:00Z')] });
    expect(drop).toHaveLength(1);
    expect(drop[0].event).toBe('score.dropped');
    expect(drop[0].data).toMatchObject({ delta: -20, measurementId: 'a2', previousMeasurementId: 'a1' });
    const flat = await extraWebhookEvents('b', { type: 'audit_done' }, { listAudits: async () => [mk('a1', 60, 55, 65, '2026-10-01T00:00:00Z'), mk('a2', 58, 53, 63, '2026-11-01T00:00:00Z')] });
    expect(flat).toEqual([]);
    const props = await extraWebhookEvents('b', { type: 'agent_proposals' }, { listPendingProposals: async () => [{ id: 'cs1' }, { id: 'cs2' }] });
    expect(props[0]).toMatchObject({ event: 'proposal.pending', data: { pending: 2, proposalIds: ['cs1', 'cs2'] } });
    expect(await extraWebhookEvents('b', { type: 'task_done' })).toEqual([]);
  });

  it('événements déclarés dans le système d’intégrations existant', async () => {
    const { EVENTS, EVENT_LABELS } = await import('@/lib/integrations');
    for (const e of ['audit.completed', 'score.dropped', 'proposal.pending'] as const) {
      expect(EVENTS).toContain(e);
      expect(EVENT_LABELS[e]).toBeTruthy();
    }
  });
});
