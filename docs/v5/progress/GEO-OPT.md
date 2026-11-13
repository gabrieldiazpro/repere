# GEO-OPT — journal
- Fait : recherche → docs/v5/geo-methode.md (docs OpenAI, Perplexity, Anthropic, Mistral, Google, Bing ; GEO KDD 2024 ; Ahrefs, SE Ranking, Toronto 2025, recency bias ; niveau de preuve par règle).
- Fait : src/lib/geo — `auditGeo(crawl, ctx)` pur → GeoReport, 8 sections (accès robots/en-têtes/pare-feu/rendu JS, entité NAP+JSON-LD+sameAs+à propos+auteurs+fiche de vérité, passages notés + réécritures, fan-out + FAQ, fraîcheur, données structurées, hors site depuis sources IA, llms.txt informatif poids 0). `GeoFinding` = Finding + `evidenceLevel`.
- Fait : `rewritePassage` (fournisseur engine/providers via getExtractor, garde-fou anti-invention nombres/liens, repli déterministe), `generateFanOut`, `runGeo` (IA puis audit ; sans clé : démo étiquetée `demo:true`).
- Fait : POST /api/v5/geo ({crawl} ou {url}, 10/h/IP failClosed, `ai:false` possible).
- Fait : 41 tests (3 témoins exemplaires sans faux positif, cas par constat, IA simulée, route sur faux sites CRAWL) ; tsc propre.
- Variables : GEO_LLM=off (désactive l'IA du module) ; sinon clés existantes du moteur.
- Limites : pare-feu jugé sur RepereBot (indice) ; pas d'analyse de journaux serveur ; hors site « non mesuré » sans réponses d'IA.
- À faire par d'autres : PUBLICATION — accepter les charges utiles autoFix décrites dans docs/v5/demandes-PUBLICATION.md. ANALYSE-60S — appeler `runGeo(crawl, { brand, siteType, facts, aiAnswers })` (HTML du crawl requis).
