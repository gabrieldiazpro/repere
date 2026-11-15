import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'repere-ops-routes-'));
delete process.env.SUPABASE_URL;
delete process.env.NEXT_PUBLIC_SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.STRIPE_SECRET_KEY;
delete process.env.RESEND_API_KEY;
process.env.CRON_SECRET = 'cron-secret-de-test-1234567890';
process.env.ADMIN_TOKEN = 'admin-token-de-test-1234567890';
process.env.OPENAI_API_KEY = 'sk-valeur-qui-ne-doit-pas-fuiter';

const health = await import('@/app/api/health/route');
const deep = await import('@/app/api/health/deep/route');
const errors = await import('@/app/api/ops/errors/route');
const incidents = await import('@/app/api/ops/incidents/route');
const guard = await import('@/app/api/ops/guard/route');
const tick = await import('@/app/api/ops/tick/route');
const worker = await import('@/app/api/cron/worker/route');
const { listErrorGroups, listIncidents, getHeartbeat, resetErrorGuards } = await import('@/lib/ops');
const { resetJobsForTests } = await import('@/lib/jobs');

const base = 'http://localhost:3000';
const bearer = { authorization: `Bearer ${process.env.CRON_SECRET}` };
const admin = { cookie: `admin_token=${process.env.ADMIN_TOKEN}` };

beforeAll(() => {
  resetJobsForTests();
  resetErrorGuards();
});

describe('/api/health', () => {
  it('public : niveaux et briques configurées, sans détail ni valeur de clé', async () => {
    const res = await health.GET(new Request(`${base}/api/health`, { headers: { 'x-forwarded-for': '203.0.113.9' } }));
    expect(res.status).toBe(200);
    const text = await res.text();
    const body = JSON.parse(text);
    expect(body.checks).toMatchObject({ db: 'ok', jobs: 'ok', cron: 'ok' });
    expect(body.configured.ai.chatgpt).toBe(true);
    expect(body.configured.stripe).toBe(false);
    expect(body.db).toBeUndefined();
    expect(body.keys).toBeUndefined();
    expect(text).not.toContain('sk-valeur');
  });
  it('Bearer CRON_SECRET : détail historique (db, env, jobs, keys) pour verifier-prod', async () => {
    const body = await (await health.GET(new Request(`${base}/api/health`, { headers: bearer }))).json();
    expect(body.db.backend).toBe('memory');
    expect(body.jobs.level).toBe('ok');
    expect(body.keys).toMatchObject({ cron: true, stripe: false, ai: { chatgpt: true } });
    expect(JSON.stringify(body)).not.toContain('sk-valeur');
  });
});

describe('/api/health/deep', () => {
  it('refusé sans authentification', async () => {
    expect((await deep.GET(new Request(`${base}/api/health/deep`))).status).toBe(401);
  });
  it('accepté pour l’admin, sans réseau (Stripe et Resend non configurés)', async () => {
    const res = await deep.GET(new Request(`${base}/api/health/deep`, { headers: admin }));
    const body = await res.json();
    expect(body.probes.store.level).toBe('ok');
    expect(body.probes.stripe.note).toBe('non configuré');
    expect(body.costs.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('/api/ops/errors', () => {
  it('enregistre une erreur du navigateur (sans l’origine ni la requête)', async () => {
    const res = await errors.POST(
      new Request(`${base}/api/ops/errors`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.10' },
        body: JSON.stringify({ name: 'TypeError', message: 'Cannot read properties of undefined', url: 'https://repere.fr/app/ia?compte=demo', kind: 'boundary' }),
      }),
    );
    expect(res.status).toBe(204);
    const groups = await listErrorGroups();
    expect(groups.find((g) => g.source === 'client')).toMatchObject({ route: '/app/ia', name: 'TypeError' });
  });
  it('corps trop gros ou illisible : 204, rien enregistré', async () => {
    const before = (await listErrorGroups()).length;
    await errors.POST(new Request(`${base}/api/ops/errors`, { method: 'POST', body: 'x'.repeat(9000) }));
    await errors.POST(new Request(`${base}/api/ops/errors`, { method: 'POST', body: '{pas du json' }));
    expect((await listErrorGroups()).length).toBe(before);
  });
  it('lecture réservée', async () => {
    expect((await errors.GET(new Request(`${base}/api/ops/errors`))).status).toBe(401);
    expect((await errors.GET(new Request(`${base}/api/ops/errors`, { headers: bearer }))).status).toBe(200);
  });
});

describe('/api/ops/incidents et /api/ops/guard', () => {
  it('déclaration refusée sans admin', async () => {
    const res = await incidents.POST(new Request(`${base}/api/ops/incidents`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Panne totale' }) }));
    expect(res.status).toBe(401);
  });
  it('formulaire admin : création puis résolution, redirection vers /admin/ops', async () => {
    const form = new FormData();
    form.set('action', 'create');
    form.set('title', 'Paiement indisponible');
    form.set('impact', 'majeur');
    form.append('services', 'paiement');
    form.set('text', 'Stripe ne répond plus, nous suivons.');
    const res = await incidents.POST(new Request(`${base}/api/ops/incidents`, { method: 'POST', headers: { ...admin, origin: base }, body: form }));
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toContain('/admin/ops?incident=cree');
    const [inc] = await listIncidents();
    expect(inc).toMatchObject({ title: 'Paiement indisponible', impact: 'majeur', services: ['paiement'], status: 'en_cours' });
    const res2 = await incidents.POST(
      new Request(`${base}/api/ops/incidents`, { method: 'POST', headers: { ...admin, 'content-type': 'application/json' }, body: JSON.stringify({ action: 'resolve', id: inc.id, text: 'Rétabli.' }) }),
    );
    expect((await res2.json()).incident.status).toBe('resolu');
  });
  it('requête d’une autre origine refusée même avec le cookie', async () => {
    const res = await incidents.POST(new Request(`${base}/api/ops/incidents`, { method: 'POST', headers: { ...admin, origin: 'https://evil.example', 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Faux incident' }) }));
    expect(res.status).toBe(401);
  });
  it('garde-fou : levée et rétablissement', async () => {
    const post = (action: string) => guard.POST(new Request(`${base}/api/ops/guard`, { method: 'POST', headers: { ...admin, 'content-type': 'application/json' }, body: JSON.stringify({ action }) }));
    expect((await post('override')).status).toBe(200);
    expect((await post('restore')).status).toBe(200);
    expect((await post('autre')).status).toBe(400);
  });
});

describe('worker et contrôle', () => {
  it('le worker enregistre son passage', async () => {
    const res = await worker.GET(new Request(`${base}/api/cron/worker`, { headers: bearer }));
    expect(res.status).toBe(200);
    expect((await getHeartbeat('worker'))?.ok).toBe(true);
  });
  it('/api/ops/tick protégé, exécutable avec le secret', async () => {
    expect((await tick.POST(new Request(`${base}/api/ops/tick`, { method: 'POST' }))).status).toBe(401);
    const res = await tick.POST(new Request(`${base}/api/ops/tick?force=1`, { method: 'POST', headers: bearer }));
    expect(res.status).toBe(200);
    expect((await res.json()).skipped).toBe(false);
  });
});
