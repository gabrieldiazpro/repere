# AUDIT-SITE — journal (mission terminée)
Fait : reprise des 6 fichiers de l'agent 1 (complets) ; fetch.ts + `transportMs` ; robotsAudit.ts + `runSiteAuditJob` (import dynamique).
Fait : jsonld (validation par type + générateur via buildJsonLd), readiness /100 (plafonds si défaut bloquant), citability (20 règles, extraits, suggestions, IA facultative), product, compare (15 s), llms (mention honnête), reviewLink (reviewKit), runs (`siteaudit.runs`), api.ts, index.ts.
Fait : 9 routes /api/tools/** (zod, limite par IP, {ok, data|error}) + /api/siteaudit POST/GET (requireBusiness ; démo non enregistrée).
Fait : 39 tests verts (src/lib/siteaudit/__tests__) ; tsc propre sur mes chemins.
Non livré : détection de pare-feu par user-agent (non demandé au contrat) ; rendu navigateur (exclu).
Variables d'environnement nouvelles : aucune.
À faire par d'autres :
- TACHES-FOND : src/lib/jobs/handlers.ts DELEGATES['siteaudit.run'].loaders → `() => import('@/lib/siteaudit/runs')` (robotsAudit reste compatible).
- QUESTIONS : src/lib/prompts/adapters.ts getSiteFetcher() → `return (u) => fetchPageSnapshot(u)` (import de '@/lib/siteaudit').
- ECOMMERCE : src/lib/ecommerce/fetch.ts → remplacer l'adaptateur par `safeFetch` de '@/lib/siteaudit' (épinglage DNS, IPv6 mappée/NAT64, robots.txt).
- OUTILS : citabilité = afficher `passed/total` + `disclaimer` ; readiness peut porter `cap`.
