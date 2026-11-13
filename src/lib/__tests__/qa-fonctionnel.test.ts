/**
 * QA-FONCTIONNEL V3 : tests d'intégration des défauts trouvés en parcourant l'app comme un vrai client
 * (inscription Découverte, achat, résiliation, partage, droits) et des correctifs de qa/v3/securite-v3.md.
 * Mode « compte local de développement », store fichier dans un dossier temporaire.
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'repere-qa-fn-'));
delete process.env.SUPABASE_URL;
delete process.env.NEXT_PUBLIC_SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.RESEND_API_KEY;

vi.mock('@/lib/auth/onboarding', () => ({ enqueueOnboardingAudit: vi.fn(async () => undefined) }));

const magic = await import('@/lib/auth/magic');
const claims = await import('@/lib/auth/claims');
const businesses = await import('@/lib/auth/businesses');
const { safeNext } = await import('@/lib/auth/cookies');
const { provisionPurchase } = await import('@/lib/auth/provision');
const onboarding = await import('@/lib/auth/onboarding');
const db = await import('@/lib/db');
const { confirmToken, readConfirmToken } = await import('@/lib/notify/reports');
const { isPrivateIp } = await import('@/lib/integrations');
const { norm: referralNorm } = await import('@/lib/growth/referral');

let n = 0;
const uniq = (p: string) => `${p}-${Date.now()}-${++n}@exemple.fr`;

async function login(email: string, params: { claim?: string | null; invite?: string | null } = {}) {
  const link = await magic.serverMagicLink(email, params);
  const r = await magic.completeMagicLink(new URL(link!), null);
  const fx = await claims.applyLoginEffects(r.session!, params);
  return { session: r.session!, fx };
}

function fakeAudit(id: string, input: Record<string, unknown>, createdAt = new Date().toISOString()) {
  return { id, input: { trade: 'boulanger', city: 'Lyon', ...input }, score: 50, createdAt, queries: [{ id: 'q1', text: 'Meilleur boulanger à Lyon ?' }], mentions: [], competitors: [] } as unknown as Parameters<typeof db.saveAudit>[0];
}

beforeEach(() => vi.spyOn(console, 'info').mockImplementation(() => undefined));
afterEach(() => vi.restoreAllMocks());

describe('inscription Découverte d’un commerce local sans ville', () => {
  it('propose /bienvenue (espace à compléter), puis lance le premier audit une fois l’espace complété', async () => {
    const email = uniq('local');
    const claim = (await import('@/lib/auth/claims')).signupClaimToken({ email, name: 'Boulangerie QA', segment: 'local', website: 'https://exemple.fr/' });
    const { session, fx } = await login(email, { claim });
    expect(fx.next).toBe('/bienvenue');
    const list = await businesses.listAccountBusinesses(session);
    expect(list).toHaveLength(1);
    expect(list[0].needsSetup).toBe(true); // perdu auparavant (forme publique sans needsSetup)
    vi.mocked(onboarding.enqueueOnboardingAudit).mockClear();
    // Métier désormais demandé aussi (jamais de métier générique « commerce » : regard-client-v3 B1).
    await businesses.completeBusinessSetup(session, { businessId: list[0].id, name: 'Boulangerie QA', trade: 'boulanger', city: 'Lyon' });
    // auparavant : needsSetup relu APRÈS la mise à jour (objet modifié en place) → audit jamais lancé
    expect(onboarding.enqueueOnboardingAudit).toHaveBeenCalledWith(list[0].id);
    expect((await businesses.listAccountBusinesses(session))[0].needsSetup).toBe(false);
  });
});

describe('questions suivies initiales', () => {
  it('ne pose pas le marqueur « semé » tant qu’aucun audit n’existe', async () => {
    const { ensureInitialPrompts, listPrompts } = await import('@/lib/prompts/repo');
    const b = await db.createBusiness({ name: 'Semis QA', trade: 'boulanger', city: 'Lyon', plan: 'free', segment: 'local' });
    expect(await ensureInitialPrompts(b)).toHaveLength(0);
    await db.saveAudit(fakeAudit(crypto.randomUUID(), { businessName: 'Semis QA' }), { businessId: b.id, trigger: 'manual' });
    const seeded = await ensureInitialPrompts(b);
    expect(seeded.length).toBeGreaterThan(0);
    expect((await listPrompts(b.id)).length).toBe(seeded.length);
  });
});

describe('abonnements Stripe', () => {
  it('une résiliation retrouve le commerce même si le paiement a été enregistré avant l’abonnement', async () => {
    const b = await db.createBusiness({ name: 'Garage QA', trade: 'garagiste', city: 'Nantes', plan: 'essentiel', segment: 'local' });
    await db.upsertSubscription({ stripeCustomerId: 'cus_qa1', stripeSubscriptionId: null, planId: 'local_essentiel_month', status: 'active', businessId: b.id } as never);
    const rec = await db.upsertSubscription({ stripeCustomerId: 'cus_qa1', stripeSubscriptionId: 'sub_qa1', planId: 'local_essentiel_month', status: 'canceled' } as never);
    expect(rec.businessId).toBe(b.id);
    expect(await db.listSubscriptionsByCustomer('cus_qa1')).toHaveLength(1);
  });
});

describe('achat avec l’identifiant d’audit d’un tiers (M4)', () => {
  it('ne reprend ni la saisie ni le rattachement si l’acheteur n’a pas demandé l’audit', async () => {
    const auditId = crypto.randomUUID();
    await db.saveAudit(fakeAudit(auditId, { businessName: 'Commerce Victime', segment: 'local' }));
    await db.saveLead({ email: uniq('victime'), businessName: 'Commerce Victime', auditId, source: 'site', consent: false } as never);
    const out = await provisionPurchase({ planId: 'local_essentiel_month', email: uniq('concurrent'), customerId: 'cus_m4', auditId }, { sendEmail: false });
    const b = await db.getBusinessRecord(out.businessId!);
    expect(b?.name).not.toBe('Commerce Victime');
    expect(b?.needsSetup).toBe(true);
    expect(await db.getAuditBusinessId(auditId)).toBeNull();
  });

  it('l’auteur de l’audit (adresse dans leads) le retrouve à l’achat et à l’inscription', async () => {
    const email = uniq('auteur');
    const auditId = crypto.randomUUID();
    await db.saveAudit(fakeAudit(auditId, { businessName: 'Commerce Auteur', segment: 'local' }));
    await db.saveLead({ email, businessName: 'Commerce Auteur', auditId, source: 'site', consent: false } as never);
    expect(await db.auditRequestedBy(auditId, email)).toBe(true);
    expect(await db.auditRequestedBy(auditId, uniq('autre'))).toBe(false);
    const claim = claims.signupClaimToken({ email, name: 'Commerce Auteur', segment: 'local', city: 'Lyon', audit: auditId });
    const { fx } = await login(email, { claim });
    expect(await db.getAuditBusinessId(auditId)).toBe(fx.selectBusinessId);
  });
});

describe('correctifs de sécurité', () => {
  it('M1 : safeNext refuse les redirections déguisées', () => {
    for (const bad of ['/\t/evil.fr', '/\\evil.fr', '/\u0000/evil.fr', '//evil.fr', 'https://evil.fr', '/%09/evil.fr'.replace('%09', '\t'), '/\n/evil.fr']) {
      expect(safeNext(bad)).toBe('/app');
    }
    expect(safeNext('/app/questions?q=1#x')).toBe('/app/questions?q=1#x');
    expect(safeNext('/carte/abc?t=1')).toBe('/carte/abc?t=1');
  });

  it('M3 : le jeton de confirmation des rapports expire', () => {
    const t = confirmToken('bizQ', 'a@b.fr');
    expect(readConfirmToken(t)).toEqual({ businessId: 'bizQ', email: 'a@b.fr' });
    const old = confirmToken('bizQ', 'a@b.fr', Date.now() - 15 * 86_400_000);
    expect(readConfirmToken(old)).toBeNull();
  });

  it('M2 : filtre IP des webhooks aligné sur siteaudit (NAT64, 6to4, lien local)', () => {
    for (const ip of ['64:ff9b::a9fe:a9fe', '2002:7f00:1::', '::7f00:1', 'fe81::1', 'fec0::1', '127.0.0.1', '10.1.2.3', '169.254.169.254']) {
      expect(isPrivateIp(ip)).toBe(true);
    }
    expect(isPrivateIp('93.184.216.34')).toBe(false);
  });

  it('M6 : adresse canonique pour l’auto-parrainage', () => {
    expect(referralNorm('Jean.Dupont+promo@gmail.com')).toBe(referralNorm('jeandupont@googlemail.com'));
    expect(referralNorm('a+x@exemple.fr')).toBe('a@exemple.fr');
  });
});

describe('cohérence des chiffres des comptes démo', () => {
  it('marge du rapport public / PDF = marge de l’app, du CSV et du copilote (range), pour les 3 comptes', async () => {
    const { buildDemoWorkspaceById } = await import('@/lib/demo-v2');
    const { marginOf } = await import('@/components/report/v3');
    for (const id of ['demo', 'demo-pme', 'demo-ecom']) {
      const ws = buildDemoWorkspaceById(id)!;
      for (const a of ws.audits) {
        const m = marginOf(a as never);
        expect(m.score, `${id} ${a.id}`).toBe(Math.round(a.score));
        expect([m.low, m.high], `${id} ${a.id}`).toEqual([a.range!.low, a.range!.high]);
      }
    }
  });
});

describe('copilote', () => {
  it('« Quelle est ma part de voix ? » reçoit la réponse chiffrée (rang + part de voix), pas « pas de donnée »', async () => {
    const { detectIntent } = await import('@/lib/copilot/router');
    expect(detectIntent('Quelle est ma part de voix ?')).toBe('rank');
    expect(detectIntent('Exporte la part de voix en CSV')).toBe('export');
  });
});

describe('POST /api/audit { businessId } : une mesure par période de l’offre (E1)', () => {
  it('Découverte : 402 après la mesure du mois (au-delà de l’exception post-inscription)', async () => {
    const { POST } = await import('@/app/api/audit/route');
    const b = await db.createBusiness({ name: 'Quota QA', trade: 'boulanger', city: 'Lyon', plan: 'free', segment: 'local', planId: 'local_decouverte' });
    const day = 86_400_000;
    await db.saveAudit(fakeAudit(crypto.randomUUID(), { businessName: 'Quota QA' }, new Date(Date.now() - 3 * day).toISOString()), { businessId: b.id, trigger: 'manual' });
    await db.saveAudit(fakeAudit(crypto.randomUUID(), { businessName: 'Quota QA' }, new Date(Date.now() - 2 * day).toISOString()), { businessId: b.id, trigger: 'manual' });
    // bac à sable local : commerce sans membre accessible sans session (comme en V2)
    const r = await POST(new Request('http://localhost/api/audit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ businessId: b.id }) }));
    expect(r.status).toBe(402);
    expect(((await r.json()) as { code?: string }).code).toBe('quota_exceeded');
  });
});
