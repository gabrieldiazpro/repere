/**
 * Calcul de la commission d'un partenaire. Pur, testé.
 *
 * Règles (proposition à valider par le fondateur, docs/v9/progress/PARTENAIRES.md) :
 * - base : montant HT des factures Stripe PAYÉES enregistrées par le webhook (collection `partners.payments`) ;
 *   rien n'est estimé, une facture non reçue n'existe pas ;
 * - fenêtre : `months` mois à compter du PREMIER paiement enregistré du client apporté ;
 * - seulement les paiements reçus pendant que le partenaire est accepté (pas avant l'acceptation, pas pendant une
 *   suspension) ;
 * - écartés : autre devise que l'euro, client dont l'e-mail est sur le domaine du partenaire (auto-parrainage
 *   probable : à vérifier à la main) ;
 * - remboursements : DÉDUITS (V10, décision 8) : le webhook Stripe `charge.refunded` enregistre le montant remboursé
 *   de la facture (`refundedExclTaxCents`, au prorata HT) ; la base devient HT payé − HT remboursé ;
 * - versements : trimestriels, sur facture, saisis à la main dans l'admin ; dû = acquis − versé (jamais négatif) ; un
 *   remboursement postérieur à un versement donne un trop-versé (`clawbackCents`) à déduire du versement suivant.
 */
import type { CommissionTerms } from './program';
import { quarterOf } from './terms';

export interface PaymentRow {
  invoiceId: string;
  businessId: string;
  partnerCode: string;
  amountPaidCents: number;
  /** Montant hors taxes (Stripe total_excluding_tax, borné au montant payé). */
  amountExclTaxCents: number;
  /** V10 : montant remboursé (TTC, cumul Stripe `amount_refunded`) et sa part hors taxes */
  refundedCents?: number;
  refundedExclTaxCents?: number;
  currency: string;
  paidAt: string;
}

export interface StatusEvent {
  at: string;
  status: string;
}

export interface CommissionLine extends PaymentRow {
  eligible: boolean;
  reason: string | null;
  commissionCents: number;
}

export interface CommissionSummary {
  lines: CommissionLine[];
  /** Somme HT des paiements retenus */
  baseCents: number;
  earnedCents: number;
  paidOutCents: number;
  dueCents: number;
  /** V10 : commission déjà versée au-delà de l'acquis (remboursement après versement), à déduire du prochain versement */
  clawbackCents: number;
  /** V10 : total HT remboursé sur les paiements des clients apportés */
  refundedExclTaxCents: number;
  /** V10 : commission acquise par trimestre civil (« 2026-T4 » → centimes), pour le versement trimestriel */
  byQuarter: Record<string, number>;
  /** Nombre de clients apportés ayant payé au moins une fois */
  payingClients: number;
}

const MONTH_ADD = (iso: string, months: number): number => {
  const d = new Date(iso);
  const out = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()));
  return out.getTime();
};

/** Intervalles [début, fin) pendant lesquels le partenaire était « accepte » (d'après l'historique de statut). */
export function acceptedWindows(history: StatusEvent[], now: Date = new Date()): [number, number][] {
  const sorted = [...history].sort((a, b) => a.at.localeCompare(b.at));
  const out: [number, number][] = [];
  let start: number | null = null;
  for (const h of sorted) {
    const t = Date.parse(h.at);
    if (!Number.isFinite(t)) continue;
    if (h.status === 'accepte' && start === null) start = t;
    else if (h.status !== 'accepte' && start !== null) {
      out.push([start, t]);
      start = null;
    }
  }
  if (start !== null) out.push([start, now.getTime() + 1]);
  return out;
}

const domainOfEmail = (e: string | null | undefined) => (e && e.includes('@') ? e.split('@')[1].toLowerCase().replace(/^www\./, '') : '');

export function computeCommission(input: {
  terms: CommissionTerms | null;
  history: StatusEvent[];
  payments: PaymentRow[];
  payouts: { cents: number }[];
  /** domaine du partenaire (site) */
  partnerDomain?: string | null;
  /** e-mail de contact de chaque espace apporté (businessId → e-mail), pour repérer l'auto-parrainage */
  contactEmails?: Record<string, string | null | undefined>;
  now?: Date;
}): CommissionSummary {
  const now = input.now ?? new Date();
  const windows = acceptedWindows(input.history, now);
  const inAccepted = (t: number) => windows.some(([a, b]) => t >= a && t < b);
  const pdom = (input.partnerDomain ?? '').toLowerCase().replace(/^www\./, '');

  const firstPaid = new Map<string, string>();
  for (const p of [...input.payments].sort((a, b) => a.paidAt.localeCompare(b.paidAt))) {
    if (!firstPaid.has(p.businessId)) firstPaid.set(p.businessId, p.paidAt);
  }

  const lines: CommissionLine[] = [...input.payments]
    .sort((a, b) => b.paidAt.localeCompare(a.paidAt))
    .map((p) => {
      const t = Date.parse(p.paidAt);
      const base = netBase(p);
      let reason: string | null = null;
      if (!input.terms) reason = 'Pas de commission prévue pour ce partenaire.';
      else if (p.currency.toLowerCase() !== 'eur') reason = `Devise ${p.currency.toUpperCase()} : non comptée.`;
      else if (pdom && domainOfEmail(input.contactEmails?.[p.businessId]) === pdom) reason = 'Client sur le domaine du partenaire : auto-parrainage probable, à vérifier.';
      else if (!inAccepted(t)) reason = 'Paiement reçu hors période d’acceptation du partenaire.';
      else if (t >= MONTH_ADD(firstPaid.get(p.businessId) ?? p.paidAt, input.terms.months)) reason = `Au-delà des ${input.terms.months} mois suivant le premier paiement.`;
      else if (base <= 0) reason = (p.refundedExclTaxCents ?? 0) > 0 ? 'Remboursé intégralement.' : 'Montant nul.';
      const eligible = reason === null;
      return { ...p, eligible, reason, commissionCents: eligible && input.terms ? Math.round(base * input.terms.rate) : 0 };
    });

  const earnedCents = lines.reduce((s, l) => s + l.commissionCents, 0);
  const paidOutCents = input.payouts.reduce((s, p) => s + (Number.isFinite(p.cents) ? p.cents : 0), 0);
  const byQuarter: Record<string, number> = {};
  for (const l of lines) if (l.commissionCents > 0) byQuarter[quarterOf(l.paidAt)] = (byQuarter[quarterOf(l.paidAt)] ?? 0) + l.commissionCents;
  return {
    lines,
    baseCents: lines.filter((l) => l.eligible).reduce((s, l) => s + netBase(l), 0),
    earnedCents,
    paidOutCents,
    dueCents: Math.max(0, earnedCents - paidOutCents),
    clawbackCents: Math.max(0, paidOutCents - earnedCents),
    refundedExclTaxCents: lines.reduce((s, l) => s + Math.max(0, l.refundedExclTaxCents ?? 0), 0),
    byQuarter,
    payingClients: firstPaid.size,
  };
}

/** Base HT d'un paiement, remboursements déduits (jamais négative). */
export function netBase(p: Pick<PaymentRow, 'amountExclTaxCents' | 'amountPaidCents' | 'refundedExclTaxCents'>): number {
  const ht = Math.max(0, Math.min(p.amountExclTaxCents, p.amountPaidCents));
  return Math.max(0, ht - Math.max(0, Math.round(p.refundedExclTaxCents ?? 0)));
}

export const eur = (cents: number) =>
  (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
