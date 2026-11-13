#!/usr/bin/env node
/**
 * Configure Stripe pour Repéré, en une commande, sans rien cliquer dans Stripe (idempotent : relançable).
 *
 *   node scripts/ops/stripe-setup.mjs --dry-run      # montre ce qui serait créé ou modifié, sans rien changer
 *   node scripts/ops/stripe-setup.mjs                # avec une clé sk_test_ (sandbox) : essai complet
 *   node scripts/ops/stripe-setup.mjs --live         # avec la clé sk_live_ : configuration réelle
 *
 * Crée ou met à jour, d'après src/lib/plans.ts (seule source des prix) :
 *  - un produit par offre (« Repéré Local — Essentiel »…) et un prix par formule (mensuel, annuel, ponctuel),
 *    retrouvés par leur lookup_key = identifiant de l'offre (ex. local_essentiel_month). Prix modifié dans plans.ts :
 *    nouveau prix créé (la lookup_key lui est transférée), l'ancien est archivé (les abonnés en cours le gardent) ;
 *  - l'endpoint webhook https://<domaine>/api/stripe/webhook avec TOUS les événements traités par
 *    src/app/api/stripe/webhook/route.ts, à la version d'API du SDK installé ;
 *  - le portail client par défaut (factures, carte, adresse, résiliation en fin de période, liens CGV et confidentialité).
 * Puis imprime STRIPE_PRICE_* et STRIPE_WEBHOOK_SECRET, et les écrit dans .env.production.local en mode live.
 *
 * Options : --domaine https://votre-domaine.fr (défaut NEXT_PUBLIC_APP_URL), --fichier <fichier>,
 *   --ecrire (écrire aussi en mode test), --sans-ecrire, --anciennes-offres (offres V1 conservées),
 *   --recreer-webhook (supprime et recrée l'endpoint pour obtenir un nouveau secret).
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP_ROOT, argValue, loadScriptEnv, upsertEnvFile } from './lib/envfile.mjs';
import { priceEnvName, soldPlans } from './lib/plans.mjs';

export const WEBHOOK_PATH = '/api/stripe/webhook';
export const WEBHOOK_ROUTE_FILE = path.join(APP_ROOT, 'src', 'app', 'api', 'stripe', 'webhook', 'route.ts');
const SEGMENT_LABEL = { local: 'Local', pme: 'PME', ecommerce: 'E-commerce', agence: 'Agence' };

/** Événements traités par la route webhook (lus dans le code : jamais de liste recopiée à la main). */
export async function webhookEvents(file = WEBHOOK_ROUTE_FILE) {
  const src = await fs.readFile(file, 'utf8');
  const sw = src.slice(src.indexOf('switch (event.type)'));
  const events = [...sw.matchAll(/case\s+'([a-z_]+(?:\.[a-z_]+)+)'\s*:/g)].map((m) => m[1]);
  if (!events.length) throw new Error(`Aucun événement trouvé dans ${path.relative(APP_ROOT, file)}`);
  return [...new Set(events)].sort();
}

/** Produit Stripe d'une offre : les formules mensuelle et annuelle partagent le même produit. */
export function productKey(planId) {
  return String(planId).replace(/_(month|year)$/, '');
}

export function productSpecs(plans) {
  const out = new Map();
  for (const p of plans) {
    const key = productKey(p.id);
    if (out.has(key)) continue;
    const name = p.name.replace(/\s+annuel$/i, '');
    out.set(key, {
      id: `repere_${key}`,
      name: `Repéré ${SEGMENT_LABEL[p.segment] ?? p.segment} — ${name}`,
      metadata: { app: 'auditia', product_key: key },
    });
  }
  return out;
}

export function priceSpec(plan, productId) {
  return {
    product: productId,
    currency: 'eur',
    unit_amount: plan.priceCents,
    lookup_key: plan.id,
    nickname: `${plan.id} (${plan.priceCents / 100} €${plan.interval === 'one_time' ? '' : plan.interval === 'month' ? '/mois' : '/an'})`,
    metadata: { app: 'auditia', plan_id: plan.id },
    ...(plan.interval === 'one_time' ? {} : { recurring: { interval: plan.interval } }),
  };
}

const samePrice = (existing, spec) =>
  existing.unit_amount === spec.unit_amount &&
  existing.currency === spec.currency &&
  (existing.product?.id ?? existing.product) === spec.product &&
  (existing.recurring?.interval ?? null) === (spec.recurring?.interval ?? null);

const isMissing = (e) => e?.statusCode === 404 || e?.code === 'resource_missing' || e?.raw?.code === 'resource_missing';

