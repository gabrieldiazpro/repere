# V5 — Repéré devient la référence SEO + GEO des sites professionnels (brief et contrats)

Demande du fondateur (13 nov. 2026) : « Le site n'est pas au niveau, pas assez intelligent, pas la référence du SEO / GEO /
mise en avant des sites commerçants ». Choix explicites : (1) analyse réelle du site en 60 s, (2) SEO classique complet,
(3) agent qui fait le travail, (4) données exclusives (baromètres), (5) optimisation GEO poussée — pour TOUS les sites pros
(commerces locaux, PME/B2B, e-commerce).

## Promesse V5
« Entrez votre site : en 60 secondes, Repéré l'explore pour de vrai, vous dit pourquoi Google et les IA vous recommandent
(ou pas), et fait les corrections avec vous. » Mesurer → Comprendre → Agir → Prouver, sur Google ET sur les IA.

## Règles absolues (inchangées)
- Aucune donnée inventée présentée comme réelle. Démo = étiquetée démo. Pas de volumes de recherche ou de positions
  fabriqués : si un fournisseur de données n'est pas configuré, on le dit et on montre ce qu'on mesure sans lui.
- Aucune promesse de résultat. Marges d'erreur sur les mesures des IA.
- Aucune action publiée chez le client sans sa validation explicite ; tout changement est réversible et journalisé.
- Respect des sites analysés : robots.txt (notre robot RepereBot), politesse (concurrence ≤ 4, délai), SSRF bloqué
  (réutiliser src/lib/siteaudit/fetch.ts : safeFetch, isBlockedIp, setFetchDeps pour les tests).
- Sécurité : secrets chiffrés au repos (INTEGRATIONS_SECRET, voir src/lib/integrations), aucun jeton côté client.
- Règles machine : /home/claude/auditia/docs/v3/missions/_COMMUN.md (verrou `flock /tmp/repere-heavy.lock` pour tsc /
  vitest ; jamais de next build / dev / start dans le dossier principal ; tests sur faux serveurs HTTP locaux : le réseau
  sortant de la machine est filtré, ne compte pas sur Internet dans les tests).
- Réutiliser l'existant : src/lib/siteaudit (fetch sûr, robots, bots IA, html, jsonld, citabilité, llms, produit),
  src/lib/engine (moteur IA, fournisseurs, sources), src/lib/jobs (file de tâches), src/lib/store (documents),
  src/lib/entitlements (droits par offre), src/lib/integrations (secrets chiffrés, webhooks), src/lib/ecommerce/shopify.ts.

## Modules et périmètres exclusifs (vague A : moteurs, sans interface)
| Agent | Possède | Produit |
|---|---|---|
| CRAWL | src/lib/crawl/** | exploration réelle d'un site → `SiteCrawl` |
| SEO-AUDIT | src/lib/seoaudit/** | 100+ contrôles SEO sur `SiteCrawl` → `SeoReport` |
| GEO-OPT | src/lib/geo/** | optimisation GEO poussée sur `SiteCrawl` (+ moteur IA) → `GeoReport` |
| SEO-DATA | src/lib/seodata/** | données externes : Search Console, PageSpeed/CrUX, Bing Webmaster, DataForSEO (mots-clés, positions, liens), suivi de positions |
| PUBLICATION | src/lib/publish/** | agent qui applique les correctifs : WordPress, Shopify, Webflow, PrestaShop, fiche Google (si API), export ; aperçu, validation, application, retour arrière, mesure d'effet |
| BAROMETRE | src/lib/barometre/**, scripts/barometre/** | baromètres publics par métier × ville / catégorie, à partir de VRAIES mesures |
| ANALYSE-60S (vague A aussi) | src/lib/analysis/** | orchestration de l'analyse publique en 60 s : CRAWL → SEO-AUDIT + GEO-OPT + SEO-DATA (si configuré) + contrôle IA rapide → `FullAnalysis`, en flux (progression) |
Vague B (interfaces, après la vague A) : page publique d'analyse et rapport, nouvelles sections de l'app, positionnement du
site. Les agents de vague A NE TOUCHENT PAS aux pages ni aux composants ; ils exposent des fonctions pures + des routes
d'API minces dans src/app/api/v5/<module>/** (leur périmètre aussi).

## Contrat central : `SiteCrawl` (src/lib/crawl/types.ts — CRAWL l'écrit EN PREMIER, mot pour mot, puis peut AJOUTER des champs optionnels)
```ts
export interface CrawlOptions {
  maxPages?: number;          // défaut 60 (analyse publique), jusqu'à 2 000 en app selon l'offre
  timeBudgetMs?: number;      // défaut 45_000
  concurrency?: number;       // défaut 4, max 6
  includeSubdomains?: boolean;
  userAgent?: string;         // défaut RepereBot
  respectRobots?: boolean;    // défaut true
  onProgress?: (p: CrawlProgress) => void;
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
}
```
Résultats communs (SEO-AUDIT et GEO-OPT utilisent la même forme de constat) :
```ts
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
```
`SeoReport` = { score, sections: ScoredSection[], topFixes: Finding[] (impact×effort), stats } ; `GeoReport` idem.
`FullAnalysis` (ANALYSE-60S) = { crawl résumé, seo: SeoReport, geo: GeoReport, data?: résumé SEO-DATA, ai?: contrôle IA
rapide, verdict: phrase, scores: { seo, geo, global }, priorities: Finding[] (les 5 premières, mélangées SEO+GEO) }.

## Journal, coordination
Chaque agent tient /home/claude/auditia/docs/v5/progress/<NOM>.md (fait, décisions, ce qu'il attend des autres).
Les demandes à un autre module vont dans /home/claude/auditia/docs/v5/demandes-<NOM>.md. Un agent de passe design V4 peut
encore travailler sur src/app/app/** et src/components/** : ne pas y toucher en vague A.
