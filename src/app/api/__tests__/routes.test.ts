/**
 * Tests d'intégration des routes API (mode démo : ni Supabase, ni Stripe, ni Resend, IA simulées).
 * Les handlers exportés sont appelés directement avec `new Request`.
 */
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Environnement de démo isolé : à poser AVANT l'import des modules (constantes lues au chargement).
const DATA_DIR = mkdtempSync(path.join(tmpdir(), 'repere-test-'));
Object.assign(process.env, {
  DATA_DIR,
  ADMIN_TOKEN: 'test-admin-token',
  CRON_SECRET: 'test-cron-secret',
  UNSUBSCRIBE_SECRET: 'test-unsub-secret',
  AUDIT_RATE_LIMIT_PER_DAY: '5',
  AUDIT_GLOBAL_PER_HOUR: '12',
  AUDIT_GLOBAL_PER_DAY: '1000',
  AUDIT_PER_EMAIL_PER_DAY: '3',
});
for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_SUPABASE_URL', 'STRIPE_SECRET_KEY', 'RESEND_API_KEY', 'OPENAI_API_KEY', 'PERPLEXITY_API_KEY', 'GEMINI_API_KEY', 'ANTHROPIC_API_KEY']) {
  delete process.env[k];
}

// `after()` n'existe que dans une requête Next : on exécute la tâche tout de suite et on la garde pour l'attendre.
const pending: Promise<unknown>[] = [];
vi.mock('next/server', async (orig) => {
  const mod = await orig<typeof import('next/server')>();
  return { ...mod, after: (fn: () => unknown) => void pending.push(Promise.resolve().then(fn)) };
});

const auditRoute = await import('../audit/route');
const auditIdRoute = await import('../audit/[id]/route');
const leadsRoute = await import('../leads/route');
const actionsRoute = await import('../actions/route');
const checkoutRoute = await import('../checkout/route');
const cronRoute = await import('../cron/monthly/route');
const unsubRoute = await import('../unsubscribe/route');
const planRoute = await import('../report/[id]/plan/route');
const pdfRoute = await import('../report/[id]/pdf/route');
const devRoute = await import('../dev/ratelimit/route');
const { resetRateLimit, ipBucket, getClientIp } = await import('@/lib/ratelimit');
const { isSuppressed } = await import('@/lib/db');
const { unsubscribeToken, unsubscribeUrl, sendReportEmail, sendPurchaseConfirmationEmail } = await import('@/lib/email');
const { signPlanToken } = await import('@/lib/pdf/sign');
const { PLANS } = await import('@/lib/plans');

const B = 'http://localhost:3000';
let ipSeq = 0;
const freshIp = () => `10.20.${Math.floor(++ipSeq / 250)}.${ipSeq % 250}`;