export function portalConfig(appUrl) {
  return {
    business_profile: { privacy_policy_url: `${appUrl}/confidentialite`, terms_of_service_url: `${appUrl}/cgv` },
    default_return_url: `${appUrl}/app/reglages`,
    features: {
      customer_update: { enabled: true, allowed_updates: ['email', 'address', 'name', 'tax_id'] },
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: {
        enabled: true,
        mode: 'at_period_end',
        proration_behavior: 'none',
        cancellation_reason: { enabled: true, options: ['too_expensive', 'missing_features', 'switched_service', 'unused', 'other'] },
      },
      subscription_update: { enabled: false },
    },
  };
}

/**
 * Configure Stripe avec un client compatible SDK. Renvoie les variables à poser et le journal des actions.
 * @param {import('stripe').default} stripe
 */
export async function setupStripe(stripe, { plans, appUrl, apiVersion, events, dryRun = false, recreateWebhook = false, log = () => undefined }) {
  const actions = [];
  const act = (a) => {
    actions.push(a);
    log(a);
  };
  /** @type {Record<string, string>} */
  const env = {};

  // 1. Produits
  const products = productSpecs(plans);
  for (const spec of products.values()) {
    let existing = null;
    try {
      existing = await stripe.products.retrieve(spec.id);
    } catch (e) {
      if (!isMissing(e)) throw e;
    }
    if (!existing) {
      act(`produit créé : ${spec.name} (${spec.id})`);
      if (!dryRun) await stripe.products.create({ id: spec.id, name: spec.name, metadata: spec.metadata });
    } else if (!existing.active || existing.name !== spec.name) {
      act(`produit mis à jour : ${spec.name}`);
      if (!dryRun) await stripe.products.update(spec.id, { name: spec.name, active: true, metadata: spec.metadata });
    }
  }

  // 2. Prix (lookup_key = identifiant de l'offre)
  for (const plan of plans) {
    const spec = priceSpec(plan, products.get(productKey(plan.id)).id);
    const found = (await stripe.prices.list({ lookup_keys: [plan.id], limit: 1 })).data?.[0] ?? null;
    let id;
    if (found && samePrice(found, spec)) {
      id = found.id;
      if (!found.active) {
        act(`prix réactivé : ${plan.id}`);
        if (!dryRun) await stripe.prices.update(found.id, { active: true });
      }
    } else {
      act(found ? `prix modifié : ${plan.id} → nouveau prix ${spec.unit_amount / 100} € (l’ancien est archivé)` : `prix créé : ${plan.id} (${spec.unit_amount / 100} €${spec.recurring ? ` / ${spec.recurring.interval === 'month' ? 'mois' : 'an'}` : ''})`);
      if (dryRun) id = found?.id ?? `price_(à créer : ${plan.id})`;
      else {
        const created = await stripe.prices.create({ ...spec, ...(found ? { transfer_lookup_key: true } : {}) });
        id = created.id;
        if (found?.active) await stripe.prices.update(found.id, { active: false });
      }
    }
    env[priceEnvName(plan.id)] = id;
  }

  // 3. Webhook
  const url = `${appUrl}${WEBHOOK_PATH}`;
  const list = (await stripe.webhookEndpoints.list({ limit: 100 })).data ?? [];
  let endpoint = list.find((w) => w.url === url) ?? null;
  let webhookSecret = null;
  if (endpoint && recreateWebhook) {
    act(`webhook supprimé pour être recréé : ${url}`);
    if (!dryRun) await stripe.webhookEndpoints.del(endpoint.id);
    endpoint = null;
  }
  if (!endpoint) {
    act(`webhook créé : ${url} (${events.length} événements, API ${apiVersion})`);
    if (!dryRun) {
      const created = await stripe.webhookEndpoints.create({
        url,
        enabled_events: events,
        api_version: apiVersion,
        description: 'Repéré — paiements, abonnements, factures',
        metadata: { app: 'auditia' },
      });
      webhookSecret = created.secret ?? null;
    }
  } else {
    const current = [...(endpoint.enabled_events ?? [])].sort();
    if (current.join(',') !== [...events].sort().join(',') || endpoint.status === 'disabled') {
      act(`webhook mis à jour : ${url} (événements : ${events.join(', ')})`);
      if (!dryRun) await stripe.webhookEndpoints.update(endpoint.id, { enabled_events: events, disabled: false });
    }
    if (endpoint.api_version && apiVersion && endpoint.api_version !== apiVersion) {
      act(`! webhook en version d’API ${endpoint.api_version} (SDK : ${apiVersion}) : relancez avec --recreer-webhook`);
    }
  }

  // 4. Portail client (configuration par défaut, utilisée par POST /api/account/portal)
  const portal = (await stripe.billingPortal.configurations.list({ is_default: true, limit: 1 })).data?.[0] ?? null;
  let portalStatus = 'missing';
  if (portal) {
    act(`portail client mis à jour (${portal.id})`);
    if (!dryRun) await stripe.billingPortal.configurations.update(portal.id, portalConfig(appUrl));
    portalStatus = 'updated';
  } else {
    act('! portail client : aucune configuration par défaut (voir ci-dessous)');
  }

  return { env, webhookSecret, webhookUrl: url, webhookExisted: Boolean(endpoint), portalStatus, actions };
}

