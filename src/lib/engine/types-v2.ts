/**
 * Types V2 (contrat figé par l'orchestrateur — docs/v2/08-CONTRATS-V2.md).
 * Ajouts strictement additifs : AuditResult V1 reste valide.
 */
import type { ProviderId } from './types';
import type { UrlStat } from './types-v3';

// ---------------------------------------------------------------------------
// Parcours
// ---------------------------------------------------------------------------
export type Segment = 'local' | 'pme' | 'ecommerce';

/** Champs d'entrée V2 (ajoutés à AuditInput, tous optionnels pour compatibilité). */
export interface AuditInputV2 {
  segment?: Segment; // défaut 'local'
  /** PME : secteur / catégorie d'offre (« logiciel de paie », « cabinet de recrutement tech ») */
  category?: string;
  /** PME / e-com : ce que vend l'entreprise, en une phrase */
  offering?: string;
  /** e-com : catégories produits phares (« crème solaire bio », « sneakers éco ») */
  productCategories?: string[];
  /** concurrents connus déclarés par le client */
  knownCompetitors?: string[];
  /** zone de chalandise (PME/e-com : 'France' par défaut) */
  market?: string;
}

// ---------------------------------------------------------------------------
// Sources (docs/v2/03-sources.md)
// ---------------------------------------------------------------------------
export type SourceCategory =
  | 'annuaire'
  | 'avis'
  | 'media_national'
  | 'media_local'
  | 'comparatif'
  | 'forum'
  | 'marketplace'
  | 'reseau_social'
  | 'concurrent'
  | 'client'
  | 'wikipedia'
  | 'institutionnel'
  | 'autre';

export interface SourceCitation {
  url: string;
  domain: string;
  title?: string;
  provider: ProviderId;
  queryId: string;
  run: number;
  position: number; // 1 = première citation de la réponse
  category: SourceCategory;
}

export type Presence = 'present' | 'absent' | 'unknown';

export interface DomainStat {
  domain: string;
  label: string;
  category: SourceCategory;
  citations: number;
  citationShare: number; // 0–1 sur toutes les citations
  providers: ProviderId[];
  queries: string[]; // queryIds
  clientPresence: Presence;
  competitorsPresent: string[];
  sampleUrls: string[];
}

export interface SourceOpportunity {
  domain: string;
  label: string;
  category: SourceCategory;
  score: number; // 0–100
  why: string;
  action: string; // « S'inscrire sur… », « Proposer un article à… »
  howTo: string[];
  effort: 'S' | 'M' | 'L';
  impact: 1 | 2 | 3;
  competitorsPresent: string[];
}

export interface SourcesReport {
  totalCitations: number;
  domains: DomainStat[]; // triés par citations desc
  byCategory: Partial<Record<SourceCategory, number>>;
  opportunities: SourceOpportunity[]; // top 10
  clientCitedCount: number; // nb de citations pointant vers le site du client
  note?: string; // ex. « Gemini sans ancrage : pas de sources »
  /** V3 (additif) : citations URL par URL, triées par citations décroissantes */
  urls?: UrlStat[];
}

// ---------------------------------------------------------------------------
// Perception : ce que les IA disent de la marque
// ---------------------------------------------------------------------------
export type Sentiment = 'positif' | 'neutre' | 'negatif';

export interface BrandQuote {
  provider: ProviderId;
  query: string;
  text: string; // verbatim ≤ 400 car.
  sentiment: Sentiment;
  at: string;
  /** V3 (additif) : verbatim porteur d'une erreur factuelle (compté en négatif) */
  factError?: boolean;
}

export interface BrandClaim {
  field: BrandFactField | 'autre';
  value: string; // ce que dit l'IA
  provider: ProviderId;
  quote: string;
}

export interface PerceptionReport {
  quotes: BrandQuote[]; // 3–8 verbatims
  sentiment: { positif: number; neutre: number; negatif: number }; // parts 0–1
  themes: string[]; // « réactivité », « prix élevés »…
  claims: BrandClaim[]; // affirmations factuelles extraites
}

// ---------------------------------------------------------------------------
// Fiche de vérité + vérification (alerte hallucination)
// ---------------------------------------------------------------------------
export type BrandFactField =
  | 'adresse'
  | 'telephone'
  | 'horaires'
  | 'prix'
  | 'zone'
  | 'services'
  | 'dirigeant'
  | 'creation'
  | 'site'
  | 'statut' // ouvert / fermé définitivement
  | 'produits'
  | 'livraison'
  | 'clients' // références B2B
  | 'retours' // e-commerce : politique de retour
  | 'ingredients' // e-commerce : composition, INCI
  | 'certifications'; // e-commerce : labels, certifications

export interface BrandFacts {
  businessId: string;
  facts: Partial<Record<BrandFactField, string>>;
  updatedAt: string;
}

export interface FactCheckItem {
  field: BrandFactField;
  expected: string;
  stated: string;
  provider: ProviderId;
  quote: string;
  verdict: 'correct' | 'faux' | 'incomplet' | 'non_verifiable';
  severity: 'haute' | 'moyenne' | 'basse';
  /** Référence de comparaison : la fiche de vérité (par défaut) ou le catalogue produit (erreurs de prix e-commerce). */
  source?: 'fiche' | 'catalogue';
}

