/**
 * Types partagés du module AUDIT-SITE (contrat docs/v3/12-CONTRATS-V3.md § Endpoints AUDIT-SITE).
 * Les formes `Check`, `ReadinessReport`, `CitabilityReport`… sont consommées par OUTILS, ENTONNOIR et l'app.
 */

export type CheckStatus = 'ok' | 'warn' | 'fail';

/** Un contrôle (readiness, citabilité, fiche produit). */
export interface Check {
  id: string;
  label: string;
  status: CheckStatus;
  /** Constat factuel, en français, sur la page analysée. */
  detail: string;
  /** Correctif concret (vide si status = ok). */
  fix: string;
  /** Points obtenus / points possibles dans le score sur 100. */
  points: number;
  maxPoints: number;
  /** Contrôle d'information seulement (compte pour 0 point, ex. llms.txt). */
  informational?: boolean;
  /** Tâche Repéré qui réalise le correctif, si elle existe. */
  task?: 'jsonld' | 'robots' | 'faq_page' | 'review_kit' | 'content';
}

export interface ScoredReport {
  score: number;
  checks: Check[];
  /** Correctifs priorisés (contrôles en échec puis en alerte, par poids décroissant). */
  fixes: { id: string; label: string; fix: string; impact: number }[];
}

export type BotRole = 'training' | 'search' | 'user' | 'control';

export interface AiBot {
  token: string;
  operator: string;
  role: BotRole;
  /** Produit concerné (ChatGPT, Claude, Gemini…). */
  product: string;
  /** Ce que fait ce robot, en clair. */
  meaning: string;
  /** robots.txt peut ne pas s'appliquer (récupération à la demande d'un utilisateur). */
  mayIgnoreRobots?: boolean;
  /** Jeton robots.txt seulement : jamais vu dans les journaux. */
  tokenOnly?: boolean;
}

export type BotStatus = 'allowed' | 'blocked' | 'not_mentioned';

export interface BotVerdict {
  token: string;
  operator: string;
  product: string;
  role: BotRole;
  roleLabel: string;
  status: BotStatus;
  /** Groupe qui s'applique : propre au robot, groupe « * », ou aucun. */
  group: 'specific' | 'wildcard' | 'none';
  /** Ligne (1-based) et texte de la règle décisive, si une règle a décidé. */
  line: number | null;
  rule: string | null;
  /** Chemins bloqués pour ce robot (hors « / »), pour signaler un blocage partiel. */
  blockedPaths: string[];
  severity: 'ok' | 'info' | 'warn' | 'critical';
  recommendation: string;
}

export interface RobotsReport {
  url: string;
  robotsUrl: string;
  /** HTTP du robots.txt (null : injoignable). */
  httpStatus: number | null;
  found: boolean;
  /** 5xx ou injoignable : les robots respectueux considèrent le site entièrement interdit (RFC 9309 § 2.3.1.4). */
  unreachable: boolean;
  sitemaps: string[];
  paths: string[];
  bots: BotVerdict[];
  summary: { searchBlocked: string[]; trainingBlocked: string[]; userBlocked: string[] };
  recommended: { cite: string; citeNoTraining: string };
  limits: string[];
  botsListVersion: string;
}

/** Ce que voit un robot sans JavaScript (outil « rendu sans JavaScript »). */
export interface RenderReport {
  verdict: 'lisible' | 'partiel' | 'quasi_vide';
  words: number;
  /** Part du texte visible dans le HTML brut (0 à 1). */
  textRatio: number;
  hasH1: boolean;
  hasMain: boolean;
  hasTitle: boolean;
  hasMetaDescription: boolean;
  hasJsonLd: boolean;
  noscriptWords: number;
  /** Racine vide d'application JavaScript détectée (div#root, div#__next, app-root…). */
  emptyRoot: string | null;
  frameworks: string[];
  /** Début du texte lu par un robot. */
  preview: string;
  headings: { level: number; text: string }[];
  limit: string;
}

export interface ReadinessReport extends ScoredReport {
  url: string;
  finalUrl: string;
  httpStatus: number;
  fetchedAt: string;
  elapsedMs: number;
  htmlBytes: number;
  words: number;
  robots: RobotsReport | null;
  render: RenderReport;
  sitemap: { found: boolean; url: string | null };
  jsonLdTypes: string[];
  llmsTxt: { found: boolean; url: string; note: string };
  limits: string[];
  /** Raison du plafonnement du score (défaut bloquant), si appliqué. */
  cap?: string;
}

export interface CitableExtract {
  text: string;
  reason: string;
}

export interface RewriteSuggestion {
  rule: string;
  before: string;
  after: string;
  why: string;
}

export interface CitabilityReport extends ScoredReport {
  url: string | null;
  title: string;
  words: number;
  passed: number;
  total: number;
  extracts: CitableExtract[];
  suggestions: RewriteSuggestion[];
  /** Réécriture du premier paragraphe par IA (mode facultatif, comptes connectés avec clé). */
  aiRewrite: { text: string; model: 'llm' } | null;
  aiNote?: string;
  disclaimer: string;
}

export interface ProductData {
  name?: string;
  brand?: string;
  gtin?: string;
  mpn?: string;
  sku?: string;
  description?: string;
  images: string[];
  price?: string;
  priceCurrency?: string;
  availability?: string;
  ratingValue?: string;
  reviewCount?: string;
  reviews: number;
  hasShipping: boolean;
  hasReturns: boolean;
  sources: { jsonld: boolean; microdata: boolean; opengraph: boolean };
  /** Valeurs contradictoires entre sources (ex. prix JSON-LD ≠ prix Open Graph). */
  conflicts: string[];
}

export interface ProductReport extends ScoredReport {
  url: string | null;
  product: ProductData;
  descriptionWords: number;
  missing: string[];
  /** Balisage Product à compléter, construit avec les seules valeurs trouvées sur la page. */
  suggestedJsonLd: Record<string, unknown> | null;
}

export interface CompareRow {
  id: string;
  label: string;
  mine: { status: CheckStatus | 'n/a'; detail: string };
  theirs: { status: CheckStatus | 'n/a'; detail: string };
  /** Qui fait mieux sur ce signal. */
  edge: 'mine' | 'theirs' | 'equal';
}

export interface CompareReport {
  mine: { url: string; readiness: number | null; citability: number | null; error?: string };
  theirs: { url: string; readiness: number | null; citability: number | null; error?: string };
  rows: CompareRow[];
  gaps: { id: string; label: string; fix: string }[];
  disclaimer: string;
}

export interface JsonLdBlock {
  index: number;
  types: string[];
  valid: boolean;
  data: unknown;
  errors: string[];
  warnings: string[];
  missing: string[];
}

export interface JsonLdValidation {
  blocks: JsonLdBlock[];
  microdataTypes: string[];
  errors: string[];
  warnings: string[];
  missing: string[];
  note: string;
}
