/**
 * Webhooks SORTANTS de bout en bout : un vrai serveur HTTP local (node:http, port 0) reçoit les livraisons faites par
 * le code de production (aucun fetch simulé), via la vraie file de tâches (mémoire) et le vrai gestionnaire
 * `webhook.deliver`. Seule concession : l'option de test `__allowLocalTargetsForTests` (cibles de bouclage en http).
 */
import crypto from 'node:crypto';
import { mkdtempSync, readFileSync } from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  CONFIG,
  SLACK_LIMITS,
  __allowLocalTargetsForTests,
  addTarget,
  checkWebhookUrl,
  decryptSecret,
  deliverWebhook,
  dispatchEvent,
  encryptSecret,
  getConfig,
  listDeliveries,
  listTargets,
  sendTest,
  verifySignature,
} from '@/lib/integrations';
import { listNotifications } from '@/lib/notify/center';
import { appUrl } from '@/lib/email';
import { listLocalJobs, runDueLocalJobs, useMemoryJobs } from '@/lib/jobs/testing';
import { PermanentJobError } from '@/lib/jobs';

const env = process.env as Record<string, string | undefined>;
const DIR = mkdtempSync(path.join(os.tmpdir(), 'repere-webhooks-e2e-'));
env.DATA_DIR = DIR;
(globalThis as { __repereDocsDir?: string }).__repereDocsDir = DIR;
delete env.SUPABASE_URL;
delete env.NEXT_PUBLIC_SUPABASE_URL;
delete env.SUPABASE_SERVICE_ROLE_KEY;
env.INTEGRATIONS_SECRET = 'cle-integrations-de-test-e2e';
env.JOBS_MAX_ATTEMPTS = '5';
env.JOBS_BACKOFF_BASE_MS = '60000';

// ---------------------------------------------------------------------------
// Récepteur réel
// ---------------------------------------------------------------------------
interface Received {
  method: string;
  url: string;
  headers: http.IncomingHttpHeaders;
  body: string;
  aborted: boolean;
}
type Reply = number | 'hang';
const received: Received[] = [];
let replies: Reply[] = [];
let server: http.Server;
let base = '';

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      const rec: Received = { method: req.method ?? '', url: req.url ?? '', headers: req.headers, body: Buffer.concat(chunks).toString('utf8'), aborted: false };
      received.push(rec);
      const r = replies.shift() ?? 200;
      if (r === 'hang') {
        res.on('close', () => (rec.aborted = true));
        return; // ne répond jamais : le client doit abandonner au délai
      }
      res.writeHead(r, { 'Content-Type': 'text/plain' });
      res.end(r < 300 ? 'ok' : 'erreur');
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  __allowLocalTargetsForTests({ timeoutMs: 400 });
});

afterAll(async () => {
  __allowLocalTargetsForTests(null);
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  useMemoryJobs();
  received.length = 0;
  replies = [];
});

const H = 3600_000;
let clock = Date.now();
/** Avance l'horloge de la file bien au-delà du backoff maximal et exécute les tâches dues. */
async function later(): Promise<Date> {
  clock = Math.max(clock, Date.now()) + 7 * H;
  const at = new Date(clock);
  await runDueLocalJobs(at, 'webhook.deliver');
  return at;
}
const jobs = () => listLocalJobs('webhook.deliver');

function parseSig(h: string | string[] | undefined): { t: number; v1: string } {
  const parts = Object.fromEntries(String(h).split(',').map((p) => p.split('=') as [string, string]));
  return { t: Number(parts.t), v1: parts.v1 };
}

