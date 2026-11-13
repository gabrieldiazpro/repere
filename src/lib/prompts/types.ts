/**
 * Questions suivies (agent QUESTIONS, docs/v3/12-CONTRATS-V3.md).
 * Une « question » (prompt) est ce que l'on pose aux IA à chaque mesure, pour un commerce donné.
 */
import type { ProviderId, QueryAngle } from '@/lib/engine/types';

/** Intention de la question (taxonomie Repéré, en français, reliée aux angles du moteur). */
export type PromptIntent =
  | 'recommandation'
  | 'proximite'
  | 'urgence'
  | 'service'
  | 'avis'
  | 'comparatif'
  | 'alternative'
  | 'prix'
  | 'achat'
  | 'marque';

export const PROMPT_INTENTS: readonly PromptIntent[] = [
  'recommandation',
  'proximite',
  'urgence',
  'service',
  'avis',
  'comparatif',
  'alternative',
  'prix',
  'achat',
  'marque',
];

export const INTENT_LABEL: Record<PromptIntent, string> = {
  recommandation: 'Recommandation',
  proximite: 'Proximité',
  urgence: 'Urgence',
  service: 'Service précis',
  avis: 'Avis',
  comparatif: 'Comparatif',
  alternative: 'Alternative',
  prix: 'Prix',
  achat: 'Où acheter',
  marque: 'Votre marque',
};

/** Étape du parcours d'achat (dérivée de l'intention). */
export type PromptStage = 'decouverte' | 'consideration' | 'decision';

export const INTENT_STAGE: Record<PromptIntent, PromptStage> = {
  recommandation: 'decouverte',
  proximite: 'decouverte',
  urgence: 'decouverte',
  service: 'decouverte',
  avis: 'consideration',
  comparatif: 'consideration',
  alternative: 'consideration',
  prix: 'decision',
  achat: 'decision',
  marque: 'decision',
};

/** Origine : gabarit du moteur (audit), suggestion acceptée, ou saisie du client. */
export type PromptOrigin = 'gabarit' | 'suggestion' | 'client';

export interface TrackedPrompt {
  id: string;
  businessId: string;
  text: string;
  /** sujet libre (« Urgences », « Prix »…) ; défaut : libellé de l'intention */
  theme: string;
  tags: string[];
  intent: PromptIntent;
  origin: PromptOrigin;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
  /** identifiant de requête du moteur quand la question vient d'un gabarit (« T1-fd2c ») */
  queryId?: string;
  /** IA à interroger (vide = toutes celles de l'offre) */
  providers?: ProviderId[];
}

export type DemandLevel = 'faible' | 'moyen' | 'fort';

/** Indice de demande : jamais un volume chiffré, toujours étiqueté « estimation ». */
export interface DemandIndex {
  level: DemandLevel;
  label: 'estimation';
  /** signaux déclarés ayant conduit au niveau (méthode : src/lib/prompts/METHODE.md) */
  signals: string[];
}

/** Question telle que renvoyée par l'API (avec ses champs dérivés). */
export interface PromptView extends TrackedPrompt {
  intentLabel: string;
  stage: PromptStage;
  demand: DemandIndex;
  demo?: boolean;
}

export type SuggestionSource = 'site' | 'offre' | 'secteur' | 'concurrents';

export interface PromptSuggestion {
  text: string;
  intent: PromptIntent;
  intentLabel: string;
  stage: PromptStage;
  theme: string;
  tags: string[];
  source: SuggestionSource;
  /** pourquoi on la propose, en une phrase */
  why: string;
  demand: DemandIndex;
  label: 'suggestion';
  queryId?: string;
}

export interface PromptInput {
  text: string;
  theme?: string;
  tags?: string[];
  intent?: PromptIntent;
  origin?: PromptOrigin;
  active?: boolean;
  queryId?: string;
  providers?: ProviderId[];
}

export type PromptPatch = Partial<Pick<TrackedPrompt, 'text' | 'theme' | 'tags' | 'intent' | 'active' | 'providers'>>;

export const PROMPT_ANGLE: Record<PromptIntent, QueryAngle> = {
  recommandation: 'best',
  proximite: 'nearby',
  urgence: 'urgent',
  service: 'specific',
  avis: 'review',
  comparatif: 'comparison',
  alternative: 'alternative',
  prix: 'price',
  achat: 'where_to_buy',
  marque: 'brand_opinion',
};

export const ANGLE_PROMPT_INTENT: Record<QueryAngle, PromptIntent> = {
  best: 'recommandation',
  which_company: 'recommandation',
  french_brand: 'recommandation',
  nearby: 'proximite',
  urgent: 'urgence',
  specific: 'service',
  alternative: 'alternative',
  where_to_buy: 'achat',
  price: 'prix',
  review: 'avis',
  comparison: 'comparatif',
  brand_opinion: 'marque',
  brand_trust: 'marque',
  brand_facts: 'marque',
};
