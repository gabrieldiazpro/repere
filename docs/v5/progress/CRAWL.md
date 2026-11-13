# CRAWL — journal
- Fait : **types publiés** (src/lib/crawl/types.ts, contrat mot pour mot + ajouts optionnels : CrawlOptions.signal/delayMs/checkLinks/maxLinkChecks ; SiteCrawl.redirects/aborted/linkChecks).
- Fait : `crawlSite(url, opts)` (src/lib/crawl/crawl.ts, index.ts) : entrée normalisée (repli http/www), redirections saut par saut (statuts, boucles, sortie du site), robots.txt RepereBot par origine (+ crawl-delay ≤ 2 s), sitemaps (index, gzip, 30 fichiers, 10 000 URL), file en largeur + échantillon équilibré par section, dédup (suivi, fragments, tri des paramètres), filtre HTML, concurrence ≤ 6, budgets pages/temps → `truncated`, annulation → `aborted`, extraction complète, rendu client, profondeur de clic (-1 = orpheline du sitemap), état des liens/images en HEAD (option). `publicCrawl()` retire le HTML.
- Fait : POST /api/v5/crawl (zod, 10/h/IP failClosed, 60 pages, 45 s, NDJSON ou SSE `format:'sse'`).
- Fait : 32 tests (faux sites node:http, src/lib/crawl/__tests__/fakesites.ts réutilisable par les autres agents) ; 60 pages ≈ 1,7 s ; tsc propre.
- Décisions : `isIndexable` juge le contenu à `finalUrl` ; pages uniques par URL finale ; `redirects` liste les URL redirigées.
- Hors périmètre (autorisé par la mission) : src/lib/siteaudit/fetch.ts — ajout additif `getFetchDeps()` et `TransportRequest.method` ('HEAD'). Tests siteaudit verts.
- À faire par d'autres : rien de bloquant.
