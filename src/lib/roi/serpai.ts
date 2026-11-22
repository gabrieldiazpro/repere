/**
 * V8 FINALE — dépense DataForSEO des relevés d'IA (aperçus IA et AI Mode de Google, Copilot dans Bing), par mois.
 * Ces relevés passent par le moteur de mesure (src/lib/engine/providers/serp.ts) : leur coût est déjà compté dans
 * `details.estimatedCostEur` des audits (compteur OPS « Audits (IA) »), mais pas dans le registre `seodata.costs`.
 * Or ils consomment aussi l'engagement mensuel DataForSEO : /admin/roi les ajoute aux « autres appels » du calcul
 * de l'engagement Backlinks. Document `roi.serpai` / `<AAAA-MM>` : { microUsd }. Coûts DÉCLARÉS par nos appels
 * (tarifs publics), pas la facture.
 */
import { getDoc, incrDoc } from '@/lib/store';

export const SERP_AI = 'roi.serpai';

const monthOf = (d: Date) => d.toISOString().slice(0, 7);

/** Ajoute une dépense (dollars) au mois. Ne lève jamais. */
export async function recordSerpAiSpend(usd: number, now: Date = new Date()): Promise<void> {
  if (!Number.isFinite(usd) || usd <= 0) return;
  try {
    await incrDoc(SERP_AI, monthOf(now), { microUsd: Math.round(usd * 1_000_000) });
  } catch {
    /* mesure facultative */
  }
}

/** Dépense du mois, en dollars (0 si rien). */
export async function readSerpAiUsd(month: string): Promise<number> {
  try {
    const d = (await getDoc<{ microUsd?: number }>(SERP_AI, month))?.data;
    return Math.round((Number(d?.microUsd) || 0) / 10_000) / 100;
  } catch {
    return 0;
  }
}
