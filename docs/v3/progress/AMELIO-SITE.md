# AMELIO-SITE (B9, B19, B20, B24, amél. 13, 14, 15 de qa/v3/regard-client-v3.md)

Fait :
- B20 : onglet par défaut de la landing = « Artisan, commerce » (HeroDemo).
- B19 / amél. 14 : site/offer-facts.ts lit fréquence, questions et IA dans getEntitlements (landing, /local, /pme, /e-commerce, AiStrip, /tarifs, fonctionnalités, Bento). ProofWall : 8 × 3 IA × 2 passages = 48.
- B24 : exemple fiche produit = shampoing « Onde » lu dans DEMO_PRODUCTS, prix « 12,90 € » (tools/format.ts, marges arrondies).
- Amél. 15 : section /tarifs#accompagne (pages/AccompagneProof + accompagne-data) : livrables réels de Repéré et des comptes démo, premier mois en 5 étapes, ce que le client valide ; FAQ TVA 293 B précisée.
- B9 / amél. 13 : site/demo-figures.ts calcule au rendu (buildDemoWorkspace, auditStats, getAiTraffic, buildWeeklyDigest, productTracking, buildLocalDemo) ; scènes (motion/scenes/live.tsx), mockups, Bento, mocks, ChatScene, /demo lus là. Plus aucun chiffre démo en dur ; revalidate 1 jour.
- Tests : site/__tests__ (offer-facts, demo-figures), tools format, pages accompagne, motion mis à jour. tsc propre, vitest components + app verts.

Reste : —

À faire par d'autres :
- APP : Réglages Découverte affichent Claude et Mistral cochés (src/components/app/Settings.tsx : n'afficher que getEntitlements().engines).
- APP : « marge ± 13.7 pts » (Effet de vos actions, src/app/app) → Math.round.
- DIGEST : lundi d'un compte mensuel sans nouvelle mesure : « Pas de nouvelle mesure cette semaine : voici vos 3 actions ».
- Note obsolète d'AMELIO-DONNEES (exports HERO_SCENES…) : motion.test.ts lit désormais demo-figures.
