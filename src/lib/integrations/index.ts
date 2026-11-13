/**
 * Intégrations sortantes (docs/v3/09-audit-app.md n° 12) :
 * - Slack : webhook entrant (URL https://hooks.slack.com/services/…) collée par le client ; message en blocs.
 * - Webhook générique signé HMAC-SHA256 (événements audit.completed, alert.created, task.done).
 *
 * Les URL et secrets sont chiffrés (AES-256-GCM, clé dérivée de INTEGRATIONS_SECRET) dans `integrations.config`.
 * Chaque livraison passe par la file (`enqueue('webhook.deliver')`) : un échec lève une erreur → reprise par la file.
 * Règle de reprise : 5xx, 408, 425, 429, délai dépassé (10 s) ou réseau → nouvelle tentative (backoff exponentiel de
 * la file, `JOBS_MAX_ATTEMPTS` essais) ; autre 4xx, 3xx, adresse refusée ou secret illisible → abandon immédiat.
 * Tout abandon est journalisé (`integrations.deliveries`) et signalé dans le centre de notifications.
 * Même `id` / `X-Repere-Delivery` et même `createdAt` à chaque tentative : le récepteur dédoublonne sur l'id.
 * Comptes démo : lecture seule, aucune livraison.
 */
import crypto from 'node:crypto';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import { PermanentJobError } from '@/lib/jobs';
import { isBlockedIp, resolvePublic, type ResolvedAddress } from '@/lib/siteaudit/fetch';
import { getDoc, listDocs, putDoc } from '@/lib/store';
import { isDemoBusinessId } from '@/lib/demo-v2';
import { appUrl } from '@/lib/email';
import { addNotification } from '@/lib/notify/center';
import { enqueue, getEntitlements, registerHandler } from '@/lib/notify/platform';
import { getBusinessRecord } from '@/lib/db';

export const CONFIG = 'integrations.config';
export const DELIVERIES = 'integrations.deliveries';

export const EVENTS = ['audit.completed', 'alert.created', 'task.done', 'measure.result'] as const;
export type IntegrationEvent = (typeof EVENTS)[number] | 'test';
export const isEvent = (v: unknown): v is (typeof EVENTS)[number] => typeof v === 'string' && (EVENTS as readonly string[]).includes(v);

export const EVENT_LABELS: Record<(typeof EVENTS)[number], string> = {
  'audit.completed': 'Mesure terminée',
  'alert.created': 'Nouvelle alerte',
  'task.done': 'Tâche faite',
  'measure.result': 'Résultat d’une mesure avant/après',
};

export type TargetKind = 'slack' | 'webhook';
export const MAX_WEBHOOKS = 3;

export interface IntegrationTarget {
  id: string;
  kind: TargetKind;
  label: string;
  /** URL chiffrée */
  urlEnc: string;
  /** hôte + 4 derniers caractères, pour l'affichage */
  hint: string;
  /** secret de signature chiffré (webhook générique uniquement) */
  secretEnc?: string;
  events: (typeof EVENTS)[number][];
  active: boolean;
  createdAt: string;
  lastStatus?: { ok: boolean; at: string; code?: number; error?: string } | null;
}

export interface IntegrationConfig {
  businessId: string;
  targets: IntegrationTarget[];
}

export interface IntegrationTargetView {
  id: string;
  kind: TargetKind;
  label: string;
  hint: string;
  events: string[];
  active: boolean;
  createdAt: string;
  lastStatus: IntegrationTarget['lastStatus'] | null;
}

export class IntegrationError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// Chiffrement des secrets
// ---------------------------------------------------------------------------
function key(): Buffer {
  // Jamais de repli sur un autre secret (ni la clé service_role) en production (F3 de qa/v3/securite-v3.md).
  if (!process.env.INTEGRATIONS_SECRET && process.env.NODE_ENV === 'production') throw new Error('INTEGRATIONS_SECRET manquant');
  const s = process.env.INTEGRATIONS_SECRET || 'repere-dev-integrations';
  return crypto.createHash('sha256').update(`integrations:${s}`).digest();
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return `v1.${iv.toString('base64url')}.${c.getAuthTag().toString('base64url')}.${enc.toString('base64url')}`;
}

