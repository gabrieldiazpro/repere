/**
 * Tâche de fond « barometre.run » (src/lib/jobs). Le type doit être ajouté à JOB_TYPES (src/lib/jobs/types.ts,
 * hors périmètre : voir docs/v5/demandes-BAROMETRE.md) ; d'ici là, `registerBarometreJob` ne fait rien et la passe
 * mensuelle se lance avec scripts/barometre/run.ts.
 * Idempotent : la collecte reprend là où elle s'est arrêtée (document `slug:AAAA-MM`).
 */
import { isJobType, registerHandler } from '../jobs';
import type { JobType } from '../jobs';
import { runMonthly } from './pipeline';

export const BAROMETRE_JOB = 'barometre.run';

export async function barometreJobHandler(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const slugs = Array.isArray(payload.slugs) ? payload.slugs.filter((s): s is string => typeof s === 'string') : undefined;
  const period = typeof payload.period === 'string' && /^\d{4}-\d{2}$/.test(payload.period) ? payload.period : undefined;
  const job = payload._job as { signal?: AbortSignal } | undefined;
  // Jamais de simulation depuis la file : une tâche planifiée ne mesure que du réel.
  const r = await runMonthly({ slugs, period, signal: job?.signal, demo: false });
  return {
    period: r.period,
    spentEur: r.spentEur,
    done: r.results.filter((x) => x.status === 'collected').map((x) => x.slug),
    incomplete: r.results.filter((x) => x.status !== 'collected').map((x) => x.slug),
    skippedForBudget: r.skippedForBudget,
  };
}

/** Enregistre le gestionnaire si le type existe dans la file ; renvoie true si c'est fait. */
export function registerBarometreJob(): boolean {
  if (!isJobType(BAROMETRE_JOB)) return false;
  registerHandler(BAROMETRE_JOB as JobType, barometreJobHandler);
  return true;
}
