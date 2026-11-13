# ANALYSE-60S — journal
## Fait
- src/lib/analysis : `runFullAnalysis` (flux d'événements numérotés, budget 58 s, exploration 60 p/45 s, parallèle crawl→SEO+GEO / PageSpeed / IA, résultat partiel), détection (JSON-LD, og:site_name, titre, domaine), synthèse (scores SEO/GEO/global, 5 priorités SEO+GEO impact×effort, autoFixes, verdict, avant/après), contrôle IA (moteur `runAudit`, 3–6 questions, plafond `ANALYSIS_MAX_AI_CALLS`=18, démo étiquetée), stockage (analysis.runs/domains, jeton signé 90 j via share, cache 10 min, e-mail haché, `attachAnalysisToBusiness` + audit moteur rattaché).
- Modules branchés : CRAWL `crawlSite`, SEO-DATA `pagespeedSummary` ; SEO et GEO = adaptateurs provisoires réels mais réduits (provisional.ts, `modules.seo.provisional`).
- Routes : POST /api/v5/analysis (NDJSON, `pro` obligatoire, limites IP/domaine/global, cache, SSRF), GET /api/v5/analysis/[id] (jeton ou membre).
- Vérifié : tsc propre sur mes chemins ; vitest lib + route : 16/16 (faux site node:http, < 20 s).
## Variables nouvelles
ANALYSIS_MAX_AI_CALLS, ANALYSIS_RATE_LIMIT_PER_HOUR (6) / _PER_DAY (15), ANALYSIS_PER_DOMAIN_PER_HOUR (4), ANALYSIS_GLOBAL_PER_HOUR (120) / _PER_DAY (600).
## À faire par d'autres
- SEO-AUDIT / GEO-OPT : publier `auditSeo(crawl, { siteType, perf })` / `auditGeo(crawl, ctx)` → remplacer dans src/lib/analysis/modules.ts (2 lignes) et supprimer provisional.ts.
- Auth (claims.ts, afterSignup) : `claim.analysis` → `attachAnalysisToBusiness(id, businessId, session.email)`.
- ANALYSE-UI : consommer le flux NDJSON ; lien `/analyse/<id>?t=<jeton>` (page à créer) ; check-env/guide : variables ci-dessus.
