# Mission LOCAL (journal : docs/v3/progress/LOCAL.md)

## À lire
- docs/v3/05-teardown-local.md en entier + docs/v3/features-local.json, docs/v2/04-execution.md (règles Google, avis,
  API), docs/05-plan-action.md (annuaires par métier).
- Code : src/lib/execution/ (reviewKit, tâches), src/lib/engine/index.ts, src/lib/store.ts, src/lib/demo-v2.ts.
- 3 à 5 recherches web sur l'API Places actuelle : Place Details (New), champs (nombre d'avis, note, horaires,
  catégories, photos, site, téléphone), politique de cache et de stockage (place_id stockable ; le reste ?), tarifs.

## Périmètre exclusif
src/lib/local/**, src/app/api/local/**. Pas d'écrans (vague suivante).

## À livrer
1. **Audit de fiche Google /100** : complétude (catégories, description, horaires et horaires exceptionnels, services,
   attributs, photos récentes, posts récents, site, téléphone), avis (nombre, note, récence, taux de réponse),
   cohérence avec la fiche de vérité. Sources : (a) API Places si `GOOGLE_PLACES_KEY` (respect strict du stockage :
   place_id + NOS scores dérivés, pas le contenu brut au-delà de la durée permise ; documente-le), (b) saisie guidée
   par le client, (c) démo. Critères {id, label, status, detail, fix} + lien vers la tâche d'exécution.
2. **Carte de visibilité par quartier**, « simulation » clairement étiquetée : grille de quartiers ou
   d'arrondissements (table pour Paris, Lyon, Marseille et les 12 plus grandes villes, sinon points cardinaux autour
   de l'adresse) ; pour chaque zone, questions reformulées avec le quartier via runAudit(input, { queries }) ; budget
   plafonné (zones × questions × IA selon l'offre) ; résultat par zone : taux de mention, rang, concurrent dominant.
   Format prêt pour une carte SVG schématique (pas de fond Google Maps). Démo déterministe.
3. **Audit NAP sur annuaires** : liste par métier ; statut « déclaré présent », « vérifié » (URL fournie puis
   vérification légère nom / adresse / téléphone via safeFetch de '@/lib/siteaudit') ou « absent » ; incohérences
   (normalisation téléphone, adresse) ; score.
4. **Calendrier de posts Google** : idées par métier et par saison (gabarits, LLM si clé), planification, rappel
   (notification ou e-mail), publication manuelle avec texte prêt à coller.
5. **Thèmes des avis** : avis collés par le client (ou Places si clé), thèmes positifs et négatifs par règles (+ LLM
   en option), suggestions de réponses via draftReviewReply.
6. Routes /api/local/* (requireBusiness), seed de démonstration pour `demo` (Plomberie Martin), tests.
