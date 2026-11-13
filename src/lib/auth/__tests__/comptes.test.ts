/**
 * Comptes V3 : session, rôles, droits par offre, achat (webhook), inscription Découverte, équipe, middleware.
 * Mode « compte local de développement » (sans Supabase) + vérification HS256 pour le mode Supabase.
 */
import crypto from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'repere-comptes-'));
delete process.env.SUPABASE_URL;
delete process.env.NEXT_PUBLIC_SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.RESEND_API_KEY;

vi.mock('@/lib/auth/onboarding', () => ({ enqueueOnboardingAudit: vi.fn(async () => undefined) }));

const auth = await import('@/lib/auth');
const { COOKIES } = await import('@/lib/auth/cookies');
const session = await import('@/lib/auth/session');
const magic = await import('@/lib/auth/magic');
const claims = await import('@/lib/auth/claims');
const users = await import('@/lib/auth/users');
const team = await import('@/lib/auth/team');
const { provisionPurchase } = await import('@/lib/auth/provision');
const { decideRoute } = await import('@/lib/auth/routing');
const { getEntitlements, assertEntitled, assertWithinQuota } = await import('@/lib/entitlements');
const db = await import('@/lib/db');
const onboarding = await import('@/lib/auth/onboarding');

const env = process.env as Record<string, string | undefined>;
let n = 0;
const uniq = (p: string) => `${p}-${Date.now()}-${++n}@exemple.fr`;

function cookieHeader(writes: { name: string; value: string }[]): string {
  return writes.filter((w) => w.value).map((w) => `${w.name}=${encodeURIComponent(w.value)}`).join('; ');
}

function reqWith(cookie: string, url = 'http://localhost/api/x', init: RequestInit = {}): Request {
  return new Request(url, { ...init, headers: { cookie, ...(init.headers as Record<string, string>) } });
}

/** Connexion locale complète (lien magique → session confirmée). */
async function login(email: string, params: { claim?: string | null; invite?: string | null } = {}) {
  const link = await magic.serverMagicLink(email, params);
  const r = await magic.completeMagicLink(new URL(link!), null);
  expect(r.session).not.toBeNull();
  const fx = await claims.applyLoginEffects(r.session!, params);
  return { session: r.session!, cookie: cookieHeader(r.cookies), fx };
}

function fakeAudit(id: string, input: Record<string, unknown>) {
  return {
    id,
    input: { trade: 'éditeur', city: 'Lyon', ...input },
    score: 42,
    createdAt: new Date().toISOString(),
    queries: [],
    mentions: [],
    competitors: [],
  } as unknown as Parameters<typeof db.saveAudit>[0];
}

beforeEach(() => vi.spyOn(console, 'info').mockImplementation(() => undefined));
afterEach(() => vi.restoreAllMocks());

