/**
 * Après paiement (webhook Stripe `checkout.session.completed`) : compte + commerce + accès.
 *
 * 1. Commerce : celui désigné par la metadata `business_id` (posée par NOTRE serveur à partir d'une session
 *    propriétaire, jamais par le client), sinon celui de l'audit payé (créé avec le BON segment), sinon le commerce
 *    Découverte du même parcours d'un compte confirmé (montée en gamme), sinon un commerce « à compléter » (/bienvenue).
 * 2. Compte : créé s'il est absent (jamais confirmé à la création).
 * 3. Rattachement immédiat seulement si l'adresse est déjà confirmée ; sinon le lien magique de l'e-mail porte un
 *    jeton de rattachement lié à cette adresse (faille A3 : un compte non confirmé ne s'approprie rien).
 * 4. E-mail d'accès avec lien magique (ou lien vers /connexion si la génération échoue).
 */
import {
  auditRequestedBy,
  claimBusinessesForUser,
  createBusiness,
  getAudit,
  getAuditBusinessId,
  getBusinessRecord,
  getMembership,
  linkAuditToBusiness,
  listBusinessesForUser,
  updateBusiness,
  type BusinessRecord,
} from '@/lib/db';
import { isDemoBusinessId } from '@/lib/demo-v2';
import type { Segment } from '@/lib/engine/types-v2';
import { isHouseBusinessId } from '@/lib/house';
import { decouvertePlanFor, getPlan, type PlanId } from '@/lib/plans';
import { purchaseClaimToken } from './claims';
import { serverMagicLink } from './magic';
import { sendAccessEmail } from './mail';
import { enqueueOnboardingAudit } from './onboarding';
import { ensureUser, normEmail } from './users';

export interface PurchaseInput {
  planId: PlanId;
  email: string | null;
  /** client Stripe (null pour un paiement invité) */
  customerId: string | null;
  auditId?: string | null;
  /** metadata.business_id, posée par /api/checkout depuis une session propriétaire */
  businessId?: string | null;
}

export interface PurchaseOutcome {
  businessId: string | null;
  userId: string | null;
  /** rattaché au compte dès maintenant (adresse déjà confirmée) */
  attached: boolean;
  /** le client avait déjà un compte confirmé */
  secondPurchase: boolean;
  created: boolean;
  magicLink: string | null;
  emailStatus: string | null;
}

const SEGMENTS: Segment[] = ['local', 'pme', 'ecommerce'];

export function segmentForPlan(planId: PlanId): Segment {
  const s = getPlan(planId).segment;
  return (SEGMENTS as string[]).includes(s) ? (s as Segment) : 'local';
}

async function businessFromAudit(auditId: string, email: string | null, customerId: string | null, planId: PlanId): Promise<{ id: string; created: boolean } | null> {
  const linked = await getAuditBusinessId(auditId);
  if (linked) {
    // Audit déjà rattaché (son lien est public) : réutilisé seulement pour le même client.
    const b = await getBusinessRecord(linked);
    const sameCustomer = Boolean(b && customerId && b.stripeCustomerId === customerId);
    const sameEmail = Boolean(b && email && normEmail(b.contactEmail ?? '') === normEmail(email));
    if (sameCustomer || sameEmail) return { id: linked, created: false };
    console.warn('[provision] audit déjà rattaché à un autre client : nouveau commerce créé', auditId);
  }
  const audit = await getAudit(auditId);
  if (!audit) return null;
  // L'identifiant d'audit est public (lien /rapport/<id>) : on ne reprend sa saisie et on ne le lie au commerce de
  // l'acheteur que si celui-ci l'a demandé avec la même adresse (M4 de qa/v3/securite-v3.md). Sinon : espace « à
  // compléter », sans données du tiers, et l'audit reste rattachable par son auteur.
  if (!auditId.startsWith('demo-') && !(await auditRequestedBy(auditId, email))) {
    console.warn('[provision] audit demandé par une autre adresse : saisie non reprise', auditId);
    return null;
  }
  const segment: Segment =
    (audit as { segment?: Segment }).segment ?? audit.input.segment ?? segmentForPlan(planId);
  const b = await createBusiness({
    name: audit.input.businessName,
    trade: audit.input.trade,
    city: audit.input.city,
    district: audit.input.district,
    website: audit.input.website,
    contactEmail: email ?? audit.input.email,
    stripeCustomerId: customerId ?? undefined,
    plan: 'free',
    segment: (SEGMENTS as string[]).includes(segment) ? segment : 'local',
    planId: decouvertePlanFor(segment),
    auditInput: audit.input as unknown as Record<string, unknown>,
  });
  if (!linked) await linkAuditToBusiness(auditId, b.id);
  await updateBusiness(b.id, { lastScore: audit.score });
  return { id: b.id, created: true };
}

