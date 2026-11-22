/**
 * V8 (TEST-MARQUE) — inscription libre « sans carte bancaire » : serveur de démonstration (DEMO_MODE, build de
 * production, sans Supabase) → comptes locaux, e-mail de confirmation, lien montré seulement pour CRÉER un compte ;
 * rattachement de l'analyse par le lien signé du rapport ; marque déjà suivie (questions du test de marque).
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.setConfig({ testTimeout: 30_000 });
process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'repere-inscription-libre-'));
for (const k of ['SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'RESEND_API_KEY', 'VERCEL', 'AUTH_LOCAL_ACCOUNTS', 'DEMO_MODE']) delete process.env[k];
const enqueue = vi.fn(async () => ({ id: 'j' }));
vi.mock('@/lib/jobs', () => ({ enqueue }));

const env = process.env as Record<string, string | undefined>;
env.AUTH_SECRET ||= 'test-auth-secret-v8-xxxxxxxxxxxxxxxxxxxx';
env.AUDIT_SIGNING_SECRET ||= 'test-audit-secret-v8-xxxxxxxxxxxxxxxxxxx';
env.UNSUBSCRIBE_SECRET ||= 'test-unsub-secret-v8-xxxxxxxxxxxxxxxxxxx';
const config = await import('@/lib/auth/config');
const magic = await import('@/lib/auth/magic');
const users = await import('@/lib/auth/users');
const claims = await import('@/lib/auth/claims');
const store = await import('@/lib/analysis/store');
type FA = import('@/lib/analysis/types').FullAnalysis;

function asDemoServer<T>(fn: () => Promise<T>): Promise<T> {
  const prev = { NODE_ENV: env.NODE_ENV, DEMO_MODE: env.DEMO_MODE };
  env.NODE_ENV = 'production';
  env.DEMO_MODE = '1';
  return fn().finally(() => {
    env.NODE_ENV = prev.NODE_ENV;
    if (prev.DEMO_MODE === undefined) delete env.DEMO_MODE;
    else env.DEMO_MODE = prev.DEMO_MODE;
  });
}

afterEach(() => vi.restoreAllMocks());

describe('mode d’authentification du serveur de démonstration', () => {
  it('production sans Supabase : off ; avec DEMO_MODE (hors Vercel) : comptes de démonstration', async () => {
    const prev = env.NODE_ENV;
    env.NODE_ENV = 'production';
    try {
      expect(config.authMode()).toBe('off');
      env.DEMO_MODE = '1';
      expect(config.authMode()).toBe('local');
      expect(config.demoAccounts()).toBe(true);
      env.VERCEL = '1';
      expect(config.authMode()).toBe('off');
    } finally {
      env.NODE_ENV = prev;
      delete env.DEMO_MODE;
      delete env.VERCEL;
    }
    expect(config.demoAccounts()).toBe(false); // développement : comptes locaux classiques
  });
});

describe('lien de confirmation', () => {
  it('démo : e-mail envoyé (journalisé) ; lien montré pour créer un compte non confirmé, jamais pour se connecter', async () => {
    const logs: string[] = [];
    vi.spyOn(console, 'info').mockImplementation((...a: unknown[]) => void logs.push(a.map(String).join(' ')));
    await asDemoServer(async () => {
      const email = `nouveau-${Date.now()}@exemple.fr`;
      await users.ensureUser(email);
      const claim = claims.signupClaimToken({ email, name: 'Atelier Lune', segment: 'local', city: 'Lyon', trade: 'fleuriste' });
      const r = await magic.startBrowserLogin(email, { next: '/app', claim });
      expect(r.ok).toBe(true);
      expect(r.devLink).toMatch(/\/connexion\/callback\?/);
      expect(logs.some((l) => l.includes('[email:démo]') && l.includes('Confirmez votre adresse') && l.includes(email))).toBe(true);

      // Connexion (pas d'inscription) : aucun lien à l'écran.
      const login = await magic.startBrowserLogin(email, { next: '/app' });
      expect(login.ok).toBe(true);
      expect(login.devLink).toBeUndefined();

      // Compte déjà confirmé : une nouvelle « inscription » ne montre pas le lien (pas de prise de compte).
      await users.markLocalConfirmed(email);
      const again = await magic.startBrowserLogin(email, { next: '/app', claim: claims.signupClaimToken({ email, name: 'X', segment: 'local' }) });
      expect(again.devLink).toBeUndefined();

      // Le lien ouvre bien une session (parcours complet).
      const done = await magic.completeMagicLink(new URL(r.devLink!), null);
      expect(done.session?.email).toBe(email);
    });
  });
});

function analysis(id: string, withTest = true): FA {
  return {
    id,
    version: 1,
    input: { url: 'https://atelier-lune.fr/' },
    detected: { brand: 'Atelier Lune', siteType: 'local', city: 'Lyon', activity: 'fleuriste', sources: { brand: 'jsonld', siteType: 'jsonld' } },
    createdAt: new Date().toISOString(),
    durationMs: 1000,
    crawl: null,
    seo: null,
    geo: null,
    verdict: '',
    scores: { seo: null, geo: null, global: null },
    priorities: [],
    autoFixes: [],
    modules: {} as FA['modules'],
    partial: false,
    demo: true,
    ...(withTest
      ? {
          brandTest: {
            version: 1 as const,
            demo: true,
            measuredAt: new Date().toISOString(),
            brand: 'Atelier Lune',
            questions: [
              { id: 'Q60-1', text: 'Quel fleuriste me recommandez-vous à Lyon ?', cells: [] },
              { id: 'Q60-2', text: 'Quels sont les fleuristes les mieux notés à Lyon ?', cells: [] },
            ],
            providers: [],
            notConfigured: [],
            overall: { cited: 0, asked: 0, rate: 0, low: 0, high: 0 },
            note: '',
          },
        }
      : {}),
  };
}

describe('rattachement de l’analyse et marque déjà suivie', () => {
  it('lien signé du rapport : l’adresse est ajoutée, l’analyse rattachée à la confirmation, questions du test semées', async () => {
    const id = `an_libre${Date.now()}`;
    const saved = await store.saveAnalysis(analysis(id), { domain: 'atelier-lune.fr' }); // aucun e-mail au lancement
    const email = `gerante-${Date.now()}@exemple.fr`;
    expect(await store.addRequesterEmail(id, 'mauvais-jeton-xxxxxxxxxxxxxxxxxxxxxxxxxxxx', email)).toBe(false);
    expect(await store.addRequesterEmail(id, saved.token, email)).toBe(true);
    const d = await claims.analysisSignupDefaults(id, email);
    expect(d?.questions?.map((q) => q.id)).toEqual(['Q60-1', 'Q60-2']);

    const s = { userId: `u-${Date.now()}`, email };
    const fx = await claims.applyLoginEffects(s, { claim: claims.signupClaimToken({ email, name: 'Atelier Lune', segment: 'local', city: 'Lyon', trade: 'fleuriste', analysis: id }) });
    expect(fx.selectBusinessId).toBeTruthy();
    expect((await store.getStoredAnalysis(id))?.businessId).toBe(fx.selectBusinessId);
    const { listPrompts } = await import('@/lib/prompts/repo');
    const prompts = await listPrompts(fx.selectBusinessId!);
    expect(prompts.map((p) => p.text)).toEqual(expect.arrayContaining(['Quel fleuriste me recommandez-vous à Lyon ?']));
    expect(enqueue).toHaveBeenCalledWith('audit.run', expect.objectContaining({ businessId: fx.selectBusinessId }), expect.anything());

    // Déjà rattachée : un autre détenteur du lien ne peut plus l'ajouter.
    expect(await store.addRequesterEmail(id, saved.token, 'autre@exemple.fr')).toBe(false);
  });
});
