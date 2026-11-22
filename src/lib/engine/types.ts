/**
 * Types partagés du moteur d'audit (contrat 00-ARCHITECTURE.md + extension 00b-CONTRATS-MODULES.md).
 * Les champs marqués « optionnel » sont des ajouts additifs du moteur : ils ne cassent pas le contrat.
 */

import type { AuditInputV2, AuditResultV2Ext, BrandFactField, BrandFacts } from './types-v2';
import type { AuditResultV3Ext, CustomQuery } from './types-v3';

/** IA historiques (toujours présentes dans `subScores`). */
export type CoreProviderId = 'chatgpt' | 'perplexity' | 'gemini' | 'claude';
/**
 * IA en option, chacune derrière sa variable (désactivée si non configurée) :
 * - V3 : Mistral (assistant renommé « Vibe » le 28 mai 2026, ex-Le Chat), MISTRAL_API_KEY ;
 * - V8 : DeepSeek (DEEPSEEK_API_KEY), Grok (XAI_API_KEY), et via les résultats de recherche relevés par DataForSEO
 *   (DATAFORSEO_LOGIN/PASSWORD + AUDIT_SERP_ENGINES) : aperçus IA de Google (AI Overviews), Google AI Mode,
 *   Copilot dans la recherche Bing. Méthode de mesure de chaque IA : `PROVIDER_METHODS` (providers/methods.ts).
 */
export type ExtendedProviderId = 'deepseek' | 'google_aio' | 'google_ai_mode' | 'copilot' | 'grok';
export type ProviderId = CoreProviderId | 'mistral' | ExtendedProviderId;

export const CORE_PROVIDERS: CoreProviderId[] = ['chatgpt', 'perplexity', 'gemini', 'claude'];
/** V8 : IA ajoutées (ordre d'affichage). */
export const EXTENDED_PROVIDERS: ExtendedProviderId[] = ['google_aio', 'google_ai_mode', 'copilot', 'deepseek', 'grok'];
export const ALL_PROVIDERS: ProviderId[] = [...CORE_PROVIDERS, 'mistral', ...EXTENDED_PROVIDERS];

export function isProviderId(x: unknown): x is ProviderId {
  return typeof x === 'string' && (ALL_PROVIDERS as string[]).includes(x);
}

/** Libellés des IA (source unique dans le moteur). Noms en texte, jamais de logos officiels. */
export const PROVIDER_LABELS: Record<ProviderId, string> = {
  chatgpt: 'ChatGPT',
  perplexity: 'Perplexity',
  gemini: 'Gemini',
  claude: 'Claude',
  mistral: 'Mistral Vibe',
  google_aio: 'Google AI Overviews',
  google_ai_mode: 'Google AI Mode',
  copilot: 'Copilot (Bing)',
  deepseek: 'DeepSeek',
  grok: 'Grok',
};

/** Libellés courts (pastilles, colonnes étroites). */
export const PROVIDER_SHORT: Record<ProviderId, string> = {
  chatgpt: 'ChatGPT',
  perplexity: 'Perplexity',
  gemini: 'Gemini',
  claude: 'Claude',
  mistral: 'Mistral',
  google_aio: 'AI Overviews',
  google_ai_mode: 'AI Mode',
  copilot: 'Copilot',
  deepseek: 'DeepSeek',
  grok: 'Grok',
};

/** Entrée d'audit. V2 : champs de parcours (segment, catégorie, concurrents connus…), tous optionnels. */
export interface AuditInput extends AuditInputV2 {
  businessName: string;
  trade: string;
  city: string;
  district?: string;
  website?: string;
  email?: string;
}

export type QueryIntent = 'best' | 'nearby' | 'urgent' | 'specific' | 'review';

/** V2 : angle précis de la requête (les intentions V1 restent la clé de lecture du rapport). */
export type QueryAngle =
  | 'best'
  | 'nearby'
  | 'urgent'
  | 'specific'
  | 'review'
  | 'comparison'
  | 'alternative'
  | 'price'
  | 'which_company'
  | 'where_to_buy'
  | 'french_brand'
  | 'brand_opinion'
  | 'brand_trust'
  | 'brand_facts';

