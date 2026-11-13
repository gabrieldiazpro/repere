/**
 * Stripe — Checkout + correspondance plans ↔ prix (docs/07-offre-prix.md §9).
 * Les price ids sont lus dans l'env : STRIPE_PRICE_<PLANID> (ex. STRIPE_PRICE_SUIVI_MONTH).
 * Sans STRIPE_SECRET_KEY : mode démo (le checkout renvoie /merci?demo=1).
 */
import Stripe from 'stripe';
import { appUrl } from '@/lib/email';
import { PLAN_IDS, getPlan, isSubscriptionPlan, type PlanId } from '@/lib/plans';

let _stripe: Stripe | null = null;

export function isStripeEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!_stripe) _stripe = new Stripe(key, { appInfo: { name: 'repere-auditia' }, maxNetworkRetries: 2 });
  return _stripe;
}

export function priceEnvName(planId: PlanId): string {
  return `STRIPE_PRICE_${planId.toUpperCase()}`;
}

export function priceIdForPlan(planId: PlanId): string | null {
  return process.env[priceEnvName(planId)] || null;
}

/** Retrouve le plan à partir d'un price id (webhook). */
export function planIdForPrice(priceId: string | null | undefined): PlanId | null {
  if (!priceId) return null;
  for (const id of PLAN_IDS) if (priceIdForPlan(id) === priceId) return id;
  return null;
}

export interface CheckoutArgs {
  planId: PlanId;
  auditId?: string;
  businessId?: string;
  email?: string;
  /** client Stripe existant (2ᵉ achat d'un propriétaire connecté) : remplace customer_email */
  customerId?: string;
  /** horodatage serveur de la case « je suis un professionnel » cochée sur notre site (si envoyée) */
  proDeclaredAt?: string;
}

export class CheckoutConfigError extends Error {}

/**
 * Déclaration professionnelle (service réservé aux professionnels, CGV art. 4) : affichée sur la page de paiement Stripe
 * dans la case d'acceptation obligatoire (consent_collection.terms_of_service) et rappelée sous le bouton de paiement.
 * Preuve côté serveur : version du texte en metadata (session + abonnement), horodatage de la case cochée sur notre
 * site (`pro_declared_at`, posé par NOTRE serveur) et enregistrement à la réception du paiement (webhook,
 * collection `billing.pro_declarations`).
 */
export const PRO_DECLARATION_VERSION = 'pro-v1-2026-11-13';
export const PRO_DECLARATION = 'Je déclare agir pour les besoins de mon activité professionnelle (Repéré est réservé aux professionnels, CGV article 4).';
export const PRO_SUBMIT_NOTE = 'Service réservé aux professionnels : en payant, vous confirmez agir pour votre activité professionnelle.';

export function proDeclarationMetadata(proDeclaredAt?: string): Record<string, string> {
  return { pro_declaration: PRO_DECLARATION_VERSION, ...(proDeclaredAt ? { pro_declared_at: proDeclaredAt } : {}) };
}

/**
 * Crée une session Stripe Checkout et renvoie son URL.
 * - Abonnements (suivi/pro/agence) : mode subscription.
 * - Démarrage : 199 € une fois + Suivi mensuel avec 90 jours d'essai (le 29 € démarre après les 3 mois inclus).
 * - Plan d'action : paiement unique, facture créée.
 */