export async function provisionPurchase(input: PurchaseInput, deps: { sendEmail?: boolean } = {}): Promise<PurchaseOutcome> {
  const email = input.email ? normEmail(input.email) : null;
  const out: PurchaseOutcome = { businessId: null, userId: null, attached: false, secondPurchase: false, created: false, magicLink: null, emailStatus: null };
  const user = email ? await ensureUser(email) : null;
  out.userId = user?.id ?? null;
  out.secondPurchase = Boolean(user && !user.created && user.confirmed);

  // 1. Commerce
  let business: BusinessRecord | null = null;
  if (input.businessId && !isDemoBusinessId(input.businessId) && !isHouseBusinessId(input.businessId)) {
    business = await getBusinessRecord(input.businessId);
  }
  if (!business && input.auditId) {
    const r = await businessFromAudit(input.auditId, email, input.customerId, input.planId);
    if (r) {
      business = await getBusinessRecord(r.id);
      out.created = r.created;
    }
  }
  if (!business && user?.confirmed) {
    // Montée en gamme depuis /tarifs sans session : commerce Découverte du même parcours, dont il est propriétaire.
    const segment = segmentForPlan(input.planId);
    for (const b of await listBusinessesForUser(user.id)) {
      if (b.plan !== 'free' || (b.segment ?? 'local') !== segment) continue;
      if ((await getMembership(b.id, user.id))?.role !== 'owner') continue;
      business = await getBusinessRecord(b.id);
      break;
    }
  }
  if (!business && email) {
    const segment = segmentForPlan(input.planId);
    business = await createBusiness({
      name: 'Mon entreprise',
      trade: '',
      city: '',
      contactEmail: email,
      stripeCustomerId: input.customerId ?? undefined,
      plan: 'free',
      segment,
      planId: decouvertePlanFor(segment),
      needsSetup: true,
    });
    out.created = true;
  }
  out.businessId = business?.id ?? null;
  // Audit d'onboarding (relancé selon l'offre ensuite) : seulement pour un espace complet.
  if (business && !business.needsSetup) await enqueueOnboardingAudit(business.id);
  if (!business || !user || !email) return out;

  // 2-3. Rattachement
  const member = await getMembership(business.id, user.id);
  if (member || business.ownerId === user.id) out.attached = true;
  else if (user.confirmed) out.attached = (await claimBusinessesForUser(user.id, email, { businessIds: [business.id] })).length > 0;

  // 4. E-mail d'accès
  const canClaim = !out.attached && !business.ownerId && normEmail(business.contactEmail ?? email) === email;
  out.magicLink = await serverMagicLink(email, {
    next: business.needsSetup ? '/bienvenue' : '/app',
    claim: canClaim ? purchaseClaimToken(business.id, email) : null,
  }).catch((e) => {
    console.error('[provision] lien magique impossible', e);
    return null;
  });
  if (deps.sendEmail !== false) {
    const r = await sendAccessEmail(email, {
      planId: input.planId,
      businessName: business.needsSetup ? null : business.name,
      magicLink: out.magicLink,
      secondPurchase: out.secondPurchase,
    });
    out.emailStatus = r.status;
  }
  return out;
}
