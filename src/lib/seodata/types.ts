/**
 * SEO-DATA — contrats des données SEO externes (docs/v5/00-BRIEF-V5.md, docs/v5/donnees-seo.md).
 *
 * Règle : aucune donnée fabriquée. Chaque résultat porte sa `source` (fournisseur réel, « demo » étiqueté, ou rien).
 * Un fournisseur non configuré ne renvoie jamais de chiffres : il est décrit par `ProviderStatus` (state 'off').
 */

export type Device = 'mobile' | 'desktop';
export type Rating = 'good' | 'needs-improvement' | 'poor';

/** Provenance d'une donnée, affichée telle quelle dans l'interface. */
export interface DataSource {
  /** 'google-search-console' | 'pagespeed-insights' | 'crux' | 'dataforseo' | 'bing-webmaster' | 'demo' */
  provider: string;
  /** vrai = données de démonstration (comptes démo uniquement) */
  demo: boolean;
  fetchedAt: string;
  note?: string;
}

export type ProviderKind = 'searchConsole' | 'perf' | 'keywords' | 'serp' | 'backlinks' | 'bing';

export interface ProviderStatus {
  kind: ProviderKind;
  /** live : fournisseur réel ; demo : données de démonstration ; off : non configuré (aucun chiffre) */
  state: 'live' | 'demo' | 'off';
  provider: string | null;
  /** phrase affichable (« Non configuré : ajoutez DATAFORSEO_LOGIN… ») */
  reason?: string;
}

// ---------------------------------------------------------------------------
// Performance (PageSpeed Insights + CrUX) — interface attendue par SEO-AUDIT et ANALYSE-60S
// ---------------------------------------------------------------------------

/** Mesure de terrain (utilisateurs Chrome réels, p75 sur 28 jours). */
export interface PerfField {
  /** 'url' : données de cette page ; 'origin' : tout le site (la page n'a pas assez de trafic) */
  scope: 'url' | 'origin';
  lcpMs: number | null;
  inpMs: number | null;
  cls: number | null;
  fcpMs: number | null;
  ttfbMs: number | null;
  ratings: { lcp: Rating | null; inp: Rating | null; cls: Rating | null };
  /** Signaux Web essentiels réussis (LCP, INP et CLS « bons ») ; null si une mesure manque */
  passesCwv: boolean | null;
  /** période CrUX (AAAA-MM-JJ), si connue */
  period?: { from: string; to: string } | null;
  source: 'pagespeed-insights' | 'crux' | 'demo';
}

/** Mesure de laboratoire (Lighthouse, une exécution simulée). */
export interface PerfLab {
  /** score Performance 0–100 */
  performance: number | null;
  lcpMs: number | null;
  cls: number | null;
  tbtMs: number | null;
  fcpMs: number | null;
  speedIndexMs: number | null;
  /** pistes d'amélioration Lighthouse avec gain estimé */
  opportunities: { id: string; title: string; savingsMs: number | null }[];
}

export interface PerfDevice {
  device: Device;
  field: PerfField | null;
  lab: PerfLab | null;
}

export interface PerfData {
  url: string;
  fetchedAt: string;
  demo: boolean;
  devices: Partial<Record<Device, PerfDevice>>;
  /** erreurs par appareil (mesure partielle) */
  errors: { device: Device; message: string }[];
  sources: string[];
}

// ---------------------------------------------------------------------------
// Search Console
// ---------------------------------------------------------------------------

export type GscDimension = 'date' | 'query' | 'page' | 'country' | 'device' | 'searchAppearance';

export interface GscQuery {
  startDate: string;
  endDate: string;
  dimensions?: GscDimension[];
  rowLimit?: number;
  startRow?: number;
  type?: 'web' | 'image' | 'video' | 'news' | 'discover' | 'googleNews';
  dataState?: 'final' | 'all';
  filters?: { dimension: GscDimension; operator?: 'equals' | 'contains' | 'notContains' | 'notEquals' | 'includingRegex' | 'excludingRegex'; expression: string }[];
}

export interface GscRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscSite {
  siteUrl: string;
  permissionLevel: string;
}

export interface GscSitemap {
  path: string;
  lastSubmitted?: string;
  lastDownloaded?: string;
  isPending: boolean;
  isSitemapsIndex: boolean;
  warnings: number;
  errors: number;
  contents: { type: string; submitted: number; indexed: number | null }[];
}

