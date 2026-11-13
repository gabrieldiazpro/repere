/**
 * RGPD : export complet (toutes collections, secrets masqués), suppression en cascade avec confirmation,
 * refus si abonnement actif, comptes démo (export lisible, suppression interdite), contrôle d'accès.
 * Mode local (sans Supabase) : un commerce sans propriétaire est ouvert (bac à sable de développement).
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.setConfig({ testTimeout: 60_000 });
process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'repere-rgpd-'));
for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_SUPABASE_URL', 'STRIPE_SECRET_KEY', 'RESEND_API_KEY', 'VERCEL_ENV', 'APP_ENV']) {
  delete process.env[k];
}

const db = await import('@/lib/db');
const { createMockAudit } = await import('@/lib/engine');
const { putDoc, getDoc } = await import('@/lib/store');
const jobs = await import('@/lib/jobs');
const route = await import('../route');
const { confirmationMatches, maskSecrets } = await import('../gdpr');

const B = 'http://localhost:3000/api/account/data';

async function seed(name: string, extra: Partial<Parameters<typeof db.createBusiness>[0]> = {}) {
  const b = await db.createBusiness({ name, trade: 'fleuriste', city: 'Lyon', plan: 'essentiel', contactEmail: 'gerant@fleurs-exemple.fr', ...extra });
  const input = { businessName: name, trade: 'fleuriste', city: 'Lyon' };
  await db.saveAudit(createMockAudit(input, `${name}-1`), { businessId: b.id, trigger: 'manual' });
  await db.recordAlert({ businessId: b.id, auditId: null, type: 'audit_done', title: 'Mesure', payload: {} });
  await putDoc('exec.tasks', `${b.id}:t1`, { title: 'Compléter la fiche' }, b.id);
  await putDoc('integrations.config', b.id, { targets: [{ url: 'https://hooks.exemple.fr', secret: 'whsec_tres_secret' }] }, b.id);
  await putDoc('exec.tasks', 'autre:t1', { title: 'Ne pas exporter' }, 'autre-commerce');
  // Modules V3 e-commerce et local (collections ecom.* et local.*)
  await putDoc('ecom.catalog', b.id, { businessId: b.id, products: [{ id: 'p1', name: 'Bouquet' }] }, b.id);
  await putDoc('ecom.shopify', b.id, { shop: 'fleurs.myshopify.com', accessToken: 'shpat_chiffre', refreshToken: 'shprt_chiffre' }, b.id);
  await putDoc('local.gbp', `${b.id}:g1`, { businessId: b.id, score: 61 }, b.id);
  jobs.registerHandler('report.scheduled', async () => undefined);
  await jobs.enqueue('report.scheduled', { businessId: b.id }, { businessId: b.id });
  return b;
}

describe('GET /api/account/data (export)', () => {
  it('export complet du commerce, téléchargeable, secrets masqués, rien d’un autre commerce', async () => {
    const b = await seed('Fleurs Export');
    const res = await route.GET(new Request(`${B}?businessId=${b.id}`));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition')).toMatch(/attachment; filename="repere-donnees-fleurs-export-\d{4}-\d{2}-\d{2}\.json"/);
    const data = (await res.json()) as Record<string, unknown> & { documents: Record<string, { id: string; data: unknown }[]> };
    expect(data.format).toBe('repere.export.v1');
    expect((data.business as { id: string }).id).toBe(b.id);
    expect(data.audits as unknown[]).toHaveLength(1);
    expect((data.alerts as unknown[]).length).toBeGreaterThanOrEqual(1);
    expect(data.documents['exec.tasks'].map((d) => d.id)).toEqual([`${b.id}:t1`]);
    expect(JSON.stringify(data.documents['integrations.config'])).not.toContain('whsec_tres_secret');
    expect(data.documents['ecom.catalog'].map((d) => d.id)).toEqual([b.id]);
    expect(data.documents['local.gbp'].map((d) => d.id)).toEqual([`${b.id}:g1`]);
    expect(JSON.stringify(data.documents['ecom.shopify'])).toContain('fleurs.myshopify.com');
    expect(JSON.stringify(data.documents['ecom.shopify'])).not.toMatch(/shpat_|shprt_/);
    expect((data.jobs as unknown[]).length).toBe(1);
    expect(JSON.stringify(data)).not.toContain('Ne pas exporter');
  });

  it('compte démo : export lisible ; identifiant invalide : 400', async () => {
    expect((await route.GET(new Request(`${B}?businessId=demo`))).status).toBe(200);
    expect((await route.GET(new Request(`${B}?businessId=../x`))).status).toBe(400);
  });

  it('commerce d’un autre propriétaire sans session : 401', async () => {
    const b = await db.createBusiness({ name: 'Fleurs Privées', trade: 'fleuriste', city: 'Lyon', ownerId: '11111111-1111-4111-8111-111111111111' });
    expect((await route.GET(new Request(`${B}?businessId=${b.id}`))).status).toBe(401);
  });
});

describe('DELETE /api/account/data (suppression)', () => {
  const del = (id: string, body?: unknown) =>
    route.DELETE(new Request(`${B}?businessId=${id}`, { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }));

  it('exige la confirmation exacte, puis supprime tout en cascade et met l’adresse en opposition', async () => {
    const b = await seed('Fleurs Suppression');
    expect((await del(b.id)).status).toBe(400);
    expect((await del(b.id, { confirm: 'autre nom' })).status).toBe(400);
    const res = await del(b.id, { confirm: '  fleurs suppression ' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { deleted: { documents: number; jobs: number } };
    expect(body.deleted.documents).toBeGreaterThanOrEqual(2);
    expect(body.deleted.jobs).toBe(1);
    expect(await db.getBusinessRecord(b.id)).toBeNull();
    expect(await db.listAuditsForBusiness(b.id)).toHaveLength(0);
    expect(await db.listAlerts(b.id)).toHaveLength(0);
    expect(await getDoc('exec.tasks', `${b.id}:t1`)).toBeNull();
    expect(await getDoc('exec.tasks', 'autre:t1')).not.toBeNull();
    expect(await getDoc('ecom.catalog', b.id)).toBeNull();
    expect(await getDoc('ecom.shopify', b.id)).toBeNull();
    expect(await getDoc('local.gbp', `${b.id}:g1`)).toBeNull();
    expect(await jobs.listJobsForBusiness(b.id)).toHaveLength(0);
    expect(await db.isSuppressed('gerant@fleurs-exemple.fr')).toBe(true);
  });

  it('abonnement actif : 409, rien n’est supprimé', async () => {
    const b = await seed('Fleurs Abonnées', { stripeCustomerId: 'cus_test_rgpd' });
    await db.upsertSubscription({ stripeCustomerId: 'cus_test_rgpd', stripeSubscriptionId: 'sub_rgpd', businessId: b.id, planId: 'local_essentiel_month', status: 'active' } as Parameters<typeof db.upsertSubscription>[0]);
    const res = await del(b.id, { confirm: 'Fleurs Abonnées' });
    expect(res.status).toBe(409);
    expect(await db.getBusinessRecord(b.id)).not.toBeNull();
  });

  it('compte démo : suppression interdite', async () => {
    expect((await del('demo', { confirm: 'Plomberie Martin' })).status).toBe(403);
  });

  it('outils : confirmation insensible aux accents et à la casse ; masquage des secrets', () => {
    expect(confirmationMatches({ name: 'Boulangerie Éloïse' }, 'boulangerie eloise')).toBe(true);
    expect(confirmationMatches({ name: 'Boulangerie Éloïse' }, 'boulangerie')).toBe(false);
    expect(confirmationMatches({ name: 'X' }, 42)).toBe(false);
    expect(maskSecrets({ a: { tokenHash: 'h', webhookSecret: 's', url: 'u' } })).toEqual({ a: { tokenHash: '[masqué]', webhookSecret: '[masqué]', url: 'u' } });
  });
});
