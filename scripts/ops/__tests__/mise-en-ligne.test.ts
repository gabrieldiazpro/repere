/**
 * Scripts de mise en ligne : secrets, contrôle de production, configuration Stripe (client simulé qui vérifie
 * chaque appel), vérification du site en ligne (fetch simulé), branchement de l'identité légale.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import Stripe from 'stripe';
import { CATALOG, INTERNAL_SECRETS, entityReady, jwtPayload, luhnOk } from '../lib/catalog.mjs';
import { APP_ROOT, parseEnv, quoteEnv, upsertEnvText } from '../lib/envfile.mjs';
import { priceEnvName, soldPlans } from '../lib/plans.mjs';
import { buildEnvTemplate, internalSecrets, vercelCommands, vercelValues } from '../secrets.mjs';
import { checkProduction } from '../check-env.mjs';
import { keyMode, priceSpec, productKey, setupStripe, webhookEvents } from '../stripe-setup.mjs';
import { formatVerify, verify } from '../verifier-prod.mjs';

type Plan = { id: string; segment: string; name: string; priceCents: number; interval: 'one_time' | 'month' | 'year'; available: boolean; legacy?: boolean };

// --------------------------------------------------------------------------------------------------------------
// Environnement de production complet et valide (valeurs fictives, format réel)
// --------------------------------------------------------------------------------------------------------------
const REF = 'abcdefghijklmnopqrst';
function jwt(payload: Record<string, unknown>) {
  const b = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b({ alg: 'HS256', typ: 'JWT' })}.${b(payload)}.signature`;
}

let plans: Plan[];
beforeAll(async () => {
  plans = (await soldPlans()) as Plan[];
});

function validEnv(): Record<string, string> {
  const env: Record<string, string> = {
    ...internalSecrets({}),
    NEXT_PUBLIC_APP_URL: 'https://repere-test.fr',
    NEXT_PUBLIC_SITE_URL: 'https://repere-test.fr',
    NEXT_PUBLIC_CONTACT_EMAIL: 'contact@repere-test.fr',
    EMAIL_FROM: 'Repéré <bonjour@mail.repere-test.fr>',
    SUPABASE_URL: `https://${REF}.supabase.co`,
    NEXT_PUBLIC_SUPABASE_URL: `https://${REF}.supabase.co`,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_AbCdEfGhIjKlMnOpQrStUv_12345678',
    SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_AbCdEfGhIjKlMnOpQrStUvWxYz_0123456789abcd',
    STRIPE_SECRET_KEY: ['sk', 'live', '51AbCdEfGhIjKlMnOpQrStUvWxYz'].join('_') /* faux, découpé pour les scanners de secrets */,
    STRIPE_WEBHOOK_SECRET: ['whsec', 'AbCdEfGhIjKlMnOpQrStUvWxYz012345'].join('_'),
    RESEND_API_KEY: 're_AbCdEfGh_IjKlMnOpQrStUvWx',
    OPENAI_API_KEY: 'sk-proj-AbCdEfGhIjKlMnOpQrSt',
    GEMINI_API_KEY: `AIza${'B'.repeat(35)}`,
    PERPLEXITY_API_KEY: 'pplx-AbCdEfGhIjKlMnOpQrStUvWx',
    NEXT_PUBLIC_LEGAL_NAME: 'Société Test SAS',
    NEXT_PUBLIC_LEGAL_FORM: 'SAS au capital de 1 000 €',
    NEXT_PUBLIC_LEGAL_SIREN: '123 456 782',
    NEXT_PUBLIC_LEGAL_SIRET: '12345678200010',
    NEXT_PUBLIC_LEGAL_RCS_CITY: 'Lyon',
    NEXT_PUBLIC_LEGAL_STREET: '1 rue du Test',
    NEXT_PUBLIC_LEGAL_POSTAL_CODE: '69001',
    NEXT_PUBLIC_LEGAL_CITY: 'Lyon',
    NEXT_PUBLIC_LEGAL_EMAIL: 'legal@repere-test.fr',
    NEXT_PUBLIC_LEGAL_PHONE: '+33 4 00 00 00 00',
    NEXT_PUBLIC_LEGAL_PUBLICATION_DIRECTOR: 'Camille Test, président',
    NEXT_PUBLIC_FOUNDER_NAME: 'Camille Test',
    NEXT_PUBLIC_FOUNDER_BIO: 'Parcours de test en deux phrases, suffisamment long pour passer le contrôle de longueur minimale.',
  };
  (plans ?? []).forEach((p, i) => (env[priceEnvName(p.id)] = `price_test${i}AbCd`));
  return env;
}