export interface GscInspection {
  url: string;
  verdict: string;
  coverageState?: string;
  indexingState?: string;
  robotsTxtState?: string;
  pageFetchState?: string;
  lastCrawlTime?: string;
  googleCanonical?: string;
  userCanonical?: string;
  crawledAs?: string;
  link?: string;
}

export interface SearchConsoleProvider {
  readonly name: string;
  readonly demo: boolean;
  listSites(): Promise<GscSite[]>;
  /** Pagine automatiquement jusqu'à `maxRows` (défaut 25 000). */
  query(siteUrl: string, q: GscQuery, maxRows?: number): Promise<GscRow[]>;
  sitemaps(siteUrl: string): Promise<GscSitemap[]>;
  inspect(siteUrl: string, url: string): Promise<GscInspection>;
}

// ---------------------------------------------------------------------------
// Mots-clés, SERP, liens
// ---------------------------------------------------------------------------

export interface KeywordLocation {
  /** code DataForSEO (2250 = France) ; prioritaire sur `name` */
  code?: number;
  /** « Paris,Ile-de-France,France » */
  name?: string;
  language: string;
}

export interface KeywordMetrics {
  keyword: string;
  /** recherches mensuelles moyennes (Google Ads) ; null si Google ne donne rien */
  volume: number | null;
  cpcEur?: number | null;
  competition?: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  /** 0–100, si le fournisseur l'expose */
  difficulty?: number | null;
  trend?: { month: string; volume: number }[];
}

export interface KeywordsProvider {
  readonly name: string;
  readonly demo: boolean;
  volumes(keywords: string[], loc: KeywordLocation): Promise<KeywordMetrics[]>;
  difficulty?(keywords: string[], loc: KeywordLocation): Promise<Record<string, number | null>>;
  /** mots-clés sur lesquels le domaine se positionne (Labs) */
  rankedKeywords?(domain: string, loc: KeywordLocation, limit: number): Promise<{ keyword: string; position: number; url: string; volume: number | null; difficulty: number | null }[]>;
  /** concurrents organiques (Labs) */
  competitors?(domain: string, loc: KeywordLocation, limit: number): Promise<{ domain: string; commonKeywords: number; avgPosition: number | null }[]>;
}

export interface SerpRequest {
  keyword: string;
  device: Device;
  location: KeywordLocation;
  /** 10 ou 20 */
  depth: number;
  aiOverview: boolean;
}

export interface SerpOrganic {
  position: number;
  domain: string;
  url: string;
  title?: string;
}

export interface SerpResult {
  keyword: string;
  device: Device;
  checkedAt: string;
  /** types d'éléments présents (featured_snippet, local_pack, people_also_ask, ai_overview…) */
  features: string[];
  /** true / false si le fournisseur l'expose ; null si inconnu */
  aiOverview: boolean | null;
  /** domaines cités dans l'aperçu IA (si exposés) */
  aiOverviewDomains: string[];
  organic: SerpOrganic[];
  checkUrl?: string;
  costUsd?: number;
}

export interface SerpProvider {
  readonly name: string;
  readonly demo: boolean;
  /** relevé immédiat (plus cher) */
  live(req: SerpRequest): Promise<SerpResult>;
  /** file standard (moins chère) : dépôt puis collecte */
  submit?(reqs: SerpRequest[]): Promise<{ taskId: string; req: SerpRequest }[]>;
  collect?(taskId: string, req: SerpRequest): Promise<SerpResult | null>;
}

export interface BacklinksSummary {
  target: string;
  backlinks: number;
  referringDomains: number;
  referringMainDomains?: number;
  rank?: number | null;
  brokenBacklinks?: number;
}

export interface BacklinksProvider {
  readonly name: string;
  readonly demo: boolean;
  summary(target: string): Promise<BacklinksSummary>;
  referringDomains(target: string, limit: number): Promise<{ domain: string; backlinks: number; rank: number | null; firstSeen: string | null }[]>;
  anchors(target: string, limit: number): Promise<{ anchor: string; backlinks: number; referringDomains: number }[]>;
  newLost(target: string, from: string): Promise<{ date: string; newBacklinks: number; lostBacklinks: number; newDomains: number; lostDomains: number }[]>;
}

export interface BingQueryRow {
  query: string;
  date: string;
  clicks: number;
  impressions: number;
  avgPosition: number | null;
}

export interface BingProvider {
  readonly name: string;
  readonly demo: boolean;
  sites(): Promise<string[]>;
  queryStats(siteUrl: string): Promise<BingQueryRow[]>;
  trafficStats(siteUrl: string): Promise<{ date: string; clicks: number; impressions: number }[]>;
}
