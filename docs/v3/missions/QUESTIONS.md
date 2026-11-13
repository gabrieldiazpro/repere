# Mission QUESTIONS (journal : docs/v3/progress/QUESTIONS.md)

## À lire
- docs/v3/02-teardown-midmarket.md (gestion et suggestion de prompts chez Peec, Otterly), docs/v3/01-teardown-enterprise.md
  (gestionnaire de prompts, volumes), docs/v3/09-audit-app.md (points 3 et 4).
- Code : src/lib/engine/{types,types-v2,queries,index}.ts, src/lib/store.ts, src/lib/db.ts (Business, audits), src/lib/demo-v2.ts.

## Périmètre exclusif
src/lib/prompts/**, src/app/api/prompts/**.

## À livrer
1. **Modèle** `TrackedPrompt` (id, businessId, texte, thème, tags, intention, origine gabarit|suggestion|client, actif,
   créé le). CRUD dans le store (`prompts.items`), quotas via getEntitlements.
2. **Suggestions** : depuis l'URL du site (récupération sûre via '@/lib/siteaudit' si disponible, sinon catégorie +
   offre), depuis le secteur et le parcours (gabarits du moteur), depuis les questions où les concurrents sont cités.
   Classées par intention, sans doublons (normalisation + similarité), 20, étiquetées « suggestion ».
3. **Indice de demande** faible / moyen / fort, étiqueté « estimation », règle déterministe documentée dans
   src/lib/prompts/METHODE.md. Jamais de volume chiffré.
4. **Import** CSV ou texte (une question par ligne), dédoublonné ; export.
5. **Historique par question × IA** à partir des audits enregistrés : série (date, IA, cité ou non, rang, concurrents
   cités) + réponses brutes avec positions de surlignage (client, concurrents, sources). Prépare l'écran « Réponses ».
6. **Routes** : GET/POST /api/prompts?businessId, PATCH/DELETE /api/prompts/[id], POST /api/prompts/suggest,
   POST /api/prompts/import, GET /api/prompts/[id]/history. Auth par requireBusiness (démo en lecture seule).
7. **Seed de démonstration** pour les 3 comptes : 8 à 12 questions taguées, cohérentes avec les audits démo.
8. `promptsToQueries(prompts)` → QuerySpec pour `runAudit(input, { queries })` (paramètre ajouté par MOTEUR).
9. Tests : CRUD, quotas, dédoublonnage, suggestions, historique, routes.
