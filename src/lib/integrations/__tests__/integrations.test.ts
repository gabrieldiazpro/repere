import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  __setFetch, __skipDnsCheck, addTarget, checkWebhookUrl, decryptSecret, dispatchEvent, encryptSecret, formatSlackMessage, getConfig, isPrivateIp,
  listTargets, removeTarget, sendTest, signPayload, updateTarget, verifySignature,
} from '@/lib/integrations';
import { listNotifications } from '@/lib/notify/center';

const calls: { url: string; init: RequestInit }[] = [];
let status = 200;

beforeAll(() => {
  (globalThis as { __repereDocsDir?: string }).__repereDocsDir = mkdtempSync(path.join(os.tmpdir(), 'integ-'));
  __skipDnsCheck(true);
  __setFetch(async (url, init) => {
    calls.push({ url, init });
    return { ok: status < 300, status };
  });
});
afterAll(() => {
  __setFetch(null);
  __skipDnsCheck(false);
});

describe('signature HMAC', () => {
  it('signe et vérifie', () => {
    const body = '{"a":1}';
    const h = signPayload('whsec_x', body, 1_700_000_000);
    expect(h).toMatch(/^t=1700000000,v1=[0-9a-f]{64}$/);
    expect(verifySignature('whsec_x', body, h, { now: 1_700_000_100 })).toBe(true);
    expect(verifySignature('whsec_y', body, h, { now: 1_700_000_100 })).toBe(false);
    expect(verifySignature('whsec_x', '{"a":2}', h, { now: 1_700_000_100 })).toBe(false);
    expect(verifySignature('whsec_x', body, h, { now: 1_700_001_000 })).toBe(false); // hors tolérance
    expect(verifySignature('whsec_x', body, null)).toBe(false);
  });
  it('chiffrement des secrets', () => {
    const enc = encryptSecret('https://hooks.slack.com/services/T/B/C');
    expect(enc).not.toContain('slack');
    expect(decryptSecret(enc)).toBe('https://hooks.slack.com/services/T/B/C');
    const parts = enc.split('.');
    parts[3] = parts[3].slice(0, -2) + (parts[3].endsWith('A') ? 'BB' : 'AA');
    expect(() => decryptSecret(parts.join('.'))).toThrow();
  });
});

describe('validation des adresses', () => {
  it('Slack et webhook', () => {
    expect(() => checkWebhookUrl('https://hooks.slack.com/services/T0/B0/xyz', 'slack')).not.toThrow();
    expect(() => checkWebhookUrl('https://evil.com/services/T0/B0/xyz', 'slack')).toThrow();
    expect(() => checkWebhookUrl('http://exemple.fr/hook', 'webhook')).toThrow(/https/);
    expect(() => checkWebhookUrl('https://localhost/hook', 'webhook')).toThrow(/interne/);
    expect(() => checkWebhookUrl('https://192.168.1.2/hook', 'webhook')).toThrow(/interne/);
    expect(() => checkWebhookUrl('https://user:pw@exemple.fr/hook', 'webhook')).toThrow();
    expect(() => checkWebhookUrl('https://exemple.fr:8443/hook', 'webhook')).toThrow();
    expect(checkWebhookUrl('https://exemple.fr/hook', 'webhook')).toBe('https://exemple.fr/hook');
    expect(isPrivateIp('10.0.0.1')).toBe(true);
    expect(isPrivateIp('::ffff:127.0.0.1')).toBe(true);
    expect(isPrivateIp('93.184.216.34')).toBe(false);
  });
});

describe('livraison', () => {
  it('webhook signé via la file, Slack formaté', async () => {
    const { target, secret } = await addTarget('bizI', { kind: 'webhook', url: 'https://exemple.fr/hook', events: ['task.done'] });
    expect(secret).toMatch(/^whsec_/);
    await addTarget('bizI', { kind: 'slack', url: 'https://hooks.slack.com/services/T0/B0/xyz' });
    const cfg = await getConfig('bizI');
    expect(JSON.stringify(cfg)).not.toContain('exemple.fr/hook');
    calls.length = 0;
    const n = await dispatchEvent('bizI', 'task.done', { title: 'Tâche faite : fiche Google', href: '/app/taches' }, { dedupeKey: 'k1' });
    expect(n).toBe(2);
    const hook = calls.find((c) => c.url === 'https://exemple.fr/hook')!;
    const headers = hook.init.headers as Record<string, string>;
    expect(verifySignature(secret!, String(hook.init.body), headers['X-Repere-Signature'])).toBe(true);
    expect(JSON.parse(String(hook.init.body))).toMatchObject({ event: 'task.done', businessId: 'bizI' });
    const slack = calls.find((c) => c.url.startsWith('https://hooks.slack.com'))!;
    expect(JSON.parse(String(slack.init.body)).blocks.length).toBeGreaterThan(1);
    // non abonné
    calls.length = 0;
    expect(await dispatchEvent('bizI', 'alert.created', { title: 'x' }, { only: ['webhook'] })).toBe(0);
    // dédoublonnage
    expect(await dispatchEvent('bizI', 'task.done', { title: 'x' }, { dedupeKey: 'k1', only: ['webhook'] })).toBe(1);
    expect(calls).toHaveLength(0);
    // désactivation, test, suppression
    await updateTarget('bizI', target.id, { active: false });
    expect(await dispatchEvent('bizI', 'task.done', { title: 'y' }, { only: ['webhook'] })).toBe(0);
    status = 500;
    const r = await sendTest('bizI', target.id);
    expect(r.ok).toBe(false);
    expect((await listTargets('bizI')).find((t) => t.id === target.id)?.lastStatus?.ok).toBe(false);
    status = 200;
    expect(await removeTarget('bizI', target.id)).toBe(true);
  });

  it('échec définitif → notification d’erreur d’intégration', async () => {
    const { deliverWebhook } = await import('@/lib/integrations');
    const { target } = await addTarget('bizJ', { kind: 'webhook', url: 'https://exemple.fr/h2' });
    status = 503;
    await expect(deliverWebhook({ businessId: 'bizJ', targetId: target.id, event: 'alert.created', deliveryId: 'dl_x', data: { title: 't' }, _job: { attempt: 5, maxAttempts: 5 } })).rejects.toThrow();
    status = 200;
    const { items } = await listNotifications('bizJ');
    expect(items[0].type).toBe('integration_error');
  });

  it('compte démo : rien n’est enregistré ni envoyé', async () => {
    await expect(addTarget('demo', { kind: 'webhook', url: 'https://exemple.fr/hook' })).rejects.toThrow(/démonstration/);
    expect(await dispatchEvent('demo', 'task.done', { title: 'x' })).toBe(0);
  });

  it('message Slack échappé', () => {
    const m = formatSlackMessage('alert.created', { title: 'Alerte', body: '<script>&', severity: 'critique', href: '/app' }) as { blocks: { text?: { text: string } }[] };
    expect(JSON.stringify(m)).toContain('&lt;script&gt;&amp;');
    expect(m.blocks[0].text!.text).toContain('[Critique]');
  });
});
