/**
 * Effet mesuré d'une publication (pur, côté navigateur possible) : remesure de la page à J+7, taux de citation par
 * les IA avec marge d'erreur (IC 95 %, calcul de @/lib/measure.compareSnapshots fait côté serveur), repère sur la courbe.
 * Jamais de promesse : un écart dans la marge d'erreur est dit tel quel.
 */
import { fmtMargin, fmtPts } from '@/lib/text';
import type { Tone } from '@/components/ui/tone';

export type EffectVerdict = 'hausse' | 'baisse' | 'stable' | 'insuffisant';

export interface AgentEffect {
  csId: string;
  appliedAt: string;
  /** remesure programmée (J+7) */
  dueAt: string;
  status: 'scheduled' | 'done' | 'failed' | 'none';
  /** score déterministe de la page relue (sans marge d'erreur : même page, même calcul) */
  page?: { before: number | null; after: number | null; label: string };
  /** taux de citation sur les questions suivies, avant / après */
  ai?: {
    questions: number;
    provider?: string;
    before: { answers: number; mentioned: number };
    after: { answers: number; mentioned: number };
    result?: { delta: number; margin: number; verdict: EffectVerdict };
  };
  curve?: { values: number[]; marker: number; label: string };
  error?: string;
  demo?: boolean;
}

export const EFFECT_VERDICT: Record<EffectVerdict, { label: string; tone: Tone; sentence: string }> = {
  hausse: { label: 'En hausse', tone: 'up', sentence: 'Hausse au-delà de la marge d’erreur. C’est une corrélation : d’autres facteurs ont pu jouer.' },
  baisse: { label: 'En baisse', tone: 'down', sentence: 'Baisse au-delà de la marge d’erreur. Vous pouvez annuler la modification depuis le journal.' },
  stable: { label: 'Dans la marge d’erreur', tone: 'neutral', sentence: 'L’écart reste dans la marge d’erreur : on ne peut pas encore conclure. La mesure continue chaque semaine.' },
  insuffisant: { label: 'Pas assez de réponses', tone: 'neutral', sentence: 'Trop peu de réponses pour conclure. La mesure continue chaque semaine.' },
};

export const rate = (x: { answers: number; mentioned: number }) => (x.answers ? Math.round((x.mentioned / x.answers) * 100) : 0);

export function effectHeadline(e: AgentEffect): string {
  if (e.status === 'scheduled') return 'Remesure prévue';
  if (e.status === 'failed') return 'Remesure impossible';
  if (e.status === 'none') return 'Pas de mesure : modification annulée';
  const r = e.ai?.result;
  if (r) return `${fmtPts(r.delta)} de citations (marge ${fmtMargin(r.margin)})`;
  if (e.page && e.page.before !== null && e.page.after !== null) return `Page : ${e.page.before} → ${e.page.after} sur 100`;
  return 'Remesure faite';
}
