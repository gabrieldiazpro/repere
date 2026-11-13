/**
 * Coûts et budget. Coût par appel = celui déclaré par chaque fournisseur du moteur (src/lib/engine/providers,
 * `costPerCallEur`, pire cas, USD × 0,92) ; recopié ici pour estimer sans clé, et vérifié par un test.
 */
import { USD_TO_EUR } from '../engine/providers/http';
import { createRealProvider, getExtractor } from '../engine/providers';
import type { ProviderId } from '../engine/types';
import { CATALOG, providersFor, questionsFor, runsFor } from './catalog';
import type { BarometreDef } from './types';

/** Coût d'un appel (euros) : openai.ts 0,014 $, perplexity.ts 0,007 $, gemini.ts 0,016 $, anthropic.ts 0,02 $, mistral.ts 0,033 $. */
export const COST_PER_CALL_EUR: Record<ProviderId, number> = {
  chatgpt: 0.014 * USD_TO_EUR,
  perplexity: 0.007 * USD_TO_EUR,
  gemini: 0.016 * USD_TO_EUR,
  claude: 0.02 * USD_TO_EUR,
  mistral: 0.033 * USD_TO_EUR,
};
/** Extraction des noms par réponse (extracteur le moins cher : openai.ts 0,0003 $ ; heuristique gratuite sinon). */
export const EXTRACT_COST_EUR = 0.0003 * USD_TO_EUR;

/** Coût réel si le fournisseur est configuré, sinon la table. */
export function costPerCall(id: ProviderId): number {
  return createRealProvider(id)?.costPerCallEur ?? COST_PER_CALL_EUR[id];
}
export function extractCost(): number {
  return getExtractor()?.costPerCallEur ?? EXTRACT_COST_EUR;
}

export interface CostEstimate {
  slug: string;
  questions: number;
  providers: ProviderId[];
  runs: number;
  calls: number;
  costEur: number;
}

export function estimateCost(def: BarometreDef, env: Record<string, string | undefined> = process.env): CostEstimate {
  const questions = questionsFor(def).length;
  const providers = providersFor(def, env);
  const runs = runsFor(def);
  const perRound = providers.reduce((a, p) => a + COST_PER_CALL_EUR[p] + EXTRACT_COST_EUR, 0);
  return { slug: def.slug, questions, providers, runs, calls: questions * runs * providers.length, costEur: round2(questions * runs * perRound) };
}

export function estimateMonthly(catalog: BarometreDef[] = CATALOG, env: Record<string, string | undefined> = process.env) {
  const items = catalog.filter((d) => d.active !== false).map((d) => estimateCost(d, env));
  return { count: items.length, calls: items.reduce((a, x) => a + x.calls, 0), costEur: round2(items.reduce((a, x) => a + x.costEur, 0)), items };
}

/** Budget mensuel (euros) : BAROMETRE_BUDGET_EUR, défaut 120 € (50 baromètres × 4 IA ≈ 96,50 €, plus les relances). */
export function monthlyBudget(env: Record<string, string | undefined> = process.env): number {
  const v = Number(env.BAROMETRE_BUDGET_EUR);
  return Number.isFinite(v) && v > 0 ? v : 120;
}

/** Baromètres retenus pour le mois, par priorité, tant que l'estimation tient dans le budget restant. */
export function planWithinBudget(catalog: BarometreDef[], remainingEur: number, env: Record<string, string | undefined> = process.env) {
  const sorted = catalog.filter((d) => d.active !== false).sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999));
  const selected: CostEstimate[] = [];
  const skipped: CostEstimate[] = [];
  let left = remainingEur;
  for (const d of sorted) {
    const e = estimateCost(d, env);
    if (e.costEur <= left + 1e-9) {
      selected.push(e);
      left -= e.costEur;
    } else skipped.push(e);
  }
  return { selected, skipped, leftEur: round2(left) };
}

export function round2(x: number): number {
  return Math.round(x * 100) / 100;
}