describe('envfile', () => {
  it('lit, écrit et met à jour un .env sans perdre les commentaires', () => {
    const text = '# commentaire\nA=1\nB="deux mots"\nC=valeur # note\nexport D=4\n';
    expect(parseEnv(text)).toEqual({ A: '1', B: 'deux mots', C: 'valeur', D: '4' });
    expect(quoteEnv('Repéré <a@b.fr>')).toBe('"Repéré <a@b.fr>"');
    const up = upsertEnvText(text, { B: 'x', E: 'nouveau' });
    expect(up).toContain('# commentaire');
    expect(parseEnv(up)).toMatchObject({ A: '1', B: 'x', E: 'nouveau' });
  });
});

describe('secrets.mjs', () => {
  it('génère tous les secrets internes de src/lib/env.ts, longs, distincts, et conserve les existants', async () => {
    const s = internalSecrets({});
    const names = INTERNAL_SECRETS.map((x: { name: string }) => x.name);
    // Tous les secrets à longueur minimale exigés par env.ts sont couverts.
    const envTs = readFileSync(path.join(APP_ROOT, 'src/lib/env.ts'), 'utf8');
    const required = [...envTs.matchAll(/name: '([A-Z_]+)', get: v\('\1'\), check: minLen/g)].map((m) => m[1]).filter((k) => k !== 'SUPABASE_SERVICE_ROLE_KEY');
    expect(required.length).toBeGreaterThan(5);
    for (const r of required) expect(names).toContain(r);
    for (const k of ['AUTH_SECRET', 'SHARE_SECRET', 'INTEGRATIONS_SECRET', 'RATE_LIMIT_SALT', 'AUDIT_SIGNING_SECRET', 'CRON_SECRET', 'UNSUBSCRIBE_SECRET', 'ADMIN_TOKEN', 'DIGEST_SIGNING_SECRET']) {
      expect(s[k], k).toMatch(/^[0-9a-f]{64}$/);
    }
    expect(new Set(Object.values(s)).size).toBe(names.length);
    expect(internalSecrets({ CRON_SECRET: 'garde-moi' }).CRON_SECRET).toBe('garde-moi');
    expect(internalSecrets({ CRON_SECRET: 'garde-moi' }, { force: true }).CRON_SECRET).not.toBe('garde-moi');
  });

  it('écrit un modèle complet : secrets, chaque clé externe avec sa page, prix Stripe', () => {
    const t = buildEnvTemplate(internalSecrets({}), plans.map((p) => priceEnvName(p.id)));
    const env = parseEnv(t);
    for (const c of CATALOG) {
      expect(env, c.name).toHaveProperty(c.name);
      if (c.required && !c.legal && c.group !== 'Site') expect(c.where, c.name).toMatch(/https:\/\/|stripe-setup|SUPABASE_URL/);
    }
    for (const p of plans) expect(env).toHaveProperty(priceEnvName(p.id));
    expect(t).toMatch(/NE JAMAIS versionner/);
  });

  it('prépare l’envoi à Vercel sans DATABASE_URL, avec les copies serveur de l’identité', () => {
    const env = { ...validEnv(), DATABASE_URL: 'postgresql://x' };
    const v = vercelValues(env);
    expect(v).not.toHaveProperty('DATABASE_URL');
    expect(v.LEGAL_SIREN).toBe('123456782');
    expect(v.LEGAL_ADDRESS).toBe('1 rue du Test, 69001 Lyon');
    const cmds = vercelCommands({ CRON_SECRET: "a'b", NEXT_PUBLIC_APP_URL: 'https://x.fr' });
    expect(cmds).toContain(`printf '%s' 'a'\\''b' | vercel env add CRON_SECRET production --sensitive`);
    expect(cmds).toContain('vercel env add NEXT_PUBLIC_APP_URL production\n');
  });

  it('.gitignore exclut le fichier de production', () => {
    const gi = readFileSync(path.join(APP_ROOT, '.gitignore'), 'utf8');
    expect(gi).toMatch(/^\.env\*$/m);
    expect(gi).toMatch(/^\.env\.production\.local$/m);
  });
});

