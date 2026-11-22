# TEST-MARQUE (V8) — journal (22 nov. 2026)
## Fait
- Test de marque en tête de /analyse : src/lib/analysis/{brandtest,aicheck,aiguard,why,signals,mail}.ts, run.ts (événements
  brandplan / brand / brandskip, « pourquoi lui » finalisé avec l'exploration), BrandTest.tsx (direct + rapport).
  1 exécution par question × chaque IA configurée (lit ALL_PROVIDERS + PROVIDER_LABELS : les IA de MOTEURS-IA sont prises
  d'office), 3 à 5 questions sous ANALYSIS_MAX_AI_CALLS (18), Wilson 90 %, « mesure unique, à confirmer dans le temps ».
- Pourquoi lui : sources des réponses (le nomme / vous nomme), page d'accueil du concurrent lue (1 page, CrawlFetcher,
  robots.txt) vs toutes vos pages lues ; écart affiché seulement s'il est relevé chez lui ET absent chez vous ; 3 actions,
  « Repéré la prépare » seulement si un correctif (jsonld, meta.title…) existe dans l'analyse.
- Garde-fous : cache 24 h par domaine+marque+ville (ANALYSIS_BRAND_CACHE_HOURS), ANALYSIS_AI_PER_DOMAIN_PER_DAY (3),
  ANALYSIS_AI_DAILY_CAP_EUR (5, réservation avant appel), pause OPS ; route : ANALYSIS_PER_DOMAIN_PER_DAY (12).
- E-mail du rapport : lib/analysis/mail.ts (test de marque en tête, désinscription). Rapport partageable + impression
  (cellules et « pourquoi » dépliés à l'impression).
- Inscription libre : DEMO_MODE=1 (hors Vercel, sans Supabase) → comptes de démonstration (config.demoAccounts) ; e-mail
  de confirmation (auth/mail.sendLoginLinkEmail) en mode local ; lien à l'écran seulement pour créer un compte non
  confirmé. Rattachement par le lien signé : POST /api/v5/analysis/[id]/claim (store.addRequesterEmail). Questions du
  test semées comme questions suivies (claims.createOwnedBusiness).
- Tests : brandtest.test.ts, inscription-libre.test.ts, claim.test.ts ; unit/analysis tests mis à jour.
## À faire par d'autres
- SITE : docs/v8/demandes-SITE.md (accroche, « sans carte bancaire », liste des IA via brandTestEngines()).
- MISE-EN-LIGNE : documenter ANALYSIS_BRAND_CACHE_HOURS, ANALYSIS_AI_PER_DOMAIN_PER_DAY, ANALYSIS_AI_DAILY_CAP_EUR,
  ANALYSIS_PER_DOMAIN_PER_DAY dans .env.example (facultatives, valeurs par défaut sûres).
## Vérifications (22 nov., fin)
- tsc : 0 erreur dans mon périmètre (restent 3 erreurs src/lib/content/__tests__ « openai » et src/components/tools/v8 :
  AGENT-CONTENU / ECOM). eslint --quiet : 1 erreur hors périmètre (src/components/app/contenu/Facts.tsx, AGENT-CONTENU).
- vitest complet : 2 231 / 2 234 ; échecs hors périmètre : notify.test.ts (« already_sent », état du store),
  demo-figures et rank (passent seuls : interférence d'ordre).
- Captures qa/v8/TEST-MARQUE (1440 + 390 ; /analyse est clair seulement ; app en clair et sombre) : formulaire, direct
  (questions puis tableau), rapport, impression, inscription, lien envoyé, arrivée dans l'app (marque suivie, mesure).
## Reste
- Flux enregistré en démonstration seulement (aucune clé IA ici) : à revoir avec de vraies clés (temps < 60 s avec
  5+ IA, sources Gemini absentes par CGU).
- Pas de mise en avant dédiée dans /app du test rattaché (APP-ECRANS) ; e-mail Supabase = modèle Supabase (à aligner).
