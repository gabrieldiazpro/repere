/**
 * Suivi par partenaire (admin) : analyses et audits venus de son lien, espaces créés (inscriptions), offre actuelle de
 * ces espaces, paiements Stripe enregistrés et commission (src/lib/partners/commission.ts). Serveur uniquement.
 * Tout vient des données enregistrées : aucune estimation.
 */
import { getBusinessRecord } from '@/lib/db';
import { listAttributions, partnerCodeOf, type AttributionRecord } from '@/lib/roi/attribution';
import { computeCommission, type CommissionSummary } from './commission';
import { listPartnerPayments, type PartnerPaymentDoc } from './payments';
import type { PartnerRow } from './store';

export interface AttributedBusiness {
  businessId: string;
  name: string | null;
  plan: string | null;
  planId: string | null;
  contactEmail: string | null;
  signedUpAt: string;
}

export interface PartnerTracking {
  code: string;
  analyses: number;
  audits: number;
  signups: AttributedBusiness[];
  /** Espaces apportés avec une offre payante en cours */
  subscribed: number;
  commission: CommissionSummary;
}

/** Regroupe les origines par code partenaire (pur). */
export function groupByCode(records: AttributionRecord[]): Map<string, AttributionRecord[]> {
  const m = new Map<string, AttributionRecord[]>();
  for (const r of records) {
    const c = partnerCodeOf(r.attribution);
    if (!c) continue;
    const list = m.get(c) ?? [];
    list.push(r);
    m.set(c, list);
  }
  return m;
}

/** Codes vus dans les origines mais attribués à aucun partenaire (liens mal saisis, partenaire supprimé…). Pur. */
export function orphanCodes(byCode: Map<string, AttributionRecord[]>, partners: Pick<PartnerRow, 'code'>[]): { code: string; count: number }[] {
  const known = new Set(partners.map((p) => p.code).filter(Boolean));
  return [...byCode.entries()].filter(([c]) => !known.has(c)).map(([code, list]) => ({ code, count: list.length })).sort((a, b) => b.count - a.count);
}

export async function loadTrackingInputs(): Promise<{ byCode: Map<string, AttributionRecord[]>; payments: PartnerPaymentDoc[] }> {
  const [attrs, payments] = await Promise.all([listAttributions().catch(() => []), listPartnerPayments().catch(() => [])]);
  return { byCode: groupByCode(attrs), payments };
}

export async function trackPartner(p: PartnerRow, inputs: { byCode: Map<string, AttributionRecord[]>; payments: PartnerPaymentDoc[] }, now: Date = new Date()): Promise<PartnerTracking | null> {
  if (!p.code) return null;
  const recs = inputs.byCode.get(p.code) ?? [];
  const signupRecs = recs.filter((r) => r.kind === 'business');
  const signups: AttributedBusiness[] = await Promise.all(
    signupRecs.map(async (r) => {
      const b = await getBusinessRecord(r.id).catch(() => null);
      return {
        businessId: r.id,
        name: b ? (b.needsSetup ? null : b.name) : null,
        plan: b?.plan ?? null,
        planId: b?.planId ?? null,
        contactEmail: b?.contactEmail ?? null,
        signedUpAt: r.at,
      };
    }),
  );
  signups.sort((a, b) => b.signedUpAt.localeCompare(a.signedUpAt));
  const payments = inputs.payments.filter((x) => x.partnerCode === p.code);
  const contactEmails: Record<string, string | null> = {};
  for (const s of signups) contactEmails[s.businessId] = s.contactEmail;
  for (const pay of payments) {
    if (!(pay.businessId in contactEmails)) contactEmails[pay.businessId] = (await getBusinessRecord(pay.businessId).catch(() => null))?.contactEmail ?? null;
  }
  return {
    code: p.code,
    analyses: recs.filter((r) => r.kind === 'analysis').length,
    audits: recs.filter((r) => r.kind === 'audit').length,
    signups,
    subscribed: signups.filter((s) => s.plan && s.plan !== 'free').length,
    commission: computeCommission({
      terms: p.commission,
      history: p.statusHistory,
      payments,
      payouts: p.payouts ?? [],
      partnerDomain: p.domain,
      contactEmails,
      now,
    }),
  };
}
