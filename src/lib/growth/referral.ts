/**
 * Parrainage (docs/v3/11-outils-gratuits.md, boucle 4).
 * - un code par compte (REP-XXXXXXXX), jamais d'argent comptant : un crédit sur la facture (coupon Stripe) ;
 * - attribution au moment de l'inscription du filleul (?ref=code) ;
 * - récompense acquise seulement au premier paiement du filleul, plafonnée par an pour le parrain ;
 * - webhook Stripe (src/app/api/stripe/webhook, à ajouter par COMPTES) : sur `invoice.paid` (ou `invoice.payment_succeeded`),
 *   après l'activation du compte, appeler
 *     await onReferredFirstPayment({ refereeBusinessId: <business_id des métadonnées>, refereeSubscriptionId: invoice.subscription,
 *                                    amountPaidCents: invoice.amount_paid });
 *   (idempotent : seul le statut « pending » est récompensé ; ne jamais faire échouer le webhook sur une erreur ici : try/catch + log).
 * - attribution : après l'inscription avec ?ref=CODE, appeler POST /api/growth/referral/attribute { businessId, code }.
 * - anti-abus : pas d'auto-parrainage (même propriétaire, même adresse, même client Stripe), un seul parrain par filleul.
 */
import { getDoc, listDocs, putDoc } from '@/lib/store';
import { getBusinessRecord, listSubscriptionsByCustomer, type BusinessRecord } from '@/lib/db';
import { getStripe } from '@/lib/stripe';
import { COLLECTIONS } from './constants';
import { REFERRAL_CODE_RE, generateReferralCode } from './tokens';

export interface ReferralReward {
  /** Mois offerts au parrain et au filleul. */
  referrerMonths: number;
  refereeMonths: number;
  /** Plafond de mois offerts par parrain sur 12 mois glissants. */
  annualCapMonths: number;
}

/** Proposition par défaut (à valider avec le fondateur) : un mois offert à chacun après le premier paiement du filleul. */
export const DEFAULT_REWARD: ReferralReward = { referrerMonths: 1, refereeMonths: 1, annualCapMonths: 6 };

/** Récompense paramétrable : variable GROWTH_REFERRAL_REWARD (JSON partiel) sinon défaut. */
export function getRewardConfig(env: Record<string, string | undefined> = process.env): ReferralReward {
  const raw = env.GROWTH_REFERRAL_REWARD;
  if (!raw) return DEFAULT_REWARD;
  try {
    const p = JSON.parse(raw) as Partial<ReferralReward>;
    const n = (v: unknown, d: number) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 12 ? v : d);
    return {
      referrerMonths: n(p.referrerMonths, DEFAULT_REWARD.referrerMonths),
      refereeMonths: n(p.refereeMonths, DEFAULT_REWARD.refereeMonths),
      annualCapMonths: typeof p.annualCapMonths === 'number' && p.annualCapMonths >= 0 && p.annualCapMonths <= 60 ? Math.floor(p.annualCapMonths) : DEFAULT_REWARD.annualCapMonths,
    };
  } catch {
    return DEFAULT_REWARD;
  }
}

export interface RefCode {
  code: string;
  businessId: string;
  createdAt: string;
}

export type ReferralStatus = 'pending' | 'rewarded' | 'qualified_no_reward' | 'rejected';

export interface Referral {
  refereeBusinessId: string;
  referrerBusinessId: string;
  code: string;
  status: ReferralStatus;
  reason?: string;
  createdAt: string;
  qualifiedAt?: string;
  referrerMonths?: number;
  refereeMonths?: number;
  /** Détail de l'application Stripe (null en mode démo : rien n'est appliqué, rien n'est prétendu). */
  stripe?: { referrerCoupon: string | null; refereeCoupon: string | null; applied: boolean; referrerApplied?: boolean };
}

/** Code du compte (créé au premier appel, ensuite stable). */
export async function getOrCreateCode(businessId: string): Promise<RefCode> {
  const found = (await listDocs<RefCode>(COLLECTIONS.refCodes, { businessId, limit: 1 }))[0];
  if (found) return found.data;
  for (let i = 0; i < 5; i++) {
    const code = generateReferralCode();
    if (await getDoc(COLLECTIONS.refCodes, code)) continue;
    const rec: RefCode = { code, businessId, createdAt: new Date().toISOString() };
    await putDoc(COLLECTIONS.refCodes, code, rec, businessId);
    return rec;
  }
  throw new Error('code de parrainage : collisions répétées');
}

export async function findCode(code: string): Promise<RefCode | null> {
  const c = (code ?? '').trim().toUpperCase();
  if (!REFERRAL_CODE_RE.test(c)) return null;
  return (await getDoc<RefCode>(COLLECTIONS.refCodes, c))?.data ?? null;
}