export function decryptSecret(blob: string): string {
  const [v, iv, tag, data] = blob.split('.');
  if (v !== 'v1' || !iv || !tag || data === undefined) throw new Error('secret illisible');
  const d = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
  d.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([d.update(Buffer.from(data, 'base64url')), d.final()]).toString('utf8');
}

// ---------------------------------------------------------------------------
// Signature HMAC (webhook générique) — en-tête « X-Repere-Signature: t=<secondes>,v1=<hex> »
// ---------------------------------------------------------------------------
export const SIGNATURE_HEADER = 'X-Repere-Signature';

export function signPayload(secret: string, body: string, timestamp: number = Math.floor(Date.now() / 1000)): string {
  const v1 = crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  return `t=${timestamp},v1=${v1}`;
}

/** Vérification côté récepteur (documentée pour les clients) : tolérance de 5 minutes par défaut. */
export function verifySignature(secret: string, body: string, header: string | null | undefined, opts: { toleranceSec?: number; now?: number } = {}): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(',').map((p) => p.trim().split('=') as [string, string]));
  const t = Number(parts.t);
  if (!Number.isFinite(t) || !parts.v1) return false;
  const now = opts.now ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - t) > (opts.toleranceSec ?? 300)) return false;
  const expected = Buffer.from(crypto.createHmac('sha256', secret).update(`${t}.${body}`).digest('hex'));
  const got = Buffer.from(parts.v1);
  return expected.length === got.length && crypto.timingSafeEqual(expected, got);
}

export function newWebhookSecret(): string {
  return `whsec_${crypto.randomBytes(24).toString('base64url')}`;
}

// ---------------------------------------------------------------------------
// Validation des URL (anti-SSRF)
// ---------------------------------------------------------------------------
export const SLACK_URL_RE = /^https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9]+\/[A-Za-z0-9]+\/[A-Za-z0-9]+$/;

/** Une seule source de vérité (siteaudit) : couvre NAT64, 6to4, fe80::/10, fec0::/10, hors 2000::/3… (M2). */
export function isPrivateIp(ip: string): boolean {
  return isBlockedIp(ip);
}

// ---------------------------------------------------------------------------
// Option réservée aux tests : cibles locales (http://127.0.0.1:<port>) pour les tests de bout en bout.
// Activable uniquement par un appel de code (jamais par une variable d'environnement) et inopérante en production.
// ---------------------------------------------------------------------------
let localTargets: { timeoutMs: number } | null = null;
export const DELIVERY_TIMEOUT_MS = 10_000;

/** Tests : autorise les cibles de bouclage (http, tout port) et règle le délai d'envoi. `null` rétablit la règle. */
export function __allowLocalTargetsForTests(opts: { timeoutMs?: number } | null): void {
  if (opts && process.env.NODE_ENV === 'production') throw new Error('Option réservée aux tests : interdite en production.');
  localTargets = opts ? { timeoutMs: opts.timeoutMs ?? DELIVERY_TIMEOUT_MS } : null;
}
const localAllowed = () => localTargets !== null && process.env.NODE_ENV !== 'production';
const isLoopbackHost = (h: string) => h === 'localhost' || h === '127.0.0.1' || h === '::1';

function normalizedHost(u: URL): string {
  return u.hostname.replace(/^\[|\]$/g, '').replace(/\.+$/, '').toLowerCase();
}

