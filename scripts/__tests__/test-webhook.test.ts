/** scripts/ops/test-webhook.mjs : envoi réel vers un serveur local, signature vérifiée avec la bibliothèque de production. */
import { execFile } from 'node:child_process';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { verifySignature } from '@/lib/integrations';

const SCRIPT = path.resolve(__dirname, '..', 'ops', 'test-webhook.mjs');
const got: { headers: http.IncomingHttpHeaders; body: string; url: string }[] = [];
let status = 200;
let server: http.Server;
let base = '';

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      got.push({ headers: req.headers, body: Buffer.concat(chunks).toString('utf8'), url: req.url ?? '' });
      res.writeHead(status, { 'Content-Type': 'text/plain' });
      res.end(status < 300 ? 'reçu' : 'non');
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((r) => server.close(() => r()));
});

function run(args: string[], extraEnv: Record<string, string> = {}): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const envNoSecret = { ...process.env, ...extraEnv };
    if (!('WEBHOOK_SECRET' in extraEnv)) delete envNoSecret.WEBHOOK_SECRET;
    execFile(process.execPath, [SCRIPT, ...args], { env: envNoSecret, timeout: 20_000 }, (err, stdout, stderr) => {
      resolve({ code: err ? ((err as { code?: number }).code ?? 1) : 0, stdout, stderr });
    });
  });
}

describe('scripts/ops/test-webhook.mjs', () => {
  it('envoie un événement de test signé, vérifiable avec verifySignature, et affiche la réponse', async () => {
    got.length = 0;
    status = 200;
    const r = await run([`${base}/hook`, '--secret', 'whsec_script']);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('← 200');
    expect(r.stdout).toContain('reçu');
    expect(got).toHaveLength(1);
    const { headers, body } = got[0];
    expect(verifySignature('whsec_script', body, String(headers['x-repere-signature']))).toBe(true);
    expect(headers['x-repere-event']).toBe('test');
    expect(JSON.parse(body)).toMatchObject({ id: headers['x-repere-delivery'], event: 'test', data: { title: 'Repéré est bien connecté' } });
  });

  it('secret par variable d’environnement ; réponse 500 → code de sortie 1', async () => {
    got.length = 0;
    status = 500;
    const r = await run([`${base}/hook`], { WEBHOOK_SECRET: 'whsec_env' });
    expect(r.code).toBe(1);
    expect(r.stdout).toContain('← 500');
    expect(verifySignature('whsec_env', got[0].body, String(got[0].headers['x-repere-signature']))).toBe(true);
  });

  it('Slack : blocs sans signature ; usage incorrect → code 2 ; --dry-run n’envoie rien', async () => {
    got.length = 0;
    status = 200;
    expect((await run([`${base}/services/T/B/C`, '--slack'])).code).toBe(0);
    expect(got[0].headers['x-repere-signature']).toBeUndefined();
    expect(JSON.parse(got[0].body).blocks[0].type).toBe('header');
    expect((await run([`${base}/hook`])).code).toBe(2); // secret manquant
    expect((await run([])).code).toBe(2);
    expect((await run([`${base}/hook`, '--secret', 's', '--dry-run'])).code).toBe(0);
    expect(got).toHaveLength(1);
  });
});
