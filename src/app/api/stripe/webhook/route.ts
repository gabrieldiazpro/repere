import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import {
  findSubscriptionByStripeId,
  getBusinessRecord,
  listSubscriptionsByCustomer,
  markStripeEventProcessed,
  recordAlert,
  unmarkStripeEvent,
  updateBusiness,
  upsertSubscription,
  type SubscriptionStatus,
} from '@/lib/db';
import { sendPaymentFailedEmail, sendPurchaseConfirmationEmail } from '@/lib/email';
import { includesActionPlan, isPlanId, planTier } from '@/lib/plans';
import { grantAuditOffer } from '@/lib/entitlements';
import { putDoc } from '@/lib/store';
import { provisionPurchase } from '@/lib/auth/provision';
import { sendAccessEmail } from '@/lib/auth/mail';
import {
  commitmentUntilFromMetadata,
  createPortalUrl,
  getStripe,
  planIdForSubscription,
  subscriptionPeriodEnd,
} from '@/lib/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function mapStatus(s: Stripe.Subscription.Status): SubscriptionStatus {
  switch (s as string) {
    case 'trialing':
    case 'active':
    case 'past_due':
    case 'canceled':
    case 'incomplete':
    case 'unpaid':
      return s as SubscriptionStatus;
    case 'incomplete_expired':
      return 'canceled';
    default:
      return 'past_due'; // paused, etc.
  }
}

/** Accès conservé pendant l'essai, l'abonnement actif et les relances de paiement. */
const hasAccess = (s: SubscriptionStatus) => s === 'active' || s === 'trialing' || s === 'past_due';

const idOf = (v: string | { id: string } | null | undefined): string | null =>
  !v ? null : typeof v === 'string' ? v : v.id;

/** Collection des preuves de déclaration professionnelle (une par abonnement, ou par session pour un achat unique). */
const PRO_DECLARATIONS = 'billing.pro_declarations';

/**
 * Preuve de la déclaration « je suis un professionnel » enregistrée avec l'abonnement : texte accepté (version), case
 * obligatoire de la page Stripe (consent.terms_of_service), horodatage de la case cochée sur notre site s'il existe
 * (posé par notre serveur), et date d'enregistrement. Idempotent (même identifiant).
 */
async function recordProDeclaration(
  session: Stripe.Checkout.Session,
  ctx: { subscriptionId: string | null; businessId: string | null; planId: string; email: string | null },
): Promise<void> {
  const meta = session.metadata ?? {};
  const id = ctx.subscriptionId ?? session.id;
  await putDoc(
    PRO_DECLARATIONS,
    id,
    {
      subscriptionId: ctx.subscriptionId,
      sessionId: session.id,
      planId: ctx.planId,
      businessId: ctx.businessId,
      email: ctx.email,
      declaration: meta.pro_declaration ?? null,
      siteCheckboxAt: meta.pro_declared_at ?? null,
      stripeConsent: session.consent?.terms_of_service ?? null,
      checkoutCreatedAt: session.created ? new Date(session.created * 1000).toISOString() : null,
      recordedAt: new Date().toISOString(),
    },
    ctx.businessId,
  );
}

