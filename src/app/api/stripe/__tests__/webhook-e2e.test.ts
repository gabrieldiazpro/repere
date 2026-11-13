/**
 * Webhook Stripe ENTRANT de bout en bout : vrais événements signés (stripe.webhooks.generateTestHeaderString), vraie
 * route POST, vrai client Stripe (dirigé vers un faux serveur d'API Stripe local pour subscriptions.retrieve et le
 * portail), stockage fichier `.data` dans un répertoire temporaire. Seul l'audit d'onboarding est neutralisé.
 */
import crypto from 'node:crypto';
import { existsSync, mkdtempSync } from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const env = process.env as Record<string, string | undefined>;
const DIR = mkdtempSync(path.join(os.tmpdir(), 'repere-stripe-e2e-'));
env.DATA_DIR = DIR;
(globalThis as { __repereDocsDir?: string }).__repereDocsDir = DIR;
delete env.SUPABASE_URL;
delete env.NEXT_PUBLIC_SUPABASE_URL;
delete env.SUPABASE_SERVICE_ROLE_KEY;
delete env.RESEND_API_KEY;
env.STRIPE_SECRET_KEY = 'sk_test_e2e_repere';
const WHSEC = `whsec_${crypto.randomBytes(16).toString('hex')}`;
env.STRIPE_WEBHOOK_SECRET = WHSEC;

vi.mock('@/lib/auth/onboarding', () => ({ enqueueOnboardingAudit: vi.fn(async () => undefined) }));

import { POST } from '@/app/api/stripe/webhook/route';
import { getStripe } from '@/lib/stripe';
import { findSubscriptionByStripeId, getBusinessRecord, listAlerts, listSubscriptionsByCustomer } from '@/lib/db';

// ---------------------------------------------------------------------------
// Faux serveur d'API Stripe (local)
// ---------------------------------------------------------------------------
interface ApiCall {
  method: string;
  path: string;
  auth: string | undefined;
  body: string;
}
const apiCalls: ApiCall[] = [];
const subscriptions = new Map<string, Record<string, unknown>>();
let api: http.Server;

const DAY = 86_400;
const NOW = Math.floor(Date.now() / 1000);
const P1 = NOW + 30 * DAY;
const P2 = NOW + 31 * DAY;
const P3 = NOW + 61 * DAY;
const iso = (s: number) => new Date(s * 1000).toISOString();
const CUSTOMER = 'cus_e2e_1';
const SUB = 'sub_e2e_1';
const EMAIL = `stripe-e2e-${crypto.randomUUID().slice(0, 8)}@exemple.fr`;

function subscription(over: Record<string, unknown> = {}, periodEnd = P1): Record<string, unknown> {
  return {
    id: SUB,
    object: 'subscription',
    status: 'active',
    customer: CUSTOMER,
    created: NOW,
    cancel_at_period_end: false,
    metadata: { app: 'auditia', plan_id: 'pme_essentiel_month' },
    items: { object: 'list', data: [{ id: 'si_1', object: 'subscription_item', current_period_end: periodEnd, price: { id: 'price_e2e' } }] },
    ...over,
  };
}

beforeAll(async () => {
  api = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      const p = new URL(req.url ?? '/', 'http://x').pathname;
      apiCalls.push({ method: req.method ?? '', path: p, auth: req.headers.authorization, body: Buffer.concat(chunks).toString('utf8') });
      const send = (status: number, body: unknown) => {
        res.writeHead(status, { 'Content-Type': 'application/json', 'Request-Id': `req_${apiCalls.length}` });
        res.end(JSON.stringify(body));
      };
      const sub = p.match(/^\/v1\/subscriptions\/([\w-]+)$/);
      if (req.method === 'GET' && sub) {
        const s = subscriptions.get(sub[1]);
        return s ? send(200, s) : send(404, { error: { type: 'invalid_request_error', message: 'No such subscription' } });
      }
      if (req.method === 'POST' && p === '/v1/billing_portal/sessions') {
        return send(200, { id: 'bps_e2e', object: 'billing_portal.session', url: 'https://billing.stripe.com/p/session/test_e2e' });
      }
      send(404, { error: { type: 'invalid_request_error', message: `route inconnue ${p}` } });
    });
  });
  await new Promise<void>((resolve) => api.listen(0, '127.0.0.1', resolve));
  const client = getStripe() as unknown as { _setApiField(k: string, v: unknown): void };
  client._setApiField('host', '127.0.0.1');
  client._setApiField('port', (api.address() as AddressInfo).port);
  client._setApiField('protocol', 'http');
  client._setApiField('maxNetworkRetries', 0);
});

afterAll(async () => {
  api.closeAllConnections();
  await new Promise<void>((resolve) => api.close(() => resolve()));
});