describe('check-env.mjs --prod', () => {
  it('accepte un environnement complet (et la validation de src/lib/env.ts aussi)', async () => {
    const r = await checkProduction(validEnv(), { plans });
    expect(r.errors).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.entityReady).toBe(true);
  });

  it('refuse : clé manquante, mauvais format, clés inversées, secrets identiques, mode démo', async () => {
    const env = validEnv();
    delete env.RESEND_API_KEY;
    env.STRIPE_WEBHOOK_SECRET = 'abc';
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'sb_secret_inverse_0123456789abcdefghijklmnop';
    env.SHARE_SECRET = env.AUTH_SECRET;
    env.DEMO_MODE = '1';
    env.STRIPE_SECRET_KEY = 'pk_live_123';
    const r = await checkProduction(env, { plans, app: false });
    const all = r.errors.join('\n');
    expect(all).toMatch(/RESEND_API_KEY manquante/);
    expect(all).toMatch(/STRIPE_WEBHOOK_SECRET invalide/);
    expect(all).toMatch(/NEXT_PUBLIC_SUPABASE_ANON_KEY invalide : c’est une clé SECRÈTE/);
    expect(all).toMatch(/SHARE_SECRET est identique à AUTH_SECRET/);
    expect(all).toMatch(/DEMO_MODE/);
    expect(all).toMatch(/STRIPE_SECRET_KEY invalide : clé PUBLIQUE/);
    expect(r.ok).toBe(false);
  });

  it('vérifie les anciennes clés JWT de Supabase (rôle et projet)', async () => {
    const env = validEnv();
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY = jwt({ role: 'service_role', ref: REF });
    env.SUPABASE_SERVICE_ROLE_KEY = jwt({ role: 'service_role', ref: 'zzzzzzzzzzzzzzzzzzzz' });
    const r = await checkProduction(env, { plans, app: false });
    expect(r.errors.join('\n')).toMatch(/rôle « service_role » : il faut la clé anon/);
    expect(r.errors.join('\n')).toMatch(/autre projet Supabase/);
    expect(jwtPayload('pas.un.jwt')).toBeNull();
  });

  it('exige un prix Stripe pour chaque offre vendue de src/lib/plans.ts', async () => {
    const env = validEnv();
    delete env[priceEnvName('pme_accompagne_month')];
    env[priceEnvName('local_essentiel_year')] = env[priceEnvName('local_essentiel_month')];
    const r = await checkProduction(env, { plans, app: false });
    expect(r.errors.join('\n')).toMatch(/STRIPE_PRICE_PME_ACCOMPAGNE_MONTH manquant/);
    expect(r.errors.join('\n')).toMatch(/même prix Stripe/);
  });

  it('échoue si l’identité légale manque ou est provisoire (ENTITY_READY), sans rien inventer', async () => {
    const env = validEnv();
    delete env.NEXT_PUBLIC_LEGAL_SIREN;
    env.NEXT_PUBLIC_LEGAL_STREET = '[À COMPLÉTER : adresse]';
    env.NEXT_PUBLIC_LEGAL_PHONE = '';
    const r = await checkProduction(env, { plans, app: false });
    const all = r.errors.join('\n');
    expect(all).toMatch(/NEXT_PUBLIC_LEGAL_SIREN manquante/);
    expect(all).toMatch(/NEXT_PUBLIC_LEGAL_STREET contient un texte provisoire/);
    expect(all).toMatch(/NEXT_PUBLIC_LEGAL_PHONE manquante/);
    expect(all).toMatch(/ENTITY_READY faux/);
    expect(entityReady(env)).toBe(false);
    expect(luhnOk('123456782')).toBe(true);
    expect(luhnOk('123456789')).toBe(false);
    env.NEXT_PUBLIC_LEGAL_SIREN = '123456789';
    expect((await checkProduction(env, { plans, app: false })).errors.join('\n')).toMatch(/SIREN invalide/);
  });

  it('exige au moins une IA et signale les IA manquantes de l’audit de base', async () => {
    const env = validEnv();
    delete env.OPENAI_API_KEY;
    delete env.GEMINI_API_KEY;
    delete env.PERPLEXITY_API_KEY;
    expect((await checkProduction(env, { plans, app: false })).errors.join('\n')).toMatch(/Aucune clé IA/);
    env.ANTHROPIC_API_KEY = 'sk-ant-api03-x';
    const r = await checkProduction(env, { plans, app: false });
    expect(r.errors.join('\n')).not.toMatch(/Aucune clé IA/);
    expect(r.warnings.join('\n')).toMatch(/OPENAI_API_KEY, GEMINI_API_KEY, PERPLEXITY_API_KEY/);
  });

  it('le catalogue couvre toutes les variables obligatoires de src/lib/env.ts', () => {
    const envTs = readFileSync(path.join(APP_ROOT, 'src/lib/env.ts'), 'utf8');
    const block = envTs.slice(envTs.indexOf('REQUIRED_IN_PRODUCTION'), envTs.indexOf('];', envTs.indexOf('REQUIRED_IN_PRODUCTION')));
    const names = [...block.matchAll(/name: '([A-Z_]+)'/g)].map((m) => m[1]);
    const known = new Set([...CATALOG.map((c: { name: string }) => c.name), ...INTERNAL_SECRETS.map((s: { name: string }) => s.name)]);
    for (const n of names) expect(known.has(n), n).toBe(true);
  });
});

