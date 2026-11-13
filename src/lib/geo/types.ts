/**
 * Types du module GEO-OPT (V5). `Finding` et `ScoredSection` viennent du contrat central (src/lib/crawl/types.ts).
 * Méthode et niveaux de preuve : docs/v5/geo-methode.md.
 */
import type { Finding, ScoredSection, SiteCrawl } from '@/lib/crawl/types';
import type { ProviderAnswer } from '@/lib/engine/types';
import type { BrandFactField, SourceCategory } from '@/lib/engine/types-v2';

export type { Finding, ScoredSection, SiteCrawl };

/** Type de site : commerce local (artisan, restaurant…), PME/B2B, boutique en ligne. */
export type GeoSiteType = 'local' | 'pme' | 'ecommerce';

/** Niveau de preuve de la recommandation appliquée (voir docs/v5/geo-methode.md). */
export type EvidenceLevel = 'demontre' | 'probable' | 'hypothese';

/** Constat GEO : `Finding` du contrat + niveau de preuve. */
export interface GeoFinding extends Finding {
  evidenceLevel: EvidenceLevel;
}

export type GeoSectionId = 'acces' | 'entite' | 'passages' | 'questions' | 'fraicheur' | 'donnees' | 'llms' | 'hors_site';

export interface GeoSection extends ScoredSection {
  id: GeoSectionId;
  findings: GeoFinding[];
  /** false : section non mesurée (données absentes) — exclue du score global. */
  measured: boolean;
  /** Poids dans le score global (0 = informatif). */
  weight: number;
  /** Phrase d'explication (ce qui a été mesuré, ou pourquoi ce n'est pas mesuré). */
  note: string;
}

/* ------------------------------------------------------------------ */
/* Passages                                                            */
/* ------------------------------------------------------------------ */

export type PassageCriterion = 'autonome' | 'chiffre' | 'date' | 'source' | 'reponse' | 'longueur' | 'entites';

export interface Passage {
  /** Identifiant stable (hachage url + texte). */
  id: string;
  url: string;
  /** Titre de section qui précède le passage (h2, h3…), s'il existe. */
  heading?: string;
  headingIsQuestion: boolean;
  text: string;
  words: number;
  /** Position relative du début du passage dans le contenu principal (0 = haut, 1 = bas). */
  position: number;
  /** Profondeur de la page (0 = accueil). */
  depth: number;
  /** Lien(s) sortant(s) vers un autre site dans le passage. */
  externalLinks: number;
}

export interface ScoredPassage extends Passage {
  score: number;
  criteria: Record<PassageCriterion, boolean>;
  /** Ce qui manque, en clair (« aucun chiffre précis »…). */
  missing: string[];
}

export interface PassageRewrite {
  passageId: string;
  url: string;
  before: string;
  after: string;
  /** 'ia' : fournisseur d'IA configuré ; 'deterministe' : règles (démo, sans clé, ou IA rejetée). */
  mode: 'ia' | 'deterministe';
  /** Faits utilisés (issus du passage, de la page ou de la fiche de vérité). */
  facts: string[];
  /** Avertissements (réécriture IA rejetée, informations à compléter…). */
  notes: string[];
  model?: string;
}

/* ------------------------------------------------------------------ */
/* Couverture des questions (query fan-out)                            */
/* ------------------------------------------------------------------ */

export type FanOutFacet =
  | 'prix'
  | 'delai'
  | 'zone'
  | 'urgence'
  | 'horaires'
  | 'contact'
  | 'garanties'
  | 'avis'
  | 'choix'
  | 'etapes'
  | 'cible'
  | 'references'
  | 'comparaison'
  | 'livraison'
  | 'retours'
  | 'caracteristiques'
  | 'paiement'
  | 'origine'
  | 'autre';

export interface SubQuestion {
  id: string;
  question: string;
  facet: FanOutFacet;
  /** Question client d'origine. */
  seed: string;
  /** 'ia' : générée par le fournisseur d'IA ; 'modele' : gabarits sans IA (démo / sans clé). */
  source: 'ia' | 'modele';
}

export interface SubQuestionCoverage extends SubQuestion {
  status: 'couverte' | 'partielle' | 'absente';
  /** Meilleur passage trouvé. */
  bestUrl?: string;
  bestPassageId?: string;
  /** 0–1 */
  match: number;
}

