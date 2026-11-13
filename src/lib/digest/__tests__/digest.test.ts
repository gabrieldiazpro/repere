import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.setConfig({ testTimeout: 30_000 }); // premier calcul des espaces démo (18 audits simulés) : quelques secondes

process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'repere-digest-'));
for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_SUPABASE_URL', 'RESEND_API_KEY']) delete process.env[k];
process.env.CRON_SECRET = 'test-cron';

const { buildWeeklyDigest, weekOf, signDoneToken, verifyDoneToken, doneUrl } = await import('@/lib/digest');
const { renderWeeklyDigestEmail } = await import('@/lib/email');
const { getDemoWorkspace } = await import('@/lib/demo-v2');
const { getBusiness, getAudit, getAuditBusinessId } = await import('@/lib/db');
const doneRoute = await import('@/app/api/digest/done/route');
const previewRoute = await import('@/app/api/digest/preview/route');
const weeklyRoute = await import('@/app/api/cron/weekly/route');
const factsRoute = await import('@/app/api/facts/route');
const benchRoute = await import('@/app/api/benchmark/route');

const B = 'http://localhost:3000';

describe('comptes démo V2', () => {
  it.each([
    ['local', 'demo', 'Plomberie Martin'],
    ['pme', 'demo-pme', 'Paysia'],
    ['ecommerce', 'demo-ecom', 'Maison Sora'],
  ] as const)('%s → %s', async (segment, id, name) => {
    const ws = await getDemoWorkspace(segment);
    expect(ws.business).toMatchObject({ id, name, segment });
    expect(ws.audits).toHaveLength(6);
    expect(ws.audits.every((a) => a.demo)).toBe(true);
    expect(Object.keys(ws.facts.facts).length).toBeGreaterThanOrEqual(5);
    expect((await getBusiness(id))?.name).toBe(name);
    const last = ws.audits[5];
    expect((await getAudit(last.id))?.id).toBe(last.id);
    expect(await getAuditBusinessId(last.id)).toBe(id);
  });
  it('la démo V1 garde ses identifiants et scores', async () => {
    const ws = await getDemoWorkspace('local');
    expect(ws.audits.map((a) => a.id)).toEqual(['demo-1', 'demo-2', 'demo-3', 'demo-4', 'demo-5', 'demo-6']);
    expect(ws.audits.map((a) => a.score)).toEqual([18, 27, 33, 42, 52, 61]);
  });
});

describe('buildWeeklyDigest (démo)', () => {
  it.each(['demo', 'demo-pme', 'demo-ecom'])('%s : digest complet, jamais vide', async (id) => {
    const d = await buildWeeklyDigest(id, new Date('2026-11-09T07:30:00+01:00'));
    expect(d.week).toBe('2026-11-09');
    // Doc 06 § 2.1 : l'erreur d'une IA prend la tête ; la phrase de citation passe en 2ᵉ ligne.
    expect(d.headline).toMatch(/^Gemini (donne|annonce|se trompe)/);
    expect(d.secondLine).toMatch(/vous cite dans \d+ questions? sur \d+/);
    expect(d.benchmark?.label).toMatch(/sur \d+/);
    expect(d.tasks.length).toBeGreaterThan(0);
    expect(d.tasks.length).toBeLessThanOrEqual(3);
    expect(d.demo).toBe(true);
    expect(d.subject.length).toBeGreaterThan(10);
    expect(typeof d.factErrors).toBe('number');
  });
  it('weekOf renvoie le lundi (heure de Paris)', () => {
    expect(weekOf(new Date('2026-11-15T22:30:00Z'))).toBe('2026-11-09'); // dimanche 23 h 30 à Paris
    expect(weekOf(new Date('2026-11-15T23:30:00Z'))).toBe('2026-11-16'); // lundi 0 h 30 à Paris
  });
  it("rend un e-mail HTML avec boutons « C'est fait » signés", async () => {
    const d = await buildWeeklyDigest('demo');
    const r = renderWeeklyDigestEmail('client@exemple.fr', d, { done: (t) => doneUrl('demo', t) });
    expect(r.html).toContain('C&#39;est fait');
    expect(r.html).toContain('/api/digest/done?token=');
    expect(r.html).toContain('Votre rang');
    expect(r.html).toContain('Se désinscrire');
    expect(r.text).toContain(d.headline);
  });
});