// ---------------------------------------------------------------------------
describe('session (compte local de développement)', () => {
  it('mode local hors production, indisponible en production sans Supabase', () => {
    expect(auth.authMode()).toBe('local');
    const prev = env.NODE_ENV;
    env.NODE_ENV = 'production';
    try {
      expect(auth.authMode()).toBe('off');
    } finally {
      env.NODE_ENV = prev;
    }
  });

  it('cookie de session signé, httpOnly, refusé s’il est modifié', async () => {
    const writes = session.localSessionCookies('u-1', 'Alice@Exemple.fr');
    expect(writes[0].options.httpOnly).toBe(true);
    const s = await session.sessionFromCookieHeader(cookieHeader(writes));
    expect(s).toEqual({ userId: 'u-1', email: 'alice@exemple.fr' });
    const tampered = writes[0].value.replace(/^./, (c) => (c === 'a' ? 'b' : 'a'));
    expect(await session.sessionFromCookieHeader(`${COOKIES.local}=${tampered}`)).toBeNull();
    expect(await auth.getSession(reqWith(cookieHeader(writes)))).toEqual({ userId: 'u-1', email: 'alice@exemple.fr' });
    expect(await auth.getSession(reqWith(''))).toBeNull();
  });

  it('lien magique local : confirme l’adresse, usage unique', async () => {
    const email = uniq('lien');
    await users.ensureUser(email);
    expect((await users.findUser(email))?.confirmed).toBe(false);
    const start = await magic.startBrowserLogin(email, { next: '/app/ia' });
    expect(start.ok).toBe(true);
    expect(start.devLink).toContain('/connexion/callback?local=');
    const url = new URL(start.devLink!);
    expect(url.searchParams.get('next')).toBe('/app/ia');
    const r = await magic.completeMagicLink(url, null);
    expect(r.session?.email).toBe(email);
    expect((await users.findUser(email))?.confirmed).toBe(true);
    expect((await magic.completeMagicLink(url, null)).error).toBe('expired');
  });

  it('next : jamais de redirection ouverte', async () => {
    const { safeNext } = auth;
    expect(safeNext('//evil.example')).toBe('/app');
    expect(safeNext('https://evil.example')).toBe('/app');
    expect(safeNext('/app/plan')).toBe('/app/plan');
  });

  it('mode Supabase : jeton HS256 vérifié localement, rafraîchi quand il expire', async () => {
    const saved = { url: env.SUPABASE_URL, key: env.SUPABASE_SERVICE_ROLE_KEY, secret: env.SUPABASE_JWT_SECRET };
    env.SUPABASE_URL = 'https://projet.supabase.co';
    env.SUPABASE_SERVICE_ROLE_KEY = 'service';
    env.SUPABASE_JWT_SECRET = 'secret-de-test';
    const jwt = (claims: object, secret = 'secret-de-test') => {
      const h = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const p = Buffer.from(JSON.stringify(claims)).toString('base64url');
      const sig = crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url');
      return `${h}.${p}.${sig}`;
    };
    try {
      expect(auth.authMode()).toBe('supabase');
      const exp = Math.floor(Date.now() / 1000) + 3600;
      const ok = jwt({ sub: '11111111-1111-4111-a111-111111111111', email: 'B@x.fr', exp });
      expect(await session.sessionFromCookieHeader(`${COOKIES.access}=${ok}`)).toEqual({ userId: '11111111-1111-4111-a111-111111111111', email: 'b@x.fr' });
      expect(await session.sessionFromCookieHeader(`${COOKIES.access}=${jwt({ sub: 'x', exp }, 'autre')}`)).toBeNull();
      // Bearer accepté (PWA)
      expect((await session.sessionFromCookieHeader('', ok))?.email).toBe('b@x.fr');

      const expired = jwt({ sub: 'u', exp: Math.floor(Date.now() / 1000) - 10 });
      const refreshed = await session.refreshIfNeeded(`${COOKIES.access}=${expired}; ${COOKIES.refresh}=rt`, async (rt) =>
        rt === 'rt' ? { accessToken: ok, refreshToken: 'rt2', expiresIn: 3600, userId: 'u', email: 'b@x.fr' } : null,
      );
      expect(refreshed?.find((w) => w.name === COOKIES.access)?.value).toBe(ok);
      expect(refreshed?.find((w) => w.name === COOKIES.refresh)?.options.httpOnly).toBe(true);
      const refused = await session.refreshIfNeeded(`${COOKIES.refresh}=mauvais`, async () => null);
      expect(refused?.every((w) => w.options.maxAge === 0)).toBe(true);
      expect(await session.refreshIfNeeded(`${COOKIES.access}=${ok}; ${COOKIES.refresh}=rt`, async () => null)).toBeNull();
    } finally {
      env.SUPABASE_URL = saved.url;
      env.SUPABASE_SERVICE_ROLE_KEY = saved.key;
      env.SUPABASE_JWT_SECRET = saved.secret;
      if (!saved.url) delete env.SUPABASE_URL;
      if (!saved.key) delete env.SUPABASE_SERVICE_ROLE_KEY;
      if (!saved.secret) delete env.SUPABASE_JWT_SECRET;
    }
  });
});