// ---------------------------------------------------------------------------
let seq = 0;
function event(type: string, object: Record<string, unknown>, id = `evt_e2e_${++seq}_${crypto.randomUUID().slice(0, 6)}`) {
  return { id, object: 'event', api_version: '2025-08-27.basil', created: NOW, livemode: false, pending_webhooks: 1, request: { id: null, idempotency_key: null }, type, data: { object } };
}

async function deliver(evt: unknown, opts: { secret?: string; timestamp?: number; header?: string | null; body?: string } = {}) {
  const payload = JSON.stringify(evt);
  const header =
    opts.header === null
      ? null
      : (opts.header ?? getStripe()!.webhooks.generateTestHeaderString({ payload, secret: opts.secret ?? WHSEC, ...(opts.timestamp ? { timestamp: opts.timestamp } : {}) }));
  const res = await POST(
    new Request('https://repere.test/api/stripe/webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(header ? { 'stripe-signature': header } : {}) },
      body: opts.body ?? payload,
    }),
  );
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
}

const sub = async () => (await findSubscriptionByStripeId(SUB))!;
let businessId = '';

describe('webhook Stripe entrant (route réelle, événements signés)', () => {
  it('checkout.session.completed : abonnement, commerce et accès créés (avec appel réel à subscriptions.retrieve)', async () => {
    subscriptions.set(SUB, subscription());
    const r = await deliver(
      event('checkout.session.completed', {
        id: 'cs_e2e_1',
        object: 'checkout.session',
        mode: 'subscription',
        payment_status: 'paid',
        created: NOW,
        customer: CUSTOMER,
        subscription: SUB,
        customer_details: { email: EMAIL },
        metadata: { app: 'auditia', plan_id: 'pme_essentiel_month' },
      }),
    );
    expect(r).toEqual({ status: 200, json: { received: true } });
    expect(apiCalls).toEqual([{ method: 'GET', path: `/v1/subscriptions/${SUB}`, auth: 'Bearer sk_test_e2e_repere', body: '' }]);
    const s = await sub();
    expect(s).toMatchObject({ stripeCustomerId: CUSTOMER, planId: 'pme_essentiel_month', status: 'active', currentPeriodEnd: iso(P1), email: EMAIL });
    expect(s.businessId).toBeTruthy();
    businessId = s.businessId!;
    expect(await getBusinessRecord(businessId)).toMatchObject({ plan: 'essentiel', planId: 'pme_essentiel_month', stripeCustomerId: CUSTOMER, contactEmail: EMAIL, isActive: true });
    expect(existsSync(path.join(DIR, 'subscriptions.json'))).toBe(true);
  });

  it('même session traitée deux fois (async_payment_succeeded, nouvel envoi) : aucun second commerce ; même événement : ignoré', async () => {
    const session = {
      id: 'cs_e2e_1', object: 'checkout.session', mode: 'subscription', payment_status: 'paid', created: NOW,
      customer: CUSTOMER, subscription: SUB, customer_details: { email: EMAIL }, metadata: { app: 'auditia', plan_id: 'pme_essentiel_month' },
    };
    const evt = event('checkout.session.async_payment_succeeded', session);
    apiCalls.length = 0;
    expect((await deliver(evt)).json).toEqual({ received: true });
    expect(apiCalls).toHaveLength(1);
    expect((await sub()).businessId).toBe(businessId);
    expect((await deliver(evt)).json).toEqual({ received: true, duplicate: true });
    expect(apiCalls).toHaveLength(1);
    // Nouvel identifiant d'événement pour la même session (Stripe renvoie après un 500) : toujours le même commerce.
    expect((await deliver(event('checkout.session.completed', session))).json).toEqual({ received: true });
    expect((await sub()).businessId).toBe(businessId);
    expect(await listSubscriptionsByCustomer(CUSTOMER)).toHaveLength(1);
  });

  it('customer.subscription.updated : statut, période et résiliation programmée', async () => {
    const r = await deliver(event('customer.subscription.updated', subscription({ status: 'past_due', cancel_at_period_end: true }, P2)));
    expect(r.status).toBe(200);
    expect(await sub()).toMatchObject({ status: 'past_due', cancelAtPeriodEnd: true, currentPeriodEnd: iso(P2), businessId });
    // Relance de paiement : l'accès est conservé.
    expect(await getBusinessRecord(businessId)).toMatchObject({ plan: 'essentiel' });
  });

  it('invoice.paid : prolonge la période ; idempotent (rejeu, doublon, facture plus ancienne)', async () => {
    const invoice = (id: string, end: number) => ({
      id,
      object: 'invoice',
      customer: CUSTOMER,
      customer_email: EMAIL,
      amount_paid: 9900,
      status: 'paid',
      parent: { type: 'subscription_details', subscription_details: { subscription: SUB } },
      lines: { object: 'list', data: [{ id: `il_${id}`, object: 'line_item', period: { start: end - 30 * DAY, end } }] },
    });
    const evt = event('invoice.paid', invoice('in_e2e_1', P3));
    expect((await deliver(evt)).status).toBe(200);
    expect((await sub()).currentPeriodEnd).toBe(iso(P3));
    const before = await sub();
    expect((await deliver(evt)).json).toEqual({ received: true, duplicate: true });
    // Autre identifiant d'événement, même facture : aucun effet.
    expect((await deliver(event('invoice.paid', invoice('in_e2e_1', P3)))).status).toBe(200);
    expect((await sub()).currentPeriodEnd).toBe(iso(P3));
    // Facture plus ancienne reçue en retard : la période ne recule jamais.
    expect((await deliver(event('invoice.paid', invoice('in_e2e_0', P1)))).status).toBe(200);
    const after = await sub();
    expect(after.currentPeriodEnd).toBe(iso(P3));
    expect({ ...after, updatedAt: '' }).toEqual({ ...before, updatedAt: '' });
    expect(await listSubscriptionsByCustomer(CUSTOMER)).toHaveLength(1);
  });

  it('invoice.payment_failed : alerte au commerce et lien de portail créé', async () => {
    apiCalls.length = 0;
    const r = await deliver(
      event('invoice.payment_failed', {
        id: 'in_e2e_fail', object: 'invoice', customer: CUSTOMER, customer_email: EMAIL, amount_paid: 0, status: 'open',
        parent: { type: 'subscription_details', subscription_details: { subscription: SUB } }, lines: { object: 'list', data: [] },
      }),
    );
    expect(r.status).toBe(200);
    expect((await listAlerts(businessId)).map((a) => a.type)).toContain('payment_failed');
    expect(apiCalls).toHaveLength(1);
    expect(apiCalls[0]).toMatchObject({ method: 'POST', path: '/v1/billing_portal/sessions' });
    expect(new URLSearchParams(apiCalls[0].body).get('customer')).toBe(CUSTOMER);
  });

  it('customer.subscription.deleted : abonnement arrêté, retour aux droits Découverte, alerte', async () => {
    const r = await deliver(event('customer.subscription.deleted', subscription({ status: 'canceled' }, P3)));
    expect(r.status).toBe(200);
    expect((await sub()).status).toBe('canceled');
    expect(await getBusinessRecord(businessId)).toMatchObject({ plan: 'free', planId: null });
    expect((await listAlerts(businessId)).map((a) => a.type)).toContain('subscription_canceled');
  });

  it('signature fausse, absente, expirée ou corps modifié → 400, sans marquer l’événement', async () => {
    const evt = event('customer.subscription.updated', subscription({ status: 'active' }, P3));
    expect(await deliver(evt, { secret: 'whsec_mauvais' })).toEqual({ status: 400, json: { error: 'Signature invalide.' } });
    expect(await deliver(evt, { header: null })).toEqual({ status: 400, json: { error: 'Signature manquante.' } });
    expect((await deliver(evt, { timestamp: NOW - 3600 })).status).toBe(400);
    expect((await deliver(evt, { header: 't=1,v1=abc' })).status).toBe(400);
    const valid = getStripe()!.webhooks.generateTestHeaderString({ payload: JSON.stringify(evt), secret: WHSEC });
    const tampered = JSON.stringify({ ...evt, data: { object: subscription({ status: 'active', metadata: { app: 'auditia', plan_id: 'agency_month' } }, P3) } });
    expect((await deliver(evt, { header: valid, body: tampered })).status).toBe(400);
    expect((await sub()).status).toBe('canceled');
    // L'événement authentique reste traitable (aucun marquage par les tentatives refusées).
    expect((await deliver(evt)).json).toEqual({ received: true });
    expect((await sub()).status).toBe('active');
  });

  it('événement inconnu → 200 sans effet', async () => {
    const subsBefore = JSON.stringify(await listSubscriptionsByCustomer(CUSTOMER));
    const bizBefore = JSON.stringify(await getBusinessRecord(businessId));
    const alertsBefore = (await listAlerts(businessId)).length;
    apiCalls.length = 0;
    const r = await deliver(event('customer.created', { id: CUSTOMER, object: 'customer', email: EMAIL }));
    expect(r).toEqual({ status: 200, json: { received: true } });
    expect(JSON.stringify(await listSubscriptionsByCustomer(CUSTOMER))).toBe(subsBefore);
    expect(JSON.stringify(await getBusinessRecord(businessId))).toBe(bizBefore);
    expect((await listAlerts(businessId)).length).toBe(alertsBefore);
    expect(apiCalls).toHaveLength(0);
  });
});
