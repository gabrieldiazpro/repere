/**
 * ANALYSE-60S — contrats de l'analyse publique en 60 s (docs/v5/00-BRIEF-V5.md, `FullAnalysis`).
 *
 * Les rapports SEO-AUDIT et GEO-OPT sont typés ici de façon STRUCTURELLE (`ModuleReport`) : le vrai `SeoReport`
 * (src/lib/seoaudit) et le vrai `GeoReport` (src/lib/geo) y sont assignables sans dépendance circulaire.
 */
import type { CrawlOptions, Finding, ScoredSection, Severity, SiteCrawl } from '@/lib/crawl/types';
import type { ProviderId } from '@/lib/engine/types';
import type { PerfData as SeoDataPerfData } from '@/lib/seodata/types';
import type { AccessReport } from './access';

export type SiteType = 'local' | 'pme' | 'ecommerce';

export interface AnalysisInput {
  url: string;
  brand?: string;
  siteType?: SiteType;
  city?: string;
  /** Jamais renvoyé dans la vue publique : seul son hachage est gardé (rattachement à l'inscription). */
  email?: string;
}

/** Forme commune de `SeoReport` et `GeoReport` (brief) : { score, sections, topFixes, stats }. */
export interface ModuleReport {
  score: number;
  sections: ScoredSection[];
  topFixes: Finding[];
  stats?: unknown;
}

/** Résumé SEO-DATA (PageSpeed mobile de la page d'accueil). Absent si le fournisseur n'est pas configuré. */
export interface DataSummary {
  pagespeed?: {
    strategy: 'mobile';
    url: string;
    performance: number | null; // 0–100
    lcpMs?: number | null;
    cls?: number | null;
    inpMs?: number | null;
    /** Mesure de terrain (CrUX) disponible ? */
    field?: boolean;
    source: string; // « PageSpeed Insights »
  } | null;
  note?: string;
}

export interface AiCheckSummary {
  demo: boolean;
  /** Identifiant de l'audit moteur sauvegardé (src/lib/db), rattaché au compte avec l'analyse. */
  auditId?: string;
  providers: ProviderId[];
  questions: { id: string; text: string; mentioned: number; asked: number; competitors: string[] }[];
  /** Score de recommandation du moteur (0–100) et sa fourchette (marge d'erreur). */
  score: number;
  range?: { low: number; high: number } | null;
  mentionRate: number;
  calls: number;
  topCompetitors: string[];
  note: string;
  /** V8 : détail du test de marque (question × IA), déplacé dans `FullAnalysis.brandTest` à la synthèse. */
  test?: BrandTest;
}

/* ------------------------------------------------------------------ */
/* V8 — test de marque (« Votre marque est-elle citée par les IA ? »)  */
/* ------------------------------------------------------------------ */

/** Réponse d'une IA à une question : cité ou non, à quelle place, qui à la place, la phrase, les sources lues. */
export interface BrandTestCell {
  provider: string;
  label: string;
  /** cited : la marque est nommée ; not_cited : d'autres le sont ; no_reco : aucune recommandation ; error : pas de réponse */
  status: 'cited' | 'not_cited' | 'no_reco' | 'error';
  /** place parmi les recommandations (1 = première), si citée */
  rank: number | null;
  /** cités à la place (ou avant vous), dans l'ordre de la réponse, 3 au plus */
  instead: string[];
  /** phrase extraite de la réponse (la vôtre si vous êtes cité, sinon celle du premier cité) */
  excerpt?: string;
  /** sources consultées ou citées par l'IA pour cette réponse (5 au plus) */
  sources: { url: string; domain: string; title?: string }[];
  /** modèle interrogé (traçabilité) */
  model?: string;
}

export interface BrandTestQuestion {
  id: string;
  text: string;
  cells: BrandTestCell[];
}

/** Taux de citation avec sa fourchette (intervalle de Wilson à 90 %). */
export interface CitationRate {
  cited: number;
  asked: number;
  rate: number;
  low: number;
  high: number;
}

export interface BrandTestProvider extends CitationRate {
  id: string;
  label: string;
}

/** Signal lisible sur une page d'accueil (données structurées, avis, FAQ…) — src/lib/analysis/signals.ts. */
export type SiteSignalId = 'entity' | 'rating' | 'faq' | 'address' | 'phone' | 'hours' | 'city' | 'prices' | 'sameas' | 'content';

export interface WhyAction {
  title: string;
  how: string;
  /** repere : Repéré prépare la correction (vous validez) ; vous : à faire de votre côté (Repéré vous guide) */
  by: 'repere' | 'vous';
  /** d'où vient l'action (écart de site, source manquante) */
  from: SiteSignalId | 'source';
}

