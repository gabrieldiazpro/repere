import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'repere-ops-'));
delete process.env.SUPABASE_URL;
delete process.env.NEXT_PUBLIC_SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const { deleteDoc, getDoc, listDocs, putDoc } = await import('@/lib/store');
const { createMemoryBackend } = await import('@/lib/jobs');
const ops = await import('@/lib/ops');
const {
  OPS,
  computeHealth,
  dailyCosts,
  errorSignature,
  errorsLastHour,
  isPausedState,
  guardState,
  listErrorGroups,
  normalizeMessage,
  normalizeRoute,
  nextParisDayStart,
  parisDay,
  parisDayStart,
  parseConsoleArgs,
  pausableBackend,
  publicHealth,
  recordError,
  resetErrorGuards,
  runOpsTick,
  sendOpsAlert,
  serviceStatuses,
  overallState,
  createIncident,
  updateIncident,
  listIncidents,
  validateIncident,
} = ops;

async function clear(collection: string) {
  for (const d of await listDocs(collection, { limit: 5000 })) await deleteDoc(collection, d.id);
}

beforeEach(async () => {
  resetErrorGuards();
  for (const c of Object.values(OPS)) await clear(c);
  await clear('copilot.usage');
  await clear('seodata.costs');
});

describe('dates de Paris', () => {
  it('jour, début du jour et lendemain (heure d’hiver et d’été)', () => {
    expect(parisDay(new Date('2026-11-15T23:30:00Z'))).toBe('2026-11-16');
    expect(parisDayStart(new Date('2026-11-15T12:00:00Z')).toISOString()).toBe('2026-11-14T23:00:00.000Z');
    expect(parisDayStart(new Date('2026-07-01T12:00:00Z')).toISOString()).toBe('2026-06-30T22:00:00.000Z');
    expect(nextParisDayStart(new Date('2026-11-15T12:00:00Z')).toISOString()).toBe('2026-11-15T23:00:00.000Z');
  });
});