// --------------------------------------------------------------------------------------------------------------
// Stripe : client simulé, fidèle aux contraintes de l'API (lookup_key unique, secret webhook à la création…)
// --------------------------------------------------------------------------------------------------------------
type Call = { method: string; args: unknown[] };
const MUTATING = /\.(create|update|del)$/;

function fakeStripe({ portalDefault = true } = {}) {
  const calls: Call[] = [];
  const products = new Map<string, Record<string, unknown>>();
  const prices: Record<string, unknown>[] = [];
  const webhooks: Record<string, unknown>[] = [];
  const portal: Record<string, unknown> = { id: 'bpc_default', is_default: true };
  let n = 0;
  const rec =
    <A extends unknown[], R>(method: string, fn: (...a: A) => R) =>
    async (...args: A) => {
      calls.push({ method, args });
      return fn(...args);
    };
  const missing = () => Object.assign(new Error('No such product'), { statusCode: 404, code: 'resource_missing' });
  return {
    calls,
    state: { products, prices, webhooks, portal },
    products: {
      retrieve: rec('products.retrieve', (id: string) => {
        const p = products.get(id);
        if (!p) throw missing();
        return p;
      }),
      create: rec('products.create', (p: Record<string, unknown>) => {
        if (products.has(p.id as string)) throw new Error('id déjà pris');
        const o = { ...p, active: true };
        products.set(p.id as string, o);
        return o;
      }),
      update: rec('products.update', (id: string, p: Record<string, unknown>) => Object.assign(products.get(id)!, p)),
    },
    prices: {
      list: rec('prices.list', ({ lookup_keys }: { lookup_keys: string[] }) => ({ data: prices.filter((p) => lookup_keys.includes(p.lookup_key as string)) })),
      create: rec('prices.create', (p: Record<string, unknown>) => {
        if (!Number.isInteger(p.unit_amount) || (p.unit_amount as number) <= 0) throw new Error('unit_amount invalide');
        if (p.currency !== 'eur') throw new Error('devise');
        if (!products.has(p.product as string)) throw new Error('produit inconnu');
        const iv = (p.recurring as { interval?: string } | undefined)?.interval;
        if (iv && !['month', 'year'].includes(iv)) throw new Error('intervalle');
        const clash = prices.find((x) => x.lookup_key === p.lookup_key);
        if (clash && !p.transfer_lookup_key) throw new Error('lookup_key déjà utilisée');
        if (clash) clash.lookup_key = null;
        const { transfer_lookup_key: _t, ...rest } = p;
        const o = { id: `price_${++n}`, active: true, ...rest };
        prices.push(o);
        return o;
      }),
      update: rec('prices.update', (id: string, p: Record<string, unknown>) => Object.assign(prices.find((x) => x.id === id)!, p)),
    },
    webhookEndpoints: {
      list: rec('webhookEndpoints.list', () => ({ data: webhooks })),
      create: rec('webhookEndpoints.create', (p: Record<string, unknown>) => {
        if (!/^https:\/\//.test(p.url as string)) throw new Error('url https requise');
        const o = { id: `we_${++n}`, status: 'enabled', secret: `whsec_simule${n}`, ...p };
        webhooks.push(o);
        return o;
      }),
      update: rec('webhookEndpoints.update', (id: string, p: Record<string, unknown>) => Object.assign(webhooks.find((w) => w.id === id)!, p)),
      del: rec('webhookEndpoints.del', (id: string) => {
        webhooks.splice(webhooks.findIndex((w) => w.id === id), 1);
        return { id, deleted: true };
      }),
    },
    billingPortal: {
      configurations: {
        list: rec('billingPortal.configurations.list', () => ({ data: portalDefault ? [portal] : [] })),
        update: rec('billingPortal.configurations.update', (_id: string, p: Record<string, unknown>) => Object.assign(portal, p)),
      },
    },
  };
}

describe('stripe-setup.mjs', () => {
  const APP = 'https://repere-test.fr';
  let events: string[];
  beforeAll(async () => {
    events = await webhookEvents();
  });

  it('lit dans la route webhook TOUS les événements traités, dont invoice.paid', async () => {
    const route = readFileSync(path.join(APP_ROOT, 'src/app/api/stripe/webhook/route.ts'), 'utf8');
    for (const e of events) expect(route).toContain(`case '${e}':`);
    expect(events).toEqual(expect.arrayContaining([
      'checkout.session.completed', 'checkout.session.async_payment_succeeded', 'customer.subscription.created',
      'customer.subscription.updated', 'customer.subscription.deleted', 'invoice.payment_failed', 'invoice.paid', 'charge.dispute.created',
    ]));
  });

  it('crée produits, prix (exactement plans.ts), webhook et portail, puis renvoie les variables', async () => {
    const s = fakeStripe();
    const r = await setupStripe(s as never, { plans, appUrl: APP, apiVersion: Stripe.API_VERSION, events });
    // un prix par offre vendue, montants et intervalles identiques à plans.ts
    expect(Object.keys(r.env).sort()).toEqual(plans.map((p) => priceEnvName(p.id)).sort());
    for (const p of plans) {
      const price = s.state.prices.find((x) => x.lookup_key === p.id)!;
      expect(price.unit_amount, p.id).toBe(p.priceCents);
      expect((price.recurring as { interval?: string } | undefined)?.interval ?? 'one_time', p.id).toBe(p.interval);
      expect(r.env[priceEnvName(p.id)]).toBe(price.id);
      expect(price.product).toBe(`repere_${productKey(p.id)}`);
    }
    // mensuel et annuel partagent un produit
    expect(s.state.products.get('repere_local_essentiel')).toBeTruthy();
    expect(s.state.products.size).toBeLessThan(plans.length);
    // webhook : URL, tous les événements, version d'API du SDK, secret renvoyé
    const create = s.calls.find((c) => c.method === 'webhookEndpoints.create')!.args[0] as Record<string, unknown>;
    expect(create.url).toBe(`${APP}/api/stripe/webhook`);
    expect([...(create.enabled_events as string[])].sort()).toEqual([...events].sort());
    expect(create.api_version).toBe(Stripe.API_VERSION);
    expect(r.webhookSecret).toMatch(/^whsec_/);
    // portail
    const portal = s.state.portal as { features: { subscription_cancel: { mode: string } }; default_return_url: string; business_profile: { terms_of_service_url: string } };
    expect(portal.features.subscription_cancel.mode).toBe('at_period_end');
    expect(portal.default_return_url).toBe(`${APP}/app/reglages`);
    expect(portal.business_profile.terms_of_service_url).toBe(`${APP}/cgv`);
  });

  it('est idempotent : un second passage ne crée ni ne modifie rien', async () => {
    const s = fakeStripe();
    const first = await setupStripe(s as never, { plans, appUrl: APP, apiVersion: Stripe.API_VERSION, events });
    s.calls.length = 0;
    const second = await setupStripe(s as never, { plans, appUrl: APP, apiVersion: Stripe.API_VERSION, events });
    const writes = s.calls.filter((c) => MUTATING.test(c.method) && c.method !== 'billingPortal.configurations.update');
    expect(writes).toEqual([]);
    expect(second.env).toEqual(first.env);
    expect(second.webhookSecret).toBeNull();
  });

  it('prix modifié dans plans.ts : nouveau prix, clé transférée, ancien archivé', async () => {
    const s = fakeStripe();
    const first = await setupStripe(s as never, { plans, appUrl: APP, apiVersion: Stripe.API_VERSION, events });
    const changed = plans.map((p) => (p.id === 'local_essentiel_month' ? { ...p, priceCents: 3900 } : p));
    const r = await setupStripe(s as never, { plans: changed, appUrl: APP, apiVersion: Stripe.API_VERSION, events });
    const oldId = first.env.STRIPE_PRICE_LOCAL_ESSENTIEL_MONTH;
    expect(r.env.STRIPE_PRICE_LOCAL_ESSENTIEL_MONTH).not.toBe(oldId);
    expect(s.state.prices.find((x) => x.id === oldId)!.active).toBe(false);
    expect(s.state.prices.find((x) => x.id === r.env.STRIPE_PRICE_LOCAL_ESSENTIEL_MONTH)!.unit_amount).toBe(3900);
  });

  it('--dry-run : aucune écriture ; webhook existant incomplet : complété ; portail absent : signalé', async () => {
    const s = fakeStripe({ portalDefault: false });
    const r = await setupStripe(s as never, { plans, appUrl: APP, apiVersion: Stripe.API_VERSION, events, dryRun: true });
    expect(s.calls.filter((c) => MUTATING.test(c.method))).toEqual([]);
    expect(r.actions.length).toBeGreaterThan(plans.length);
    expect(r.portalStatus).toBe('missing');

    const s2 = fakeStripe();
    s2.state.webhooks.push({ id: 'we_old', url: `${APP}/api/stripe/webhook`, enabled_events: ['checkout.session.completed'], status: 'enabled', api_version: Stripe.API_VERSION });
    await setupStripe(s2 as never, { plans, appUrl: APP, apiVersion: Stripe.API_VERSION, events });
    expect([...(s2.state.webhooks[0].enabled_events as string[])].sort()).toEqual([...events].sort());
    expect(s2.calls.some((c) => c.method === 'webhookEndpoints.create')).toBe(false);
  });

  it('garde-fous de clé : publique refusée, live sans --live refusée', () => {
    expect(() => keyMode('pk_live_x')).toThrow(/PUBLIQUE/);
    expect(() => keyMode('sk_live_x')).toThrow(/--live/);
    expect(keyMode('sk_live_x', { live: true })).toBe('live');
    expect(keyMode('sk_test_x')).toBe('test');
    expect(priceSpec(plans.find((p) => p.interval === 'one_time')!, 'prod_x')).not.toHaveProperty('recurring');
  });
});

// --------------------------------------------------------------------------------------------------------------
// verifier-prod.mjs : fetch simulé (site conforme, puis site défaillant)
// --------------------------------------------------------------------------------------------------------------
function fakeSite(over: Record<string, { status?: number; headers?: Record<string, string>; body?: string }> = {}) {
  const host = 'repere-test.fr';
  const sec = {
    'content-security-policy': "default-src 'self'; frame-ancestors 'none'",
    'strict-transport-security': 'max-age=63072000; includeSubDomains',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'permissions-policy': 'camera=()',
  };
  const page = (t: string) => `<html><head><title>${t} | Repéré</title><link rel="canonical" href="https://${host}/"/></head><body>${t}</body></html>`;
  const routes: Record<string, { status?: number; headers?: Record<string, string>; body?: string }> = {
    'http://repere-test.fr/': { status: 308, headers: { location: `https://${host}/` } },
    '/robots.txt': { body: `User-agent: *\nAllow: /\n\nSitemap: https://${host}/sitemap.xml\n` },
    '/sitemap.xml': { body: `<urlset><url><loc>https://${host}/</loc></url><url><loc>https://${host}/a-propos</loc></url></urlset>` },
    '/llms.txt': { body: `# Repéré\n> https://${host}\n- Entreprise : Société Test SAS, SIREN 123456782, 1 rue du Test, 69001 Lyon\n` },
    '/api/stripe/webhook': { status: 400, body: '{"error":"Signature manquante."}' },
    '/api/health': {
      headers: { 'x-robots-tag': 'noindex' },
      body: JSON.stringify({ status: 'ok', mode: 'production', checks: { db: 'ok', env: 'ok', jobs: 'ok' }, db: { level: 'ok', backend: 'supabase', ms: 40 }, env: { errors: [], warnings: [] }, jobs: { level: 'ok', stats: { queued: 0, dead: 0 } }, keys: { stripe: true, resend: true, cron: true, ai: { chatgpt: true } } }),
    },
    ...over,
  };
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    const u = new URL(url);
    const key = u.protocol === 'http:' ? url : u.pathname;
    const r = routes[key] ?? { body: page(u.pathname) };
    return new Response(r.body ?? '', { status: r.status ?? 200, headers: { 'content-type': 'text/html', ...sec, ...(r.headers ?? {}) } });
  };
  return { fetchImpl, calls };
}