/** Mode de la clé et garde-fou : une clé live exige --live. */
export function keyMode(key, { live = false } = {}) {
  if (!key) throw new Error('STRIPE_SECRET_KEY manquante (dans .env.production.local) → https://dashboard.stripe.com/apikeys');
  if (/^pk_/.test(key)) throw new Error('C’est la clé PUBLIQUE (pk_…) : il faut la clé secrète (sk_…).');
  if (/^(sk|rk)_test_/.test(key)) return 'test';
  if (/^(sk|rk)_live_/.test(key)) {
    if (!live) throw new Error('Clé LIVE détectée : ajoutez --live pour confirmer (ou --dry-run pour un essai à blanc).');
    return 'live';
  }
  throw new Error('STRIPE_SECRET_KEY doit commencer par sk_live_ ou sk_test_.');
}

async function main() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const { env: vars, file } = await loadScriptEnv(argv);
  const mode = keyMode(vars.STRIPE_SECRET_KEY, { live: argv.includes('--live') || dryRun });
  const appUrl = (argValue(argv, '--domaine') || vars.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '');
  if (!/^https:\/\/[^/]+$/.test(appUrl)) throw new Error('Domaine manquant ou invalide : --domaine https://votre-domaine.fr (ou NEXT_PUBLIC_APP_URL).');

  const { default: Stripe } = await import('stripe');
  const stripe = new Stripe(vars.STRIPE_SECRET_KEY, { appInfo: { name: 'repere-stripe-setup' }, maxNetworkRetries: 2 });
  const plans = await soldPlans({ legacy: argv.includes('--anciennes-offres') });
  const events = await webhookEvents();

  console.log(`Stripe en mode ${mode === 'live' ? 'LIVE (paiements réels)' : 'test (sandbox)'}${dryRun ? ' — ESSAI À BLANC, rien ne sera modifié' : ''}`);
  console.log(`  ${plans.length} prix d’après src/lib/plans.ts · webhook ${appUrl}${WEBHOOK_PATH} · ${events.length} événements\n`);
  const r = await setupStripe(stripe, {
    plans,
    appUrl,
    apiVersion: Stripe.API_VERSION,
    events,
    dryRun,
    recreateWebhook: argv.includes('--recreer-webhook'),
    log: (a) => console.log(`  ${a.startsWith('!') ? '' : '→ '}${a}`),
  });
  if (!r.actions.length) console.log('  ✓ Tout est déjà en place, rien à modifier.');

  const out = { ...r.env };
  if (r.webhookSecret) out.STRIPE_WEBHOOK_SECRET = r.webhookSecret;
  console.log('\nVariables :');
  for (const [k, v] of Object.entries(out)) console.log(`${k}=${v}`);
  if (!r.webhookSecret && r.webhookExisted) {
    console.log('# STRIPE_WEBHOOK_SECRET : inchangé (endpoint existant). Perdu ? Stripe › Workbench › Webhooks › l’endpoint › « Signing secret »,');
    console.log('#   ou relancez avec --recreer-webhook pour en obtenir un nouveau.');
  }
  if (r.portalStatus === 'missing') {
    console.log(`\n! Portail client : ouvrez https://dashboard.stripe.com/settings/billing/portal (en ${mode}), cliquez « Save » une fois,`);
    console.log('  puis relancez ce script : il appliquera les réglages (factures, carte, résiliation en fin de période).');
  }

  const write = !dryRun && !argv.includes('--sans-ecrire') && (mode === 'live' || argv.includes('--ecrire'));
  if (write && file) {
    await upsertEnvFile(file, out, { section: 'Stripe (stripe-setup.mjs)' });
    console.log(`\n✓ Valeurs écrites dans ${file}. Vérifiez : node scripts/ops/check-env.mjs --prod`);
  } else if (!dryRun) {
    console.log(`\nMode ${mode} : valeurs non écrites${mode === 'test' ? ' (ajoutez --ecrire pour les écrire)' : ''}.`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(`✗ ${e instanceof Error ? e.message : String(e)}`);
    process.exitCode = 1;
  });
}