async function onCheckoutCompleted(session: Stripe.Checkout.Session, stripe: Stripe) {
  const meta = session.metadata ?? {};
  if (meta.app && meta.app !== 'auditia') return; // session d'un autre produit du même compte Stripe (F6)
  const planId = meta.plan_id;
  if (!isPlanId(planId)) {
    console.warn('[webhook] checkout sans plan_id reconnu', session.id);
    return;
  }
  if (session.payment_status === 'unpaid' && session.mode === 'payment') return; // paiement asynchrone non confirmé

  const email = session.customer_details?.email ?? session.customer_email ?? null;
  const customerId = idOf(session.customer) ?? `guest_${session.id}`;
  const auditId = meta.audit_id ?? session.client_reference_id ?? null;
  // Compte + commerce (bon segment) + accès par lien magique (src/lib/auth/provision.ts). `business_id` n'est lu que
  // dans la metadata posée par NOTRE serveur (/api/checkout, session propriétaire), jamais fournie par le client.
  // Même session traitée une seconde fois (async_payment_succeeded après completed, ou nouvel envoi de Stripe après un
  // 500 survenu en cours de traitement) : on reprend le commerce déjà lié à cet abonnement / à cette session, au lieu
  // d'en créer un second « Mon entreprise » vers lequel l'abonnement basculerait (perte d'accès au commerce réel).
  const subIdEarly = idOf(session.subscription);
  const already = subIdEarly
    ? await findSubscriptionByStripeId(subIdEarly)
    : !idOf(session.customer)
      ? ((await listSubscriptionsByCustomer(customerId)).find((s) => s.planId === planId && s.businessId) ?? null)
      : null;
  const provisioned = await provisionPurchase(
    { planId, email, customerId: idOf(session.customer), auditId, businessId: meta.business_id ?? already?.businessId ?? null },
    { sendEmail: false },
  );
  const businessId = provisioned.businessId;

  const subId = idOf(session.subscription);
  let status: SubscriptionStatus = 'active';
  let periodEnd: string | null = null;
  let commitmentUntil = commitmentUntilFromMetadata(planId, meta, session.created);
  if (subId) {
    const sub = await stripe.subscriptions.retrieve(subId);
    status = mapStatus(sub.status);
    periodEnd = subscriptionPeriodEnd(sub);
    commitmentUntil = commitmentUntilFromMetadata(planId, { ...meta, ...(sub.metadata ?? {}) }, sub.created ?? session.created);
  }

  await upsertSubscription({
    stripeCustomerId: customerId,
    stripeSubscriptionId: subId,
    planId,
    status,
    currentPeriodEnd: periodEnd,
    businessId,
    email,
    actionPlanPurchased: includesActionPlan(planId) ? true : undefined,
    commitmentUntil,
  });
  try {
    await recordProDeclaration(session, { subscriptionId: subId, businessId, planId, email });
  } catch (e) {
    console.error('[webhook] preuve de déclaration professionnelle non enregistrée', session.id, e);
  }

  if (businessId) {
    const current = await getBusinessRecord(businessId);
    const tier = planTier(planId);
    const patch: Parameters<typeof updateBusiness>[1] = { isActive: true };
    if (tier !== 'free' && hasAccess(status)) {
      patch.plan = tier;
      patch.planId = planId;
    }
    // Ne jamais écraser le contact / le client Stripe d'un commerce existant (E1).
    if (email && !current?.contactEmail) patch.contactEmail = email.toLowerCase();
    if (idOf(session.customer) && !current?.stripeCustomerId) patch.stripeCustomerId = idOf(session.customer)!;
    await updateBusiness(businessId, patch);
    // Audit approfondi acheté seul : 1 mois d'Essentiel offert, sans carte (idempotent, @/lib/entitlements).
    await grantAuditOffer(businessId, planId, new Date((session.created ?? Date.now() / 1000) * 1000));
  } else {
    console.warn('[webhook] paiement sans e-mail : commerce non créé', session.id);
  }

  if (email) {
    const current = businessId ? await getBusinessRecord(businessId) : null;
    await sendAccessEmail(email, {
      planId,
      businessName: current && !current.needsSetup ? current.name : null,
      magicLink: provisioned.magicLink,
      secondPurchase: provisioned.secondPurchase,
    });
    // Plan d'action (PDF) : e-mail dédié avec le lien de téléchargement.
    if (includesActionPlan(planId)) await sendPurchaseConfirmationEmail(email, { planId, businessId, auditId });
  }
}

async function onSubscriptionChange(sub: Stripe.Subscription, deleted: boolean) {
  const planId = planIdForSubscription(sub);
  if (!planId) {
    console.warn('[webhook] abonnement sans plan reconnu', sub.id);
    return;
  }
  const status: SubscriptionStatus = deleted ? 'canceled' : mapStatus(sub.status);
  const customerId = idOf(sub.customer)!;
  const businessId = null; // dérivé de la ligne subscriptions existante (E1 : jamais des métadonnées client)

  const rec = await upsertSubscription({
    stripeCustomerId: customerId,
    stripeSubscriptionId: sub.id,
    planId,
    status,
    currentPeriodEnd: subscriptionPeriodEnd(sub),
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    businessId: businessId ?? undefined,
    // Engagement Accompagné (3 mois) : metadata de l'abonnement ; undefined conserve la valeur existante.
    commitmentUntil: commitmentUntilFromMetadata(planId, sub.metadata, sub.created) ?? undefined,
  });

  if (rec.businessId) {
    const access = hasAccess(status) && planTier(planId) !== 'free';
    // Fin d'abonnement : retour aux droits Découverte (historique conservé), jamais de suppression.
    await updateBusiness(rec.businessId, access ? { plan: planTier(planId), planId } : { plan: 'free', planId: null });
    if (deleted) {
      await recordAlert({
        businessId: rec.businessId,
        type: 'subscription_canceled',
        title: 'Votre suivi est arrêté',
        body: 'Votre abonnement a pris fin. Votre historique reste consultable.',
      });
    }
  }
}

