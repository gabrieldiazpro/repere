# FICHE-OFFICIELLE — journal (V9, 23 nov. 2026)
## Fait
- Modèle unique src/lib/execution/fiche/** (collection `fiche.official`) : chaque fait = valeur + source (client / site /
  fiche Google) + date + « vérifié par le client » ; services avec prix « à partir de », labels (n°, organisme, lien de
  vérification), exceptions d'horaires, langues, paiement, sameAs, date de dernière confirmation. Migration douce depuis
  facts.brand, content.facts (prime, règle V8) et exec.settings.sameAs ; changements faits ensuite dans /app/verite ou
  /app/contenu/faits repris s'ils sont plus récents ; enregistrement = miroir champ par champ vers les 3 anciennes
  collections (jamais vidées). Vue publique = faits saisis ou confirmés seulement.
- /p/<slug> (FicheDocument.tsx + fiche.css, clair/sombre, sans JS) ; JSON-LD Organization/LocalBusiness complet
  (horaires + specialOpening, Offer minPrice, hasCredential, knowsLanguage, sameAs, ProfilePage lastReviewed) pour les
  vraies entreprises SEULEMENT ; indexable uniquement sur opt-in (/api/fiche/publication, admin) ; démos noindex,
  étiquetées, aucun balisage. /p/<slug>.md (réécriture next.config.ts → /p/<slug>/fiche.md), /p/<slug>/llms.txt.
- Encart : /encart/<slug>/e.js (≈ 2 Ko, Shadow DOM, textContent, sans cookie/stockage/requête), /encart/<slug> (cadre,
  frame-ancestors * via next.config.ts), HTML statique à copier, JSON-LD en option ; export « À propos »/« Contact »
  (/api/fiche/export) pour l'agent de publication.
- /app/fiche : édition, écarts site / fiche Google (saisie /app/local) / IA (contrôle Vérité) / analyse GEO, « Relire
  mon site », « Je confirme que c'est à jour », aperçus page + encart, codes à copier. Rappel 90 j : notification
  `actions_reminder` (ouverture de l'écran + GET /api/fiche/rappels, cron).
- Tests : src/lib/execution/fiche/__tests__/fiche.test.ts (18). Vérifs finales : tsc 0 erreur ; vitest complet 161 fichiers /
  2 336 tests verts ; eslint 0 erreur dans mon périmètre (2 erreurs restantes dans src/app/admin/newsletter, VEILLE).
- Captures 1440/390 clair/sombre (3 démos /app/fiche, /p/plomberie-martin, /p/maison-sora, encart) : qa/v9/FICHE-OFFICIELLE/,
  aucun défilement horizontal. Serveur 4102 arrêté. Rien poussé.
## Hors périmètre touché (minimal)
- next.config.ts (rewrite .md + en-tête CSP de /encart) ; src/components/app/nav.ts (entrée « Fiche officielle »).
## À faire par d'autres
- SITE : docs/v9/demandes-SITE.md § FICHE-OFFICIELLE (page /fonctionnalites/fiche-officielle, menus, house.ts,
  cron vercel.json /api/fiche/rappels).
- Vérité / Contenus : à terme lire getFiche() directement (aujourd'hui tenus à jour par miroir).
- Agent de publication (src/lib/publish) : brancher publicationExport() pour créer les pages « À propos »/« Contact ».
- Comportement changé : /p/<slug> d'une vraie entreprise n'est plus indexé par défaut (opt-in) ; compte maison
  `repere` : indexable par défaut.