function post(url: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(`${B}${url}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}
const params = (id: string) => ({ params: Promise.resolve({ id }) });
const valid = (n = 1) => ({ businessName: `Plomberie Test ${n}`, trade: 'plombier', city: 'Paris', district: '11e' });

async function createAudit(extra: Record<string, unknown> = {}, ip = freshIp()) {
  const res = await auditRoute.POST(post('/api/audit', { ...valid(), ...extra }, { 'x-forwarded-for': ip }));
  expect(res.status).toBe(201);
  return ((await res.json()) as { id: string }).id;
}

beforeEach(() => {
  resetRateLimit();
  pending.length = 0;
});
afterAll(async () => {
  await Promise.allSettled(pending);
});

describe('POST /api/audit', () => {
  it('refuse les corps invalides (zod) avec un message par champ', async () => {
    const cases: [unknown, string][] = [
      [{}, 'businessName'],
      [{ ...valid(), trade: 'p' }, 'trade'],
      [{ ...valid(), email: 'pas-un-email' }, 'email'],
      [{ ...valid(), website: 'pas un site' }, 'website'],
      [{ ...valid(), businessName: 'Compte suspendu : ameli-remb.fr' }, 'businessName'],
      [{ ...valid(), trade: 'plombier https://x.io' }, 'trade'],
    ];
    for (const [body, field] of cases) {
      const res = await auditRoute.POST(post('/api/audit', body, { 'x-forwarded-for': freshIp() }));
      expect(res.status).toBe(400);
      const json = (await res.json()) as { fields: Record<string, string> };
      expect(json.fields[field]).toBeTruthy();
    }
    expect((await auditRoute.POST(post('/api/audit', 'pas du json'))).status).toBe(400);
    expect((await auditRoute.POST(post('/api/audit', { ...valid(), hp: 'robot' }))).status).toBe(400);
  });

  it('crée un audit démo lisible par GET /api/audit/[id], sans e-mail ni coût', async () => {
    const id = await createAudit({ email: 'Client@Exemple.fr', consent: true });
    const res = await auditIdRoute.GET(new Request(`${B}/api/audit/${id}`), params(id));
    expect(res.status).toBe(200);
    const audit = await res.json();
    expect(audit.id).toBe(id);
    expect(audit.demo).toBe(true);
    expect(audit.score).toBeGreaterThanOrEqual(0);
    expect(audit.score).toBeLessThanOrEqual(100);
    expect(JSON.stringify(audit)).not.toContain('exemple.fr');
    expect(audit.details?.estimatedCostEur).toBeUndefined();
  });

  it('GET /api/audit/[id] inexistant : 404', async () => {
    const res = await auditIdRoute.GET(new Request(`${B}/api/audit/nope`), params('nope'));
    expect(res.status).toBe(404);
  });

  it('limite à 5 audits par IP et par jour (429 à la 6e), réinitialisable en dev', async () => {
    const ip = freshIp();
    for (let i = 1; i <= 5; i++) {
      expect((await auditRoute.POST(post('/api/audit', valid(i), { 'x-forwarded-for': ip }))).status).toBe(201);
    }
    const sixth = await auditRoute.POST(post('/api/audit', valid(6), { 'x-forwarded-for': ip }));
    expect(sixth.status).toBe(429);
    expect(sixth.headers.get('Retry-After')).toBeTruthy();

    const reset = await devRoute.DELETE(new Request(`${B}/api/dev/ratelimit?bucket=audit`, { method: 'DELETE' }));
    expect(reset.status).toBe(200);
    expect((await auditRoute.POST(post('/api/audit', valid(7), { 'x-forwarded-for': ip }))).status).toBe(201);
  });

  it('regroupe les IPv6 par /64 (rotation d’adresses inutile)', async () => {
    for (let i = 1; i <= 5; i++) {
      const ip = `2001:db8:abcd:12::${i.toString(16)}`;
      expect((await auditRoute.POST(post('/api/audit', valid(i), { 'x-forwarded-for': ip }))).status).toBe(201);
    }
    const res = await auditRoute.POST(post('/api/audit', valid(9), { 'x-forwarded-for': '2001:db8:abcd:12:ffff::1' }));
    expect(res.status).toBe(429);
  });

  it('l’admin échappe à la limite par IP, pas au plafond global horaire', async () => {
    const ip = freshIp();
    const admin = { 'x-forwarded-for': ip, 'x-admin-token': 'test-admin-token' };
    for (let i = 1; i <= 12; i++) expect((await auditRoute.POST(post('/api/audit', valid(i), admin))).status).toBe(201);
    const over = await auditRoute.POST(post('/api/audit', valid(13), admin));
    expect(over.status).toBe(503);
    // un faux jeton ne donne aucun passe-droit
    resetRateLimit();
    const fake = { 'x-forwarded-for': ip, 'x-admin-token': 'faux' };
    for (let i = 1; i <= 5; i++) await auditRoute.POST(post('/api/audit', valid(i), fake));
    expect((await auditRoute.POST(post('/api/audit', valid(6), fake))).status).toBe(429);
  }, 30_000); // 18 audits simulés : dépasse 5 s quand la machine est chargée (suite complète)

  it('limite les audits par adresse e-mail (3/jour), quelles que soient les IP', async () => {
    for (let i = 1; i <= 3; i++) await createAudit({ email: 'cible@exemple.fr' });
    const res = await auditRoute.POST(post('/api/audit', { ...valid(), email: 'CIBLE@exemple.fr' }, { 'x-forwarded-for': freshIp() }));
    expect(res.status).toBe(429);
  });

  it('refuse poliment les professions réglementées, sans lancer d’audit', async () => {
    for (const trade of ['dentiste', 'Avocat', 'expert-comptable', 'Kinésithérapeute', 'médecin généraliste']) {
      const res = await auditRoute.POST(post('/api/audit', { ...valid(), trade }, { 'x-forwarded-for': freshIp() }));
      expect(res.status).toBe(400);
      const j = (await res.json()) as { error: string; fields: Record<string, string> };
      expect(j.fields.trade).toMatch(/ne couvre pas encore les professions réglementées/);
    }
    // Un métier non réglementé passe toujours.
    await createAudit({ trade: 'fleuriste' });
  });

  it('la case obligatoire n’est pas un consentement marketing (E4)', async () => {
    await createAudit({ email: 'sansoptin@exemple.fr', consent: true });
    await createAudit({ email: 'optin@exemple.fr', consent: true, marketingConsent: true });
    await Promise.allSettled(pending);
    const leads = Object.values(JSON.parse(readFileSync(path.join(DATA_DIR, 'leads.json'), 'utf8'))) as { email: string; consent: boolean }[];
    expect(leads.find((l) => l.email === 'sansoptin@exemple.fr')?.consent).toBe(false);
    expect(leads.find((l) => l.email === 'optin@exemple.fr')?.consent).toBe(true);
  });
});

describe('POST /api/leads', () => {
  const lead = { email: 'a@b.fr', businessName: 'X', trade: 'plombier', city: 'Paris' };
  it('valide le corps et enregistre un lead du site', async () => {
    expect((await leadsRoute.POST(post('/api/leads', { ...lead, email: 'nope' }))).status).toBe(400);
    expect((await leadsRoute.POST(post('/api/leads', lead, { 'x-forwarded-for': freshIp() }))).status).toBe(201);
  });
  it('réserve source=prospection au jeton admin', async () => {
    expect((await leadsRoute.POST(post('/api/leads', { ...lead, source: 'prospection' }))).status).toBe(401);
    expect((await leadsRoute.POST(post('/api/leads', { ...lead, source: 'prospection' }, { 'x-admin-token': 'faux' }))).status).toBe(401);
    expect((await leadsRoute.POST(post('/api/leads', { ...lead, source: 'prospection' }, { 'x-admin-token': 'test-admin-token' }))).status).toBe(201);
  });
});

describe('POST /api/leads (outils gratuits et contact)', () => {
  it.each(['tool', 'contact'] as const)('source=%s : l’e-mail suffit, commerce/métier/ville facultatifs', async (source) => {
    const email = `${source}@exemple.fr`;
    const res = await leadsRoute.POST(post('/api/leads', { email, source, businessName: '', trade: '', city: '' }, { 'x-forwarded-for': freshIp() }));
    expect(res.status).toBe(201);
    const leads = Object.values(JSON.parse(readFileSync(path.join(DATA_DIR, 'leads.json'), 'utf8'))) as { email: string; source: string }[];
    expect(leads.find((x) => x.email === email)?.source).toBe(source);
  });
  it('source=tool : e-mail invalide refusé ; source inconnue refusée', async () => {
    expect((await leadsRoute.POST(post('/api/leads', { email: 'nope', source: 'tool' }, { 'x-forwarded-for': freshIp() }))).status).toBe(400);
    expect((await leadsRoute.POST(post('/api/leads', { email: 'x@exemple.fr', source: 'outil' }, { 'x-forwarded-for': freshIp() }))).status).toBe(400);
  });
  it('le type SQL lead_source accepte tool et contact', () => {
    const sql = readFileSync(path.join(process.cwd(), 'supabase/migrations/0005_lead_sources.sql'), 'utf8') + readFileSync(path.join(process.cwd(), 'supabase/schema.sql'), 'utf8');
    for (const v of ['tool', 'contact']) expect(sql).toContain(`alter type lead_source add value if not exists '${v}'`);
  });
});

describe('POST /api/leads (liste d’attente Pro / Agence)', () => {
  it('accepte source=waitlist avec un simple e-mail et l’offre attendue', async () => {
    const res = await leadsRoute.POST(post('/api/leads', { email: 'agence@exemple.fr', source: 'waitlist', interest: 'agency' }, { 'x-forwarded-for': freshIp() }));
    expect(res.status).toBe(201);
    const leads = Object.values(JSON.parse(readFileSync(path.join(DATA_DIR, 'leads.json'), 'utf8'))) as { email: string; source: string; interest?: string }[];
    const l = leads.find((x) => x.email === 'agence@exemple.fr');
    expect(l?.source).toBe('waitlist');
    expect(l?.interest).toBe('agency');
  });
  it('refuse une offre inconnue, un e-mail invalide, et exige le commerce hors liste d’attente', async () => {
    expect((await leadsRoute.POST(post('/api/leads', { email: 'x@exemple.fr', source: 'waitlist', interest: 'gold' }, { 'x-forwarded-for': freshIp() }))).status).toBe(400);
    expect((await leadsRoute.POST(post('/api/leads', { email: 'nope', source: 'waitlist' }, { 'x-forwarded-for': freshIp() }))).status).toBe(400);
    expect((await leadsRoute.POST(post('/api/leads', { email: 'x@exemple.fr', source: 'site' }, { 'x-forwarded-for': freshIp() }))).status).toBe(400);
  });
});

describe('/api/actions', () => {
  it('démo en lecture seule côté serveur ; commerce sans propriétaire (bac à sable local) : persiste et relit', async () => {
    expect((await actionsRoute.POST(post('/api/actions', { businessId: 'demo' }))).status).toBe(400);
    expect((await actionsRoute.POST(post('/api/actions', { businessId: 'demo', actionId: 'A1"; drop', done: true }))).status).toBe(400);
    const demo = await actionsRoute.POST(post('/api/actions', { businessId: 'demo', actionId: 'A3', done: true }));
    expect(demo.status).toBe(403);
    expect(((await demo.json()) as { demo: boolean }).demo).toBe(true);
    expect((await actionsRoute.GET(new Request(`${B}/api/actions?businessId=demo`))).status).toBe(200);

    const { createBusiness } = await import('@/lib/db');
    const b = await createBusiness({ name: 'Actions Test', trade: 'plombier', city: 'Lyon', plan: 'essentiel' } as Parameters<typeof createBusiness>[0]);
    expect((await actionsRoute.POST(post('/api/actions', { businessId: b.id, actionId: 'A3', done: true }))).status).toBe(200);
    const get = await actionsRoute.GET(new Request(`${B}/api/actions?businessId=${b.id}`));
    expect(((await get.json()) as { progress: Record<string, boolean> }).progress.A3).toBe(true);
    expect((await actionsRoute.GET(new Request(`${B}/api/actions`))).status).toBe(400);
    expect((await actionsRoute.POST(post('/api/actions', { businessId: 'inconnu', actionId: 'A1', done: true }))).status).toBe(404);
  });
});

describe('POST /api/checkout (sans Stripe)', () => {
  it.each(PLANS.filter((p) => p.priceCents > 0 && p.available).map((p) => p.id))('%s : redirection démo vers /merci?demo=1', async (planId) => {
    const auditId = '11111111-2222-3333-4444-555555555555';
    const res = await checkoutRoute.POST(post('/api/checkout', { planId, auditId }, { 'x-forwarded-for': freshIp() }));
    expect(res.status).toBe(200);
    const { url } = (await res.json()) as { url: string };
    expect(url).toBe(`/merci?demo=1&plan=${planId}&audit=${auditId}`);
  });
  it('refuse l’audit gratuit, une offre inconnue, un auditId arbitraire et un e-mail invalide', async () => {
    for (const body of [{ planId: 'audit_free' }, { planId: 'bidon' }, { planId: 'suivi_month', auditId: '../x' }, { planId: 'action_plan', email: 'x' }]) {
      expect((await checkoutRoute.POST(post('/api/checkout', body, { 'x-forwarded-for': freshIp() }))).status).toBe(400);
    }
  });
  it.each(PLANS.filter((p) => !p.available).map((p) => p.id))('%s : offre non disponible, refusée (400)', async (planId) => {
    expect(planId).toMatch(/^(pro|agency)_/);
    const res = await checkoutRoute.POST(post('/api/checkout', { planId }, { 'x-forwarded-for': freshIp() }));
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toMatch(/pas encore disponible/);
  });
  it('ignore businessId envoyé par le client (E1)', async () => {
    const res = await checkoutRoute.POST(post('/api/checkout', { planId: 'suivi_month', businessId: 'victime' }, { 'x-forwarded-for': freshIp() }));
    expect(res.status).toBe(200);
    expect(((await res.json()) as { url: string }).url).not.toContain('victime');
  });
});

describe('GET /api/cron/monthly', () => {
  it('exige le Bearer CRON_SECRET', async () => {
    expect((await cronRoute.GET(new Request(`${B}/api/cron/monthly`))).status).toBe(401);
    expect((await cronRoute.GET(new Request(`${B}/api/cron/monthly`, { headers: { authorization: 'Bearer faux' } }))).status).toBe(401);
    const ok = await cronRoute.GET(new Request(`${B}/api/cron/monthly`, { headers: { authorization: 'Bearer test-cron-secret' } }));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ processed: expect.any(Number) });
  });
});

describe('désinscription', () => {
  it('/api/unsubscribe : jeton invalide 400, jeton signé 200 puis adresse en opposition', async () => {
    expect((await unsubRoute.GET(new Request(`${B}/api/unsubscribe?e=x@y.fr&t=faux`))).status).toBe(400);
    expect((await unsubRoute.POST(new Request(`${B}/api/unsubscribe?e=x@y.fr`, { method: 'POST' }))).status).toBe(400);
    const t = unsubscribeToken('x@y.fr');
    expect((await unsubRoute.POST(new Request(`${B}/api/unsubscribe?e=X@Y.fr&t=${t}`, { method: 'POST' }))).status).toBe(200);
    expect(await isSuppressed('x@y.fr')).toBe(true);
  });

  it('les e-mails pointent vers /desinscription signé, qui inscrit en opposition (E5)', async () => {
    const url = new URL(unsubscribeUrl('Page@Exemple.fr'));
    expect(url.pathname).toBe('/desinscription');
    const { default: Page } = await import('@/app/desinscription/page');
    await Page({ searchParams: Promise.resolve({ e: 'page@exemple.fr', t: 'faux' }) });
    expect(await isSuppressed('page@exemple.fr')).toBe(false);
    await Page({ searchParams: Promise.resolve(Object.fromEntries(url.searchParams)) });
    expect(await isSuppressed('page@exemple.fr')).toBe(true);
  });

  it('le rapport par e-mail respecte la liste d’opposition (E3)', async () => {
    const id = await createAudit();
    const audit = await (await auditIdRoute.GET(new Request(`${B}/api/audit/${id}`), params(id))).json();
    expect((await sendReportEmail('libre@exemple.fr', audit)).status).toBe('logged');
    expect((await sendReportEmail('x@y.fr', audit)).status).toBe('suppressed');
  });
});

describe('PDF', () => {
  it('rapport PDF : 200, application/pdf, > 5 Ko ; id invalide 404', async () => {
    const id = await createAudit();
    const res = await pdfRoute.GET(new Request(`${B}/api/report/${id}/pdf`), params(id));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/pdf');
    expect((await res.arrayBuffer()).byteLength).toBeGreaterThan(5000);
    expect((await pdfRoute.GET(new Request(`${B}/api/report/x/pdf`), params('../x'))).status).toBe(404);
  });

  it('plan d’action : 403 sans jeton ou jeton faux, 200 avec le lien de l’e-mail d’achat', async () => {
    const id = await createAudit();
    expect((await planRoute.GET(new Request(`${B}/api/report/${id}/plan`), params(id))).status).toBe(403);
    expect((await planRoute.GET(new Request(`${B}/api/report/${id}/plan?token=00`), params(id))).status).toBe(403);
    const ok = await planRoute.GET(new Request(`${B}/api/report/${id}/plan?token=${signPlanToken(id)}`), params(id));
    expect(ok.status).toBe(200);
    expect(ok.headers.get('content-type')).toBe('application/pdf');

    const log = vi.spyOn(console, 'info').mockImplementation(() => {});
    await sendPurchaseConfirmationEmail('acheteur@exemple.fr', { planId: 'action_plan', auditId: id });
    const printed = log.mock.calls.flat().join('\n');
    log.mockRestore();
    expect(printed).toContain(`/api/report/${id}/plan?token=${signPlanToken(id)}`);
  }, 30_000);
});

describe('ratelimit : identification du client', () => {
  it('regroupe IPv6 par /64 et normalise les IPv4 mappées', () => {
    expect(ipBucket('2001:db8:abcd:12::1')).toBe(ipBucket('2001:0db8:abcd:0012:ffff:1:2:3'));
    expect(ipBucket('::ffff:1.2.3.4')).toBe('1.2.3.4');
    expect(ipBucket('1.2.3.4')).toBe('1.2.3.4');
  });
  it('lit X-Forwarded-For hors production', () => {
    expect(getClientIp(new Request(B, { headers: { 'x-forwarded-for': '9.9.9.9, 10.0.0.1' } }))).toBe('9.9.9.9');
  });
});

beforeAll(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