describe('signatures et regroupement des erreurs', () => {
  it('normalise identifiants, nombres, URL et adresses', () => {
    expect(normalizeMessage('audit 8f3a9b2c1d4e5f60 introuvable (12 ms) https://x.fr/a?b=1 jean@ex.fr')).toBe('audit <id> introuvable (<n> ms) <url> <email>');
    expect(normalizeRoute('/r/abc123def?x=1')).toBe('/r/<id>');
    expect(normalizeRoute('/app/[id]/page')).toBe('/app/[id]/page');
  });

  it('même erreur à des identifiants près → même signature ; autre route → autre groupe', () => {
    const a = errorSignature({ source: 'server', name: 'Error', message: 'audit 1234567 introuvable', route: '/api/x' });
    const b = errorSignature({ source: 'server', name: 'Error', message: 'audit 7654321 introuvable', route: '/api/x' });
    const c = errorSignature({ source: 'server', name: 'Error', message: 'audit 7654321 introuvable', route: '/api/y' });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it('compte, première et dernière occurrence, doublon immédiat ignoré, compteur horaire', async () => {
    const t0 = new Date('2026-11-15T10:00:00Z');
    const sig = await recordError({ source: 'server', name: 'TypeError', message: 'x is undefined', route: '/api/a', stack: 'TypeError: x\n at f (a.ts:1)' }, t0);
    expect(sig).toBeTruthy();
    expect(await recordError({ source: 'server', name: 'TypeError', message: 'x is undefined', route: '/api/a' }, new Date(t0.getTime() + 1000))).toBeNull();
    await recordError({ source: 'server', name: 'TypeError', message: 'x is undefined', route: '/api/a' }, new Date(t0.getTime() + 10_000));
    const [g] = await listErrorGroups();
    expect(g.count).toBe(2);
    expect(g.firstAt).toBe(t0.toISOString());
    expect(g.lastAt).toBe(new Date(t0.getTime() + 10_000).toISOString());
    expect(g.lastStack).toContain('a.ts');
    expect((await errorsLastHour(t0)).current).toBe(2);
  });

  it('masque les adresses e-mail dans le message stocké', async () => {
    await recordError({ source: 'client', message: 'échec pour marie.durand@exemple.fr' });
    const [g] = await listErrorGroups();
    expect(g.message).not.toContain('marie.durand');
  });
});

describe('lecture de console.error', () => {
  it('ligne JSON du journal structuré', () => {
    const line = JSON.stringify({ level: 'error', event: 'job.dead', jobType: 'audit.run', err: { name: 'Error', message: 'boom', stack: 's' } });
    expect(parseConsoleArgs([line])).toMatchObject({ source: 'job', name: 'Error', message: 'boom', route: 'job:audit.run', event: 'job.dead' });
    expect(parseConsoleArgs([JSON.stringify({ level: 'warn', event: 'x' })])).toBeNull();
  });
  it('ancien console.error du webhook Stripe', () => {
    const p = parseConsoleArgs(['[webhook] traitement en échec', 'invoice.paid', new Error('db down')]);
    expect(p).toMatchObject({ source: 'webhook', message: 'db down', event: 'console.webhook' });
  });
});

describe('alertes', () => {
  const env = { ALERT_EMAIL: 'fondateur@exemple.fr' };
  it('une par type et par heure, journalisées', async () => {
    const sent: string[] = [];
    const send = async (to: string, subject: string) => {
      sent.push(`${to}|${subject}`);
      return { id: 'x', status: 'sent' as const };
    };
    const t = new Date('2026-11-15T10:00:00Z');
    expect((await sendOpsAlert('error_spike', ['25 erreurs'], { now: t, send, env })).status).toBe('sent');
    expect((await sendOpsAlert('error_spike', ['30 erreurs'], { now: new Date(t.getTime() + 30 * 60_000), send, env })).status).toBe('throttled');
    expect((await sendOpsAlert('cost_cap', ['12 €'], { now: new Date(t.getTime() + 30 * 60_000), send, env })).status).toBe('sent');
    expect((await sendOpsAlert('error_spike', ['40 erreurs'], { now: new Date(t.getTime() + 61 * 60_000), send, env })).status).toBe('sent');
    expect(sent).toEqual(['fondateur@exemple.fr|[Repéré] Pic d\'erreurs', 'fondateur@exemple.fr|[Repéré] Plafond de coût du jour dépassé', 'fondateur@exemple.fr|[Repéré] Pic d\'erreurs']);
    expect((await ops.listOpsAlerts()).length).toBe(3);
  });
  it('sans ALERT_EMAIL : rien n’est envoyé', async () => {
    let called = false;
    const r = await sendOpsAlert('health_fail', ['base'], { env: {}, send: async () => ((called = true), { id: null, status: 'sent' as const }) });
    expect(r.status).toBe('no_recipient');
    expect(called).toBe(false);
  });
});

describe('coûts du jour', () => {
  it('additionne copilote (jour) et part du jour de DataForSEO (mensuel), compare au plafond', async () => {
    const yesterday = new Date('2026-11-14T15:00:00Z');
    const today = new Date('2026-11-15T15:00:00Z');
    await putDoc('seodata.costs', 'b1:2026-11', { businessId: 'b1', month: '2026-11', spentUsd: 10 });
    await dailyCosts({ now: yesterday, env: {}, audits: async () => 0 }); // relevé de la veille (base)
    await putDoc('seodata.costs', 'b1:2026-11', { businessId: 'b1', month: '2026-11', spentUsd: 15 });
    await putDoc('copilot.usage', 'day:2026-11-15', { milliEur: 1500 });
    const c = await dailyCosts({ now: today, env: { OPS_DAILY_COST_CAP_EUR: '5', SEODATA_EUR_PER_USD: '1' }, audits: async () => 2 });
    expect(c.bySource.copilot).toBe(1.5);
    expect(c.bySource.audits).toBe(2);
    // 5 USD du jour × 0,92 (taux par défaut lu dans process.env)
    expect(c.bySource.dataforseo).toBeCloseTo(4.6, 4);
    expect(c.totalEur).toBeCloseTo(8.1, 4);
    expect(c.over).toBe(true);
  });
  it('premier relevé du jour sans historique : la dépense antérieure du mois n’est pas imputée au jour', async () => {
    await putDoc('seodata.costs', 'b2:2026-11', { businessId: 'b2', month: '2026-11', spentUsd: 100 });
    const c = await dailyCosts({ now: new Date('2026-11-15T15:00:00Z'), env: {}, audits: async () => 0 });
    expect(c.bySource.dataforseo).toBe(0);
    expect(c.over).toBe(false);
  });
});

describe('garde-fou : pause des tâches non urgentes', () => {
  it('seules les urgentes sortent pendant la pause ; les autres sont reportées au lendemain', async () => {
    const inner = createMemoryBackend();
    const base = { payload: {}, businessId: null, dedupeKey: null, maxAttempts: 5, runAt: new Date(Date.now() - 1000) };
    await inner.insert({ ...base, type: 'audit.run', priority: 1 });
    await inner.insert({ ...base, type: 'barometre.run', priority: 8 });
    await inner.insert({ ...base, type: 'digest.send', priority: 5 });
    const refunded: string[] = [];
    const b = pausableBackend(inner, { isPaused: async () => true, refund: async (j) => void refunded.push(j.type) });
    const got = await b.claim('w', 10, 60_000);
    expect(got.map((j) => j.type)).toEqual(['audit.run']);
    expect(refunded.sort()).toEqual(['barometre.run', 'digest.send']);
    const later = inner.all().filter((j) => j.type !== 'audit.run');
    expect(later.every((j) => j.status === 'queued' && new Date(j.runAt).getTime() > Date.now())).toBe(true);
    expect(await b.claim('w', 10, 60_000)).toEqual([]);
    expect((await guardState()).deferred).toBe(2);
  });
  it('hors pause : la persistance est transparente', async () => {
    const inner = createMemoryBackend();
    await inner.insert({ payload: {}, businessId: null, dedupeKey: null, maxAttempts: 5, runAt: new Date(Date.now() - 1000), type: 'barometre.run', priority: 8 });
    const b = pausableBackend(inner, { isPaused: async () => false });
    expect((await b.claim('w', 10, 60_000)).length).toBe(1);
    expect(b.kind).toBe('memory');
  });
});

describe('santé', () => {
  const stats = { queued: 0, running: 0, done: 3, dead: 0, oldestQueuedMin: null, backend: 'supabase' as const };
  const now = new Date('2026-11-15T12:00:00Z');
  it('worker silencieux → cron à surveiller (Supabase seulement)', () => {
    const r = computeHealth({ now, env: {}, db: { level: 'ok', backend: 'supabase' }, jobs: { stats }, worker: { name: 'worker', at: '2026-11-13T12:00:00Z', ok: true } });
    expect(r.checks.cron).toBe('warn');
    expect(r.status).not.toBe('fail');
    const mem = computeHealth({ now, env: {}, db: { level: 'ok', backend: 'memory' }, jobs: { stats }, worker: null });
    expect(mem.checks.cron).toBe('ok');
  });
  it('base en échec → fail ; corps public sans détail ni valeur de clé', () => {
    const env = { OPENAI_API_KEY: 'sk-secret-value', RESEND_API_KEY: 're_abcdefgh' };
    const r = computeHealth({ now, env, db: { level: 'fail', backend: 'supabase', error: 'connexion refusée' }, jobs: { stats }, worker: null });
    expect(r.status).toBe('fail');
    const pub = JSON.stringify(publicHealth(r));
    expect(pub).not.toContain('sk-secret');
    expect(pub).not.toContain('connexion refusée');
    expect(publicHealth(r).configured.ai.chatgpt).toBe(true);
    expect(publicHealth(r).configured.resend).toBe(true);
  });
});

describe('contrôle périodique', () => {
  const okHealth = () =>
    computeHealth({ now: new Date(), env: {}, db: { level: 'ok', backend: 'memory' }, jobs: { stats: { queued: 0, running: 0, done: 0, dead: 0, oldestQueuedMin: null, backend: 'memory' } }, worker: null });
  const send = async () => ({ id: 'x', status: 'sent' as const });

  it('plafond dépassé → pause du jour + alerte ; intervalle minimal respecté', async () => {
    const now = new Date('2026-11-15T15:00:00Z');
    await putDoc('copilot.usage', 'day:2026-11-15', { milliEur: 12_000 });
    const env = { ALERT_EMAIL: 'a@exemple.fr', OPS_DAILY_COST_CAP_EUR: '10' };
    const r = await runOpsTick({ now, env, health: async () => okHealth(), stripe: async () => null, audits: async () => 0, alert: { send } });
    expect(r.skipped).toBe(false);
    expect(r.paused).toBe(true);
    expect(r.alerts.map((a) => a.kind)).toEqual(['cost_cap']);
    expect(isPausedState(await guardState(), now)).toBe(true);
    const again = await runOpsTick({ now: new Date(now.getTime() + 60_000), env, health: async () => okHealth(), stripe: async () => null, audits: async () => 0 });
    expect(again.skipped).toBe(true);
    // levée par l'admin
    await ops.overrideToday(now);
    expect(isPausedState(await guardState(), now)).toBe(false);
  });

  it('santé en échec, webhook Stripe non livré, tâches abandonnées → alertes', async () => {
    const env = { ALERT_EMAIL: 'a@exemple.fr', OPS_DAILY_COST_CAP_EUR: '0' };
    const t = new Date('2026-11-15T15:00:00Z');
    const sick = (dead: number) =>
      computeHealth({ now: t, env: {}, db: { level: 'fail', backend: 'supabase', error: 'timeout' }, jobs: { stats: { queued: 0, running: 0, done: 0, dead, oldestQueuedMin: null, backend: 'supabase' } }, worker: { name: 'worker', at: t.toISOString(), ok: true } });
    await runOpsTick({ now: t, env, force: true, health: async () => sick(1), stripe: async () => null, audits: async () => 0, alert: { send } });
    const r = await runOpsTick({
      now: new Date(t.getTime() + 2 * 3600_000),
      env,
      force: true,
      health: async () => sick(3),
      stripe: async () => ({ count: 2, types: ['invoice.paid'], oldestAt: t.toISOString() }),
      audits: async () => 0,
      alert: { send },
    });
    expect(r.alerts.map((a) => a.kind).sort()).toEqual(['health_fail', 'jobs_dead', 'stripe_webhook']);
    expect(r.alerts.find((a) => a.kind === 'jobs_dead')?.lines[0]).toContain('2 nouvelle');
  });

  it('pic d’erreurs → alerte', async () => {
    const t = new Date('2026-11-15T15:30:00Z');
    await putDoc(OPS.errorCount, `h:${ops.parisHour(t)}`, { n: 25 });
    const r = await runOpsTick({ now: t, env: { OPS_DAILY_COST_CAP_EUR: '0', OPS_ERROR_SPIKE_PER_HOUR: '20' }, force: true, health: async () => okHealth(), stripe: async () => null, audits: async () => 0 });
    expect(r.alerts.map((a) => a.kind)).toEqual(['error_spike']);
    expect(r.alerts[0].status).toBe('no_recipient');
  });
});

describe('incidents et page /statut', () => {
  it('validation, création, mise à jour, résolution', async () => {
    expect(validateIncident({ title: 'ab' }).ok).toBe(false);
    const v = validateIncident({ title: 'Analyses ralenties', impact: 'inconnu', services: ['analyses', 'pirate'] });
    expect(v.ok && v.value).toMatchObject({ impact: 'mineur', services: ['analyses'] });
    const inc = await createIncident({ title: 'Analyses ralenties', impact: 'mineur', services: ['analyses'], text: 'Nous enquêtons.' });
    expect((await listIncidents())[0].status).toBe('en_cours');
    const st = serviceStatuses(null, await listIncidents());
    expect(st.find((s) => s.id === 'analyses')?.state).toBe('perturbe');
    expect(overallState(st)).toBe('perturbe');
    await updateIncident(inc.id, { text: 'Corrigé.', resolve: true });
    const [done] = await listIncidents();
    expect(done.status).toBe('resolu');
    expect(done.updates).toHaveLength(2);
    expect(overallState(serviceStatuses(null, [done]))).toBe('operationnel');
  });
  it('brique non configurée → « pas encore activé », sans faire passer l’état général en panne', () => {
    const h = computeHealth({ now: new Date(), env: {}, db: { level: 'ok', backend: 'memory' }, jobs: { stats: { queued: 0, running: 0, done: 0, dead: 0, oldestQueuedMin: null, backend: 'memory' } }, worker: null });
    const st = serviceStatuses(h, []);
    expect(st.find((s) => s.id === 'paiement')?.state).toBe('inactif');
    expect(overallState(st)).toBe('operationnel');
  });
});

describe('heartbeat', () => {
  it('enregistre le dernier passage', async () => {
    await ops.recordHeartbeat('worker', true, { durationMs: 12 }, new Date('2026-11-15T10:00:00Z'));
    expect((await getDoc<{ at: string }>(OPS.heartbeat, 'worker'))?.data.at).toBe('2026-11-15T10:00:00.000Z');
  });
});
