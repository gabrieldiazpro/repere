/**
 * Paiements des clients apportés par un partenaire (collection `partners.payments`, une ligne par facture Stripe).
 * Écrits par le webhook Stripe sur `invoice.paid` (src/app/api/stripe/webhook/route.ts → recordPartnerPayment), et
 * seulement si l'espace payeur a une origine partenaire (src/lib/roi attribution, `?ref=`). Idempotent : même facture
 * = même document. Jamais bloquant pour la facturation.
 */
import { getDoc, listDocs, putDoc } from '@/lib/store';
import { getAttribution, partnerCodeOf } from '@/lib/roi/attribution';
import type { PaymentRow } from './commission';

export const PAYMENTS_COLLECTION = 'partners.payments';

export interface PartnerPaymentDoc extends PaymentRow {
  subscriptionId: string | null;
  recordedAt: string;
  /** V10 : paiement Stripe de la facture, pour rattacher un remboursement (`charge.refunded`) */
  paymentIntentId?: string | null;
  refundedAt?: string | null;
}

const INVOICE_RE = /^[A-Za-z0-9_-]{3,120}$/;

/** Montant HT : `total_excluding_tax` si Stripe le donne, sinon montant payé moins la taxe connue ; borné à [0, payé]. */
export function exclTax(input: { amountPaid: number; totalExcludingTax?: number | null; tax?: number | null }): number {
  const paid = Math.max(0, Math.round(input.amountPaid || 0));
  let ht = typeof input.totalExcludingTax === 'number' ? input.totalExcludingTax : typeof input.tax === 'number' ? paid - input.tax : paid;
  if (!Number.isFinite(ht)) ht = paid;
  return Math.max(0, Math.min(paid, Math.round(ht)));
}

export async function recordPartnerPayment(input: {
  invoiceId: string;
  businessId: string;
  subscriptionId: string | null;
  amountPaidCents: number;
  amountExclTaxCents: number;
  currency: string;
  paidAt?: string | null;
  paymentIntentId?: string | null;
  now?: Date;
}): Promise<PartnerPaymentDoc | null> {
  if (!INVOICE_RE.test(input.invoiceId) || !input.businessId || !(input.amountPaidCents > 0)) return null;
  const origin = await getAttribution('business', input.businessId);
  const code = partnerCodeOf(origin?.attribution);
  if (!code) return null;
  const existing = await getDoc<PartnerPaymentDoc>(PAYMENTS_COLLECTION, input.invoiceId);
  if (existing) return existing.data;
  const now = input.now ?? new Date();
  const doc: PartnerPaymentDoc = {
    invoiceId: input.invoiceId,
    businessId: input.businessId,
    partnerCode: code,
    subscriptionId: input.subscriptionId,
    amountPaidCents: Math.round(input.amountPaidCents),
    amountExclTaxCents: Math.max(0, Math.min(Math.round(input.amountPaidCents), Math.round(input.amountExclTaxCents))),
    currency: (input.currency || 'eur').toLowerCase(),
    paidAt: input.paidAt && Number.isFinite(Date.parse(input.paidAt)) ? new Date(input.paidAt).toISOString() : now.toISOString(),
    recordedAt: now.toISOString(),
    paymentIntentId: input.paymentIntentId && INVOICE_RE.test(input.paymentIntentId) ? input.paymentIntentId : null,
  };
  await putDoc(PAYMENTS_COLLECTION, input.invoiceId, doc, input.businessId);
  return doc;
}

/** Part HT d'un remboursement (au prorata du paiement), bornée au HT payé. Pur. */
export function refundExclTax(doc: Pick<PaymentRow, 'amountPaidCents' | 'amountExclTaxCents'>, amountRefundedCents: number): number {
  const paid = Math.max(0, doc.amountPaidCents);
  if (!(paid > 0) || !(amountRefundedCents > 0)) return 0;
  const refunded = Math.min(paid, Math.round(amountRefundedCents));
  return Math.min(doc.amountExclTaxCents, Math.round((refunded * doc.amountExclTaxCents) / paid));
}

/**
 * V10 (décision 8 : remboursements déduits) : remboursement Stripe d'un paiement de client apporté (`charge.refunded`).
 * `amountRefundedCents` est le CUMUL remboursé sur le paiement (Stripe `charge.amount_refunded`) : idempotent, un
 * événement rejoué ou un second remboursement partiel remplace la valeur. Retrouve la facture par son identifiant
 * (anciennes versions de l'API : `charge.invoice`) ou par le paiement (`payment_intent`). Sans effet si le paiement
 * n'est pas celui d'un client apporté.
 */
export async function recordPartnerRefund(input: {
  invoiceId?: string | null;
  paymentIntentId?: string | null;
  amountRefundedCents: number;
  now?: Date;
}): Promise<PartnerPaymentDoc | null> {
  let doc: PartnerPaymentDoc | null = null;
  if (input.invoiceId && INVOICE_RE.test(input.invoiceId)) doc = (await getDoc<PartnerPaymentDoc>(PAYMENTS_COLLECTION, input.invoiceId))?.data ?? null;
  if (!doc && input.paymentIntentId) doc = (await listPartnerPayments()).find((p) => p.paymentIntentId === input.paymentIntentId) ?? null;
  if (!doc) return null;
  const now = input.now ?? new Date();
  const refundedCents = Math.min(doc.amountPaidCents, Math.max(0, Math.round(input.amountRefundedCents || 0)));
  const next: PartnerPaymentDoc = { ...doc, refundedCents, refundedExclTaxCents: refundExclTax(doc, refundedCents), refundedAt: now.toISOString() };
  await putDoc(PAYMENTS_COLLECTION, doc.invoiceId, next, doc.businessId);
  return next;
}

export async function listPartnerPayments(limit = 20_000): Promise<PartnerPaymentDoc[]> {
  const docs = await listDocs<PartnerPaymentDoc>(PAYMENTS_COLLECTION, { limit });
  return docs.map((d) => d.data).filter((p): p is PartnerPaymentDoc => !!p && typeof p.partnerCode === 'string');
}
