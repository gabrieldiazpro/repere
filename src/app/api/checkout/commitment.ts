/**
 * Checkout des offres avec engagement (Accompagné : 3 mois minimum).
 * src/lib/stripe.ts (V1) ne sait pas porter l'engagement : on construit ici la session Stripe avec
 * - metadata `commitment_months` / `commitment_until` (session, abonnement) — lue par le webhook et le support ;
 * - une mention explicite sur la page de paiement (custom_text) + acceptation des CGV obligatoire.
 * Sans STRIPE_SECRET_KEY : même redirection démo que les autres offres.
 */
import type Stripe from 'stripe';
import { appUrl } from '@/lib/email';
import { commitmentCheckoutTerms, getPlan, type PlanId } from '@/lib/plans';
import { CheckoutConfigError, PRO_DECLARATION, PRO_SUBMIT_NOTE, getStripe, priceEnvName, priceIdForPlan, proDeclarationMetadata } from '@/lib/stripe';

export interface CommitmentCheckoutArgs {
  planId: PlanId;
  auditId?: string;
  businessId?: string;
  email?: string;
  /** client Stripe existant (2ᵉ achat d'un propriétaire connecté) : remplace customer_email */
  customerId?: string;
  /** horodatage serveur de la case « je suis un professionnel » (si envoyée) */
  proDeclaredAt?: string;
}

/** Paramètres de session Stripe (pur, testable). */
export function commitmentSessionParams(
  args: CommitmentCheckoutArgs,
  price: string,
  base: string,
  now: Date = new Date(),
): Stripe.Checkout.SessionCreateParams {
  const terms = commitmentCheckoutTerms(args.planId, now);
  if (!terms) throw new CheckoutConfigError('Offre sans engagement.');
  const plan = getPlan(args.planId);
  const taxRates = process.env.STRIPE_TAX_RATE_ID ? [process.env.STRIPE_TAX_RATE_ID] : undefined;
  const metadata: Record<string, string> = { app: 'auditia', plan_id: args.planId, ...terms.metadata, ...proDeclarationMetadata(args.proDeclaredAt) };
  if (args.auditId) metadata.audit_id = args.auditId;
  if (args.businessId) metadata.business_id = args.businessId;
  return {
    mode: 'subscription',
    line_items: [{ price, quantity: 1, tax_rates: taxRates }],
    success_url: `${base}/merci?session_id={CHECKOUT_SESSION_ID}&plan=${args.planId}`,
    cancel_url: args.auditId ? `${base}/rapport/${encodeURIComponent(args.auditId)}` : `${base}/tarifs`,
    client_reference_id: args.auditId,
    ...(args.customerId ? { customer: args.customerId, customer_update: { address: 'auto', name: 'auto' } } : { customer_email: args.email }),
    metadata,
    subscription_data: { metadata, description: `${plan.name} — engagement ${terms.metadata.commitment_months} mois` },
    locale: 'fr',
    allow_promotion_codes: true,
    billing_address_collection: 'required',
    tax_id_collection: { enabled: true },
    consent_collection: { terms_of_service: 'required' },
    custom_text: {
      submit: { message: `${terms.message} ${PRO_SUBMIT_NOTE}` },
      terms_of_service_acceptance: {
        message: `${PRO_DECLARATION} ${terms.message} Rien n'est publié sans votre validation. [CGV](${base}/cgv)`,
      },
    },
  };
}

export async function createCommitmentCheckoutUrl(args: CommitmentCheckoutArgs): Promise<string> {
  const stripe = getStripe();
  if (!stripe) {
    return `/merci?demo=1&plan=${encodeURIComponent(args.planId)}${args.auditId ? `&audit=${encodeURIComponent(args.auditId)}` : ''}`;
  }
  const price = priceIdForPlan(args.planId);
  if (!price) throw new CheckoutConfigError(`Prix Stripe non configuré : ${priceEnvName(args.planId)}`);
  const session = await stripe.checkout.sessions.create(commitmentSessionParams(args, price, appUrl()));
  if (!session.url) throw new Error('Stripe n’a pas renvoyé d’URL de paiement.');
  return session.url;
}
