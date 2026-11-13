/**
 * Baromètres publics Repéré (V5) : « Qui les IA recommandent » par métier × ville (local) ou par catégorie (PME,
 * e-commerce), mesurés chaque mois à partir de VRAIES réponses d'IA. Aucune donnée inventée n'est publiée :
 * une édition simulée (`demo: true`) n'est jamais écrite dans la collection publique ni servie en production.
 */
import type { ProviderId, RawSource } from '../engine/types';
import type { Segment, SourceCategory } from '../engine/types-v2';

/** Version de la méthode affichée sur les pages et dans le jeu de données. */
export const BAROMETRE_METHOD = 'repere-barometre-v1.0' as const;

/** Définition d'un baromètre du catalogue. */
export interface BarometreDef {
  /** identifiant d'URL stable : « plombiers-lyon », « logiciels-de-paie-pme » */
  slug: string;
  segment: Segment;
  /** titre court : « Plombiers à Lyon » */
  title: string;
  /** sujet au pluriel, pour les phrases : « plombiers », « logiciels de paie pour PME » */
  subject: string;
  /** local : métier (clé ou libellé du dictionnaire TRADES du moteur) */
  trade?: string;
  /** local : ville */
  city?: string;
  /** PME : catégorie d'offre (« logiciel de paie ») */
  category?: string;
  /** e-commerce : catégorie de produits (« cosmétiques solides ») */
  productCategory?: string;
  /** questions imposées (8 à 20) ; sinon gabarits du moteur */
  questions?: string[];
  /** nombre de questions générées par gabarits (8 à 20, défaut 12) */
  questionCount?: number;
  /** passages par question et par IA (défaut 3) */
  runs?: number;
  /** IA interrogées (défaut : catalogue) */
  providers?: ProviderId[];
  /** ordre de passage quand le budget ne suffit pas pour tout (1 = d'abord) */
  priority?: number;
  /** false = en pause (non mesuré ce mois-ci) */
  active?: boolean;
  /** variantes de noms à fusionner, saisies à la main après vérification : { « Nom canonique » : [variantes] } */
  aliases?: Record<string, string[]>;
}

export interface BarometreQuestion {
  id: string;
  text: string;
  intent?: string;
}

/** Une réponse brute d'IA, gardée telle quelle (traçabilité, reprise après interruption). */
export interface RawAnswerRecord {
  key: string;
  provider: ProviderId;
  questionId: string;
  run: number;
  text: string;
  citations: string[];
  sources: RawSource[];
  model: string;
  demo: boolean;
  error?: string;
  at: string;
  costEur: number;
}

/** Collecte d'un baromètre pour un mois (document de reprise). */
export interface RawRun {
  slug: string;
  period: string;
  demo: boolean;
  startedAt: string;
  updatedAt: string;
  questions: BarometreQuestion[];
  providers: ProviderId[];
  runs: number;
  answers: Record<string, RawAnswerRecord>;
  spentEur: number;
  status: 'collecting' | 'collected' | 'stopped_budget';
  /** entreprises extraites par réponse (gardées pour ne pas repayer l'extraction à la reprise) */
  extractions?: Record<string, { companies: { name: string; position: number; domain?: string }[]; via: 'llm' | 'heuristic' }>;
}

/** Statistique d'une entreprise citée (une ligne du classement). */
export interface CompanyStat {
  /** identifiant stable entre les mois (slug du nom canonique normalisé) */
  id: string;
  /** nom affiché : orthographe la plus fréquente dans les réponses */
  name: string;
  /** orthographes fusionnées (vues dans les réponses) */
  variants: string[];
  /** site public associé quand une IA l'a cité à côté du nom */
  domain?: string;
  /** réponses (valides) qui citent l'entreprise */
  citedAnswers: number;
  /** taux de citation : part des réponses valides qui la citent, avec intervalle à 90 % */
  rate: number;
  rateLow: number;
  rateHigh: number;
  /** part de voix : part de toutes les citations d'entreprises, avec intervalle à 90 % */
  sov: number;
  sovLow: number;
  sovHigh: number;
  /** IA (sur le nombre de réponses valides de chaque IA) */
  byProvider: Partial<Record<ProviderId, { cited: number; answers: number }>>;
  /** questions distinctes où elle apparaît */
  questions: number;
  /** position moyenne dans les listes (1 = citée en premier) */
  avgPosition: number | null;
  /** rang dans le classement (1 = la plus citée) */
  rank: number;
  /** intervalle chevauchant celui de la ligne précédente : écart non significatif */
  tiedWithPrevious: boolean;
  /** évolution par rapport à l'édition précédente publiée */
  change?: { kind: 'new' } | { kind: 'delta'; previousRate: number; deltaPts: number; significant: boolean };
}

export interface SourceStat {
  domain: string;
  label: string;
  category: SourceCategory;
  /** nombre de citations (URL distinctes par réponse) */
  citations: number;
  /** réponses qui citent ce domaine */
  answers: number;
  /** part des réponses avec sources qui citent ce domaine */
  answerShare: number;
  providers: ProviderId[];
  sampleUrls: string[];
}

export interface BarometreEdition {
  slug: string;
  /** mois mesuré, « AAAA-MM » */
  period: string;
  /** 1 à la première agrégation du mois, +1 à chaque recalcul (versionnage) */
  version: number;
  def: Pick<BarometreDef, 'slug' | 'segment' | 'title' | 'subject' | 'trade' | 'city' | 'category' | 'productCategory'>;
  /** true = réponses simulées : JAMAIS publié */
  demo: boolean;
  status: 'complete' | 'incomplete';
  measuredFrom: string;
  measuredTo: string;
  aggregatedAt: string;
  methodVersion: typeof BAROMETRE_METHOD;
  providers: ProviderId[];
  models: Partial<Record<ProviderId, string>>;
  questions: BarometreQuestion[];
  runs: number;
  answersPlanned: number;
  answersValid: number;
  answersError: number;
  /** réponses qui recommandent au moins une entreprise */
  answersWithRecommendation: number;
  /** réponses (hors Gemini, conditions d'utilisation) dont les sources sont analysées */
  answersWithSources: number;
  ranking: CompanyStat[];
  /** noms vus mais non publiés faute de vérification (une seule IA, une seule réponse, aucun site) */
  unverifiedCount: number;
  /** noms retirés à la demande des entreprises (procédure de retrait) */
  withdrawnCount: number;
  sources: SourceStat[];
  evolution?: { previousPeriod: string; entered: string[]; exited: string[] };
  costEur: number;
}

/** Résumé pour l'index et l'API de liste. */
export interface EditionSummary {
  slug: string;
  title: string;
  segment: Segment;
  period: string;
  measuredTo: string;
  answersValid: number;
  providers: ProviderId[];
  top: { name: string; rate: number }[];
}