describe('verifier-prod.mjs', () => {
  it('site conforme : tout est vert, le webhook n’est jamais déclenché (aucune signature envoyée)', async () => {
    const { fetchImpl, calls } = fakeSite();
    const r = await verify('https://repere-test.fr', { fetchImpl: fetchImpl as never, cronSecret: 's' });
    expect(r.results.filter((x) => !x.ok)).toEqual([]);
    expect(r.ok).toBe(true);
    const wh = calls.find((c) => c.url.endsWith('/api/stripe/webhook'))!;
    expect(new Headers(wh.init.headers).has('stripe-signature')).toBe(false);
    expect(formatVerify('https://repere-test.fr', r)).toMatch(/EN LIGNE ET CONFORME/);
  });

  it('site défaillant : placeholders légaux, CSP en Report-Only, webhook non configuré, base en panne, identité absente', async () => {
    const { fetchImpl } = fakeSite({
      '/mentions-legales': { body: '<title>Mentions | Repéré</title> Éditeur : [À COMPLÉTER : dénomination exacte]' },
      '/': { headers: { 'content-security-policy': '', 'content-security-policy-report-only': "default-src 'self'" }, body: '<title>Accueil Repéré</title><link rel="canonical" href="http://localhost:3000/"/>' },
      '/api/stripe/webhook': { status: 503 },
      '/api/health': { status: 503, body: JSON.stringify({ status: 'fail', mode: 'production', checks: { db: 'fail' }, db: { level: 'fail', backend: 'supabase', error: 'relation "businesses" does not exist' } }) },
      '/llms.txt': { body: '# Repéré\n> https://repere-test.fr\n' },
    });
    const r = await verify('https://repere-test.fr', { fetchImpl: fetchImpl as never });
    const failed = r.results.filter((x) => !x.ok && x.level === 'error').map((x) => `${x.name} ${x.detail}`).join('\n');
    expect(failed).toMatch(/\/mentions-legales 1 « \[À COMPLÉTER\] »/);
    expect(failed).toMatch(/Report-Only/);
    expect(failed).toMatch(/canonique/);
    expect(failed).toMatch(/503 : STRIPE_SECRET_KEY/);
    expect(failed).toMatch(/base Supabase.*does not exist/);
    expect(failed).toMatch(/ENTITY_READY/);
    expect(r.ok).toBe(false);
  });
});

