/**
 * Limites SEO-DATA par offre et plafond de coût mensuel par compte (docs/v5/donnees-seo.md § 4).
 *
 * PROPOSITION à reporter dans src/lib/entitlements.ts par l'orchestrateur (champ `seoData`) : tant que ce n'est pas
 * fait, ce module lit le niveau (`tier`) des droits existants et applique la table ci-dessous.
 * Tarifs fournisseurs (dollars US, pages officielles du 13 nov. 2026) dans `PRICES_USD`.
 */
import type { Entitlements } from '@/lib/entitlements';
import type { Device } from './types';

export interface SeoDataLimits {
  /** mots-clés suivis (positions) */
  keywords: number;
  /** appareils relevés */
  devices: Device[];
  /** profondeur de SERP relevée (10 ou 20) */
  depth: 10 | 20;
  /** relevé de l'aperçu IA (coûte un prix de base de plus par mot-clé) */
  aiOverview: boolean;
  /** liens entrants (Backlinks) */
  backlinks: boolean;
  /** mots-clés positionnés et concurrents (Labs) */
  labs: boolean;
  /** inspections d'URL Search Console par jour (quota Google : 2 000/jour/site) */
  inspectionsPerDay: number;
  /** plafond de dépense fournisseurs par mois et par compte, en euros (0 = aucun appel payant) */
  monthlyBudgetEur: number;
}

type TierKey = Entitlements['tier'] | 'essentiel_local';

export const SEODATA_LIMITS: Record<TierKey, SeoDataLimits> = {
  decouverte: { keywords: 0, devices: ['mobile'], depth: 10, aiOverview: false, backlinks: false, labs: false, inspectionsPerDay: 20, monthlyBudgetEur: 0 },
  essentiel_local: { keywords: 20, devices: ['mobile'], depth: 20, aiOverview: true, backlinks: false, labs: true, inspectionsPerDay: 50, monthlyBudgetEur: 1 },
  essentiel: { keywords: 100, devices: ['desktop'], depth: 20, aiOverview: true, backlinks: true, labs: true, inspectionsPerDay: 100, monthlyBudgetEur: 3 },
  accompagne: { keywords: 300, devices: ['mobile', 'desktop'], depth: 20, aiOverview: true, backlinks: true, labs: true, inspectionsPerDay: 100, monthlyBudgetEur: 10 },
  agence: { keywords: 2000, devices: ['desktop'], depth: 20, aiOverview: true, backlinks: true, labs: true, inspectionsPerDay: 200, monthlyBudgetEur: 40 },
  // Démo : données de démonstration, aucun appel payant.
  demo: { keywords: 50, devices: ['mobile', 'desktop'], depth: 20, aiOverview: true, backlinks: true, labs: true, inspectionsPerDay: 0, monthlyBudgetEur: 0 },
};

export function limitsFor(e: Pick<Entitlements, 'tier'>, segment?: string | null): SeoDataLimits {
  if (e.tier === 'essentiel' && (segment ?? 'local') === 'local') return { ...SEODATA_LIMITS.essentiel_local };
  return { ...SEODATA_LIMITS[e.tier] };
}

/** Prix officiels (USD) — docs/v5/donnees-seo.md § 2. */
export const PRICES_USD = {
  serpStandardPerPage: 0.0006,
  serpLivePerPage: 0.002,
  keywordsTaskStandard: 0.06,
  keywordsTaskLive: 0.09,
  labsPerRequest: 0.012,
  labsPerRow: 0.00012,
  backlinksPerRequest: 0.02,
  backlinksPerRow: 0.00003,
} as const;

/** Prix d'un relevé SERP : pages de 10 résultats, +1 prix de base pour l'aperçu IA. */
export function serpCostUsd(depth: number, aiOverview: boolean, mode: 'standard' | 'live'): number {
  const base = mode === 'live' ? PRICES_USD.serpLivePerPage : PRICES_USD.serpStandardPerPage;
  return base * (Math.ceil(Math.max(10, depth) / 10) + (aiOverview ? 1 : 0));
}

export function labsCostUsd(rows: number): number {
  return PRICES_USD.labsPerRequest + rows * PRICES_USD.labsPerRow;
}

export function backlinksCostUsd(rows: number): number {
  return PRICES_USD.backlinksPerRequest + rows * PRICES_USD.backlinksPerRow;
}

/** Taux de conversion d'estimation (les fournisseurs facturent en dollars). */
export function eurPerUsd(): number {
  const n = Number(process.env.SEODATA_EUR_PER_USD);
  return Number.isFinite(n) && n > 0 && n < 5 ? n : 0.92;
}

/** Coût mensuel estimé d'un compte (relevés hebdomadaires, volumes, Labs et liens une fois par mois), en euros. */
export function estimateMonthlyEur(l: SeoDataLimits): number {
  if (l.monthlyBudgetEur === 0) return 0;
  const serp = l.keywords * l.devices.length * 4.35 * serpCostUsd(l.depth, l.aiOverview, 'standard');
  const volumes = l.keywords > 0 ? Math.ceil(l.keywords / 1000) * PRICES_USD.keywordsTaskStandard : 0;
  const labs = l.labs ? labsCostUsd(1000) + labsCostUsd(20) : 0;
  const links = l.backlinks ? backlinksCostUsd(0) + backlinksCostUsd(100) * 2 + backlinksCostUsd(12) : 0;
  return Math.round((serp + volumes + labs + links) * eurPerUsd() * 100) / 100;
}
