# Journal QUESTIONS — TERMINÉ

## Fait
- Lib src/lib/prompts : types, text (normalisation, doublons Jaccard ≥ 0,8 + même intention), demand (+ METHODE.md),
  repo (CRUD store `prompts.items`, quotas, amorçage depuis le dernier audit), suggest (site/offre/secteur/concurrents, 20),
  io (import CSV/texte, export CSV anti-formule), history (série question × IA + surlignage), engine (promptsToQueries),
  demo (3 comptes, 10-11 questions taguées), service, http, adapters, index.
- Routes : /api/prompts (GET liste|CSV, POST), /[id] (PATCH, DELETE), /[id]/history, /suggest, /import (dryRun).
- Tests : 34 verts (src/lib/prompts/__tests__) ; tsc propre sur mes chemins.

## Nouvelle variable d'env
- PROMPTS_SITE_FETCH=off (facultative) : désactive la lecture du site pour les suggestions.

## À faire par d'autres
- COMPTES/orchestrateur : quand @/lib/auth et @/lib/entitlements existent, remplacer dans src/lib/prompts/adapters.ts
  requireBusiness/getEntitlements/assertEntitled par des réexportations (l'adaptateur ignore minRole).
- TACHES-FOND (audit.scheduled) : runAudit(input, { queries: promptsToQueries(await listPrompts(businessId, { active: true })) }).
- TACHES-FOND : ajouter PROMPTS_SITE_FETCH à .env.example.
