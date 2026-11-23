/**
 * Économie des offres (V10) : coût variable de la mesure des IA et marge brute par offre, calculés à partir de la table
 * des droits (src/lib/entitlements.ts) et de la grille (src/lib/plans.ts). Pur, testé
 * (src/lib/__tests__/decisions-v10.test.ts : marge brute ≥ 70 % pour Essentiel et Accompagné).
 *
 * Coûts par réponse (extraction des noms comprise) : docs/v8/economie-offres.md § 1, tarifs publics du 22 nov. 2026,
 * 1 $ = 0,92 € ; estimations prudentes (pire cas) à recaler sur les premières factures. Autres coûts variables :
 * plafond mensuel des données SEO de l'offre (src/lib/seodata/limits.ts) et frais Stripe (1,5 % + 0,25 €). Non comptés :
 * le travail humain d'Accompagné, l'hébergement, les e-mails, l'analyse gratuite (coût d'acquisition plafonné).
 */
import type { ProviderId } from '@/lib/engine/types';
import type { Entitlements } from '@/lib/entitlements';

export const COST_PER_ANSWER_EUR: Record<ProviderId, number> = {
  chatgpt: 0.0132,
  perplexity: 0.0067,
  gemini: 0.015,
  claude: 0.0187,
  mistral: 0.0306,
  deepseek: 0.0095,
  grok: 0.0325,
  google_aio: 0.004,
  google_ai_mode: 0.004,
  copilot: 0.0021,
};

/** Semaines par mois (mesures hebdomadaires). */
export const WEEKS_PER_MONTH = 4.33;

export const MEASURES_PER_MONTH: Record<Entitlements['frequency'], number> = { monthly: 1, weekly: WEEKS_PER_MONTH, daily: 30 };

export function stripeFeeEur(priceEur: number): number {
  return priceEur > 0 ? priceEur * 0.015 + 0.25 : 0;
}

/** Coût d'UNE mesure complète (questions × IA × passages), en euros. */
export function measureCostEur(e: Pick<Entitlements, 'prompts' | 'engines' | 'runs'>): number {
  const perQuestion = e.engines.reduce((s, p) => s + (COST_PER_ANSWER_EUR[p] ?? 0), 0);
  return e.prompts * e.runs * perQuestion;
}

/** Coût mensuel de la mesure des IA d'un espace. */
export function monthlyAiCostEur(e: Pick<Entitlements, 'prompts' | 'engines' | 'runs' | 'frequency'>): number {
  return measureCostEur(e) * MEASURES_PER_MONTH[e.frequency];
}

export interface Margin {
  priceEur: number;
  aiEur: number;
  otherEur: number;
  marginEur: number;
  /** 0,72 = 72 % */
  rate: number;
}

/** Marge brute mensuelle (hors travail humain) pour `spaces` espaces aux droits `e` facturés `priceEur` par mois. */
export function grossMargin(priceEur: number, e: Pick<Entitlements, 'prompts' | 'engines' | 'runs' | 'frequency' | 'seoData'>, spaces = 1, seoBudgetSpaces = spaces): Margin {
  const aiEur = monthlyAiCostEur(e) * spaces;
  const otherEur = e.seoData.monthlyBudgetEur * seoBudgetSpaces + stripeFeeEur(priceEur);
  const marginEur = priceEur - aiEur - otherEur;
  return { priceEur, aiEur, otherEur, marginEur, rate: priceEur > 0 ? marginEur / priceEur : 0 };
}

// ---------------------------------------------------------------------------
// V10 (PILOTE-AUTO) : coût variable du « Pilote automatique » (tout fait pour vous, sans rendez-vous). Estimations
// prudentes, à recaler sur les premières factures (docs/v10/progress/PILOTE-AUTO.md) :
// - une série de corrections : rédaction IA des textes (titres, descriptions, textes alternatifs ; ≈ 10 textes à
//   0,002 €) + relecture ciblée des pages après application ≈ 0,025 € ;
// - un contenu (page ou article) : rédaction IA + contrôles + relectures ≈ 0,15 € (pris large : « quelques centimes ») ;
// - e-mails : récapitulatif hebdomadaire, rapport mensuel, avis après coup ≈ 12 par mois à 0,001 € ;
// - support par écrit : provision de temps humain (≈ 6 à 10 min par mois et par client), le seul poste humain compté.
// ---------------------------------------------------------------------------

export const AUTOPILOT_COSTS_EUR = {
  perSeries: 0.025,
  perContent: 0.15,
  perEmail: 0.001,
  emailsPerMonth: 12,
  writtenSupport: { local: 3, pme: 5, ecommerce: 5 } as Record<'local' | 'pme' | 'ecommerce', number>,
} as const;

/** Coût mensuel du pilote automatique au plafond de l'offre (toutes les séries et tous les contenus consommés). */
export function autopilotMonthlyCostEur(e: Pick<Entitlements, 'publish' | 'contentsPerMonth'>, segment: 'local' | 'pme' | 'ecommerce'): number {
  const c = AUTOPILOT_COSTS_EUR;
  return e.publish.changeSetsPerMonth * c.perSeries + e.contentsPerMonth * c.perContent + c.emailsPerMonth * c.perEmail + c.writtenSupport[segment];
}

/** Marge brute du pilote automatique : mesure + données SEO + Stripe + coût du pilote (support écrit compris). */
export function autopilotMargin(priceEur: number, e: Pick<Entitlements, 'prompts' | 'engines' | 'runs' | 'frequency' | 'seoData' | 'publish' | 'contentsPerMonth'>, segment: 'local' | 'pme' | 'ecommerce'): Margin {
  const base = grossMargin(priceEur, e);
  const pilot = autopilotMonthlyCostEur(e, segment);
  const otherEur = base.otherEur + pilot;
  const marginEur = priceEur - base.aiEur - otherEur;
  return { priceEur, aiEur: base.aiEur, otherEur, marginEur, rate: priceEur > 0 ? marginEur / priceEur : 0 };
}