describe('lien signé « C’est fait »', () => {
  it('vérifie la signature et l’expiration', () => {
    const t = signDoneToken('demo', 'task-1');
    expect(verifyDoneToken(t)).toMatchObject({ businessId: 'demo', taskId: 'task-1' });
    expect(verifyDoneToken(`${t.slice(0, -2)}xx`)).toBeNull();
    expect(verifyDoneToken(signDoneToken('demo', 'task-1', 10, Date.now() - 60_000))).toBeNull();
  });
  it('GET /api/digest/done : confirmation sans effet (antivirus), POST marque la tâche, 14 jours, démo en lecture seule', async () => {
    const { createBusiness, saveAudit } = await import('@/lib/db');
    const { createMockAudit } = await import('@/lib/engine');
    const b = await createBusiness({ name: 'Garage Réel', trade: 'garagiste', city: 'Nantes', plan: 'essentiel', contactEmail: 'g@exemple.fr' } as Parameters<typeof createBusiness>[0]);
    await saveAudit(createMockAudit({ businessName: 'Garage Réel', trade: 'garagiste', city: 'Nantes' }, 'garage-1'), { businessId: b.id, trigger: 'manual' });
    const d = await buildWeeklyDigest(b.id);
    const task = d.tasks[0];
    expect(task).toBeTruthy();
    const token = signDoneToken(b.id, task.id);

    // GET (ouverture du lien par un scanner) : page de confirmation, rien n'est coché.
    const get = await doneRoute.GET(new Request(`${B}/api/digest/done?token=${encodeURIComponent(token)}`));
    expect(get.status).toBe(200);
    const html = await get.text();
    expect(html).toContain('<form method="post"');
    expect(html).toContain('name="token"');
    expect((await buildWeeklyDigest(b.id)).tasks.find((t) => t.id === task.id)?.status ?? 'todo').not.toBe('done');
    expect((await doneRoute.GET(new Request(`${B}/api/digest/done?token=faux`))).status).toBe(400);

    // POST (bouton) : la tâche est cochée.
    const post = await doneRoute.POST(new Request(`${B}/api/digest/done`, { method: 'POST', body: new URLSearchParams({ token }) }));
    expect(post.status).toBe(200);
    expect(await post.text()).toContain('C’est noté');
    const { listTasks } = await import('@/lib/digest/deps');
    expect((await listTasks(b.id)).find((t) => t.id === task.id)?.status).toBe('done');
    // second GET : « déjà fait »
    expect(await (await doneRoute.GET(new Request(`${B}/api/digest/done?token=${encodeURIComponent(token)}`))).text()).toContain('Déjà fait');

    // POST invalide ou expiré (validité 14 jours)
    expect((await doneRoute.POST(new Request(`${B}/api/digest/done`, { method: 'POST', body: new URLSearchParams({ token: 'faux' }) }))).status).toBe(400);
    const old = signDoneToken(b.id, task.id, undefined, Date.now() - 15 * 86_400_000);
    expect(verifyDoneToken(old)).toBeNull();
    expect(verifyDoneToken(signDoneToken(b.id, task.id, undefined, Date.now() - 13 * 86_400_000))).not.toBeNull();

    // compte démo : refus
    const demoTask = (await buildWeeklyDigest('demo')).tasks[0];
    const demoPost = await doneRoute.POST(new Request(`${B}/api/digest/done`, { method: 'POST', body: new URLSearchParams({ token: signDoneToken('demo', demoTask.id) }) }));
    expect(demoPost.status).toBe(403);
  });
});