export interface FactCheckReport {
  checkedAt: string;
  items: FactCheckItem[];
  errors: number; // nb de 'faux'
}

// ---------------------------------------------------------------------------
// Pourquoi un concurrent passe devant
// ---------------------------------------------------------------------------
export interface CompetitorGap {
  competitor: string;
  mentions: number;
  share: number;
  presentOn: string[]; // domaines où il est cité et pas le client
  reasons: string[]; // phrases courtes, factuelles, tirées des réponses / sources
}

// ---------------------------------------------------------------------------
// Benchmark
// ---------------------------------------------------------------------------
export interface BenchmarkPosition {
  rank: number; // 1 = meilleur
  of: number; // nb d'acteurs comparés (cités dans l'audit + client)
  label: string; // « 4ᵉ sur 12 plombiers du 11ᵉ »
}

// ---------------------------------------------------------------------------
// Extension de AuditResult (tous optionnels)
// ---------------------------------------------------------------------------
export interface AuditResultV2Ext {
  segment?: Segment;
  sources?: SourcesReport;
  perception?: PerceptionReport;
  factCheck?: FactCheckReport;
  gaps?: CompetitorGap[];
  benchmark?: BenchmarkPosition;
}

// ---------------------------------------------------------------------------
// Exécution (module src/lib/execution)
// ---------------------------------------------------------------------------
export type TaskKind =
  | 'gbp_profile' // fiche Google : textes prêts à coller
  | 'bing_places'
  | 'apple_business'
  | 'directory' // annuaire / plateforme (PagesJaunes, G2, Capterra, Trustpilot…)
  | 'schema' // JSON-LD
  | 'faq_page' // page FAQ citable
  | 'review_request' // kit de demande d'avis
  | 'review_reply' // brouillon de réponse à un avis
  | 'content' // comparatif honnête, page service, étude
  | 'source_outreach' // proposer un article, répondre sur un forum…
  | 'fact_fix' // corriger une information fausse
  | 'product_feed' // e-com : flux produit / données Product
  | 'other';

export type Automation = 'auto' | 'semi' | 'guide';
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'skipped';

export interface ExecTask {
  id: string;
  businessId: string;
  kind: TaskKind;
  title: string;
  why: string;
  automation: Automation;
  minutes: number; // temps client estimé
  impact: 1 | 2 | 3;
  status: TaskStatus;
  week?: string; // ISO lundi de la semaine où elle est proposée
  /** livrable prêt à l'emploi : texte à coller, snippet, lien de page hébergée */
  deliverable?: { type: 'text' | 'html' | 'jsonld' | 'link' | 'checklist'; content: string; label?: string }[];
  steps?: string[];
  sourceDomain?: string;
  createdAt: string;
  doneAt?: string;
}

// ---------------------------------------------------------------------------
// Trafic IA (module src/lib/tracking)
// ---------------------------------------------------------------------------
export type AiEngine = 'chatgpt' | 'perplexity' | 'gemini' | 'copilot' | 'claude' | 'other_ai';

export interface AiTrafficDay {
  date: string; // YYYY-MM-DD
  visits: Partial<Record<AiEngine, number>>;
  conversions: Partial<Record<AiEngine, number>>;
  totalVisits: number; // toutes sources (dénominateur)
  bots: Record<string, number>; // GPTBot, OAI-SearchBot, PerplexityBot…
}

/** Ventes attribuées aux IA (référent ou UTM de la session d'arrivée). */
export interface AiCommerceSummary {
  source: 'shopify' | 'ga4' | 'demo';
  orders: number;
  revenueEur: number;
  byEngine: Partial<Record<AiEngine, { orders: number; revenueEur: number }>>;
  /** produits d'arrivée : visites venues des IA, commandes et CA */
  products: { path: string; name: string; visits: number; orders: number; revenueEur: number }[];
}

export interface AiTrafficSummary {
  businessId: string;
  from: string;
  to: string;
  days: AiTrafficDay[];
  totals: { aiVisits: number; aiShare: number; conversions: number; byEngine: Partial<Record<AiEngine, number>> };
  topLandingPages: { path: string; visits: number; engine: AiEngine }[];
  installed: boolean; // snippet reçu au moins une fois
  demo: boolean;
  /** E-commerce : commandes et CA attribués aux IA (Shopify / GA4 ; démo étiquetée). Ajout additif V2.1. */
  commerce?: AiCommerceSummary;
}

// ---------------------------------------------------------------------------
// Digest hebdo / alertes / copilote
// ---------------------------------------------------------------------------
export interface WeeklyDigest {
  businessId: string;
  week: string;
  headline: string; // « Cette semaine, ChatGPT vous cite dans 4 questions sur 10 (+1). »
  scoreDelta: number | null;
  benchmark?: BenchmarkPosition;
  bestQuote?: BrandQuote;
  quoteToFix?: BrandQuote;
  factErrors: number;
  newCompetitors: string[];
  tasks: ExecTask[]; // 3
  aiVisits?: number;
}

export interface CopilotMessage {
  role: 'user' | 'assistant';
  content: string;
  at: string;
}
