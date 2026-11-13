/**
 * ANALYSE-60S — contrats de l'analyse publique en 60 s (docs/v5/00-BRIEF-V5.md, `FullAnalysis`).
 *
 * Les rapports SEO-AUDIT et GEO-OPT sont typés ici de façon STRUCTURELLE (`ModuleReport`) : le vrai `SeoReport`
 * (src/lib/seoaudit) et le vrai `GeoReport` (src/lib/geo) y sont assignables sans dépendance circulaire.
 */
import type { CrawlOptions, Finding, ScoredSection, Severity, SiteCrawl } from '@/lib/crawl/types';
import type { ProviderId } from '@/lib/engine/types';
import type { PerfData as SeoDataPerfData } from '@/lib/seodata/types';

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
  verdict: string;
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
