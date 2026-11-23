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
  // --- Ajouts ROBUSTESSE (V6, optionnels) ---
  /** Plateforme reconnue (CMS, constructeur, boutique, cadriciel) : sert aux conseils et à l'agent. */
  platform?: PlatformInfo | null;
  /** Ce que le robot a pu lire, et pourquoi pas le reste : l'analyse en tire un état et un message explicites. */
  diagnosis?: CrawlDiagnosis;
  /** Rendu JavaScript (CRAWL_RENDER=on) : pages rendues dans un navigateur sans tête, et pourquoi pas les autres. */
  render?: { enabled: boolean; attempted: number; rendered: string[]; ms: number; error?: string };
}

export type PlatformId =
  | 'wix' | 'shopify' | 'squarespace' | 'wordpress' | 'webflow' | 'prestashop' | 'magento' | 'joomla' | 'drupal' | 'jimdo'
  | 'godaddy' | 'weebly' | 'hostinger' | 'framer' | 'duda' | 'nextjs' | 'nuxt' | 'gatsby';
export interface PlatformInfo {
  id: PlatformId;
  name: string;
  /** high : signature propre à la plateforme ; medium : ressources hébergées chez elle seulement. */
  confidence: 'high' | 'medium';
  /** indices relevés (lisibles) */
  evidence: string[];
  ecommerce?: boolean;
  /** extensions repérées (WordPress : WooCommerce, Yoast SEO, Rank Math…) */
  plugins?: string[];
}

/**
 * État d'accès principal (le plus bloquant) :
 * - lisible : 'ok', 'js_only' (contenu rendu par JavaScript : on voit ce que voient la plupart des robots d'IA) ;
 * - illisible (aucun score ne doit être calculé) : tous les autres.
 */
export type AccessState =
  | 'ok'
  | 'js_only'
  | 'blocked_robots'
  | 'blocked_firewall'
  | 'rate_limited'
  | 'auth_required'
  | 'password_protected'
  | 'maintenance'
  | 'server_error'
  | 'http_error'
  | 'parked'
  | 'not_html'
  | 'empty'
  | 'redirect_loop'
  | 'too_many_redirects'
  | 'cookie_loop'
  | 'timeout'
  | 'unreachable'
  | 'dns'
  | 'blocked_address'
  | 'tls_error'
  | 'directory_listing';
export type AccessNoteCode =
  | 'robots_timeout'
  | 'robots_unreachable'
  | 'robots_server_error'
  | 'robots_html'
  | 'robots_blocks_some'
  | 'moved'
  | 'js_redirect'
  | 'meta_refresh'
  | 'cookie_required'
  | 'rate_limited_partial'
  | 'firewall_partial'
  | 'slow_pages'
  | 'huge_page'
  | 'binary_pages'
  | 'url_traps'
  | 'js_pages'
  | 'rendered'
  | 'http_only';
export interface CrawlDiagnosis {
  state: AccessState;
  /** du contenu HTML a pu être lu (au moins une page 200) : les audits ont un sens */
  readable: boolean;
  /** pages HTML en 200 lues */
  pagesRead: number;
  /** statut HTTP de la page d'accueil (0 : pas de réponse) */
  homeStatus: number;
  /** Retry-After annoncé (s), si limitation ou maintenance */
  retryAfterS?: number;
  /** pare-feu ou service anti-robots reconnu */
  firewall?: string;
  /** signaux secondaires */
  notes: { code: AccessNoteCode; detail?: string }[];
}
export interface CrawledPage {
  url: string; finalUrl: string; status: number; redirectChain: { url: string; status: number; via?: 'meta-refresh' | 'js' | 'cookie' }[];
  depth: number; contentType?: string; bytes: number; fetchMs: number;
  headers: Record<string, string>;                         // en minuscules : x-robots-tag, content-language, cache-control…
  blockedByRobots?: boolean;
  html?: string;                                            // gardé seulement si ≤ 1,5 Mo ; sinon undefined (V6 : début gardé, voir htmlTruncated)
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
  // --- Ajouts ROBUSTESSE (V6, optionnels) ---
  /** `html` ne contient que les 1,5 premiers Mo de la page (page plus lourde) */
  htmlTruncated?: boolean;
  /** canonical déclaré dans l'en-tête HTTP Link (peut contredire celui du HTML) */
  canonicalHeader?: string;
  /** page rendue dans un navigateur (CRAWL_RENDER) : champs extraits du DOM rendu, `renderHints` du HTML serveur */
  rendered?: boolean;
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
