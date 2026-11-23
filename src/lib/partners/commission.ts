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
 * - remboursements : NON déduits automatiquement (le webhook ne les enregistre pas) → à vérifier avant tout versement ;
 * - versements : saisis à la main dans l'admin ; dû = acquis − versé (jamais négatif). Aucun paiement automatique.
 */
import type { CommissionTerms } from './program';

export interface PaymentRow {
  invoiceId: string;
  businessId: string;
  partnerCode: string;
  amountPaidCents: number;
  /** Montant hors taxes (Stripe total_excluding_tax, borné au montant payé). */
  amountExclTaxCents: number;
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
      const base = Math.max(0, Math.min(p.amountExclTaxCents, p.amountPaidCents));
      let reason: string | null = null;
      if (!input.terms) reason = 'Pas de commission prévue pour ce partenaire.';
      else if (p.currency.toLowerCase() !== 'eur') reason = `Devise ${p.currency.toUpperCase()} : non comptée.`;
      else if (pdom && domainOfEmail(input.contactEmails?.[p.businessId]) === pdom) reason = 'Client sur le domaine du partenaire : auto-parrainage probable, à vérifier.';
      else if (!inAccepted(t)) reason = 'Paiement reçu hors période d’acceptation du partenaire.';
      else if (t >= MONTH_ADD(firstPaid.get(p.businessId) ?? p.paidAt, input.terms.months)) reason = `Au-delà des ${input.terms.months} mois suivant le premier paiement.`;
      else if (base <= 0) reason = 'Montant nul.';
      const eligible = reason === null;
      return { ...p, eligible, reason, commissionCents: eligible && input.terms ? Math.round(base * input.terms.rate) : 0 };
    });

  const earnedCents = lines.reduce((s, l) => s + l.commissionCents, 0);
  const paidOutCents = input.payouts.reduce((s, p) => s + (Number.isFinite(p.cents) ? p.cents : 0), 0);
  return {
    lines,
    baseCents: lines.filter((l) => l.eligible).reduce((s, l) => s + Math.max(0, Math.min(l.amountExclTaxCents, l.amountPaidCents)), 0),
    earnedCents,
    paidOutCents,
    dueCents: Math.max(0, earnedCents - paidOutCents),
    payingClients: firstPaid.size,
  };
}

export const eur = (cents: number) =>
  (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
