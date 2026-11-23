/**
 * Rythme de publication plafonné par offre — DÉCIDÉ en V10 (docs/v10/DECISIONS.md, décision 7) :
 * Découverte 0, Essentiel 2 / mois, Accompagné 6 / mois, Agence 6 / mois et par client (propositions et brouillons
 * visibles partout, publication réservée aux offres payantes). Objectif : rester loin de la production de masse (Google,
 * « scaled content abuse ») ; un contenu compte quand il est créé chez le client (brouillon distant) ou exporté.
 * Table de vérité : `CONTENTS_PER_MONTH` (src/lib/entitlements.ts).
 */
import { CONTENTS_PER_MONTH, type EntitlementTier } from '@/lib/entitlements';
import type { ContentDraft } from './types';

export const MONTHLY_QUOTA: Record<EntitlementTier, number> = CONTENTS_PER_MONTH;

export const QUOTA_NOTE = 'Plafond : Essentiel 2 contenus par mois, Accompagné 6, Agence 6 par client. Un rythme humain, relu et validé, plutôt qu’un volume.';

/** Contenus « consommés » ce mois-ci (créés chez le client ou exportés, même retirés ensuite). */
export function usedThisMonth(drafts: Pick<ContentDraft, 'consumedAt'>[], now: Date): number {
  const month = now.toISOString().slice(0, 7);
  return drafts.filter((d) => d.consumedAt?.slice(0, 7) === month).length;
}

export interface QuotaView {
  tier: EntitlementTier;
  limit: number;
  used: number;
  left: number;
  /** premier jour du mois suivant */
  resetsAt: string;
}

export function quotaView(tier: EntitlementTier, drafts: ContentDraft[], now: Date): QuotaView {
  const limit = MONTHLY_QUOTA[tier] ?? 0;
  const used = usedThisMonth(drafts, now);
  const reset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { tier, limit, used, left: Math.max(0, limit - used), resetsAt: reset.toISOString().slice(0, 10) };
}
