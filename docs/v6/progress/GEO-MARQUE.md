# GEO-MARQUE — journal (V6, 15 nov. 2026)
## Fait
- Recherche datée (opérateurs, études, comparatifs FR qui se classent) : docs/visibilite-repere/00-recherche.md.
- Site : /questions/[slug] ×5 (src/app/questions/[slug], _lib/{sources,refs,render,target-questions}.ts) ; étude
  /etudes/pourquoi-les-ia-recommandent-une-marque (etudes/[slug]/marque-citee.tsx, STUDIES) ; /questions 35 Q ;
  /glossaire 53 termes ; /etudes « En bref » ; Baromètre « premières mesures à venir » si 0 audit.
- Tests : src/app/questions/_lib/*.test.ts* (17, verts) ; compteurs de content.test.ts mis à jour (36→53, 30→35).
- tsc (mes chemins) et eslint (mes dossiers) : verts.
- Kit hors site : docs/visibilite-repere/ (README, 00 à 05, questions-suivies.csv importable).
- Demandes à SITE-SEO-90 : 11 points (sitemap, llms.txt, ONE_LINER SEO+GEO, sameAs nommés, maillage, FAQ accueil).
## Reste / à faire par d'autres
- SITE-SEO-90 : demandes-SITE-SEO-90.md § « De GEO-MARQUE ».
- Propriétaire de src/lib/house.ts : HOUSE_FACTS (V2) à aligner sur 01-textes-identite.md.
- Vitest complet 15 nov. 01 h 20 : 1 943/1 945 verts ; 2 échecs hors périmètre : content.test.ts « /outils/* = 9 » (20 trouvés, agent OUTILS) et v4-site.test.tsx « hero : un seul submit » (2 trouvés, accueil SITE-SEO-90). tsc complet vert ; eslint 0 erreur (2 avertissements anciens, content.test.ts l. 33 et 57).
- Fondateur : 5 actions du README du kit.
