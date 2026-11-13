# SEO-DATA — journal (13 nov. 2026)
- Fait : recherche sourcée + coûts → docs/v5/donnees-seo.md. src/lib/seodata/** : Search Console (OAuth anti-CSRF, jetons chiffrés, propriété, import 16 mois, synchro quotidienne, sitemaps, inspection), PageSpeed+CrUX → `PerfData` (types.ts), DataForSEO (volumes, SERP + aperçu IA, Labs, liens), Bing (clé du client, chiffrée), démo étiquetée (3 comptes), « non configuré » explicite, plafond de coût mensuel (cost.ts), suivi de positions (rank.ts), tâches (jobs.ts). Routes /api/v5/seodata/** et /api/v5/connect/google/**. 57 tests verts (faux serveurs locaux), tsc et eslint propres.
- Coût estimé/mois : Découverte 0 € ; Essentiel Local ≈ 0,25 € ; Essentiel PME/E-com ≈ 1 € ; Accompagné ≈ 4,60 € ; Agence ≈ 20 € (20 marques). Fixe : 0 € (dépôt 50 $ unique) ; 100 $/mois si liens entrants activés.
- Variables nouvelles (.env.example) : PAGESPEED_API_KEY, CRUX_API_KEY, DATAFORSEO_LOGIN, DATAFORSEO_PASSWORD, SEODATA_EUR_PER_USD (GOOGLE_CLIENT_ID/SECRET réutilisés).
- À faire par d'autres (orchestrateur) :
  1. src/lib/jobs/types.ts : JOB_TYPES += 'seodata.gsc.sync','seodata.rank.weekly','seodata.rank.collect' ; DEFAULT_PRIORITY += 5, 6, 6. jobs/handlers.ts installBuiltinHandlers : `import('@/lib/seodata/jobs').then(m => m.registerSeoDataJobs())`. Sans cela : exécution en ligne + reprise par le cron.
  2. vercel.json / pg_cron : GET /api/v5/seodata/cron quotidien (Bearer CRON_SECRET).
  3. entitlements.ts : champ `seoData` = SEODATA_LIMITS (src/lib/seodata/limits.ts : mots-clés 0/20/100/300/2000, plafond 0/1/3/10/40 €).
  4. check-env + guide : 5 variables ci-dessus ; URI Google <APP_URL>/api/v5/connect/google/callback.
  5. APP-SEO (vague B) : page /app/seo?gsc=connected|choose_property|no_property|denied|invalid_state|error|not_configured (retour OAuth).
  6. ANALYSE-60S : `pagespeedSummary(url, signal)` (src/lib/seodata/perf.ts) = `AnalysisModules.pagespeed`. SEO-AUDIT : `PerfData` dans src/lib/seodata/types.ts (docs/v5/demandes-SEO-DATA.md absent à ce jour).