export type AttributionResult =
  | { ok: true; referral: Referral }
  | { ok: false; reason: 'invalid_code' | 'self_referral' | 'already_referred' | 'referee_unknown' | 'referrer_unknown' };

/** Adresse canonique (alias « +tag », points Gmail) : un alias ne suffit plus à se parrainer soi-même (M6). */
export const norm = (s: string | undefined | null) => {
  const e = (s ?? '').trim().toLowerCase();
  const at = e.lastIndexOf('@');
  if (at < 1) return e;
  let local = e.slice(0, at).replace(/\+.*$/, '');
  const domain = e.slice(at + 1).replace(/^googlemail\.com$/, 'gmail.com');
  if (domain === 'gmail.com') local = local.replace(/\./g, '');
  return `${local}@${domain}`;
};

/** Un filleul doit être un compte neuf : créé il y a 30 jours au plus, jamais payé (M6). */
const REFEREE_MAX_AGE_MS = 30 * 86_400_000;

/** Pure : deux comptes qui se parrainent (même propriétaire, même e-mail de contact, même client Stripe). */
export function isSelfReferral(a: Pick<BusinessRecord, 'id' | 'ownerId' | 'contactEmail' | 'stripeCustomerId'>, b: Pick<BusinessRecord, 'id' | 'ownerId' | 'contactEmail' | 'stripeCustomerId'>): boolean {
  if (a.id === b.id) return true;
  if (a.ownerId && a.ownerId === b.ownerId) return true;
  if (norm(a.contactEmail) && norm(a.contactEmail) === norm(b.contactEmail)) return true;
  if (a.stripeCustomerId && a.stripeCustomerId === b.stripeCustomerId) return true;
  return false;
}