export async function createCheckoutUrl(args: CheckoutArgs): Promise<string> {
  const plan = getPlan(args.planId);
  if (plan.priceCents === 0) throw new CheckoutConfigError("L'audit gratuit ne passe pas par le paiement.");

  const stripe = getStripe();
  if (!stripe) {
    return `/merci?demo=1&plan=${encodeURIComponent(args.planId)}${args.auditId ? `&audit=${encodeURIComponent(args.auditId)}` : ''}`;
  }

  const price = priceIdForPlan(args.planId);
  if (!price) throw new CheckoutConfigError(`Prix Stripe non configuré : ${priceEnvName(args.planId)}`);
  const taxRates = process.env.STRIPE_TAX_RATE_ID ? [process.env.STRIPE_TAX_RATE_ID] : undefined;

  const metadata: Record<string, string> = { app: 'auditia', plan_id: args.planId, ...proDeclarationMetadata(args.proDeclaredAt) };
  if (args.auditId) metadata.audit_id = args.auditId;
  if (args.businessId) metadata.business_id = args.businessId;

  const base = appUrl();
  const params: Stripe.Checkout.SessionCreateParams = {
    line_items: [{ price, quantity: 1, tax_rates: taxRates }],
    success_url: `${base}/merci?session_id={CHECKOUT_SESSION_ID}&plan=${args.planId}`,
    cancel_url: args.auditId ? `${base}/rapport/${encodeURIComponent(args.auditId)}` : `${base}/tarifs`,
    client_reference_id: args.auditId,
    ...(args.customerId ? { customer: args.customerId, customer_update: { address: 'auto', name: 'auto' } } : { customer_email: args.email }),
    metadata,
    locale: 'fr',
    allow_promotion_codes: true,
    billing_address_collection: 'required',
    tax_id_collection: { enabled: true },
  };

  if (isSubscriptionPlan(args.planId)) {
    params.mode = 'subscription';
    params.subscription_data = { metadata };
    if (args.planId === 'bundle_start') {
      const suivi = priceIdForPlan('suivi_month');
      if (!suivi) throw new CheckoutConfigError(`Prix Stripe non configuré : ${priceEnvName('suivi_month')}`);
      // Ligne unique 199 € facturée immédiatement + Suivi récurrent en essai 90 jours.
      params.line_items = [
        { price, quantity: 1, tax_rates: taxRates },
        { price: suivi, quantity: 1, tax_rates: taxRates },
      ];
      params.subscription_data.trial_period_days = 90;
    }
    params.consent_collection = { terms_of_service: 'required' };
    params.custom_text = {
      submit: { message: PRO_SUBMIT_NOTE },
      terms_of_service_acceptance: {
        message: `${PRO_DECLARATION} Abonnement à renouvellement automatique, sans engagement, résiliable à tout moment depuis votre espace. [CGV](${base}/cgv)`,
      },
    };
  } else {
    params.mode = 'payment';
    if (!args.customerId) params.customer_creation = 'always';
    params.invoice_creation = { enabled: true, invoice_data: { metadata } };
    params.payment_intent_data = { metadata };
    params.consent_collection = { terms_of_service: 'required' };
    params.custom_text = {
      submit: { message: PRO_SUBMIT_NOTE },
      terms_of_service_acceptance: { message: `${PRO_DECLARATION} J'accepte les [CGV](${base}/cgv).` },
    };
  }

  const session = await stripe.checkout.sessions.create(params);
  if (!session.url) throw new Error('Stripe n’a pas renvoyé d’URL de paiement.');
  return session.url;
}

/** Fin de période d'un abonnement (champ déplacé sur les items dans les versions récentes de l'API). */
export function subscriptionPeriodEnd(sub: Stripe.Subscription): string | null {
  const legacy = (sub as unknown as { current_period_end?: number }).current_period_end;
  const ts = legacy ?? sub.items?.data?.[0]?.current_period_end;
  return ts ? new Date(ts * 1000).toISOString() : null;
}

/** Plan d'un abonnement : metadata.plan_id, sinon correspondance des price ids (hors ligne 199 € du bundle). */
export function planIdForSubscription(sub: Stripe.Subscription): PlanId | null {
  const meta = sub.metadata?.plan_id;
  if (meta && (PLAN_IDS as string[]).includes(meta)) return meta as PlanId;
  for (const item of sub.items?.data ?? []) {
    const p = planIdForPrice(item.price?.id);
    if (p) return p;
  }
  return null;
}

/** Retour du portail de facturation : page Réglages de l'espace (A9 : /app/compte n'existe pas). */
export const PORTAL_RETURN_PATH = '/app/reglages';

/** Lien vers le portail client Stripe (résiliation, carte, factures). */
export async function createPortalUrl(customerId: string, returnPath = PORTAL_RETURN_PATH): Promise<string | null> {
  const stripe = getStripe();
  if (!stripe) return null;
  const s = await stripe.billingPortal.sessions.create({ customer: customerId, return_url: `${appUrl()}${returnPath}` });
  return s.url;
}

/**
 * Fin d'engagement (AAAA-MM-JJ) d'une offre Accompagné, lue dans la metadata Stripe posée par /api/checkout
 * (`commitment_until`, sinon `commitment_months` + date de création). null pour une offre sans engagement.
 * La durée est bornée par celle de l'offre (metadata jamais plus longue que plans.ts).
 */
export function commitmentUntilFromMetadata(
  planId: PlanId,
  meta: Record<string, string> | null | undefined,
  createdSec?: number | null,
): string | null {
  const months = getPlan(planId).commitmentMonths ?? 0;
  if (!months) return null;
  const start = createdSec ? new Date(createdSec * 1000) : new Date();
  const max = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + months, start.getUTCDate()));
  const raw = meta?.commitment_until;
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const d = new Date(`${raw}T00:00:00Z`);
    if (!Number.isNaN(d.getTime()) && d.getTime() <= max.getTime() + 2 * 86_400_000) return raw;
  }
  const m = Number(meta?.commitment_months);
  const n = Number.isInteger(m) && m > 0 && m <= months ? m : months;
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + n, start.getUTCDate())).toISOString().slice(0, 10);
}