// --------------------------------------------------------------------------------------------------------------
// Identité légale : site.ts et pages légales lisent les variables (aucune donnée en dur)
// --------------------------------------------------------------------------------------------------------------
type Sections = { title: string; paras?: string[]; list?: string[]; after?: string[]; table?: { rows: string[][] } }[];
async function legalText(page: 'mentions-legales' | 'cgv' | 'confidentialite'): Promise<string> {
  const mod = await import(`../../../src/app/${page}/page.tsx`);
  const el = mod.default() as { props: { sections: Sections } };
  return el.props.sections.flatMap((s) => [s.title, ...(s.paras ?? []), ...(s.list ?? []), ...(s.after ?? []), ...(s.table?.rows.flat() ?? [])]).join('\n');
}

describe('identité légale branchée sur les variables', () => {
  const LEGAL_KEYS = Object.keys(validEnv()).filter((k) => /^NEXT_PUBLIC_(LEGAL|FOUNDER)_/.test(k));
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('sans variables : repères « [À COMPLÉTER] » visibles, LEGAL_READY faux, aucune raison sociale inventée', async () => {
    for (const k of LEGAL_KEYS) vi.stubEnv(k, '');
    vi.resetModules();
    const site = await import('../../../src/lib/seo/site');
    expect(site.LEGAL_READY).toBe(false);
    expect(site.ENTITY_READY).toBe(false);
    expect(site.LEGAL_MISSING).toEqual(expect.arrayContaining(['NEXT_PUBLIC_LEGAL_NAME', 'NEXT_PUBLIC_LEGAL_SIREN', 'NEXT_PUBLIC_LEGAL_PHONE']));
    for (const p of ['mentions-legales', 'cgv', 'confidentialite'] as const) {
      const t = await legalText(p);
      expect(t, p).toMatch(/\[À COMPLÉTER : dénomination exacte \(NEXT_PUBLIC_LEGAL_NAME\)\]/);
      expect(t, p).not.toMatch(/Mycelo/);
    }
  });

  it('avec variables : nom, forme, SIREN, RCS, adresse, e-mail, téléphone, directeur publiés, plus aucun repère d’identité', async () => {
    const env = validEnv();
    for (const k of LEGAL_KEYS) vi.stubEnv(k, env[k]);
    vi.resetModules();
    const site = await import('../../../src/lib/seo/site');
    expect(site.LEGAL_READY).toBe(true);
    expect(site.ENTITY_READY).toBe(true);
    expect(site.LEGAL_ADDRESS).toBe('1 rue du Test, 69001 Lyon');
    expect(site.SIREN_DISPLAY).toBe('123 456 782');
    const ml = await legalText('mentions-legales');
    for (const v of ['Société Test SAS', 'SAS au capital de 1 000 €', 'RCS Lyon 123 456 782', '1 rue du Test, 69001 Lyon', 'legal@repere-test.fr', '+33 4 00 00 00 00', 'Camille Test, président']) {
      expect(ml).toContain(v);
    }
    for (const p of ['mentions-legales', 'cgv', 'confidentialite'] as const) {
      const t = await legalText(p);
      expect(t, p).not.toMatch(/\(NEXT_PUBLIC_LEGAL_[A-Z_]+\)\]/);
      expect(t, p).toContain('Société Test SAS');
      expect(t, p).toContain('legal@repere-test.fr');
    }
    const jsonld = await import('../../../src/lib/seo/jsonld');
    expect(JSON.stringify(jsonld.organizationLd())).toContain('Société Test SAS');
  });
});

