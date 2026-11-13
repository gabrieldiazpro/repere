# BAROMETRE — journal
- Fait : conception docs/v5/barometres.md (50 baromètres, 12 questions × 4 IA × 3 passages, marges bootstrap par question, coûts).
- Fait : src/lib/barometre (catalogue, coûts/budget, noms : fusion + exclusions, extraction, agrégation, simulé, stockage versionné, lecture publique, tâche).
- Fait : scripts/barometre/run.ts (--plan, --demo, --slug, --period, --budget, --withdraw ; reprise après interruption).
- Fait : pages /barometre, /barometre/[slug] (404 tant que non mesuré), CSV /barometre/[slug]/donnees.csv, JSON-LD Dataset ; API /api/v5/barometre, /[slug], /plan (admin).
- Vérifié : tsc sans erreur sur le périmètre ; vitest 29/29 (src/lib/barometre, src/app/barometre, scripts/barometre) ; eslint propre.
- Coût : ≈ 1,93 €/baromètre, ≈ 96,50 €/mois pour 50 (≈ 151,50 € avec Mistral). Budget par défaut 120 €.
- Variables nouvelles : BAROMETRE_BUDGET_EUR, BAROMETRE_PROVIDERS, BAROMETRE_DEMO_PREVIEW (local seulement).
- Non fait : aucune mesure réelle lancée (clés absentes ici) → aucune page publiée, voulu.
- À faire par d'autres : docs/v5/demandes-BAROMETRE.md (sitemap, llms.txt, type de tâche barometre.run + cron, sujet contact, lien de navigation).