/** Rattache un nouveau compte à un parrain. Statut « pending » jusqu'au premier paiement. Un filleul n'a qu'un parrain. */
export async function attributeReferral(input: { code: string; refereeBusinessId: string }): Promise<AttributionResult> {
  const ref = await findCode(input.code);
  if (!ref) return { ok: false, reason: 'invalid_code' };
  if (await getDoc(COLLECTIONS.referrals, input.refereeBusinessId)) return { ok: false, reason: 'already_referred' };
  const [referee, referrer] = await Promise.all([getBusinessRecord(input.refereeBusinessId), getBusinessRecord(ref.businessId)]);
  if (!referee) return { ok: false, reason: 'referee_unknown' };
  if (!referrer) return { ok: false, reason: 'referrer_unknown' };
  if (isSelfReferral(referee, referrer)) return { ok: false, reason: 'self_referral' };
  const ageMs = Date.now() - Date.parse(referee.createdAt ?? '');
  if (!(ageMs >= 0 && ageMs <= REFEREE_MAX_AGE_MS)) return { ok: false, reason: 'already_referred' };
  if (referee.stripeCustomerId && !referee.stripeCustomerId.startsWith('guest_')) {
    const paid = await listSubscriptionsByCustomer(referee.stripeCustomerId).catch(() => []);
    if (paid.length) return { ok: false, reason: 'already_referred' };
  }
  const referral: Referral = {
    refereeBusinessId: referee.id,
    referrerBusinessId: referrer.id,
    code: ref.code,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  await putDoc(COLLECTIONS.referrals, referee.id, referral, referrer.id);
  return { ok: true, referral };
}

export async function listReferralsOf(referrerBusinessId: string): Promise<Referral[]> {
  return (await listDocs<Referral>(COLLECTIONS.referrals, { businessId: referrerBusinessId, limit: 500 })).map((d) => d.data);
}

/** Pure : mois déjà accordés au parrain sur les 12 derniers mois. */
export function monthsGrantedInLastYear(referrals: Referral[], now: Date = new Date()): number {
  const since = now.getTime() - 365 * 86_400_000;
  return referrals
    // Seuls les mois réellement appliqués comptent (parrain sans abonnement actif : rien n'est accordé ni affiché).
    .filter((r) => r.status === 'rewarded' && (r.stripe?.referrerApplied ?? r.stripe?.applied) !== false && r.qualifiedAt && Date.parse(r.qualifiedAt) >= since)
    .reduce((s, r) => s + (r.referrerMonths ?? 0), 0);
}

/** Pure : mois que le parrain peut encore recevoir compte tenu du plafond. */
export function referrerMonthsAllowed(granted: number, cfg: ReferralReward): number {
  return Math.max(0, Math.min(cfg.referrerMonths, cfg.annualCapMonths - granted));
}

/**
 * Applique des mois offerts via un coupon Stripe 100 % sur N mois, ajouté aux remises existantes de l'abonnement.
 * Sans STRIPE_SECRET_KEY : n'applique rien et le dit (`applied: false`). `idempotencyKey` rend l'appel rejouable.
 */
export async function applyReferralCoupon(args: {
  subscriptionId: string | null | undefined;
  months: number;
  idempotencyKey: string;
  label: string;
}): Promise<{ applied: boolean; couponId: string | null }> {
  const stripe = getStripe();
  if (!stripe || !args.subscriptionId || args.months <= 0) return { applied: false, couponId: null };
  const coupon = await stripe.coupons.create(
    {
      percent_off: 100,
      duration: 'repeating',
      duration_in_months: args.months,
      name: args.label.slice(0, 40),
      max_redemptions: 1,
      metadata: { source: 'repere-referral', key: args.idempotencyKey },
    },
    { idempotencyKey: `coupon:${args.idempotencyKey}` },
  );
  const sub = await stripe.subscriptions.retrieve(args.subscriptionId);
  const existing = (sub.discounts ?? []).map((d) => ({ discount: typeof d === 'string' ? d : d.id }));
  await stripe.subscriptions.update(
    args.subscriptionId,
    { discounts: [...existing, { coupon: coupon.id }] },
    { idempotencyKey: `sub:${args.idempotencyKey}` },
  );
  return { applied: true, couponId: coupon.id };
}

export interface FirstPaymentInput {
  refereeBusinessId: string;
  /** Abonnement Stripe du filleul (invoice.subscription). */
  refereeSubscriptionId?: string | null;
  /** Montant réellement encaissé, en centimes : 0 (essai, 100 % de remise) ne qualifie pas. */
  amountPaidCents: number;
  now?: Date;
}

export interface FirstPaymentOutcome {
  status: 'no_referral' | 'not_pending' | 'not_paid' | 'rewarded' | 'qualified_no_reward';
  referral?: Referral;
}

/**
 * À appeler depuis le webhook Stripe au premier paiement encaissé d'un filleul (voir README du module).
 * Idempotent : un filleul n'est récompensé qu'une fois (statut « pending » requis). Fonction exportée pour le webhook.
 */
export async function onReferredFirstPayment(input: FirstPaymentInput): Promise<FirstPaymentOutcome> {
  const cur = (await getDoc<Referral>(COLLECTIONS.referrals, input.refereeBusinessId))?.data;
  if (!cur) return { status: 'no_referral' };
  if (cur.status !== 'pending') return { status: 'not_pending', referral: cur };
  if (!(input.amountPaidCents > 0)) return { status: 'not_paid', referral: cur };
  const now = input.now ?? new Date();
  const cfg = getRewardConfig();
  const referrerBiz = await getBusinessRecord(cur.referrerBusinessId);
  const granted = monthsGrantedInLastYear(await listReferralsOf(cur.referrerBusinessId), now);
  const referrerMonths = referrerMonthsAllowed(granted, cfg);
  const refereeMonths = cfg.refereeMonths;

  let referrerSubId: string | null = null;
  if (referrerBiz?.stripeCustomerId) {
    const subs = await listSubscriptionsByCustomer(referrerBiz.stripeCustomerId).catch(() => []);
    referrerSubId = subs.find((s) => (s.status === 'active' || s.status === 'trialing') && s.stripeSubscriptionId)?.stripeSubscriptionId ?? null;
  }
  const [r1, r2] = await Promise.all([
    applyReferralCoupon({ subscriptionId: referrerSubId, months: referrerMonths, idempotencyKey: `ref:${cur.refereeBusinessId}:referrer`, label: 'Parrainage Repéré (parrain)' }),
    applyReferralCoupon({ subscriptionId: input.refereeSubscriptionId, months: refereeMonths, idempotencyKey: `ref:${cur.refereeBusinessId}:referee`, label: 'Parrainage Repéré (filleul)' }),
  ]);
  const referral: Referral = {
    ...cur,
    status: referrerMonths > 0 || refereeMonths > 0 ? 'rewarded' : 'qualified_no_reward',
    qualifiedAt: now.toISOString(),
    referrerMonths,
    refereeMonths,
    stripe: { referrerCoupon: r1.couponId, refereeCoupon: r2.couponId, applied: r1.applied || r2.applied, referrerApplied: r1.applied },
  };
  await putDoc(COLLECTIONS.referrals, cur.refereeBusinessId, referral, cur.referrerBusinessId);
  return { status: referral.status === 'rewarded' ? 'rewarded' : 'qualified_no_reward', referral };
}

/** Synthèse pour la page du parrain (sans identité des filleuls : seulement des compteurs). */
export async function referralSummary(businessId: string) {
  const list = await listReferralsOf(businessId);
  return {
    invited: list.length,
    pending: list.filter((r) => r.status === 'pending').length,
    rewarded: list.filter((r) => r.status === 'rewarded').length,
    monthsGranted: monthsGrantedInLastYear(list),
    reward: getRewardConfig(),
  };
}