// --------------------------------------------------------------------------------------------------------------
// Google Business Profile : aucune dépendance à l'API Business Profile ; repli « saisie guidée »
// --------------------------------------------------------------------------------------------------------------
const placesMock = vi.hoisted(() => ({ enabled: false }));
vi.mock('@/lib/facts', () => ({ getFacts: async () => ({ facts: {} }) }));
vi.mock('@/lib/local/places', async (orig) => ({
  ...(await orig<typeof import('@/lib/local/places')>()),
  placesEnabled: () => placesMock.enabled,
  fetchPlaceDetails: async () => {
    throw new Error('403 PERMISSION_DENIED');
  },
}));

describe('fiche Google sans accès API', () => {
  const biz = { id: 'b1', name: 'Plomberie Test', trade: 'plombier', city: 'Lyon', plan: 'essentiel', segment: 'local' };
  const manual = { primaryCategory: 'Plombier', description: 'Plombier à Lyon depuis 2010, dépannage et rénovation.', hasHours: true, photosCount: 8, reviewCount: 12, rating: 4.6 };

  it('aucun code n’appelle l’API Google Business Profile (mybusiness*.googleapis.com)', () => {
    const files = ['src/lib/local/gbp.ts', 'src/lib/local/service.ts', 'src/lib/local/places.ts', 'src/lib/local/posts.ts', 'src/app/api/local/gbp/route.ts'];
    for (const f of files) expect(readFileSync(path.join(APP_ROOT, f), 'utf8'), f).not.toMatch(/mybusiness[a-z]*\.googleapis\.com|businessprofileperformance/);
  });

  it('sans clé Places : audit calculé sur la saisie guidée, avec un avertissement clair', async () => {
    placesMock.enabled = false;
    const { runGbpAudit } = await import('@/lib/local/service');
    const r = await runGbpAudit(biz as never, { placeId: 'ChIJN1t_tDeuEmsRUsoyG83frY4', manual });
    expect(r.warning).toMatch(/saisie guidée/);
    expect(r.audit.score).toBeGreaterThan(0);
  });

  it('clé Places présente mais API refusée : repli sur la saisie guidée', async () => {
    placesMock.enabled = true;
    const { runGbpAudit } = await import('@/lib/local/service');
    const r = await runGbpAudit(biz as never, { placeId: 'ChIJN1t_tDeuEmsRUsoyG83frY4', manual });
    expect(r.warning).toMatch(/échoué.*saisie guidée/);
    expect(r.audit).toBeTruthy();
    placesMock.enabled = false;
  });
});
