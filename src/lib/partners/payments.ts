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
  };
  await putDoc(PAYMENTS_COLLECTION, input.invoiceId, doc, input.businessId);
  return doc;
}

export async function listPartnerPayments(limit = 20_000): Promise<PartnerPaymentDoc[]> {
  const docs = await listDocs<PartnerPaymentDoc>(PAYMENTS_COLLECTION, { limit });
  return docs.map((d) => d.data).filter((p): p is PartnerPaymentDoc => !!p && typeof p.partnerCode === 'string');
}
