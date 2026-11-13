# SEO-AUDIT — journal
- Fait : docs/v5/seo-controles.md (recherche sourcée Google/web.dev + Screaming Frog, Semrush, Sitebulb, Ahrefs, SE Ranking ; nouveautés 2025–26 : INP, FAQ retirée mai 2026, types abandonnés 2025 ; catalogue généré depuis le code).
- Fait : src/lib/seoaudit : `auditSeo(crawl, { siteType?, perf? }) → SeoReport` ; 185 contrôles / 12 sections (checks/*.ts) ; schema.ts (exigences Google par type) ; autofix.ts (meta, alt, JSON-LD Organization/LocalBusiness/BreadcrumbList, redirections, canonical, sitemap, robots) ; score par section + global (pondération documentée, arrondi à 5) ; topFixes (sévérité × impact / effort) ; `detectSiteType`.
- Fait : exploite les ajouts CRAWL (`redirects`, `linkChecks`, depth -1) ; accepte `PerfData` de SEO-DATA (perf.ts).
- Fait : POST /api/v5/seoaudit ({ url } → crawlSite, ou { crawl }) ; zod, 10/h/IP (url, failClosed) ou 60/h (crawl).
- Tests : 216 verts (1 test par contrôle sur faux SiteCrawl, 3 sites propres sans faux positif, 3 témoins artisan/PME/boutique, vrai crawl sur faux sites HTTP de CRAWL, route). tsc propre.
- Décision : sans HTML (publicCrawl) les contrôles HTML ne se déclenchent pas → `stats.pagesWithHtml`. ANALYSE-60S doit auditer le crawl AVANT publicCrawl().
- À faire par d'autres : ANALYSE-60S → appeler auditSeo sur le crawl complet (avec HTML) ; PUBLICATION → kinds autoFix listés dans autofix.ts (en-tête) et seo-controles.md §5.
- Aucune variable d'environnement nouvelle.