async function onPaymentFailed(invoice: Stripe.Invoice) {
  const customerId = idOf(invoice.customer);
  const email = invoice.customer_email;
  const subs = customerId ? await listSubscriptionsByCustomer(customerId) : [];
  for (const s of subs) {
    if (s.businessId) {
      await recordAlert({
        businessId: s.businessId,
        type: 'payment_failed',
        title: 'Paiement refusé',
        body: 'Mettez à jour votre moyen de paiement pour garder votre suivi.',
        emailSent: Boolean(email),
      });
      break;
    }
  }
  if (email) {
    const manageUrl = customerId ? ((await createPortalUrl(customerId).catch(() => null)) ?? undefined) : undefined;
    await sendPaymentFailedEmail(email, { manageUrl });
  }
}

/** Abonnement d'une facture (champ `subscription` des anciennes API, `parent.subscription_details` des récentes). */
function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const legacy = (invoice as unknown as { subscription?: string | { id: string } | null }).subscription;
  const parent = (invoice as unknown as { parent?: { subscription_details?: { subscription?: string | { id: string } | null } | null } | null }).parent;
  const v = legacy ?? parent?.subscription_details?.subscription ?? null;
  return typeof v === 'string' ? v : v?.id ?? null;
}

/** Fin de la période couverte par une facture d'abonnement (plus grande fin de ligne), ISO ou null. */
function invoicePeriodEnd(invoice: Stripe.Invoice): string | null {
  let max = 0;
  for (const line of invoice.lines?.data ?? []) {
    const end = line.period?.end;
    if (typeof end === 'number' && end > max) max = end;
  }
  return max > 0 ? new Date(max * 1000).toISOString() : null;
}

/**
 * Facture payée :
 * 1. prolonge `currentPeriodEnd` de l'abonnement jusqu'à la fin de la période facturée (jamais en arrière : une
 *    facture rejouée ou reçue dans le désordre n'a aucun effet) ; auparavant seule la réception de
 *    `customer.subscription.updated` faisait avancer la période ;
 * 2. récompense de parrainage au premier paiement réel du filleul (@/lib/growth, idempotent).
 */
async function onInvoicePaid(invoice: Stripe.Invoice) {
  const customerId = idOf(invoice.customer);
  if (!customerId) return;
  const subId = invoiceSubscriptionId(invoice);
  const periodEnd = invoicePeriodEnd(invoice);
  if (subId && periodEnd) {
    const existing = await findSubscriptionByStripeId(subId);
    const current = existing?.currentPeriodEnd ? Date.parse(existing.currentPeriodEnd) : NaN;
    if (existing && existing.stripeCustomerId === customerId && !(current >= Date.parse(periodEnd))) {
      await upsertSubscription({
        stripeCustomerId: existing.stripeCustomerId,
        stripeSubscriptionId: subId,
        planId: existing.planId,
        status: existing.status,
        currentPeriodEnd: periodEnd,
      });
    }
  }
  if (!(invoice.amount_paid > 0)) return;
  const subs = await listSubscriptionsByCustomer(customerId);
  const sub = subs.find((s) => s.stripeSubscriptionId === subId && s.businessId) ?? subs.find((s) => s.businessId);
  if (!sub?.businessId) return;
  try {
    const { onReferredFirstPayment } = await import('@/lib/growth');
    await onReferredFirstPayment({ refereeBusinessId: sub.businessId, refereeSubscriptionId: subId, amountPaidCents: invoice.amount_paid });
  } catch (e) {
    // Jamais bloquant pour la facturation : la récompense pourra être appliquée à la main.
    console.error('[webhook] parrainage non récompensé', sub.businessId, e);
  }
}

export async function POST(req: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    return NextResponse.json({ error: 'Stripe non configuré (mode démo).' }, { status: 503 });
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) return NextResponse.json({ error: 'Signature manquante.' }, { status: 400 });

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, signature, secret);
  } catch (e) {
    console.warn('[webhook] signature invalide', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Signature invalide.' }, { status: 400 });
  }

  if (!(await markStripeEventProcessed(event.id, event.type))) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        await onCheckoutCompleted(event.data.object, stripe);
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await onSubscriptionChange(event.data.object, false);
        break;
      case 'customer.subscription.deleted':
        await onSubscriptionChange(event.data.object, true);
        break;
      case 'invoice.payment_failed':
        await onPaymentFailed(event.data.object);
        break;
      case 'invoice.paid':
        await onInvoicePaid(event.data.object);
        break;
      case 'charge.dispute.created':
        console.warn('[webhook] litige ouvert', event.data.object.id, event.data.object.amount);
        break;
      default:
        break;
    }
  } catch (e) {
    console.error('[webhook] traitement en échec', event.type, e);
    await unmarkStripeEvent(event.id).catch(() => undefined);
    return NextResponse.json({ error: 'Traitement en échec.' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