// ---------------------------------------------------------------------------
describe('webhook générique signé', () => {
  it('livre le corps exact, les en-têtes et une signature HMAC vérifiable par le récepteur', async () => {
    const { target, secret } = await addTarget('bizE1', { kind: 'webhook', url: `${base}/hooks/repere?src=e2e`, events: ['task.done'] });
    expect(secret).toMatch(/^whsec_/);
    const before = Math.floor(Date.now() / 1000);
    const n = await dispatchEvent(
      'bizE1',
      'task.done',
      { title: 'Tâche faite : fiche Google', body: 'Horaires corrigés', href: '/app/taches', severity: 'important', data: { taskId: 't_1' } },
      { dedupeKey: 'e2e-1' },
    );
    const after = Math.floor(Date.now() / 1000);
    expect(n).toBe(1);
    expect(received).toHaveLength(1);
    const r = received[0];
    expect(r.method).toBe('POST');
    expect(r.url).toBe('/hooks/repere?src=e2e');
    expect(r.headers['content-type']).toBe('application/json');
    expect(r.headers['user-agent']).toBe('Repere-Webhooks/1.0');
    expect(r.headers['x-repere-event']).toBe('task.done');
    expect(r.headers['x-repere-delivery']).toMatch(/^dl_[0-9a-f]{20}$/);
    expect(Number(r.headers['content-length'])).toBe(Buffer.byteLength(r.body));

    const json = JSON.parse(r.body);
    expect(Object.keys(json)).toEqual(['id', 'event', 'createdAt', 'businessId', 'data']);
    expect(json).toEqual({
      id: r.headers['x-repere-delivery'],
      event: 'task.done',
      createdAt: expect.stringMatching(/^\d{4}-\d\d-\d\dT/),
      businessId: 'bizE1',
      data: { title: 'Tâche faite : fiche Google', body: 'Horaires corrigés', url: `${appUrl()}/app/taches`, severity: 'important', taskId: 't_1' },
    });

    // Vérification côté récepteur, indépendante de la bibliothèque : HMAC-SHA256(secret, "<t>.<corps brut>").
    const sig = parseSig(r.headers['x-repere-signature']);
    expect(sig.t).toBeGreaterThanOrEqual(before);
    expect(sig.t).toBeLessThanOrEqual(after);
    expect(sig.v1).toBe(crypto.createHmac('sha256', secret!).update(`${sig.t}.${r.body}`).digest('hex'));
    const header = String(r.headers['x-repere-signature']);
    expect(verifySignature(secret!, r.body, header)).toBe(true);
    // Anti-rejeu : hors de la fenêtre de 5 minutes, corps modifié ou autre secret → refus.
    expect(verifySignature(secret!, r.body, header, { now: sig.t + 301 })).toBe(false);
    expect(verifySignature(secret!, r.body, header, { now: sig.t - 301 })).toBe(false);
    expect(verifySignature(secret!, r.body.replace('t_1', 't_2'), header)).toBe(false);
    expect(verifySignature('whsec_autre', r.body, header)).toBe(false);

    const [job] = await jobs();
    expect(job).toMatchObject({ status: 'done', attempts: 1 });
    expect((await listTargets('bizE1'))[0].lastStatus).toMatchObject({ ok: true, code: 200 });
    const deliveries = await listDeliveries('bizE1');
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0]).toMatchObject({ id: json.id, targetId: target.id, event: 'task.done', ok: true, code: 200, attempt: 1 });

    // Pas de doublon après la réussite : même clé → aucune nouvelle requête, ni plus tard.
    await dispatchEvent('bizE1', 'task.done', { title: 'x' }, { dedupeKey: 'e2e-1' });
    await later();
    expect(received).toHaveLength(1);
  });

  it('500 puis 500 puis 200 : nouvelles tentatives avec backoff, corps identique, aucun envoi après la réussite', async () => {
    await addTarget('bizE2', { kind: 'webhook', url: `${base}/h`, events: ['alert.created'] });
    replies = [500, 500, 200];
    const t0 = Date.now();
    await dispatchEvent('bizE2', 'alert.created', { title: 'Score en baisse' }, { dedupeKey: 'e2e-2' });
    expect(received).toHaveLength(1);
    let [job] = await jobs();
    expect(job).toMatchObject({ status: 'queued', attempts: 1 });
    expect(job.lastError).toMatch(/refusé.*\(500\)/);
    // 1re reprise : base × 2⁰ = 60 s ± 10 %.
    const d1 = Date.parse(job.runAt) - t0;
    expect(d1).toBeGreaterThanOrEqual(54_000 - 50);
    expect(d1).toBeLessThanOrEqual(66_000 + 2_000);

    const at2 = await later();
    expect(received).toHaveLength(2);
    [job] = await jobs();
    const d2 = Date.parse(job.runAt) - at2.getTime();
    expect(d2).toBeGreaterThanOrEqual(108_000);
    expect(d2).toBeLessThanOrEqual(132_000); // 2ᵉ reprise : 120 s ± 10 %

    await later();
    expect(received).toHaveLength(3);
    [job] = await jobs();
    expect(job).toMatchObject({ status: 'done', attempts: 3 });

    await later();
    await later();
    expect(received).toHaveLength(3);
    // Même livraison, même corps signé (createdAt figé à la diffusion) : le récepteur dédoublonne sur l'id.
    expect(new Set(received.map((r) => r.headers['x-repere-delivery'])).size).toBe(1);
    expect(new Set(received.map((r) => r.body)).size).toBe(1);
    const deliveries = (await listDeliveries('bizE2')).sort((a, b) => a.attempt - b.attempt);
    expect(deliveries.map((d) => [d.attempt, d.ok, d.code])).toEqual([
      [1, false, 500],
      [2, false, 500],
      [3, true, 200],
    ]);
    expect((await listNotifications('bizE2')).items.filter((i) => i.type === 'integration_error')).toHaveLength(0);
  });

  it('échecs répétés : 5 essais au plus, backoff exponentiel, abandon journalisé et notifié une fois', async () => {
    await addTarget('bizE3', { kind: 'webhook', url: `${base}/h3`, events: ['audit.completed'] });
    replies = Array(10).fill(503);
    await dispatchEvent('bizE3', 'audit.completed', { title: 'Mesure terminée' }, { dedupeKey: 'e2e-3' });
    const delays: number[] = [];
    for (let i = 0; i < 6; i++) {
      const at = i === 0 ? null : await later();
      const [job] = await jobs();
      if (job.status === 'queued') delays.push(Date.parse(job.runAt) - (at ? at.getTime() : Date.now()));
    }
    expect(received).toHaveLength(5);
    const [job] = await jobs();
    expect(job).toMatchObject({ status: 'dead', attempts: 5 });
    // 60 s, 120 s, 240 s, 480 s (± 10 %)
    expect(delays).toHaveLength(4);
    delays.forEach((d, i) => {
      const expected = 60_000 * 2 ** i;
      expect(d).toBeGreaterThanOrEqual(expected * 0.9 - 2_000);
      expect(d).toBeLessThanOrEqual(expected * 1.1 + 2_000);
    });
    const deliveries = await listDeliveries('bizE3');
    expect(deliveries).toHaveLength(5);
    expect(deliveries.every((d) => !d.ok && d.code === 503)).toBe(true);
    const errors = (await listNotifications('bizE3')).items.filter((i) => i.type === 'integration_error');
    expect(errors).toHaveLength(1);
    expect(errors[0].body).toMatch(/Après 5 essais/);
    expect((await listTargets('bizE3'))[0].lastStatus).toMatchObject({ ok: false, code: 503 });
    await later();
    expect(received).toHaveLength(5);
  });

  it('4xx : abandon immédiat sans nouvelle tentative (sauf 408 / 429)', async () => {
    await addTarget('bizE4', { kind: 'webhook', url: `${base}/h4`, events: ['task.done'] });
    replies = [404];
    await dispatchEvent('bizE4', 'task.done', { title: 'a' }, { dedupeKey: 'e2e-4a' });
    await later();
    expect(received).toHaveLength(1);
    expect((await jobs())[0]).toMatchObject({ status: 'dead', attempts: 1 });
    const errors = (await listNotifications('bizE4')).items.filter((i) => i.type === 'integration_error');
    expect(errors).toHaveLength(1);
    expect(errors[0].body).toMatch(/code 404/);

    useMemoryJobs();
    received.length = 0;
    replies = [429, 200];
    await dispatchEvent('bizE4', 'task.done', { title: 'b' }, { dedupeKey: 'e2e-4b' });
    expect((await jobs())[0]).toMatchObject({ status: 'queued', attempts: 1 });
    await later();
    expect(received).toHaveLength(2);
    expect((await jobs())[0]).toMatchObject({ status: 'done', attempts: 2 });
  });

  it('délai dépassé : la requête est abandonnée puis rejouée, une seule réussite', async () => {
    await addTarget('bizE5', { kind: 'webhook', url: `${base}/lent`, events: ['task.done'] });
    replies = ['hang', 200];
    const t = Date.now();
    await dispatchEvent('bizE5', 'task.done', { title: 'lent' }, { dedupeKey: 'e2e-5' });
    expect(Date.now() - t).toBeGreaterThanOrEqual(350);
    expect(Date.now() - t).toBeLessThan(5_000);
    let [job] = await jobs();
    expect(job).toMatchObject({ status: 'queued', attempts: 1 });
    expect(job.lastError).toMatch(/injoignable/);
    await new Promise((r) => setTimeout(r, 50));
    expect(received[0].aborted).toBe(true);
    await later();
    [job] = await jobs();
    expect(job).toMatchObject({ status: 'done', attempts: 2 });
    await later();
    expect(received).toHaveLength(2);
    expect(received[0].headers['x-repere-delivery']).toBe(received[1].headers['x-repere-delivery']);
  });

  it('livraisons simultanées vers deux cibles : chaque statut est conservé', async () => {
    await addTarget('bizE6', { kind: 'webhook', url: `${base}/a`, events: ['task.done'] });
    await addTarget('bizE6', { kind: 'webhook', url: `${base}/b`, events: ['task.done'] });
    expect(await dispatchEvent('bizE6', 'task.done', { title: 'deux' })).toBe(2);
    expect(received.map((r) => r.url).sort()).toEqual(['/a', '/b']);
    expect((await listTargets('bizE6')).map((t) => t.lastStatus?.ok)).toEqual([true, true]);
  });

  it('bouton « Tester » : événement test signé livré directement', async () => {
    const { target, secret } = await addTarget('bizE7', { kind: 'webhook', url: `${base}/test` });
    const r = await sendTest('bizE7', target.id, 'Boulangerie Martin');
    expect(r).toEqual({ ok: true, code: 200 });
    expect(received).toHaveLength(1);
    expect(JSON.parse(received[0].body)).toMatchObject({ event: 'test', businessId: 'bizE7', data: { title: 'Repéré est bien connecté' } });
    expect(verifySignature(secret!, received[0].body, String(received[0].headers['x-repere-signature']))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
const SLACK_BLOCK_TYPES = new Set(['header', 'context', 'section', 'actions', 'divider']);
/** Contraintes du format Block Kit des webhooks entrants Slack (au-delà : 400 invalid_blocks). */
function assertSlackPayload(p: { text?: unknown; blocks?: unknown }) {
  expect(typeof p.text).toBe('string');
  expect((p.text as string).length).toBeGreaterThan(0);
  const blocks = p.blocks as { type: string; text?: { type: string; text: string }; elements?: { type: string; text: unknown; url?: string }[] }[];
  expect(Array.isArray(blocks)).toBe(true);
  expect(blocks.length).toBeLessThanOrEqual(SLACK_LIMITS.blocks);
  for (const b of blocks) {
    expect(SLACK_BLOCK_TYPES.has(b.type)).toBe(true);
    if (b.type === 'header') {
      expect(b.text!.type).toBe('plain_text');
      expect(b.text!.text.length).toBeGreaterThan(0);
      expect(b.text!.text.length).toBeLessThanOrEqual(150);
    }
    if (b.type === 'section') {
      expect(b.text!.type).toBe('mrkdwn');
      expect(b.text!.text.length).toBeLessThanOrEqual(3000);
      expect(b.text!.text).not.toMatch(/&[a-z]{0,4}…?$/); // aucune entité coupée
    }
    if (b.type === 'context') for (const e of b.elements!) expect(String(e.text).length).toBeLessThanOrEqual(3000);
    if (b.type === 'actions') for (const e of b.elements!) expect(e.url).toMatch(/^https?:\/\//);
  }
}

describe('Slack', () => {
  it('message au format attendu par Slack (text + blocks), sans signature Repéré', async () => {
    await addTarget('bizS1', { kind: 'slack', url: `${base}/services/T000/B000/XXXX` });
    replies = [200];
    await dispatchEvent('bizS1', 'alert.created', {
      title: 'Score en baisse',
      body: 'Le score <b>baisse</b> & ChatGPT ne vous cite plus',
      severity: 'critique',
      href: '/app/alertes',
      businessName: 'Boulangerie Martin',
    });
    expect(received).toHaveLength(1);
    const r = received[0];
    expect(r.url).toBe('/services/T000/B000/XXXX');
    expect(r.headers['content-type']).toBe('application/json');
    expect(r.headers['x-repere-signature']).toBeUndefined();
    const p = JSON.parse(r.body);
    assertSlackPayload(p);
    expect(p.text).toBe('[Critique] Score en baisse');
    expect(p.blocks).toEqual([
      { type: 'header', text: { type: 'plain_text', text: '[Critique] Score en baisse', emoji: false } },
      { type: 'context', elements: [{ type: 'mrkdwn', text: 'Repéré · Nouvelle alerte · Boulangerie Martin' }] },
      { type: 'section', text: { type: 'mrkdwn', text: 'Le score &lt;b&gt;baisse&lt;/b&gt; &amp; ChatGPT ne vous cite plus' } },
      { type: 'actions', elements: [{ type: 'button', text: { type: 'plain_text', text: 'Ouvrir dans Repéré' }, url: `${appUrl()}/app/alertes` }] },
    ]);
  });

  it('titre vide, titre et corps trop longs : toujours accepté par Slack', async () => {
    await addTarget('bizS2', { kind: 'slack', url: `${base}/services/T1/B1/Y` });
    await dispatchEvent('bizS2', 'task.done', { title: '' });
    await dispatchEvent('bizS2', 'task.done', { title: 'T'.repeat(400), body: '&'.repeat(5000) });
    expect(received).toHaveLength(2);
    for (const r of received) assertSlackPayload(JSON.parse(r.body));
    expect(JSON.parse(received[0].body).blocks[0].text.text).toBe('Notification Repéré');
  });

  it('Slack répond 404 (no_service) : abandon immédiat, notifié', async () => {
    await addTarget('bizS3', { kind: 'slack', url: `${base}/services/T2/B2/Z` });
    replies = [404];
    await dispatchEvent('bizS3', 'task.done', { title: 'x' });
    await later();
    expect(received).toHaveLength(1);
    expect((await jobs())[0]).toMatchObject({ status: 'dead', attempts: 1 });
    expect((await listNotifications('bizS3')).items[0].type).toBe('integration_error');
  });
});

// ---------------------------------------------------------------------------
describe('adresses interdites', () => {
  const FORBIDDEN = [
    'https://127.0.0.1/h',
    'https://localhost/h',
    'https://localhost./h',
    'https://LOCALHOST/h',
    'https://[::1]/h',
    'https://10.0.0.5/h',
    'https://192.168.1.2/h',
    'https://172.16.0.1/h',
    'https://169.254.169.254/latest/meta-data',
    'https://0.0.0.0/h',
    'https://2130706433/h',
    'https://0x7f.1/h',
    'https://[::ffff:127.0.0.1]/h',
    'https://service.internal/h',
    'https://imprimante.local/h',
  ];

  it('refusées en production (et l’option de test y est inactivable)', async () => {
    const { target } = await addTarget('bizP1', { kind: 'webhook', url: `${base}/prod`, events: ['task.done'] });
    const prev = env.NODE_ENV;
    env.NODE_ENV = 'production';
    try {
      expect(() => __allowLocalTargetsForTests({})).toThrow(/production/);
      expect(() => checkWebhookUrl(`${base}/prod`, 'webhook')).toThrow();
      expect(() => checkWebhookUrl(`${base}/services/T/B/C`, 'slack')).toThrow(/Slack/);
      for (const u of FORBIDDEN) expect(() => checkWebhookUrl(u, 'webhook'), u).toThrow(/interne|https/);
      expect(checkWebhookUrl('https://exemple.fr/hook', 'webhook')).toBe('https://exemple.fr/hook');
      // Cible locale déjà enregistrée : revalidée à l'envoi → abandon définitif, aucune requête.
      await expect(
        deliverWebhook({ businessId: 'bizP1', targetId: target.id, event: 'task.done', deliveryId: 'dl_prod', data: { title: 'x' }, _job: { attempt: 1, maxAttempts: 5 } }),
      ).rejects.toBeInstanceOf(PermanentJobError);
    } finally {
      env.NODE_ENV = prev;
    }
    expect(received).toHaveLength(0);
    expect((await listNotifications('bizP1')).items[0]).toMatchObject({ type: 'integration_error' });
  });

  it('hors production, seules les adresses de bouclage sont permises, et seulement avec l’option explicite', () => {
    const loopback = (u: string) => ['127.0.0.1', 'localhost', '::1'].includes(new URL(u).hostname.replace(/^\[|\]$/g, '').replace(/\.+$/, '').toLowerCase());
    expect(FORBIDDEN.filter((u) => !loopback(u)).length).toBeGreaterThan(5);
    for (const u of FORBIDDEN.filter((x) => !loopback(x))) {
      expect(() => checkWebhookUrl(u, 'webhook'), u).toThrow();
    }
    __allowLocalTargetsForTests(null);
    try {
      expect(() => checkWebhookUrl(`${base}/x`, 'webhook')).toThrow(/https/);
      expect(() => checkWebhookUrl('https://127.0.0.1/x', 'webhook')).toThrow(/interne/);
    } finally {
      __allowLocalTargetsForTests({ timeoutMs: 400 });
    }
  });
});

// ---------------------------------------------------------------------------
describe('secrets chiffrés au repos (INTEGRATIONS_SECRET)', () => {
  it('ni l’adresse ni le secret ne sont lisibles sur disque', async () => {
    const { secret } = await addTarget('bizC1', { kind: 'webhook', url: `${base}/cible-secrete-c1` });
    await new Promise((r) => setTimeout(r, 20));
    const raw = readFileSync(path.join(DIR, `doc-${CONFIG}.json`), 'utf8');
    expect(raw).toContain('bizC1');
    expect(raw).not.toContain('cible-secrete-c1');
    expect(raw).not.toContain(base);
    expect(raw).not.toContain(secret!);
    const t = (await getConfig('bizC1')).targets[0];
    expect(t.urlEnc).toMatch(/^v1\./);
    expect(decryptSecret(t.urlEnc)).toBe(`${base}/cible-secrete-c1`);
    expect(decryptSecret(t.secretEnc!)).toBe(secret);
  });

  it('clé changée : déchiffrement refusé, livraison abandonnée et signalée (aucun envoi)', async () => {
    await addTarget('bizC2', { kind: 'webhook', url: `${base}/c2`, events: ['task.done'] });
    const enc = encryptSecret('valeur');
    const saved = env.INTEGRATIONS_SECRET;
    env.INTEGRATIONS_SECRET = 'une-autre-cle';
    try {
      expect(() => decryptSecret(enc)).toThrow();
      await dispatchEvent('bizC2', 'task.done', { title: 'x' });
    } finally {
      env.INTEGRATIONS_SECRET = saved;
    }
    expect(received).toHaveLength(0);
    expect((await jobs())[0]).toMatchObject({ status: 'dead', attempts: 1 });
    expect((await listNotifications('bizC2')).items[0].body).toMatch(/illisible/);
  });

  it('production sans INTEGRATIONS_SECRET : aucun chiffrement de repli', () => {
    const prev = env.NODE_ENV;
    const saved = env.INTEGRATIONS_SECRET;
    env.NODE_ENV = 'production';
    delete env.INTEGRATIONS_SECRET;
    try {
      expect(() => encryptSecret('x')).toThrow(/INTEGRATIONS_SECRET/);
    } finally {
      env.NODE_ENV = prev;
      env.INTEGRATIONS_SECRET = saved;
    }
  });
});