export interface QuerySpec {
  id: string;
  text: string;
  intent: QueryIntent;
  /** V2 (optionnel) : 'brand' = requête sur la marque (perception / vérité), exclue du score de recommandation */
  kind?: 'reco' | 'brand';
  /** V2 (optionnel) : angle détaillé (comparatif, alternative, prix…) */
  angle?: QueryAngle;
  /** V3 : thème (sujet) de la question, rempli par le moteur pour toutes les questions d'un audit */
  theme?: string;
  /** V3 : étiquettes libres (« gabarit », « personnalisée », tags du client…) */
  tags?: string[];
  /** V3 : question saisie par le client (et non issue d'un gabarit) */
  custom?: boolean;
}

/** Source brute renvoyée par un provider (docs/v2/03-sources.md § 3). */
export interface RawSource {
  url: string;
  title?: string;
  snippet?: string;
  /** cited = citée dans le texte ; retrieved = consultée seulement ; inline = URL écrite dans le texte */
  kind: 'cited' | 'retrieved' | 'inline';
  /** index (dans le texte final de la réponse) du passage qui porte la citation, si connu */
  startIndex?: number;
  /** ordre d'apparition (1 = première source citée) */
  order?: number;
}

export interface ProviderAnswer {
  provider: ProviderId;
  queryId: string;
  run: number;
  text: string;
  citations: string[];
  demo: boolean;
  error?: string;
  /** optionnel : modèle utilisé (traçabilité de la mesure) */
  model?: string;
  /** optionnel : horodatage ISO de la réponse */
  at?: string;
  /** V2 (optionnel) : sources structurées (titre, extrait, position) ; `citations` reste rempli pour la V1 */
  sources?: RawSource[];
  /**
   * V8 (optionnel) : aucune réponse IA affichée pour cette recherche (ex. Google n'a pas montré d'aperçu IA).
   * Mesure valide, pas une erreur : comptée « sans recommandation » (hors dénominateur) et dans le taux d'affichage.
   */
  absent?: boolean;
}

export interface MentionResult {
  provider: ProviderId;
  queryId: string;
  run: number;
  mentioned: boolean;
  rank: number | null;
  competitors: string[];
  snippet?: string;
  /** optionnel : réponse sans aucune recommandation (exclue du dénominateur) */
  noRec?: boolean;
  /** optionnel : le domaine du commerce figure dans les sources citées */
  citedDomain?: boolean;
}

export interface CompetitorStat {
  name: string;
  mentions: number;
  share: number;
}

export interface ActionItem {
  id: string;
  title: string;
  why: string;
  how: string[];
  effort: 'S' | 'M' | 'L';
  impact: 1 | 2 | 3;
  /** optionnel : vague du plan (1 = semaine 1, 2 = semaines 2-3, 3 = mois 2) */
  wave?: 1 | 2 | 3;
}

export type ScoreBand = { min: number; max: number; label: string; color: string; bg: string; ink: string };

export interface Excerpt {
  provider: ProviderId;
  query: string;
  text: string;
  competitorsHighlighted: string[];
  mentioned: boolean;
}

/** Détails de calcul (méthode 03 § 6.4), stockables à côté du résultat. */
export interface ScoreDetails {
  method: 'repere-score-v1.0';
  scoreLow: number;
  scoreHigh: number;
  mentionRateLow: number;
  mentionRateHigh: number;
  components: { M: number; R: number; V: number; C: number };
  validAnswers: number;
  agreement: number;
  excludedNoRec: number;
  citedDomainCount: number;
  models: Partial<Record<ProviderId, string>>;
  /** désaccords entre l'extracteur LLM (is_target) et la détection déterministe */
  disagreements?: number;
  /** coût API estimé de l'audit, en euros */
  estimatedCostEur?: number;
  /** appels sautés par le garde-fou budget */
  skippedForBudget?: number;
}