describe('routes RETENTION', () => {
  it('GET /api/digest/preview (JSON et HTML)', async () => {
    const res = await previewRoute.GET(new Request(`${B}/api/digest/preview?businessId=demo-pme`));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { digest: { businessName: string }; email: { subject: string } };
    expect(body.digest.businessName).toBe('Paysia');
    const html = await previewRoute.GET(new Request(`${B}/api/digest/preview?businessId=demo-ecom&format=html`));
    expect(html.headers.get('content-type')).toContain('text/html');
    expect((await previewRoute.GET(new Request(`${B}/api/digest/preview?businessId=inconnu`))).status).toBe(404);
  });
  it('GET /api/cron/weekly : secret exigé, porte horaire', async () => {
    expect((await weeklyRoute.GET(new Request(`${B}/api/cron/weekly`))).status).toBe(401);
    const ok = await weeklyRoute.GET(new Request(`${B}/api/cron/weekly?force=1`, { headers: { authorization: 'Bearer test-cron' } }));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ queued: expect.any(Number), worker: { processed: expect.any(Number) } });
  });
  it('POST /api/facts : démo en lecture seule ; validation, sauvegarde, contrôle relancé et tâche fact_fix', async () => {
    const demo = await factsRoute.POST(new Request(`${B}/api/facts?businessId=demo-pme`, { method: 'POST', body: JSON.stringify({ facts: { telephone: '01 84 80 00 00' } }) }));
    expect(demo.status).toBe(403);
    expect(((await demo.json()) as { demo: boolean }).demo).toBe(true);

    const { createBusiness, saveAudit } = await import('@/lib/db');
    const { createMockAudit, createMockFacts } = await import('@/lib/engine');
    const input = { businessName: 'Paie Réelle', trade: 'logiciel de paie', city: 'Paris', segment: 'pme' as const, category: 'logiciel de paie pour PME' };
    const b = await createBusiness({ name: input.businessName, trade: input.trade, city: input.city, segment: 'pme', plan: 'essentiel' } as Parameters<typeof createBusiness>[0]);
    const audit = createMockAudit(input as Parameters<typeof createMockAudit>[0], 'paie-1');
    await saveAudit(audit, { businessId: b.id, trigger: 'manual' });

    const bad = await factsRoute.POST(new Request(`${B}/api/facts?businessId=${b.id}`, { method: 'POST', body: JSON.stringify({ facts: { telephone: 'abc', site: 'pas un site', inconnu: 'x' } }) }));
    expect(bad.status).toBe(400);
    const errs = ((await bad.json()) as { errors: Record<string, string> }).errors;
    expect(Object.keys(errs).sort()).toEqual(['inconnu', 'site', 'telephone']);

    const truth = createMockFacts(input as Parameters<typeof createMockFacts>[0]).facts;
    const ok = await factsRoute.POST(new Request(`${B}/api/facts?businessId=${b.id}`, { method: 'POST', body: JSON.stringify({ facts: { ...truth, telephone: '01 84 80 00 00', dirigeant: '' } }) }));
    expect(ok.status).toBe(200);
    const saved = (await ok.json()) as { facts: { facts: Record<string, string> }; check: { auditId: string; report: { items: { verdict: string }[] } } | null; factFixTasks: string[] };
    expect(saved.facts.facts.telephone).toBe('01 84 80 00 00');
    expect(saved.facts.facts.dirigeant).toBeUndefined();
    expect(saved.check?.auditId).toBe(audit.id);
    const wrong = saved.check?.report.items.filter((i) => i.verdict === 'faux').length ?? 0;
    expect(wrong).toBeGreaterThan(0);
    expect(saved.factFixTasks.length).toBe(Math.min(3, wrong));
    const { listTasks } = await import('@/lib/digest/deps');
    const tasks = await listTasks(b.id);
    expect(tasks.filter((t) => t.kind === 'fact_fix').map((t) => t.id)).toEqual(expect.arrayContaining(saved.factFixTasks));
    const get = await factsRoute.GET(new Request(`${B}/api/facts?businessId=${b.id}`));
    expect(((await get.json()) as { facts: { facts: Record<string, string> } }).facts.facts.telephone).toBe('01 84 80 00 00');
  });
  it('GET /api/benchmark : rang, historique, pas de benchmark sectoriel sous 5 audits', async () => {
    const res = await benchRoute.GET(new Request(`${B}/api/benchmark?businessId=demo`));
    const body = (await res.json()) as { rank: { rank: number; of: number; label: string }; history: unknown[]; sector: unknown };
    expect(body.rank.label).toMatch(/^\d+ᵉʳ? sur \d+ plombiers/);
    expect(body.rank.rank).toBeLessThan(body.rank.of);
    expect(body.history).toHaveLength(6);
    expect(body.sector).toBeNull();
  });
});
