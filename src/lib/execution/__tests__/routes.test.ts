import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.setConfig({ testTimeout: 60_000 });

process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'repere-exec-routes-'));
for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_SUPABASE_URL', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY']) delete process.env[k];

const BASE = 'http://localhost:3000';
const json = (body: unknown) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

describe('routes EXÉCUTION (mode démo)', () => {
  it('GET /api/schema/[businessId] : JSON-LD, bloc <script>, 404, 304', async () => {
    const { GET } = await import('@/app/api/schema/[businessId]/route');
    const res = await GET(new Request(`${BASE}/api/schema/demo`), { params: Promise.resolve({ businessId: 'demo' }) });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/ld+json');
    expect(res.headers.get('cache-control')).toContain('s-maxage');
    const data = await res.json();
    expect(data['@graph'][0]['@type']).toBe('Plumber');
    const etag = res.headers.get('etag')!;
    const again = await GET(new Request(`${BASE}/api/schema/demo`, { headers: { 'if-none-match': etag } }), { params: Promise.resolve({ businessId: 'demo' }) });
    expect(again.status).toBe(304);
    const script = await GET(new Request(`${BASE}/api/schema/demo-ecom?format=script&faq=1`), { params: Promise.resolve({ businessId: 'demo-ecom' }) });
    const html = await script.text();
    expect(html).toMatch(/^<script type="application\/ld\+json">/);
    expect(html).toContain('FAQPage');
    const missing = await GET(new Request(`${BASE}/api/schema/inconnu`), { params: Promise.resolve({ businessId: 'inconnu' }) });
    expect(missing.status).toBe(404);
  });

  it('comptes démo : lecture libre, écritures refusées (403, E1), réponse à un avis sans LLM', async () => {
    const tasksRoute = await import('@/app/api/exec/tasks/route');
    const statusRoute = await import('@/app/api/exec/tasks/[id]/route');
    const gen = await import('@/app/api/exec/generate/route');
    const settings = await import('@/app/api/exec/settings/route');
    const reply = await import('@/app/api/exec/review-reply/route');

    const list = await (await tasksRoute.GET(new Request(`${BASE}/api/exec/tasks?businessId=demo-pme`))).json();
    expect(list.tasks.length).toBeGreaterThanOrEqual(8);
    expect(list.week).toHaveLength(3);
    const id = list.week[0];
    const st = await statusRoute.POST(new Request(`${BASE}/api/exec/tasks/${id}`, json({ businessId: 'demo-pme', status: 'done' })), { params: Promise.resolve({ id }) });
    expect(st.status).toBe(403);
    expect((await st.json()).demo).toBe(true);
    const ff = await tasksRoute.POST(new Request(`${BASE}/api/exec/tasks`, json({ businessId: 'demo', factFix: { field: 'telephone', expected: '01 43 55 12 34', stated: '01 99 99 99 99', provider: 'gemini' } })));
    expect(ff.status).toBe(403);
    expect((await gen.POST(new Request(`${BASE}/api/exec/generate`, json({ businessId: 'demo-pme' })))).status).toBe(403);
    const squat = await settings.POST(new Request(`${BASE}/api/exec/settings`, json({ businessId: 'demo-pme', settings: { slug: 'un-vrai-client', published: false } })));
    expect(squat.status).toBe(403);
    // rien n'a changé
    const again = await (await tasksRoute.GET(new Request(`${BASE}/api/exec/tasks?businessId=demo-pme`))).json();
    expect(again.tasks.find((t: { id: string }) => t.id === id)?.status).not.toBe('done');

    const r = await reply.POST(new Request(`${BASE}/api/exec/review-reply`, json({ businessId: 'demo', review: { rating: 2, text: 'Arrivé en retard, mais travail correct.', author: 'Paul Lemoine' } })));
    expect(r.status).toBe(200);
    const rj = await r.json();
    expect(rj.reply).toMatch(/^Bonjour,/);
    expect(rj.reply).not.toContain('Lemoine');
    expect(rj.llm).toBe(false);
  });

  it('commerce réel : statut persistant, fact_fix, régénération (statuts conservés)', async () => {
    const { createBusiness, saveAudit } = await import('@/lib/db');
    const { createMockAudit } = await import('@/lib/engine');
    const b = await createBusiness({ name: 'Plomberie Réelle', trade: 'plombier', city: 'Lyon', plan: 'essentiel', contactEmail: 'p@exemple.fr' } as Parameters<typeof createBusiness>[0]);
    await saveAudit(createMockAudit({ businessName: 'Plomberie Réelle', trade: 'plombier', city: 'Lyon' }, 'reel-1'), { businessId: b.id, trigger: 'manual' });
    const tasksRoute = await import('@/app/api/exec/tasks/route');
    const statusRoute = await import('@/app/api/exec/tasks/[id]/route');
    const gen = await import('@/app/api/exec/generate/route');

    const g0 = await gen.POST(new Request(`${BASE}/api/exec/generate`, json({ businessId: b.id })));
    expect(g0.status).toBe(200);
    const list = await (await tasksRoute.GET(new Request(`${BASE}/api/exec/tasks?businessId=${b.id}`))).json();
    expect(list.week.length).toBeGreaterThan(0);
    const id = list.week[0];
    const st = await statusRoute.POST(new Request(`${BASE}/api/exec/tasks/${id}`, json({ businessId: b.id, status: 'done' })), { params: Promise.resolve({ id }) });
    expect(st.status).toBe(200);
    expect((await st.json()).task.status).toBe('done');
    const bad = await statusRoute.POST(new Request(`${BASE}/api/exec/tasks/${id}`, json({ businessId: b.id, status: 'fini' })), { params: Promise.resolve({ id }) });
    expect(bad.status).toBe(400);
    const persisted = await (await tasksRoute.GET(new Request(`${BASE}/api/exec/tasks?businessId=${b.id}`))).json();
    expect(persisted.tasks.find((t: { id: string }) => t.id === id)?.status).toBe('done');

    const ff = await tasksRoute.POST(new Request(`${BASE}/api/exec/tasks`, json({ businessId: b.id, factFix: { field: 'telephone', expected: '04 72 00 00 00', stated: '04 99 99 99 99', provider: 'gemini' } })));
    expect(ff.status).toBe(201);
    expect((await ff.json()).task.kind).toBe('fact_fix');

    const g = await gen.POST(new Request(`${BASE}/api/exec/generate`, json({ businessId: b.id })));
    const gj = await g.json();
    expect(gj.tasks.find((t: { id: string }) => t.id === id)?.status).toBe('done'); // statut conservé
  });

  it('E5 : slug par défaut réservé à la première lecture, collision suffixée, saisie stricte', async () => {
    const { createBusiness } = await import('@/lib/db');
    const { getSettings, saveSettings, findBusinessIdBySlug, SlugTakenError } = await import('@/lib/execution');
    const victim = await createBusiness({ name: 'Boulangerie Dupont', trade: 'boulangerie', city: 'Lyon' } as Parameters<typeof createBusiness>[0]);
    const squatter = await createBusiness({ name: 'Boulangerie Dupont', trade: 'boulangerie', city: 'Lyon' } as Parameters<typeof createBusiness>[0]);
    const s1 = await getSettings(victim.id, victim.name);
    expect(s1.slug).toBe('boulangerie-dupont');
    expect(await findBusinessIdBySlug('boulangerie-dupont')).toBe(victim.id);
    const s2 = await getSettings(squatter.id, squatter.name);
    expect(s2.slug).toBe('boulangerie-dupont-2');
    await expect(saveSettings(squatter.id, { slug: 'boulangerie-dupont' })).rejects.toBeInstanceOf(SlugTakenError);
    await expect(saveSettings(squatter.id, { slug: 'paysia' })).rejects.toBeInstanceOf(SlugTakenError); // slug démo protégé
    const moved = await saveSettings(victim.id, { slug: 'dupont-lyon' });
    expect(moved.slug).toBe('dupont-lyon');
    expect(await findBusinessIdBySlug('dupont-lyon')).toBe(victim.id);
    expect(await findBusinessIdBySlug('boulangerie-dupont')).toBeNull(); // ancien slug libéré
  });

  it('page hébergée : slug démo résolu', async () => {
    const { findBusinessIdBySlug, loadExecContext } = await import('@/lib/execution');
    expect(await findBusinessIdBySlug('maison-sora')).toBe('demo-ecom');
    const ctx = await loadExecContext('demo-ecom');
    expect(ctx?.settings.slug).toBe('maison-sora');
    expect(ctx?.segment).toBe('ecommerce');
  });
});