// ---------------------------------------------------------------------------
describe('rôles et requireBusiness', () => {
  it('démo : lecture sans session, écriture refusée', async () => {
    const r = await auth.requireBusiness(new Request('http://x'), 'demo-pme');
    expect(r.role).toBe('demo');
    await expect(auth.requireBusiness(new Request('http://x'), 'demo', { write: true })).rejects.toMatchObject({ status: 403, code: 'demo_read_only' });
  });

  it('identifiant invalide 400, inconnu 404', async () => {
    await expect(auth.requireBusiness(new Request('http://x'), '../etc')).rejects.toMatchObject({ status: 400 });
    await expect(auth.requireBusiness(new Request('http://x'), crypto.randomUUID())).rejects.toMatchObject({ status: 404 });
  });

  it('production sans fournisseur de comptes : 503, jamais d’accès ouvert', async () => {
    const b = await db.createBusiness({ name: 'Orphelin', trade: 't', city: 'c' });
    const prev = env.NODE_ENV;
    env.NODE_ENV = 'production';
    try {
      await expect(auth.requireBusiness(new Request('http://x'), b.id)).rejects.toMatchObject({ status: 503 });
    } finally {
      env.NODE_ENV = prev;
    }
  });

  it('owner, admin, member, viewer : droits hiérarchisés', async () => {
    const owner = await login(uniq('owner'));
    const b = await claims.createOwnedBusiness(owner.session, { name: 'Atelier', segment: 'local', city: 'Nantes' });
    // sans session : 401 (le bac à sable ne s'applique qu'aux espaces sans membre)
    await expect(auth.requireBusiness(new Request('http://x'), b.id)).rejects.toMatchObject({ status: 401 });
    expect((await auth.requireBusiness(reqWith(owner.cookie), b.id, { minRole: 'owner' })).role).toBe('owner');

    const viewer = await login(uniq('viewer'));
    await db.addMembership(b.id, viewer.session.userId, 'viewer', viewer.session.email);
    expect((await auth.requireBusiness(reqWith(viewer.cookie), b.id)).role).toBe('viewer');
    await expect(auth.requireBusiness(reqWith(viewer.cookie), b.id, { write: true })).rejects.toMatchObject({ status: 403 });

    const member = await login(uniq('member'));
    await db.addMembership(b.id, member.session.userId, 'member', member.session.email);
    expect((await auth.requireBusiness(reqWith(member.cookie), b.id, { write: true })).role).toBe('member');
    await expect(auth.requireBusiness(reqWith(member.cookie), b.id, { minRole: 'admin' })).rejects.toMatchObject({ status: 403 });

    const stranger = await login(uniq('stranger'));
    await expect(auth.requireBusiness(reqWith(stranger.cookie), b.id)).rejects.toMatchObject({ status: 403 });
  });

  it('bac à sable local : un espace sans membre reste ouvert (V2), jamais en production', async () => {
    const b = await db.createBusiness({ name: 'Bac à sable', trade: 't', city: 'c' });
    expect((await auth.requireBusiness(new Request('http://x'), b.id, { write: true })).role).toBe('owner');
  });

  it('compat : canEditBusiness et db.canAccessBusiness délèguent', async () => {
    const { canEditBusiness } = await import('@/lib/auth/compat');
    expect(await canEditBusiness(new Request('http://x'), 'demo', { write: true })).toMatchObject({ ok: false, status: 403, demo: true });
    expect(await canEditBusiness(new Request('http://x'), 'demo')).toMatchObject({ ok: true, demo: true });
    const owner = await login(uniq('compat'));
    const b = await claims.createOwnedBusiness(owner.session, { name: 'Compat', segment: 'pme' });
    expect(await canEditBusiness(reqWith(owner.cookie), b.id, { write: true })).toMatchObject({ ok: true, role: 'owner' });
    expect(await db.canAccessBusiness(new Request('http://x'), b.id)).toEqual({ ok: false, status: 401 });
  });
});