export interface AuditResult extends AuditResultV2Ext, AuditResultV3Ext {
  id: string;
  input: AuditInput;
  createdAt: string;
  score: number;
  /** clés historiques toujours présentes ; les IA en option seulement si elles font partie de l'audit */
  subScores: Record<CoreProviderId, number | null> & Partial<Record<Exclude<ProviderId, CoreProviderId>, number | null>>;
  mentionRate: number;
  avgRank: number | null;
  shareOfVoice: number;
  competitors: CompetitorStat[];
  queries: QuerySpec[];
  mentions: MentionResult[];
  answers: ProviderAnswer[];
  confidence: 'faible' | 'moyenne' | 'bonne';
  demo: boolean;
  // Extension 00b
  range: { low: number; high: number };
  agreement: number;
  measuredAt: string;
  providersUsed: ProviderId[];
  excerpts: Excerpt[];
  topActions: ActionItem[];
  /** optionnel : détails de calcul */
  details?: ScoreDetails;
  /** V8 (optionnel) : comment chaque IA a été mesurée (modèle, date, recherche web, pays, échantillons, marge) */
  engines?: EngineMeasure[];
}

/**
 * V8 : fiche de mesure d'une IA dans un audit — ce qui diffère d'une IA à l'autre, exposé tel quel à l'interface.
 * Marge : intervalle de Wilson à 90 % sur le taux de mention de cette IA (mêmes réponses valides que le score).
 */
export interface EngineMeasure {
  provider: ProviderId;
  label: string;
  /** 'api' = API officielle de l'éditeur ; 'serp' = page de résultats relevée par un fournisseur de SERP */
  via: 'api' | 'serp';
  /** éditeur de l'API ou fournisseur de SERP (« OpenAI », « DataForSEO ») */
  vendor: string;
  model: string;
  measuredAt: string;
  /** la réponse s'appuie sur une recherche web en direct */
  webSearch: boolean;
  country: string;
  language: string;
  device?: 'mobile' | 'desktop';
  /** passages par question de recommandation (échantillons) */
  runsPerQuestion: number;
  questions: number;
  /** réponses obtenues (hors erreurs) */
  answers: number;
  /** réponses retenues pour le score (hors erreurs, hors « sans recommandation ») */
  valid: number;
  errors: number;
  /** recherches où une réponse IA était affichée (aperçus IA, Copilot) : shown sur total */
  displayed?: { shown: number; total: number };
  mentionRate: number | null;
  mentionLow: number | null;
  mentionHigh: number | null;
  /** demi-largeur de l'intervalle, en points de pourcentage */
  marginPts: number | null;
  demo: boolean;
  /** phrase à afficher telle quelle (« Mesuré via les résultats Google en France, sur mobile… ») */
  note: string;
}

export interface AuditProgress {
  done: number;
  total: number;
  provider: ProviderId;
}

export interface RunAuditOptions {
  mode?: 'free' | 'paid';
  onProgress?: (p: AuditProgress) => void;
  /** surcharge de la liste des IA (sinon AUDIT_PROVIDERS ou défaut) */
  providers?: ProviderId[];
  /** force le mode démo (aucun appel réseau) */
  forceMock?: boolean;
  /** graine pour les réponses mock (défaut : dérivée de l'entrée) */
  seed?: string;
  /** budget en euros (défaut : AUDIT_BUDGET_EUR ou 0,60 en gratuit) */
  budgetEur?: number;
  /** nombre d'appels simultanés (défaut 6) */
  concurrency?: number;
  /**
   * Questions de l'audit : liste figée (suivi mensuel) ou questions personnalisées (texte, tags, thème, intention).
   * Les entrées sans `id` sont normalisées (id `C-xxxx`). Voir `queriesMode`.
   */
  queries?: (QuerySpec | CustomQuery)[];
  /** V3 : 'replace' (défaut) = ces questions remplacent les gabarits ; 'append' = elles s'y ajoutent */
  queriesMode?: 'replace' | 'append';
  /** V3 : date de mesure imposée (démo, rejouage) ; sinon l'heure des réponses */
  measuredAt?: string;
  /** annulation (délai dépassé côté API) : plus aucun appel payant n'est lancé */
  signal?: AbortSignal;
  /** V2 : vérification HTTP légère de la présence sur les sources prioritaires (désactivée par défaut) */
  verifyPresence?: boolean;
  /** V2 : fiche de vérité ; si fournie, `factCheck` est rempli */
  facts?: BrandFacts | Partial<Record<BrandFactField, string>>;
}

/** Entité extraite d'une réponse (méthode § 4.6 / 4.7). */
export interface ExtractedEntity {
  name: string;
  rank: number;
  locationHint: string | null;
  url?: string | null;
  isTarget?: boolean;
}