/** « Pourquoi lui ? » pour une question où un concurrent est cité et pas vous. */
export interface CompetitorWhy {
  questionId: string;
  question: string;
  competitor: string;
  /** IA qui l'ont cité sur cette question */
  providers: string[];
  /** site du concurrent repéré dans les réponses (ou null), et s'il a pu être lu */
  site: { url: string; read: boolean; note?: string } | null;
  /** sources lues par les IA pour ces réponses ; le concurrent / vous y êtes-vous nommés (titre ou extrait) ? */
  sources: { domain: string; url: string; title?: string; category: string; categoryLabel: string; them: boolean; you: boolean }[];
  /** éléments relevés chez lui (page d'accueil) et absents de votre site (pages lues) */
  gaps: { id: SiteSignalId; label: string; evidence?: string }[];
  /** éléments que vous avez et lui non (honnêteté : ce n'est pas tout noir) */
  strengths: { id: SiteSignalId; label: string }[];
  actions: WhyAction[];
  /** sur quoi repose la comparaison */
  basis: string;
}

export interface BrandTest {
  version: 1;
  demo: boolean;
  measuredAt: string;
  brand: string;
  questions: BrandTestQuestion[];
  providers: BrandTestProvider[];
  /** IA connues de Repéré mais non configurées sur ce serveur (transparence) */
  notConfigured: string[];
  overall: CitationRate;
  /** pour chaque question où un concurrent est cité à votre place (3 au plus) */
  why?: CompetitorWhy[];
  /** résultat repris d'un test de moins de 24 h (aucune IA réinterrogée) */
  reused?: { at: string };
  note: string;
}

/** Test de marque non lancé : raison lisible (plafond de coûts, limite du jour…). */
export interface BrandTestSkip {
  reason: 'cost_cap' | 'domain_limit' | 'regulated' | 'no_budget';
  message: string;
}

export interface CrawlSummary {
  startUrl: string;
  finalOrigin: string;
  pagesFetched: number;
  pagesIndexable: number;
  sitemapUrls: number;
  robotsFound: boolean;
  durationMs: number;
  truncated: boolean;
  errors: number;
}

export interface Detection {
  brand: string;
  siteType: SiteType;
  city?: string;
  /** métier / catégorie déduit (sert aux questions IA) */
  activity?: string;
  /** d'où vient chaque déduction (transparence) */
  sources: { brand: string; siteType: string; city?: string };
}

export type ModuleId = 'detect' | 'crawl' | 'seo' | 'geo' | 'data' | 'ai';
export type ModuleStatus = 'ok' | 'failed' | 'skipped' | 'timeout';

export interface PriorityItem extends Finding {
  source: 'seo' | 'geo';
  /** impact × (4 − effort) : 1 à 9 */
  priority: number;
}

export interface FullAnalysis {
  id: string;
  version: 1;
  input: { url: string; brand?: string; siteType?: SiteType; city?: string };
  detected: Detection;
  createdAt: string;
  durationMs: number;
  crawl: CrawlSummary | null;
  seo: ModuleReport | null;
  geo: ModuleReport | null;
  data?: DataSummary;
  ai?: AiCheckSummary;
  /** V8 : test de marque en tête du rapport (questions × IA, pourquoi eux, premières actions). */
  brandTest?: BrandTest;
  /** V8 : test de marque non lancé, et pourquoi. */
  brandSkip?: BrandTestSkip;
  verdict: string;
  /**
   * ROBUSTESSE (V6) : ce que notre robot a pu lire (état explicite, message en français, marche à suivre adaptée à la
   * plateforme détectée, signaux secondaires). `readable: false` : aucun score SEO / GEO n'est calculé.
   */
  access?: AccessReport;
  /** null si le module n'a pas pu tourner (le global est alors calculé sur ce qui existe). */
  scores: { seo: number | null; geo: number | null; global: number | null };
  priorities: PriorityItem[];
  /** Constats corrigeables automatiquement par Repéré (avec votre validation). */
  autoFixes: { findingId: string; kind: string; title: string; source: 'seo' | 'geo' }[];
  modules: Record<ModuleId, { status: ModuleStatus; ms: number; error?: string; provisional?: boolean }>;
  /** true si au moins un module a échoué (résultat partiel). */
  partial: boolean;
  /** Réanalyse : identifiant de l'analyse précédente du même domaine. */
  previousId?: string;
  comparison?: AnalysisComparison;
  demo: boolean;
}

export interface AnalysisComparison {
  previousId: string;
  previousAt: string;
  scores: { seo: number | null; geo: number | null; global: number | null };
  fixed: string[]; // ids de constats disparus
  appeared: string[]; // ids de constats nouveaux
}

