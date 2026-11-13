/**
 * Types V3 du moteur (docs/v3/12-CONTRATS-V3.md, ligne MOTEUR). Ajouts strictement additifs :
 * AuditResult V1/V2 reste valide, tous les champs de résultat sont optionnels.
 */
import type { ProviderId, QueryAngle, QueryIntent } from './types';
import type { SourceCategory } from './types-v2';

// ---------------------------------------------------------------------------
// Questions personnalisées
// ---------------------------------------------------------------------------
/** Question saisie par le client (module QUESTIONS) : seul `text` est obligatoire. */
export interface CustomQuery {
  id?: string;
  text: string;
  /** intention V1 ('best', 'review'…), angle V2 ('comparison', 'price'…) ou texte libre (déduit sinon) */
  intent?: QueryIntent | QueryAngle | string;
  theme?: string;
  tags?: string[];
  /** 'brand' si la question nomme l'entreprise (déduit automatiquement sinon) */
  kind?: 'reco' | 'brand';
}

// ---------------------------------------------------------------------------
// Marge d'erreur
// ---------------------------------------------------------------------------
export interface MarginStat {
  /** valeur mesurée (score sur 100 ; taux et parts entre 0 et 1) */
  value: number;
  /** bornes de l'intervalle à 90 % (P5–P95 du bootstrap) */
  low: number;
  high: number;
  /** demi-largeur (± affichable) */
  margin: number;
}

export interface MarginReport {
  method: 'bootstrap-questions';
  /** nombre de rééchantillonnages */
  samples: number;
  /** niveau de l'intervalle (0,9) */
  level: number;
  /** nombre de questions rééchantillonnées */
  questions: number;
  score: MarginStat;
  mentionRate: MarginStat;
  shareOfVoice: MarginStat;
  /** phrase prête à afficher : « Score 42 ± 6 (intervalle à 90 %) » */
  label: string;
}

// ---------------------------------------------------------------------------
// Part de voix thème × IA
// ---------------------------------------------------------------------------
export interface VoiceEntity {
  name: string;
  /** true = le client */
  client: boolean;
  mentions: number;
  share: number;
}

export interface VoiceCell {
  theme: string;
  provider: ProviderId;
  /** réponses valides (dénominateur) */
  answers: number;
  /** réponses où le client est cité */
  cited: number;
  mentionRate: number;
  /** part de voix du client dans la cellule (0–1) */
  shareOfVoice: number;
  /** acteurs cités dans la cellule (client compris), 5 au plus */
  leaders: VoiceEntity[];
}

export interface TopCompetitor {
  name: string;
  mentions: number;
  share: number;
  byProvider: Partial<Record<ProviderId, number>>;
  byTheme: Record<string, number>;
}

export interface VoiceMatrix {
  themes: string[];
  providers: ProviderId[];
  /** cells[i][j] = thème i × IA j (null si aucune réponse valide) */
  cells: (VoiceCell | null)[][];
  byTheme: { theme: string; answers: number; mentionRate: number; shareOfVoice: number }[];
  byProvider: { provider: ProviderId; answers: number; mentionRate: number; shareOfVoice: number }[];
  /** les 10 premiers concurrents (même comptage que `competitors`) */
  topCompetitors: TopCompetitor[];
}

// ---------------------------------------------------------------------------
// Citations URL par URL (ajouté à SourcesReport.urls)
// ---------------------------------------------------------------------------
export interface UrlStat {
  url: string;
  title?: string;
  domain: string;
  category: SourceCategory;
  providers: ProviderId[];
  /** queryIds */
  queries: string[];
  /** nombre de citations (une par réponse) */
  citations: number;
  /** meilleure position (1 = première source de la réponse) */
  bestPosition: number | null;
  clientPresent: boolean;
  competitorsPresent: string[];
  /** historique (rempli par `mergeUrlHistory` sur plusieurs audits) : première et dernière mesure où l'URL est citée */
  firstSeen?: string;
  lastSeen?: string;
}

// ---------------------------------------------------------------------------
// Comptages (une seule fonction de vérité : auditCounts)
// ---------------------------------------------------------------------------
export interface AuditCounts {
  /** questions de visibilité (recommandation), base du score */
  visibilityQuestions: number;
  /** questions de vérification (marque : perception et vérité) */
  factualQuestions: number;
  providers: number;
  /** réponses valides du score (hors erreurs et « pas de recommandation ») */
  answers: number;
  /** réponses valides où le client est cité */
  cited: number;
  /** « 8 questions de visibilité + 2 vérifications × 3 IA » */
  label: string;
}

// ---------------------------------------------------------------------------
// Expliquer un changement
// ---------------------------------------------------------------------------
export type ChangeConfidence = 'forte' | 'moyenne' | 'faible';

export interface MetricChange {
  prev: number;
  next: number;
  delta: number;
  /** marge combinée des deux mesures (même unité que la valeur) */
  margin: number;
  /** forte : variation > marge ; moyenne : > la moitié de la marge ; faible : dans le bruit */
  confidence: ChangeConfidence;
}

export interface QuestionChange {
  queryId: string;
  text: string;
  theme?: string;
  providers: ProviderId[];
}

export interface ProviderChange {
  provider: ProviderId;
  prevRate: number | null;
  nextRate: number | null;
  delta: number;
}

export interface SourceChange {
  domain: string;
  label: string;
  citations: number;
}

export interface CompetitorChange {
  name: string;
  prevMentions: number;
  nextMentions: number;
  delta: number;
  isNew: boolean;
}

export interface ChangeExplanation {
  from: string;
  to: string;
  /** même jeu de questions et mêmes IA */
  comparable: boolean;
  score: MetricChange;
  mentionRate: MetricChange;
  shareOfVoice: MetricChange;
  questionsGained: QuestionChange[];
  questionsLost: QuestionChange[];
  providers: ProviderChange[];
  sourcesAppeared: SourceChange[];
  sourcesDisappeared: SourceChange[];
  /** domaines où le client est passé de absent/inconnu à présent, et l'inverse */
  clientSourcesGained: string[];
  clientSourcesLost: string[];
  competitors: CompetitorChange[];
  /** confiance globale : celle du score */
  confidence: ChangeConfidence;
  headline: string;
  sentences: string[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Brief de contenu
// ---------------------------------------------------------------------------
export interface QueryGap {
  queryId: string;
  text: string;
  theme?: string;
  /** concurrents cités à la place du client */
  competitors: string[];
  providers?: ProviderId[];
}

export type BriefFormat = 'comparatif' | 'guide' | 'page_service' | 'faq' | 'article_invite' | 'fiche';

export interface ContentBrief {
  id: string;
  title: string;
  format: BriefFormat;
  angle: string;
  audience: string;
  /** questions que le contenu doit traiter (formulées comme les clients les posent aux IA) */
  questions: string[];
  /** sources à citer ou à viser (citées par les IA dans l'audit) */
  sources: { domain: string; label: string; url?: string; why: string }[];
  competitors: string[];
  outline: { heading: string; points: string[] }[];
  length: { minWords: number; maxWords: number };
  /** où publier */
  publishOn: string;
  checklist: string[];
  /** rappel honnête : aucune garantie de citation */
  note: string;
}

// ---------------------------------------------------------------------------
// Extension de AuditResult (tous optionnels)
// ---------------------------------------------------------------------------
export interface AuditResultV3Ext {
  margins?: MarginReport;
  voice?: VoiceMatrix;
  counts?: AuditCounts;
}
