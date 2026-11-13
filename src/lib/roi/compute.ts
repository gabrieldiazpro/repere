/**
 * Calculs purs du tableau de ROI des sources payantes (/admin/roi) : revenu mensuel récurrent d'une offre, coût
 * incrémental des liens entrants, ratio revenu / coût et règle d'arrêt. Testés dans __tests__/compute.test.ts.
 */
import { getPlan, isPlanId } from '@/lib/plans';

/** Revenu mensuel récurrent d'une offre, en centimes : mensuel = prix, annuel = prix / 12, paiement unique = 0. */
export function monthlyRecurringCents(planId: string | null | undefined): number {
  if (!planId || !isPlanId(planId)) return 0;
  const p = getPlan(planId);
  if (p.interval === 'month') return p.priceCents;
  if (p.interval === 'year') return Math.round(p.priceCents / 12);
  return 0;
}

/** Ratio revenu / coût ; null si le coût est nul (rien à rapporter, pas de division). */
export function roiRatio(revenueEur: number, costEur: number): number | null {
  if (!Number.isFinite(costEur) || costEur <= 0) return null;
  return Math.round((Math.max(0, revenueEur) / costEur) * 100) / 100;
}

/**
 * Coût que les liens entrants AJOUTENT sur la facture DataForSEO du mois, en dollars.
 * L'engagement Backlinks (100 $) est un minimum de dépense mensuelle consommable par toutes les API DataForSEO :
 * sans liens, on paierait `otherUsd` à l'appel ; avec, max(engagement, otherUsd + backlinksUsd).
 */
export function backlinksIncrementalUsd(otherUsd: number, backlinksUsd: number, fixedUsd: number): number {
  const o = Math.max(0, otherUsd);
  const b = Math.max(0, backlinksUsd);
  return Math.round((Math.max(Math.max(0, fixedUsd), o + b) - o) * 100) / 100;
}

/** Nombre d'abonnés à `priceEur`/mois qu'il faut pour couvrir `costEur`/mois (seuil de rentabilité). */
export function breakEvenSubscribers(costEur: number, priceEur: number): number {
  if (costEur <= 0) return 0;
  if (priceEur <= 0) return Infinity;
  return Math.ceil(costEur / priceEur - 1e-9);
}

export const STOP_AFTER_MONTHS = 3;
export const STOP_RULE_TEXT = 'Si le ratio reste < 1 après 3 mois, couper.';

export interface MonthPoint {
  /** AAAA-MM */
  month: string;
  revenueEur: number;
  costEur: number;
}

export type StopStatus = 'inactive' | 'evaluation' | 'continuer' | 'couper' | 'donnees-insuffisantes';

export interface StopDecision {
  status: StopStatus;
  /** AAAA-MM-JJ */
  startDate: string | null;
  /** date à partir de laquelle la règle s'applique (démarrage + 3 mois) */
  decisionDate: string | null;
  /** ratio cumulé sur les 3 derniers mois relevés (revenu / coût) */
  ratio3m: number | null;
  /** mois relevés pris en compte */
  months: string[];
  message: string;
}

function addMonths(isoDay: string, n: number): string {
  const d = new Date(`${isoDay}T00:00:00Z`);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.toISOString().slice(0, 10);
}

const frDay = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/**
 * Règle d'arrêt : « si le ratio reste < 1 après 3 mois, couper ». Avant la date de décision : évaluation en cours.
 * Après : ratio cumulé (revenu total / coût total) des 3 derniers mois relevés depuis le démarrage ; < 1 → couper.
 * Moins de 3 mois relevés après la date de décision : données insuffisantes (on ne tranche pas sans mesure).
 */
export function stopDecision(input: { startDate: string | null; points: MonthPoint[]; now?: Date }): StopDecision {
  const now = input.now ?? new Date();
  if (!input.startDate) {
    return { status: 'inactive', startDate: null, decisionDate: null, ratio3m: null, months: [], message: 'Source non démarrée : aucune dépense relevée.' };
  }
  const start = input.startDate;
  const decisionDate = addMonths(start, STOP_AFTER_MONTHS);
  const startMonth = start.slice(0, 7);
  const pts = input.points.filter((p) => p.month >= startMonth).sort((a, b) => a.month.localeCompare(b.month)).slice(-STOP_AFTER_MONTHS);
  const rev = pts.reduce((a, p) => a + p.revenueEur, 0);
  const cost = pts.reduce((a, p) => a + p.costEur, 0);
  const ratio3m = roiRatio(rev, cost);
  const months = pts.map((p) => p.month);
  if (now.toISOString().slice(0, 10) < decisionDate) {
    return { status: 'evaluation', startDate: start, decisionDate, ratio3m, months, message: `Évaluation en cours : décision le ${frDay(decisionDate)}.` };
  }
  if (pts.length < STOP_AFTER_MONTHS) {
    return { status: 'donnees-insuffisantes', startDate: start, decisionDate, ratio3m, months, message: `Seulement ${pts.length} mois relevé${pts.length > 1 ? 's' : ''} sur 3 : ouvrez ce tableau chaque mois (ou laissez le cron quotidien le relever).` };
  }
  if (ratio3m === null) {
    return { status: 'continuer', startDate: start, decisionDate, ratio3m, months, message: 'Aucun coût relevé sur les 3 derniers mois.' };
  }
  if (ratio3m < 1) {
    return { status: 'couper', startDate: start, decisionDate, ratio3m, months, message: `Ratio ${ratio3m.toFixed(2).replace('.', ',')} < 1 sur les 3 derniers mois : couper la source.` };
  }
  return { status: 'continuer', startDate: start, decisionDate, ratio3m, months, message: `Ratio ${ratio3m.toFixed(2).replace('.', ',')} ≥ 1 sur les 3 derniers mois : garder.` };
}
