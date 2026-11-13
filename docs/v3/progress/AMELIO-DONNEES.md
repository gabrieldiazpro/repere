# AMELIO-DONNEES — journal (10 nov. 2026)
**Fait** (tsc propre ; vitest src/lib src/app/api src/components : 1 001 verts, 4 rouges dans components/motion, fichiers en cours d'édition par un autre agent)
- Pourcentages : `ratio`, `mentionRateOf`, `shareOfVoiceOf`, `findRow`, `providerBreakdown`, `stats.mentionRate` (digest/stats.ts) ; rapport (derive.competitorRanking, CompetitorBars « % des citations · N réponses sur M ») et Concurrents lisent auditStats (B5, B6).
- Carte : même vivier que Concurrents, centrée sur le taux global, compteurs variés (B7). 14 avis, note 4,3 partout. Vérité : un « juste » par information × IA (B17).
- Mock : Maison Corail / Terre d’Ocre (plus de doublons) ; concurrents déclarés cités sans phrase prêtée (B21) ; pas d'adresse « 69001 France ».
- Copilote : review_reply sans « avis », share_of_voice, « qu'est-ce qui a changé », e-mail à l'auteur, fiche du produit nommé ; ventilation par IA = totaux ; Produits = mêmes chiffres (B8, B11) ; sources sans `_…_` ; comparatif sans donnée d'audit ni nombre de clients, cas « Pour qui choisir l'autre » explicites (B13). Markdown.tsx : tableaux et `_italique_` (B12).
- E-commerce : sellingChannel (revendeur = dossier acheteur, L ; marketplace = compte vendeur, M) (B15) ; fiches par produit, INCI à coller, « Il manque », jamais « à France » ; aperçu du rapport sans livrable en double (B14).
- « C'est fait » : lib/digest/fixes.ts + accueil vert « Correction faite le…, revérification le… » ; en-tête Actions sans compteur serveur (B16).
- Tests : src/lib/__tests__/amelio-donnees.test.ts (53). Note SITE : qa/v3/a-corriger-AMELIO-SITE.md.
**Reste** : démo en lecture seule, donc « C'est fait » n'atteint pas l'accueil démo (pas de persistance) ; cellules concurrent du comparatif non pré-remplies.
**À faire par d'autres** : MOTION/SITE : remettre les exports HERO_SCENES, MEASURE_ANSWERS, PROVE_TRAFFIC attendus par motion.test.ts.