/* ------------------------------------------------------------------ */
/* Événements de progression                                           */
/* ------------------------------------------------------------------ */

interface EvBase {
  /** numéro d'ordre (strictement croissant) */
  seq: number;
  /** ms depuis le début */
  t: number;
}
export type AnalysisEvent = EvBase &
  (
    | { type: 'start'; id: string; url: string; budgetMs: number }
    | { type: 'detected'; detection: Detection }
    | { type: 'step'; step: ModuleId; status: 'running' | ModuleStatus; label: string; ms?: number; error?: string }
    | { type: 'crawl'; fetched: number; queued: number; phase: string; currentUrl?: string; /** pages lues depuis l'événement précédent (≤ 20, pour la carte en direct) */ urls?: string[] }
    | { type: 'finding'; source: 'seo' | 'geo' | 'ai'; id: string; title: string; severity: Severity }
    | { type: 'ai'; done: number; total: number; provider?: string }
    | { type: 'brandplan'; demo: boolean; questions: { id: string; text: string }[]; providers: { id: string; label: string }[] }
    | { type: 'brand'; test: BrandTest }
    | { type: 'brandskip'; skip: BrandTestSkip }
    | { type: 'score'; module: 'seo' | 'geo' | 'ai'; score: number }
    | { type: 'result'; analysis: FullAnalysis }
    | { type: 'error'; message: string }
  );

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type AnalysisEventBody = DistributiveOmit<AnalysisEvent, 'seq' | 't'>;

/* ------------------------------------------------------------------ */
/* Modules orchestrés (injectables pour les tests)                     */
/* ------------------------------------------------------------------ */

export interface AiCheckContext {
  url: string;
  brand: string;
  siteType: SiteType;
  city?: string;
  activity?: string;
  maxCalls: number;
  signal: AbortSignal;
  /** enregistrer l'audit moteur (défaut true) */
  save?: boolean;
  onProgress?: (done: number, total: number, provider?: string) => void;
  /** V8 : questions et IA du test de marque, annoncées avant les appels */
  onPlan?: (plan: { demo: boolean; questions: { id: string; text: string }[]; providers: { id: string; label: string }[] }) => void;
  /** V8 : test non lancé (plafond, limite du jour) */
  onSkip?: (skip: BrandTestSkip) => void;
}

/** Résultat du module PageSpeed : résumé public + mesure brute SEO-DATA (transmise à l'audit SEO, jamais stockée). */
export type PagespeedResult = NonNullable<DataSummary['pagespeed']> & { perf?: SeoDataPerfData };

export interface AnalysisModules {
  /** Le crawl reçu par `seo` et `geo` est COMPLET (HTML compris) : ne jamais lui appliquer publicCrawl() avant. */
  crawl(url: string, opts: CrawlOptions & { signal?: AbortSignal }): Promise<SiteCrawl>;
  seo(crawl: SiteCrawl, opts?: { siteType?: SiteType; perf?: SeoDataPerfData }): Promise<ModuleReport> | ModuleReport;
  geo(crawl: SiteCrawl, ctx: { brand: string; siteType: SiteType; city?: string; activity?: string }): Promise<ModuleReport> | ModuleReport;
  /** null = SEO-DATA non configuré (on le dit, sans inventer). */
  pagespeed(url: string, signal: AbortSignal): Promise<PagespeedResult | DataSummary['pagespeed'] | null>;
  aiCheck(ctx: AiCheckContext): Promise<AiCheckSummary | null>;
  /** V8 : lit la page d'accueil des concurrents cités (1 page chacun, robots.txt respecté) ; null = non lu */
  fetchPage?(url: string, signal: AbortSignal): Promise<{ finalUrl: string; html: string } | null>;
  /** modules encore provisoires (adaptateurs ANALYSE-60S en attendant le vrai module) */
  provisional?: Partial<Record<ModuleId, boolean>>;
}

export interface RunAnalysisOptions {
  /** budget total (défaut 58 s) */
  budgetMs?: number;
  /** exploration : 60 pages, 45 s (défauts du brief) */
  maxPages?: number;
  crawlBudgetMs?: number;
  /** plafond d'appels IA (défaut ANALYSIS_MAX_AI_CALLS ou 18) */
  maxAiCalls?: number;
  modules?: Partial<AnalysisModules>;
  /** identifiant imposé (sinon aléatoire) */
  id?: string;
  /** analyse précédente du même domaine (comparaison avant/après) */
  previous?: FullAnalysis | null;
  signal?: AbortSignal;
  /** récupération de la page d'accueil pour la détection (tests) */
  fetchHome?: (url: string) => Promise<{ finalUrl: string; html: string } | null>;
}