export interface FanOutResult {
  source: 'ia' | 'modele';
  seeds: string[];
  items: SubQuestionCoverage[];
  covered: number;
  partial: number;
  missing: number;
  note: string;
}

/* ------------------------------------------------------------------ */
/* Présence hors site                                                  */
/* ------------------------------------------------------------------ */

/** Source citée par les IA (agrégée par le moteur, ou brute). */
export interface EngineSourceInput {
  url?: string;
  domain?: string;
  title?: string;
  /** Nombre de citations observées. */
  count?: number;
  providers?: string[];
  category?: SourceCategory;
  /** Présence du client vérifiée sur ce site (true / false), ou inconnue (null / absent). */
  clientPresent?: boolean | null;
}

export interface OffsiteDomain {
  domain: string;
  label: string;
  category: SourceCategory;
  categoryLabel: string;
  citations: number;
  providers: string[];
  /** 'verifiee' : moteur ; 'liee' : votre site pointe vers ce domaine ; 'absente' : vérifiée absente ; 'inconnue'. */
  clientPresence: 'verifiee' | 'liee' | 'absente' | 'inconnue';
  howTo?: string;
}

export interface OffsiteSummary {
  measured: boolean;
  totalCitations: number;
  /** Part des citations pointant vers votre site (0–1). */
  ownShare: number;
  byCategory: { category: SourceCategory; label: string; citations: number; share: number }[];
  domains: OffsiteDomain[];
}

/* ------------------------------------------------------------------ */
/* Contexte et rapport                                                 */
/* ------------------------------------------------------------------ */

export type FactsInput = Partial<Record<BrandFactField, string>>;

export interface GeoContext {
  /** Nom de l'entreprise (sinon déduit du JSON-LD / og:site_name / titre). */
  brand?: string;
  /** Type de site (alias acceptés : 'artisan' → local, 'boutique' → ecommerce). */
  siteType?: GeoSiteType | 'artisan' | 'boutique';
  /** Métier ou activité (« plombier », « logiciel de paie »…) : sert aux sous-questions. */
  trade?: string;
  city?: string;
  /** Questions clients (sinon dérivées du type de site). */
  questions?: string[];
  /** Sous-questions déjà générées (par `generateFanOut` avec l'IA) ; sinon gabarits sans IA. */
  fanOut?: SubQuestion[];
  /** Fiche de vérité du client (source des faits autorisés dans les réécritures et la FAQ). */
  facts?: FactsInput;
  /** Sources citées par les IA, agrégées par le moteur d'audit. */
  engineSources?: EngineSourceInput[];
  /** Réponses brutes des IA (le moteur d'audit) : leurs sources sont extraites. */
  aiAnswers?: ProviderAnswer[];
  /** llms.txt récupéré (status HTTP + texte), si l'appelant l'a lu ; sinon recherché dans l'exploration. */
  llmsTxt?: { status: number; text?: string } | null;
  /** Réécritures déjà produites (par `rewritePassage` avec l'IA), par identifiant de passage. */
  rewrites?: Record<string, PassageRewrite>;
  /** Date de référence (ISO) pour la fraîcheur ; défaut : maintenant. */
  now?: string;
}

export interface GeoStats {
  pagesAnalyzed: number;
  pagesWithHtml: number;
  passages: number;
  citablePassages: number;
  avgPassageScore: number;
  subQuestions: number;
  subQuestionsCovered: number;
  searchBotsBlocked: string[];
  orgJsonLd: boolean;
}

export interface GeoReport {
  score: number;
  sections: GeoSection[];
  /** Correctifs priorisés (sévérité, puis impact / effort). */
  topFixes: GeoFinding[];
  stats: GeoStats;
  siteType: GeoSiteType;
  brand: string | null;
  passages: { top: ScoredPassage[]; toRewrite: ScoredPassage[] };
  fanOut: FanOutResult;
  offsite: OffsiteSummary;
  /** true si une partie du rapport vient de gabarits de démonstration (sous-questions sans IA). */
  demo: boolean;
  method: string;
  generatedAt: string;
  limits: string[];
}
