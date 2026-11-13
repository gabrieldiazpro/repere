#!/usr/bin/env node
/**
 * Envoie un événement de test signé à une URL réelle et affiche la réponse (vérification d'une intégration en
 * production, sans passer par l'application).
 *
 *   node scripts/ops/test-webhook.mjs <url> [--secret whsec_…] [--event test] [--slack] [--dry-run] [--timeout 10]
 *
 * - Webhook générique : même format que src/lib/integrations (corps JSON { id, event, createdAt, businessId, data },
 *   en-têtes X-Repere-Event, X-Repere-Delivery, X-Repere-Signature: t=<secondes>,v1=<HMAC-SHA256 hex de "t.corps">).
 *   Le secret vient de --secret ou de la variable WEBHOOK_SECRET (secret « whsec_… » affiché à la création).
 * - Slack (URL https://hooks.slack.com/… ou --slack) : message Block Kit (text + blocks), sans signature.
 * - Aucune redirection suivie. Code de sortie : 0 si la réponse est 2xx, 1 sinon, 2 en cas d'usage incorrect.
 */
import crypto from 'node:crypto';

function usage(msg) {
  if (msg) console.error(`Erreur : ${msg}\n`);
  console.error('Usage : node scripts/ops/test-webhook.mjs <url> [--secret whsec_…] [--event test] [--slack] [--dry-run] [--timeout 10]');
  process.exit(2);
}

const args = process.argv.slice(2);
const opts = { url: '', secret: process.env.WEBHOOK_SECRET || '', event: 'test', slack: false, dryRun: false, timeout: 10 };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--secret') opts.secret = args[++i] ?? '';
  else if (a === '--event') opts.event = args[++i] ?? 'test';
  else if (a === '--slack') opts.slack = true;
  else if (a === '--dry-run') opts.dryRun = true;
  else if (a === '--timeout') opts.timeout = Number(args[++i]);
  else if (a === '-h' || a === '--help') usage();
  else if (a.startsWith('--')) usage(`option inconnue ${a}`);
  else if (!opts.url) opts.url = a;
  else usage(`argument en trop : ${a}`);
}
if (!opts.url) usage('URL manquante.');
let target;
try {
  target = new URL(opts.url);
} catch {
  usage(`URL invalide : ${opts.url}`);
}
if (target.protocol !== 'https:' && target.protocol !== 'http:') usage('seules les URL http(s) sont acceptées.');
if (!Number.isFinite(opts.timeout) || opts.timeout <= 0) usage('--timeout doit être un nombre de secondes positif.');
const slack = opts.slack || target.hostname === 'hooks.slack.com';
if (!slack && !opts.secret) usage('secret manquant : --secret whsec_… ou variable WEBHOOK_SECRET.');

const deliveryId = `dl_test_${crypto.randomUUID()}`;
const now = new Date();
const title = 'Repéré est bien connecté';
const text = 'Message de test envoyé par scripts/ops/test-webhook.mjs.';

let body;
const headers = { 'Content-Type': 'application/json', 'User-Agent': 'Repere-Webhooks/1.0' };
if (slack) {
  body = JSON.stringify({
    text: title,
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: title, emoji: false } },
      { type: 'context', elements: [{ type: 'mrkdwn', text: 'Repéré · Message de test' }] },
      { type: 'section', text: { type: 'mrkdwn', text } },
    ],
  });
} else {
  body = JSON.stringify({
    id: deliveryId,
    event: opts.event,
    createdAt: now.toISOString(),
    businessId: 'test',
    data: { title, body: text, url: null, severity: 'info' },
  });
  const t = Math.floor(now.getTime() / 1000);
  const v1 = crypto.createHmac('sha256', opts.secret).update(`${t}.${body}`).digest('hex');
  headers['X-Repere-Signature'] = `t=${t},v1=${v1}`;
  headers['X-Repere-Event'] = opts.event;
  headers['X-Repere-Delivery'] = deliveryId;
}

console.log(`→ POST ${target.href}`);
for (const [k, v] of Object.entries(headers)) console.log(`  ${k}: ${v}`);
console.log(`  (corps ${Buffer.byteLength(body)} octets)`);
console.log(body);
if (opts.dryRun) process.exit(0);

const started = Date.now();
try {
  const res = await fetch(target, { method: 'POST', headers, body, redirect: 'manual', signal: AbortSignal.timeout(opts.timeout * 1000) });
  const ms = Date.now() - started;
  const raw = await res.text().catch(() => '');
  console.log(`\n← ${res.status} ${res.statusText} (${ms} ms)`);
  for (const [k, v] of res.headers) console.log(`  ${k}: ${v}`);
  if (raw) console.log(raw.length > 2000 ? `${raw.slice(0, 2000)}… (${raw.length} caractères)` : raw);
  if (res.status >= 300 && res.status < 400) console.log('Redirection non suivie : Repéré ne suit pas les redirections, utilisez l’adresse finale.');
  else if (res.status >= 400 && res.status < 500 && ![408, 425, 429].includes(res.status)) console.log('Refus définitif : Repéré ne retentera pas ce type de réponse.');
  else if (!res.ok) console.log('Erreur temporaire : Repéré retentera (jusqu’à 5 essais, délai croissant).');
  process.exit(res.ok ? 0 : 1);
} catch (e) {
  const timeout = e && (e.name === 'TimeoutError' || e.name === 'AbortError');
  console.error(`\n✗ ${timeout ? `aucune réponse en ${opts.timeout} s` : `échec réseau : ${e && e.message ? e.message : e}`}`);
  process.exit(1);
}
