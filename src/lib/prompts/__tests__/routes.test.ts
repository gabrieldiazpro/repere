/**
 * CRUD, quotas et routes /api/prompts en mode démo (sans Supabase) : store en fichiers temporaires.
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

Object.assign(process.env, { DATA_DIR: mkdtempSync(path.join(tmpdir(), 'repere-prompts-')), PROMPTS_SITE_FETCH: 'off' });
for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_SUPABASE_URL']) delete process.env[k];

const { createBusiness, saveAudit } = await import('@/lib/db');
const { buildDemoWorkspace } = await import('@/lib/demo-v2');
const repo = await import('../repo');
const listRoute = await import('@/app/api/prompts/route');
const idRoute = await import('@/app/api/prompts/[id]/route');
const historyRoute = await import('@/app/api/prompts/[id]/history/route');
const suggestRoute = await import('@/app/api/prompts/suggest/route');
const importRoute = await import('@/app/api/prompts/import/route');
const { HttpError } = await import('../adapters');

const B = 'http://localhost:3000/api/prompts';
let ip = 0;
const headers = () => ({ 'content-type': 'application/json', 'x-forwarded-for': `10.9.0.${++ip % 250}` });
const post = (url: string, body: unknown) => new Request(url, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

let freeId = '';
let paidId = '';

beforeAll(async () => {
  const free = await createBusiness({ name: 'Plomberie Test', trade: 'plombier', city: 'Lyon', plan: 'free' });
  freeId = free.id;
  const paid = await createBusiness({ name: 'Plomberie Martin', trade: 'plombier', city: 'Paris', district: '11e', plan: 'essentiel' });
  paidId = paid.id;
  // Audits enregistrés du commerce payant : copies des audits démo.
  const ws = buildDemoWorkspace('local');
  for (const [i, a] of ws.audits.entries()) await saveAudit({ ...a, id: `aud-test-${i}`, demo: false }, { businessId: paidId });
});

describe('repo : CRUD et quotas', () => {
  it('crée, refuse les doublons, met à jour, supprime', async () => {
    const b = (await import('@/lib/db')).getBusinessRecord;
    const business = (await b(freeId))!;
    const p = await repo.createPrompt(business, { text: 'Quel plombier à Lyon ?', tags: ['Lyon'] });
    expect(p).toMatchObject({ origin: 'client', active: true, tags: ['lyon'], intent: 'recommandation' });
    await expect(repo.createPrompt(business, { text: 'quel plombier a lyon' })).rejects.toMatchObject({ status: 409, duplicateOf: p.id });
    const u = await repo.updatePrompt(business, p.id, { theme: 'Générique', active: false });
    expect(u).toMatchObject({ theme: 'Générique', active: false });
    await repo.deletePrompt(business, p.id);
    expect(await repo.getPrompt(p.id)).toBeNull();
  });

  it('applique le quota Découverte (5 questions actives)', async () => {
    const business = (await (await import('@/lib/db')).getBusinessRecord(freeId))!;
    const texts = ['Plombier urgent Lyon ce soir', 'Combien coûte un plombier à Lyon ?', 'Avis plombiers lyonnais fiables', 'Qui fait du débouchage à Lyon ?', 'Plombier près de la Part-Dieu', 'Chauffe-eau thermodynamique : quel installateur ?'];
    for (const t of texts.slice(0, 5)) await repo.createPrompt(business, { text: t });
    await expect(repo.createPrompt(business, { text: texts[5] })).rejects.toMatchObject({ status: 402 });
    const paused = await repo.createPrompt(business, { text: texts[5], active: false });
    await expect(repo.updatePrompt(business, paused.id, { active: true })).rejects.toBeInstanceOf(HttpError);
    expect(await repo.quotaOf(business)).toEqual({ limit: 5, used: 5, remaining: 0 });
  });

  it('refuse toute écriture sur un compte démo', async () => {
    const demo = (await (await import('@/lib/db')).getBusinessRecord('demo'))!;
    await expect(repo.createPrompt(demo, { text: 'Nouvelle question démo ?' })).rejects.toMatchObject({ status: 403 });
  });
});

describe('routes /api/prompts', () => {
  it('GET liste les questions démo avec indice et quota', async () => {
    const res = await listRoute.GET(new Request(`${B}?businessId=demo-pme`, { headers: headers() }));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.demo).toBe(true);
    expect(j.prompts.length).toBeGreaterThanOrEqual(8);
    expect(j.prompts[0].demand.label).toBe('estimation');
    expect(j.quota.limit).toBeGreaterThan(0);
  });

  it('GET initialise les questions d\'un commerce réel depuis son dernier audit, dans la limite du quota', async () => {
    const res = await listRoute.GET(new Request(`${B}?businessId=${paidId}`, { headers: headers() }));
    const j = await res.json();
    expect(j.prompts.length).toBe(9);
    expect(j.prompts.every((p: { origin: string; queryId?: string }) => p.origin === 'gabarit' && p.queryId)).toBe(true);
    const csv = await listRoute.GET(new Request(`${B}?businessId=${paidId}&format=csv`, { headers: headers() }));
    expect(csv.headers.get('content-type')).toMatch(/text\/csv/);
    expect((await csv.text()).split('\r\n').length).toBeGreaterThan(9);
  });

  it('GET export CSV refusé en offre Découverte (402), identifiant invalide (400)', async () => {
    expect((await listRoute.GET(new Request(`${B}?businessId=${freeId}&format=csv`, { headers: headers() }))).status).toBe(402);
    expect((await listRoute.GET(new Request(`${B}?businessId=../x`, { headers: headers() }))).status).toBe(400);
  });

  it('POST crée (201), refuse le doublon (409) et le compte démo (403)', async () => {
    const r1 = await listRoute.POST(post(B, { businessId: paidId, text: 'Quel plombier installe une pompe à chaleur ?', tags: ['pac'] }));
    expect(r1.status).toBe(201);
    const j1 = await r1.json();
    expect(j1.prompt.tags).toEqual(['pac']);
    const r2 = await listRoute.POST(post(B, { businessId: paidId, text: 'quel plombier installe une pompe a chaleur' }));
    expect(r2.status).toBe(409);
    expect((await listRoute.POST(post(B, { businessId: 'demo', text: 'Question démo ?' }))).status).toBe(403);
    expect((await listRoute.POST(post(B, { businessId: paidId, text: 'ab' }))).status).toBe(400);
  });

  it('PATCH / DELETE sur une question, refus sur une question démo', async () => {
    const created = await (await listRoute.POST(post(B, { businessId: paidId, text: 'Plombier pour salle de bain clé en main ?' }))).json();
    const id = created.prompt.id as string;
    const patch = await idRoute.PATCH(new Request(`${B}/${id}`, { method: 'PATCH', headers: headers(), body: JSON.stringify({ tags: ['Salle de bain'], intent: 'service' }) }), ctx(id));
    expect(patch.status).toBe(200);
    expect((await patch.json()).prompt).toMatchObject({ tags: ['salle de bain'], intent: 'service' });
    expect((await idRoute.PATCH(new Request(`${B}/${id}`, { method: 'PATCH', headers: headers(), body: JSON.stringify({ intent: 'nimporte' }) }), ctx(id))).status).toBe(400);
    expect((await idRoute.DELETE(new Request(`${B}/${id}`, { method: 'DELETE', headers: headers() }), ctx(id))).status).toBe(200);
    expect((await idRoute.DELETE(new Request(`${B}/${id}`, { method: 'DELETE', headers: headers() }), ctx(id))).status).toBe(404);
    const demoId = repo.listPrompts('demo').then((l) => l[0].id);
    expect((await idRoute.DELETE(new Request(`${B}/x`, { method: 'DELETE', headers: headers() }), ctx(await demoId))).status).toBe(403);
  });

  it('POST /suggest renvoie 20 suggestions (démo comprise)', async () => {
    const res = await suggestRoute.POST(post(`${B}/suggest`, { businessId: 'demo-ecom' }));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.suggestions.length).toBe(20);
    expect(j.suggestions.every((s: { label: string }) => s.label === 'suggestion')).toBe(true);
    expect(j.siteRead).toBe(false);
  });

  it('POST /import : aperçu sur démo, import réel dédoublonné, mise en pause au-delà du quota', async () => {
    const demo = await importRoute.POST(post(`${B}/import`, { businessId: 'demo', content: 'Plombier pour fuite sous évier ?\nQuel est le meilleur plombier à Paris 11e ?', dryRun: true }));
    expect(demo.status).toBe(200);
    const dj = await demo.json();
    expect(dj.created.length).toBe(1);
    expect(dj.rejected.length).toBe(1);
    expect((await importRoute.POST(post(`${B}/import`, { businessId: 'demo', content: 'Plombier pour fuite sous évier ?' }))).status).toBe(403);

    const raw = new Request(`${B}/import?businessId=${freeId}`, { method: 'POST', headers: { 'content-type': 'text/csv', 'x-forwarded-for': '10.8.0.1' }, body: 'question;tags\nPlombier pour remplacement de WC ?;wc\nRéparation de chasse d\'eau à Lyon ?;wc' });
    const r = await importRoute.POST(raw);
    expect(r.status).toBe(201);
    const j = await r.json();
    expect(j.created.length).toBe(2);
    expect(j.pausedForQuota).toBe(2);
    expect(j.created.every((p: { active: boolean }) => !p.active)).toBe(true);
  });

  it('GET /[id]/history : série par IA et réponses surlignées', async () => {
    const list = await (await listRoute.GET(new Request(`${B}?businessId=${paidId}`, { headers: headers() }))).json();
    const p = list.prompts.find((x: { queryId?: string }) => x.queryId === 'T1-fd2c');
    const res = await historyRoute.GET(new Request(`${B}/${p.id}/history`, { headers: headers() }), ctx(p.id));
    expect(res.status).toBe(200);
    const { history } = await res.json();
    expect(history.historyMonths).toBeNull(); // Essentiel : historique illimité (src/lib/entitlements.ts)
    expect(history.series.length).toBeGreaterThan(0);
    expect(history.answers.some((a: { highlights: unknown[] }) => a.highlights.length > 0)).toBe(true);
    const demoP = (await repo.listPrompts('demo')).find((x) => x.queryId === 'T1-fd2c')!;
    const d = await historyRoute.GET(new Request(`${B}/${demoP.id}/history?provider=perplexity&answers=0`, { headers: headers() }), ctx(demoP.id));
    const dj = await d.json();
    expect(dj.history.audits).toBe(6);
    expect(dj.history.answers).toEqual([]);
    expect(dj.history.series.every((s: { provider: string }) => s.provider === 'perplexity')).toBe(true);
    expect((await historyRoute.GET(new Request(`${B}/x/history?provider=bing`, { headers: headers() }), ctx(demoP.id))).status).toBe(400);
  });
});