/** Contrôle statique : https, pas d'identifiants, port standard, pas d'hôte local. */
export function checkWebhookUrl(raw: string, kind: TargetKind): string {
  const s = raw.trim();
  if (localAllowed()) {
    try {
      const u = new URL(s);
      if ((u.protocol === 'http:' || u.protocol === 'https:') && isLoopbackHost(normalizedHost(u)) && !u.username && !u.password) return u.toString();
    } catch {
      /* contrôle normal ci-dessous */
    }
  }
  if (kind === 'slack') {
    if (!SLACK_URL_RE.test(s)) throw new IntegrationError(400, 'Adresse Slack invalide : elle commence par https://hooks.slack.com/services/.');
    return s;
  }
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    throw new IntegrationError(400, 'Adresse de webhook invalide.');
  }
  if (u.protocol !== 'https:') throw new IntegrationError(400, 'Le webhook doit utiliser https.');
  if (u.username || u.password) throw new IntegrationError(400, 'Retirez les identifiants de l’adresse.');
  if (u.port && u.port !== '443') throw new IntegrationError(400, 'Seul le port 443 est accepté.');
  // Point final retiré (« localhost. » est le même hôte que « localhost »).
  const host = normalizedHost(u);
  if (!host || /^(localhost|.*\.local|.*\.internal|.*\.localhost)$/i.test(host) || (net.isIP(host) && isPrivateIp(host))) {
    throw new IntegrationError(400, 'Adresse interne refusée.');
  }
  if (s.length > 500) throw new IntegrationError(400, 'Adresse trop longue.');
  return u.toString();
}

/**
 * Envoi POST épinglé sur l'adresse validée par resolvePublic (aucune seconde résolution DNS : le rebinding est sans
 * effet ; M2 de qa/v3/securite-v3.md). Corps de la réponse jamais lu.
 */
async function pinnedPost(url: string, headers: Record<string, string>, body: string): Promise<{ ok: boolean; status: number }> {
  const u = new URL(url);
  const local = localAllowed() && isLoopbackHost(normalizedHost(u));
  const address: ResolvedAddress = local
    ? { address: normalizedHost(u) === 'localhost' ? '127.0.0.1' : normalizedHost(u), family: normalizedHost(u) === '::1' ? 6 : 4 }
    : await resolvePublic(u.hostname);
  const transport = local && u.protocol === 'http:' ? http : https;
  return new Promise((resolve, reject) => {
    const req = transport.request(
      u,
      {
        method: 'POST',
        headers: { ...headers, 'Content-Length': String(Buffer.byteLength(body)) },
        agent: false,
        signal: AbortSignal.timeout(localAllowed() ? localTargets!.timeoutMs : DELIVERY_TIMEOUT_MS),
        lookup: ((_h: string, opts: { all?: boolean }, cb: (...a: unknown[]) => void) =>
          opts && opts.all ? cb(null, [{ address: address.address, family: address.family }]) : cb(null, address.address, address.family)) as never,
      },
      (res) => {
        res.resume();
        const status = res.statusCode ?? 0;
        resolve({ ok: status >= 200 && status < 300, status });
      },
    );
    req.on('error', reject);
    req.end(body);
  });
}