// ---------------------------------------------------------------------------
describe('droits par offre', () => {
  const base = { id: 'b1', segment: 'local' as const, planId: null };

  it('Découverte : 1 marque, 5 questions, 1 mesure par mois, 3 IA, pas d’exécution', () => {
    const e = getEntitlements({ ...base, plan: 'free' });
    expect(e).toMatchObject({ tier: 'decouverte', prompts: 5, brands: 1, frequency: 'monthly', execution: false, exports: false, planId: 'local_decouverte' });
    expect(e.engines).toEqual(['chatgpt', 'perplexity', 'gemini']);
    expect(() => assertEntitled(e, 'execution')).toThrow(expect.objectContaining({ status: 402, code: 'upgrade_required' }));
    expect(() => assertWithinQuota(e, 'prompts', 5)).toThrow(expect.objectContaining({ status: 402 }));
    expect(() => assertWithinQuota(e, 'prompts', 4)).not.toThrow();
  });

  it('Essentiel et Accompagné suivent les volumes annoncés par parcours', () => {
    expect(getEntitlements({ ...base, plan: 'essentiel' })).toMatchObject({ tier: 'essentiel', prompts: 20, frequency: 'monthly', execution: true });
    expect(getEntitlements({ ...base, segment: 'pme', plan: 'essentiel' })).toMatchObject({ prompts: 50, frequency: 'weekly', integrations: true });
    expect(getEntitlements({ ...base, segment: 'ecommerce', plan: 'accompagne' })).toMatchObject({ tier: 'accompagne', prompts: 100 });
    expect(getEntitlements({ ...base, plan: 'accompagne' }).prompts).toBe(30);
    expect(getEntitlements({ ...base, segment: 'pme', plan: 'accompagne' }).engines).toContain('mistral');
  });

  it('Agence : marque blanche ; démo : tout visible ; inactif : Découverte ; V1 mappées', () => {
    expect(getEntitlements({ ...base, plan: 'agency' })).toMatchObject({ tier: 'agence', whiteLabel: true, brands: 20 });
    expect(getEntitlements({ ...base, id: 'demo-ecom', plan: 'free' })).toMatchObject({ tier: 'demo', execution: true });
    expect(getEntitlements({ ...base, plan: 'essentiel', isActive: false }).tier).toBe('decouverte');
    expect(getEntitlements({ ...base, plan: 'suivi' }).tier).toBe('essentiel');
    expect(getEntitlements({ ...base, plan: 'reseau' })).toMatchObject({ tier: 'essentiel', brands: 5 });
    expect(getEntitlements({ ...base, plan: 'essentiel' }).whiteLabel).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe('achat (provisionPurchase, appelé par le webhook)', () => {
  it('crée le compte et le commerce avec le BON segment ; rattachement au clic (adresse prouvée)', async () => {
    const email = uniq('pme');
    const auditId = crypto.randomUUID();
    await db.saveAudit(fakeAudit(auditId, { businessName: 'Paysia', segment: 'pme', email }));
    const out = await provisionPurchase({ planId: 'pme_essentiel_month', email, customerId: 'cus_1', auditId }, { sendEmail: false });
    expect(out.created).toBe(true);
    expect(out.attached).toBe(false); // compte créé non confirmé
    const b = await db.getBusinessRecord(out.businessId!);
    expect(b).toMatchObject({ segment: 'pme', name: 'Paysia', ownerId: null, contactEmail: email });
    expect((await users.findUser(email))?.confirmed).toBe(false);
    expect(out.magicLink).toContain('claim=');
    expect(onboarding.enqueueOnboardingAudit).toHaveBeenCalledWith(out.businessId);

    const url = new URL(out.magicLink!);
    const r = await magic.completeMagicLink(url, null);
    const fx = await claims.applyLoginEffects(r.session!, { claim: url.searchParams.get('claim') });
    expect(fx.businessIds).toContain(out.businessId);
    expect(fx.hasBusiness).toBe(true);
    expect((await db.getMembership(out.businessId!, r.session!.userId))?.role).toBe('owner');
  });

  it('jeton de rattachement inutilisable par une autre adresse', async () => {
    const email = uniq('victime');
    const out = await provisionPurchase({ planId: 'local_essentiel_month', email, customerId: 'cus_v' }, { sendEmail: false });
    const claim = new URL(out.magicLink!).searchParams.get('claim');
    const thief = await login(uniq('voleur'), { claim });
    expect(thief.fx.businessIds).not.toContain(out.businessId);
    expect((await db.getBusinessRecord(out.businessId!))?.ownerId).toBeNull();
  });

  it('e-mail non confirmé : jamais rattaché, même si un compte existe déjà à cette adresse', async () => {
    const email = uniq('nonconfirme');
    await users.ensureUser(email); // inscription abandonnée ou compte créé par un tiers
    const out = await provisionPurchase({ planId: 'local_essentiel_month', email, customerId: 'cus_nc' }, { sendEmail: false });
    expect(out.attached).toBe(false);
    expect(out.secondPurchase).toBe(false);
    expect((await db.getBusinessRecord(out.businessId!))?.ownerId).toBeNull();
  });

  it('sans audit : espace « à compléter » ; deuxième achat d’un client confirmé : rattaché tout de suite', async () => {
    const email = uniq('second');
    const first = await provisionPurchase({ planId: 'ecom_essentiel_month', email, customerId: 'cus_2' }, { sendEmail: false });
    const b1 = await db.getBusinessRecord(first.businessId!);
    expect(b1).toMatchObject({ needsSetup: true, segment: 'ecommerce' });
    expect(new URL(first.magicLink!).searchParams.get('next')).toBe('/bienvenue');
    const u = new URL(first.magicLink!);
    const r = await magic.completeMagicLink(u, null);
    await claims.applyLoginEffects(r.session!, { claim: u.searchParams.get('claim') });

    const auditId = crypto.randomUUID();
    await db.saveAudit(fakeAudit(auditId, { businessName: 'Maison Sora 2', segment: 'ecommerce', email }));
    const second = await provisionPurchase({ planId: 'ecom_accompagne_month', email, customerId: 'cus_2', auditId }, { sendEmail: false });
    expect(second.secondPurchase).toBe(true);
    expect(second.attached).toBe(true);
    expect(second.businessId).not.toBe(first.businessId);
    expect((await db.getMembership(second.businessId!, r.session!.userId))?.role).toBe('owner');
    expect(new URL(second.magicLink!).searchParams.get('claim')).toBeNull();
  });

  it('montée en gamme sans session : l’espace Découverte du même parcours est réutilisé', async () => {
    const email = uniq('upgrade');
    const me = await login(email);
    const free = await claims.createOwnedBusiness(me.session, { name: 'Boutique', segment: 'ecommerce' });
    const out = await provisionPurchase({ planId: 'ecom_essentiel_month', email, customerId: 'cus_up' }, { sendEmail: false });
    expect(out.businessId).toBe(free.id);
    expect(out.attached).toBe(true);
  });

  it('metadata business_id (posée par notre serveur) : met à niveau cet espace', async () => {
    const email = uniq('meta');
    const me = await login(email);
    const b = await claims.createOwnedBusiness(me.session, { name: 'Cabinet', segment: 'pme' });
    const out = await provisionPurchase({ planId: 'pme_accompagne_month', email, customerId: 'cus_m', businessId: b.id }, { sendEmail: false });
    expect(out.businessId).toBe(b.id);
    expect(out.created).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe('webhook Stripe (route)', () => {
  it('checkout.session.completed : compte, commerce PME, plan et offre exacte', async () => {
    env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    const fakeStripe = {
      webhooks: { constructEventAsync: async (raw: string) => JSON.parse(raw) },
      subscriptions: {
        retrieve: async () => ({ id: 'sub_1', status: 'active', metadata: {}, created: 1, items: { data: [{ current_period_end: 2_000_000_000 }] } }),
      },
    };
    vi.doMock('@/lib/stripe', async (orig) => ({ ...(await orig<typeof import('@/lib/stripe')>()), getStripe: () => fakeStripe }));
    vi.resetModules();
    vi.doMock('@/lib/auth/onboarding', () => ({ enqueueOnboardingAudit: vi.fn(async () => undefined) }));
    const route = await import('@/app/api/stripe/webhook/route');
    const freshDb = await import('@/lib/db');
    const email = uniq('webhook');
    const auditId = crypto.randomUUID();
    await freshDb.saveAudit(fakeAudit(auditId, { businessName: 'Cabinet Webhook', segment: 'pme', email }));
    const event = {
      id: `evt_${crypto.randomUUID()}`,
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_1',
          mode: 'subscription',
          payment_status: 'paid',
          created: 1,
          customer: 'cus_wh',
          subscription: 'sub_1',
          customer_details: { email },
          client_reference_id: auditId,
          metadata: { app: 'auditia', plan_id: 'pme_essentiel_month', audit_id: auditId },
        },
      },
    };
    const res = await route.POST(new Request('http://localhost/api/stripe/webhook', { method: 'POST', headers: { 'stripe-signature': 't=1,v1=x' }, body: JSON.stringify(event) }));
    expect(res.status).toBe(200);
    const bid = await freshDb.getAuditBusinessId(auditId);
    const b = await freshDb.getBusinessRecord(bid!);
    expect(b).toMatchObject({ segment: 'pme', plan: 'essentiel', planId: 'pme_essentiel_month', stripeCustomerId: 'cus_wh' });
    const subs = await freshDb.listSubscriptionsByCustomer('cus_wh');
    expect(subs[0]).toMatchObject({ businessId: bid, status: 'active' });
    vi.doUnmock('@/lib/stripe');
    delete env.STRIPE_WEBHOOK_SECRET;
  });
});

// ---------------------------------------------------------------------------
describe('inscription Découverte', () => {
  it('l’espace est créé au clic (bon segment, offre Découverte), une seule fois', async () => {
    const email = uniq('signup');
    await users.ensureUser(email);
    const claim = claims.signupClaimToken({ email, name: 'Atelier Lune', segment: 'ecommerce', website: 'https://lune.fr/' });
    const a = await login(email, { claim });
    expect(a.fx.businessIds).toHaveLength(1);
    const b = await db.getBusinessRecord(a.fx.businessIds[0]);
    expect(b).toMatchObject({ name: 'Atelier Lune', segment: 'ecommerce', planId: 'ecom_decouverte', plan: 'free', ownerId: a.session.userId });
    // second clic sur une nouvelle inscription : l'espace gratuit existant est rouvert
    const again = await login(email, { claim: claims.signupClaimToken({ email, name: 'Autre', segment: 'local' }) });
    expect(again.fx.businessIds).toHaveLength(0);
    expect(again.fx.selectBusinessId).toBe(b!.id);
  });

  it('connecté sans espace : hasBusiness faux (→ /bienvenue, jamais la démo)', async () => {
    const r = await login(uniq('vide'));
    expect(r.fx.hasBusiness).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe('équipe', () => {
  it('sièges bornés par l’offre, invitation liée à l’adresse, dernier propriétaire protégé', async () => {
    const owner = await login(uniq('chef'));
    const b = await claims.createOwnedBusiness(owner.session, { name: 'Équipe', segment: 'pme' });
    const by = { session: owner.session, role: 'owner' as const };
    // Découverte : 1 accès
    await expect(team.inviteMember(b, by, { email: uniq('x'), role: 'member' })).rejects.toMatchObject({ status: 402 });
    await db.updateBusiness(b.id, { plan: 'essentiel' });
    const paid = (await db.getBusinessRecord(b.id))!;
    const guestEmail = uniq('invite');
    const { url } = await team.inviteMember(paid, by, { email: guestEmail, role: 'admin' });
    const token = new URL(url).searchParams.get('invitation')!;
    // autre adresse : refusé
    const intruder = await login(uniq('intrus'));
    expect((await claims.acceptInvitation(intruder.session, token)).outcome).toBe('wrong_email');
    // bonne adresse
    const guest = await login(guestEmail, { invite: token });
    expect(guest.fx.invite).toBe('accepted');
    expect((await db.getMembership(b.id, guest.session.userId))?.role).toBe('admin');
    // un admin n'invite pas d'admin
    await expect(team.inviteMember(paid, { session: guest.session, role: 'admin' }, { email: uniq('y'), role: 'admin' })).rejects.toMatchObject({ status: 403 });
    // dernier propriétaire
    await expect(team.removeMember(paid, { userId: owner.session.userId, role: 'owner' }, owner.session.userId)).rejects.toMatchObject({ code: 'last_owner' });
    await expect(team.changeRole(paid, { userId: owner.session.userId, role: 'owner' }, owner.session.userId, 'admin')).rejects.toMatchObject({ code: 'last_owner' });
    const view = await team.teamView(paid, { userId: owner.session.userId, role: 'owner' });
    expect(view.members).toHaveLength(2);
    expect(view.seats.max).toBe(3);
  });
});

// ---------------------------------------------------------------------------
describe('middleware (redirections)', () => {
  it('décisions pures', () => {
    expect(decideRoute({ pathname: '/app', search: '', hasSession: false })).toEqual({ action: 'redirect', to: '/connexion?next=%2Fapp' });
    expect(decideRoute({ pathname: '/app/ia', search: '?compte=demo-pme', hasSession: false })).toEqual({ action: 'redirect', to: '/app/ia', setDemo: 'pme' });
    expect(decideRoute({ pathname: '/app', search: '', hasSession: false, demoCookie: 'ecommerce' })).toEqual({ action: 'next' });
    expect(decideRoute({ pathname: '/app', search: '', hasSession: true })).toEqual({ action: 'needWorkspace' });
    expect(decideRoute({ pathname: '/app', search: '', hasSession: true, hasWorkspace: false })).toEqual({ action: 'redirect', to: '/bienvenue' });
    expect(decideRoute({ pathname: '/app', search: '', hasSession: true, hasWorkspace: true })).toEqual({ action: 'next' });
    expect(decideRoute({ pathname: '/app/connexion', search: '?x=1', hasSession: false })).toEqual({ action: 'redirect', to: '/connexion?x=1' });
    expect(decideRoute({ pathname: '/bienvenue', search: '', hasSession: false })).toMatchObject({ action: 'redirect', to: '/connexion?next=%2Fbienvenue' });
    expect(decideRoute({ pathname: '/app/hors-ligne', search: '', hasSession: false })).toEqual({ action: 'next' });
    expect(decideRoute({ pathname: '/tarifs', search: '', hasSession: false })).toEqual({ action: 'next' });
  });

  it('middleware réel : connexion, démo, /bienvenue, espace', async () => {
    const { NextRequest } = await import('next/server');
    const { middleware } = await import('@/middleware');
    const go = (url: string, cookie = '') => middleware(new NextRequest(url, { headers: cookie ? { cookie } : {} }));

    const anon = await go('http://localhost/app/ia');
    expect(anon.status).toBe(307);
    expect(anon.headers.get('location')).toBe('http://localhost/connexion?next=%2Fapp%2Fia');

    const demo = await go('http://localhost/app?compte=demo-ecom');
    expect(demo.headers.get('location')).toBe('http://localhost/app');
    expect(demo.cookies.get(COOKIES.demo)?.value).toBe('ecommerce');

    const empty = await login(uniq('mw'));
    const noWs = await go('http://localhost/app', empty.cookie);
    expect(noWs.headers.get('location')).toBe('http://localhost/bienvenue');

    await claims.createOwnedBusiness(empty.session, { name: 'MW', segment: 'local', city: 'Lille' });
    const ok = await go('http://localhost/app', empty.cookie);
    expect(ok.headers.get('location')).toBeNull();
    expect(ok.cookies.get(COOKIES.workspace)?.value).toBe(empty.session.userId);

    const api = await go('http://localhost/api/account/session');
    expect(api.headers.get('location')).toBeNull();
  });
});
