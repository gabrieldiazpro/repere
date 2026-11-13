/**
 * Contrat central V5 : `SiteCrawl` (voir docs/v5/00-BRIEF-V5.md).
 * Recopié mot pour mot du brief. On ne peut qu'AJOUTER des champs optionnels.
 */
export interface CrawlOptions {
  maxPages?: number;          // défaut 60 (analyse publique), jusqu'à 2 000 en app selon l'offre
  timeBudgetMs?: number;      // défaut 45_000
  concurrency?: number;       // défaut 4, max 6
  includeSubdomains?: boolean;
  userAgent?: string;         // défaut RepereBot
  respectRobots?: boolean;    // défaut true
  onProgress?: (p: CrawlProgress) => void;
  // --- Ajouts CRAWL (optionnels) ---
  /** Annulation : l'exploration s'arrête et renvoie un résultat partiel (`aborted: true`). */
  signal?: AbortSignal;
  /** Pause entre deux requêtes d'un même fil, en ms (défaut 100). Un crawl-delay du robots.txt l'emporte (plafonné à 2 s). */
  delayMs?: number;
  /** Vérifier l'état des liens sortants et des images (HEAD, échantillon plafonné). Défaut : non. */
  checkLinks?: boolean;
  /** Plafond de vérifications quand `checkLinks` (défaut 40, max 500). */
  maxLinkChecks?: number;
}
export interface CrawlProgress { phase: 'robots' | 'sitemaps' | 'pages' | 'done'; fetched: number; queued: number; total?: number; currentUrl?: string }
export interface SiteCrawl {
  startUrl: string; origin: string; finalOrigin: string;   // après redirections (http→https, www)
  startedAt: string; durationMs: number; truncated: boolean; // true si budget pages/temps atteint
  robots: { url: string; status: number; text?: string; sitemaps: string[] } | null;
  sitemaps: { url: string; status: number; urlCount: number; errors: string[] }[];
  sitemapUrls: string[];                                    // toutes les URL déclarées (plafonné 10 000)
  pages: CrawledPage[];
  links: { from: string; to: string; anchor: string; rel: string[]; internal: boolean }[];
  errors: { url: string; error: string }[];
  // --- Ajouts CRAWL (optionnels) ---
  /** Toutes les URL explorées qui redirigent (y compris boucles et sorties du site). */
  redirects?: { from: string; to: string; chain: { url: string; status: number }[]; error?: string }[];
  /** true si l'exploration a été annulée (signal). */
  aborted?: boolean;
  /** État des liens sortants et des images (si `checkLinks`). status 0 = injoignable (voir `error`). */
  linkChecks?: { url: string; kind: 'link' | 'image'; status: number; finalUrl?: string; bytes?: number; blockedByRobots?: boolean; error?: string }[];
}
export interface CrawledPage {
  url: string; finalUrl: string; status: number; redirectChain: { url: string; status: number }[];
  depth: number; contentType?: string; bytes: number; fetchMs: number;
  headers: Record<string, string>;                         // en minuscules : x-robots-tag, content-language, cache-control…
  blockedByRobots?: boolean;
  html?: string;                                            // gardé seulement si ≤ 1,5 Mo ; sinon undefined
  title?: string; metaDescription?: string; metaRobots?: string; canonical?: string;
  lang?: string; hreflang: { lang: string; href: string }[];
  h1: string[]; headings: { level: number; text: string }[];
  wordCount: number; textHash: string;                      // pour les doublons
  images: { src: string; alt?: string; width?: number; height?: number; loading?: string; bytes?: number }[];
  jsonLd: unknown[]; jsonLdErrors: string[];
  openGraph: Record<string, string>;
  internalLinks: number; externalLinks: number;
  isIndexable: boolean;                                     // status 200 + pas noindex + canonical sur soi
  renderHints: { scriptsCount: number; textToHtmlRatio: number; likelyClientRendered: boolean };
  // Notes CRAWL : `depth` = profondeur de clic depuis l'accueil (-1 : page vue seulement dans le sitemap, non reliée) ;
  // `finalUrl` normalisée ; `isIndexable` juge le contenu à `finalUrl` (voir `redirectChain` pour la redirection).
}

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export interface Finding {
  id: string;                 // stable, ex. 'seo.title.missing'
  category: string;           // 'technique' | 'indexation' | 'contenu' | 'balisage' | 'performance' | 'liens' | 'international' | 'images' | 'geo.acces' | 'geo.entite' | 'geo.contenu' | 'geo.sources' …
  severity: Severity;
  title: string;              // en français, phrase-résultat : « 12 pages n'ont pas de titre »
  why: string;                // pourquoi ça compte, 1–2 phrases, sans jargon
  fix: string;                // quoi faire, concret
  affected: { url: string; detail?: string }[];   // plafonné à 200, avec `affectedCount`
  affectedCount: number;
  impact: 1 | 2 | 3;          // effet attendu
  effort: 1 | 2 | 3;          // effort
  autoFix?: { kind: string; payload: unknown };   // si PUBLICATION peut l'appliquer (meta, jsonld, alt, redirection, llms.txt, robots…)
  evidence?: string;          // extrait, valeur mesurée
}
export interface ScoredSection { id: string; label: string; score: number /* 0–100 */; findings: Finding[] }