function hintOf(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname}…${url.slice(-4)}`;
  } catch {
    return '…';
  }
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
export async function getConfig(businessId: string): Promise<IntegrationConfig> {
  if (isDemoBusinessId(businessId)) return { businessId, targets: [] };
  const doc = await getDoc<IntegrationConfig>(CONFIG, businessId);
  return doc?.data ?? { businessId, targets: [] };
}

const toView = (t: IntegrationTarget): IntegrationTargetView => ({
  id: t.id, kind: t.kind, label: t.label, hint: t.hint, events: t.events, active: t.active, createdAt: t.createdAt, lastStatus: t.lastStatus ?? null,
});

export async function listTargets(businessId: string): Promise<IntegrationTargetView[]> {
  return (await getConfig(businessId)).targets.map(toView);
}

async function saveConfig(c: IntegrationConfig): Promise<void> {
  if (isDemoBusinessId(c.businessId)) return;
  await putDoc<IntegrationConfig>(CONFIG, c.businessId, c, c.businessId);
}

/**
 * Lecture-modification-écriture de la configuration sérialisée par commerce : deux livraisons simultanées (worker en
 * parallèle) ne perdent plus le `lastStatus` de l'autre, et une livraison en cours ne ressuscite pas une cible
 * supprimée (avec Supabase, getDoc renvoie une copie : la dernière écriture écrasait tout).
 */
const configLocks = new Map<string, Promise<unknown>>();
function withConfig<T>(businessId: string, fn: () => Promise<T>): Promise<T> {
  const prev = configLocks.get(businessId) ?? Promise.resolve();
  const run = prev.catch(() => undefined).then(fn);
  const tail = run.catch(() => undefined);
  configLocks.set(businessId, tail);
  void tail.then(() => {
    if (configLocks.get(businessId) === tail) configLocks.delete(businessId);
  });
  return run;
}

export interface AddTargetInput {
  kind: TargetKind;
  url: string;
  label?: string;
  events?: string[];
}

/** Ajoute Slack (remplace l'éventuel Slack existant) ou un webhook (3 max). Le secret n'est montré qu'ici. */
export async function addTarget(businessId: string, input: AddTargetInput, now: Date = new Date()): Promise<{ target: IntegrationTargetView; secret?: string }> {
  if (isDemoBusinessId(businessId)) throw new IntegrationError(403, 'Compte de démonstration : les modifications ne sont pas enregistrées.');
  const url = checkWebhookUrl(input.url, input.kind);
  return withConfig(businessId, () => addTargetLocked(businessId, input, url, now));
}

async function addTargetLocked(businessId: string, input: AddTargetInput, url: string, now: Date): Promise<{ target: IntegrationTargetView; secret?: string }> {
  const c = await getConfig(businessId);
  const events = (input.events ?? [...EVENTS]).filter(isEvent);
  const id = `int_${crypto.randomBytes(8).toString('base64url')}`;
  const secret = input.kind === 'webhook' ? newWebhookSecret() : undefined;
  const t: IntegrationTarget = {
    id,
    kind: input.kind,
    label: (input.label ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 60) || (input.kind === 'slack' ? 'Slack' : 'Webhook'),
    urlEnc: encryptSecret(url),
    hint: hintOf(url),
    ...(secret ? { secretEnc: encryptSecret(secret) } : {}),
    events: events.length ? [...new Set(events)] : [...EVENTS],
    active: true,
    createdAt: now.toISOString(),
    lastStatus: null,
  };
  let targets = c.targets;
  if (input.kind === 'slack') targets = targets.filter((x) => x.kind !== 'slack');
  else if (targets.filter((x) => x.kind === 'webhook').length >= MAX_WEBHOOKS) throw new IntegrationError(400, `${MAX_WEBHOOKS} webhooks au maximum.`);
  await saveConfig({ businessId, targets: [...targets, t] });
  return { target: toView(t), ...(secret ? { secret } : {}) };
}

export async function updateTarget(businessId: string, id: string, patch: { active?: boolean; events?: string[]; label?: string }): Promise<IntegrationTargetView | null> {
  return withConfig(businessId, async () => {
  const c = await getConfig(businessId);
  const t = c.targets.find((x) => x.id === id);
  if (!t) return null;
  if (typeof patch.active === 'boolean') t.active = patch.active;
  if (Array.isArray(patch.events)) t.events = [...new Set(patch.events.filter(isEvent))];
  if (typeof patch.label === 'string') t.label = patch.label.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 60) || t.label;
  await saveConfig(c);
  return toView(t);
  });
}

export async function removeTarget(businessId: string, id: string): Promise<boolean> {
  return withConfig(businessId, async () => {
    const c = await getConfig(businessId);
    const n = c.targets.length;
    c.targets = c.targets.filter((x) => x.id !== id);
    if (c.targets.length === n) return false;
    await saveConfig(c);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------
export interface EventData {
  title: string;
  body?: string;
  /** lien interne (« /app/… ») */
  href?: string;
  severity?: 'critique' | 'important' | 'info';
  businessName?: string;
  data?: Record<string, unknown>;
}

const slackEsc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** Échappe puis tronque à `max` caractères sans couper une entité (`&amp;`…) : Slack refuse un texte > 3000. */
function slackText(s: string, max: number): string {
  const e = slackEsc(s);
  if (e.length <= max) return e;
  return `${e.slice(0, max - 1).replace(/&[a-z]{0,4}$/, '')}…`;
}
export const SLACK_LIMITS = { header: 150, text: 3000, blocks: 50 } as const;
const SEVERITY_MARK: Record<string, string> = { critique: '[Critique]', important: '[Important]', info: '' };

export function formatSlackMessage(event: IntegrationEvent, d: EventData): Record<string, unknown> {
  // Slack refuse un bloc « header » vide ou de plus de 150 caractères (invalid_blocks → 400).
  const head = (`${SEVERITY_MARK[d.severity ?? 'info'] ?? ''} ${String(d.title ?? '').replace(/\s+/g, ' ')}`.trim() || 'Notification Repéré').slice(0, SLACK_LIMITS.header);
  const label = event === 'test' ? 'Message de test' : EVENT_LABELS[event];
  const blocks: Record<string, unknown>[] = [
    { type: 'header', text: { type: 'plain_text', text: head, emoji: false } },
    { type: 'context', elements: [{ type: 'mrkdwn', text: slackText(`Repéré · ${label}${d.businessName ? ` · ${d.businessName}` : ''}`, 2900) }] },
  ];
  if (d.body) blocks.push({ type: 'section', text: { type: 'mrkdwn', text: slackText(d.body, 2900) } });
  if (d.href && d.href.startsWith('/') && !d.href.startsWith('//')) {
    blocks.push({ type: 'actions', elements: [{ type: 'button', text: { type: 'plain_text', text: 'Ouvrir dans Repéré' }, url: `${appUrl()}${d.href}` }] });
  }
  return { text: head, blocks };
}

export function formatWebhookBody(event: IntegrationEvent, businessId: string, d: EventData, deliveryId: string, now: Date | string = new Date()): string {
  return JSON.stringify({
    id: deliveryId,
    event,
    createdAt: typeof now === 'string' ? now : now.toISOString(),
    businessId,
    data: { title: d.title, body: d.body ?? '', url: d.href && d.href.startsWith('/') && !d.href.startsWith('//') ? `${appUrl()}${d.href}` : null, severity: d.severity ?? 'info', ...(d.data ?? {}) },
  });
}

// ---------------------------------------------------------------------------
// Livraison
// ---------------------------------------------------------------------------
export interface DeliveryRecord {
  id: string;
  businessId: string;
  targetId: string;
  event: IntegrationEvent;
  ok: boolean;
  code?: number;
  error?: string;
  attempt: number;
  at: string;
}

type FetchLike = (url: string, init: RequestInit) => Promise<{ ok: boolean; status: number }>;
let fetchImpl: FetchLike = (url, init) => fetch(url, init);
/** Tests : remplace fetch. */
export function __setFetch(f: FetchLike | null): void {
  fetchImpl = f ?? ((url, init) => fetch(url, init));
}
let skipDns = false;
/** Tests : désactive la résolution DNS (sans effet en production). */
export function __skipDnsCheck(v: boolean): void {
  skipDns = v;
}

export interface PostResult {
  ok: boolean;
  code?: number;
  error?: string;
  /** vrai : inutile de réessayer (4xx hors 408/425/429, 3xx, adresse refusée, secret illisible) */
  permanent?: boolean;
}

/** Statuts HTTP qui méritent une nouvelle tentative. */
export function isRetryableStatus(status: number): boolean {
  return status >= 500 || status === 408 || status === 425 || status === 429 || status === 0;
}

async function post(t: IntegrationTarget, event: IntegrationEvent, businessId: string, d: EventData, deliveryId: string, createdAt?: string): Promise<PostResult> {
  let url: string;
  let secret: string | null = null;
  try {
    // Clé INTEGRATIONS_SECRET changée ou config abîmée : abandon journalisé (auparavant l'erreur sortait avant le
    // journal et la notification d'échec n'était jamais émise).
    url = decryptSecret(t.urlEnc);
    if (t.kind === 'webhook') secret = decryptSecret(t.secretEnc ?? '');
  } catch {
    return { ok: false, permanent: true, error: 'Configuration illisible : supprimez puis recréez cette intégration.' };
  }
  try {
    // Défense en profondeur : l'adresse enregistrée est revalidée à chaque envoi (règles du moment).
    checkWebhookUrl(url, t.kind);
  } catch {
    return { ok: false, permanent: true, error: 'Adresse refusée.' };
  }
  let body: string;
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'User-Agent': 'Repere-Webhooks/1.0' };
  if (t.kind === 'slack') body = JSON.stringify(formatSlackMessage(event, d));
  else {
    body = formatWebhookBody(event, businessId, d, deliveryId, createdAt ?? new Date());
    headers[SIGNATURE_HEADER] = signPayload(secret ?? '', body);
    headers['X-Repere-Event'] = event;
    headers['X-Repere-Delivery'] = deliveryId;
  }
  try {
    const res =
      skipDns && process.env.NODE_ENV !== 'production'
        ? await fetchImpl(url, { method: 'POST', headers, body, redirect: 'manual', signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS) })
        : await pinnedPost(url, headers, body);
    const status = 'status' in res ? res.status : 0;
    if (res.ok) return { ok: true, code: status };
    // Statut renvoyé seulement pour les réponses applicatives ; jamais de détail réseau (oracle de ports internes).
    return {
      ok: false,
      code: status >= 400 ? status : undefined,
      error: 'Le serveur du webhook a refusé l’envoi.',
      ...(isRetryableStatus(status) ? {} : { permanent: true }),
    };
  } catch (e) {
    const blocked = e instanceof Error && e.name === 'SafeFetchError' && /blocked/.test(String((e as { code?: string }).code));
    return { ok: false, error: 'Adresse injoignable ou refusée.', ...(blocked ? { permanent: true } : {}) };
  }
}

async function recordStatus(businessId: string, targetId: string, r: PostResult, now: Date): Promise<void> {
  await withConfig(businessId, async () => {
    const c = await getConfig(businessId);
    const t = c.targets.find((x) => x.id === targetId);
    if (!t) return;
    t.lastStatus = { ok: r.ok, at: now.toISOString(), ...(r.code ? { code: r.code } : {}), ...(r.error ? { error: r.error } : {}) };
    await saveConfig(c);
  });
}

/** Diffuse un événement vers toutes les cibles actives abonnées (via la file). Renvoie le nombre de livraisons. */
export async function dispatchEvent(businessId: string, event: (typeof EVENTS)[number], d: EventData, opts: { only?: TargetKind[]; dedupeKey?: string } = {}): Promise<number> {
  if (isDemoBusinessId(businessId)) return 0;
  // F2 de qa/v3/securite-v3.md : plus de livraison après rétrogradation de l'offre (droit `integrations`).
  const business = await getBusinessRecord(businessId).catch(() => null);
  if (business && !getEntitlements(business).integrations) return 0;
  const c = await getConfig(businessId);
  const createdAt = new Date().toISOString();
  let n = 0;
  for (const t of [...c.targets]) {
    if (!t.active || !t.events.includes(event) || (opts.only && !opts.only.includes(t.kind))) continue;
    const deliveryId = opts.dedupeKey
      ? `dl_${crypto.createHash('sha256').update(`${t.id}:${event}:${opts.dedupeKey}`).digest('hex').slice(0, 20)}`
      : `dl_${crypto.randomUUID()}`;
    // `createdAt` figé à la diffusion : le corps signé est identique d'une tentative à l'autre (hors horodatage de signature).
    await enqueue('webhook.deliver', { businessId, targetId: t.id, event, deliveryId, createdAt, data: d }, { businessId, dedupeKey: deliveryId });
    n++;
  }
  return n;
}

/** Traitant `webhook.deliver` : lève une erreur en cas d'échec (reprise par la file, ou abandon si définitif). */
export async function deliverWebhook(payload: Record<string, unknown>): Promise<void> {
  const businessId = String(payload.businessId ?? '');
  const targetId = String(payload.targetId ?? '');
  const event = String(payload.event ?? '') as IntegrationEvent;
  const deliveryId = String(payload.deliveryId ?? `dl_${crypto.randomUUID()}`);
  const createdAt = typeof payload.createdAt === 'string' && !Number.isNaN(Date.parse(payload.createdAt)) ? payload.createdAt : undefined;
  const d = (payload.data ?? { title: '' }) as EventData;
  const job = (payload._job ?? {}) as { attempt?: number; maxAttempts?: number };
  if (isDemoBusinessId(businessId)) return;
  const t = (await getConfig(businessId)).targets.find((x) => x.id === targetId);
  if (!t || !t.active) return; // cible supprimée ou coupée : rien à faire
  const now = new Date();
  const r = await post(t, event, businessId, d, deliveryId, createdAt);
  const attempt = job.attempt ?? 1;
  const { permanent, ...rec } = r;
  await putDoc<DeliveryRecord>(DELIVERIES, `${deliveryId}_${attempt}`, { id: deliveryId, businessId, targetId, event, ...rec, attempt, at: now.toISOString() }, businessId);
  await recordStatus(businessId, targetId, r, now);
  if (!r.ok) {
    const last = Boolean(job.maxAttempts && attempt >= job.maxAttempts);
    if (permanent || last) {
      await addNotification(businessId, {
        type: 'integration_error',
        title: `Échec d’envoi vers ${t.label}`,
        body: permanent
          ? `Envoi abandonné${r.code ? ` (code ${r.code})` : ''} : ${r.error ?? 'erreur inconnue'} Vérifiez l’adresse dans Réglages > Intégrations.`
          : `Après ${attempt} essais : ${r.error ?? 'erreur inconnue'} Vérifiez l’adresse dans Réglages > Intégrations.`,
        href: '/app/reglages',
        severity: 'important',
        dedupeKey: `int-fail:${deliveryId}`,
      });
    }
    const msg = `webhook ${t.kind} : ${r.error ?? 'échec'}${r.code ? ` (${r.code})` : ''}`;
    if (permanent) throw new PermanentJobError(msg);
    throw new Error(msg);
  }
}

/** Bouton « Tester » : envoi direct (hors file), résultat immédiat. */
export async function sendTest(businessId: string, targetId: string, businessName?: string): Promise<{ ok: boolean; code?: number; error?: string }> {
  if (isDemoBusinessId(businessId)) return { ok: false, error: 'Compte de démonstration : aucun envoi.' };
  const t = (await getConfig(businessId)).targets.find((x) => x.id === targetId);
  if (!t) throw new IntegrationError(404, 'Intégration introuvable.');
  const now = new Date();
  const r = await post(t, 'test', businessId, { title: 'Repéré est bien connecté', body: 'Vous recevrez ici les alertes et résultats choisis dans vos réglages.', href: '/app', businessName }, `dl_test_${crypto.randomUUID()}`).catch(
    (e: unknown) => ({ ok: false, error: e instanceof Error ? e.message : 'échec' }) as PostResult,
  );
  await recordStatus(businessId, targetId, r, now);
  const { permanent: _p, ...out } = r;
  return out;
}

export async function listDeliveries(businessId: string, limit = 50): Promise<DeliveryRecord[]> {
  if (isDemoBusinessId(businessId)) return [];
  const docs = await listDocs<DeliveryRecord>(DELIVERIES, { businessId, limit: Math.min(200, limit) });
  return docs.map((d) => d.data).filter((x) => x.businessId === businessId);
}

registerHandler('webhook.deliver', deliverWebhook);
