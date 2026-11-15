# SITE-SEO-90 — journal (V6, 15 nov. 2026) — TERMINÉ
## Méthode (reproductible)
- Copie scratchpad/seo90/build ; `seo90/sync-build.sh <n>` (copie + build sous verrou ; options mémoire et lint coupé
  dans la copie seulement), `seo90/start-4201.sh` / `stop-4201.sh` (ne touchent que 4201 ; arrêté en fin de mission).
- Audit : seo90/audit/audit.test.ts (crawlSite + auditSeo + auditGeo du dossier principal, en direct, hôte repere-ia.fr,
  note brute non arrondie affichée) ; `python3 summary.py <out>.json`. « Avant » rejoué sur le build du 13 nov. (port 4202).
## Scores (build de production, toutes les pages liées + sitemap, 198 pages)
- Départ (moteur d'alors, 1 000 pages plafond) : SEO 55 / GEO 96 (avant.json). Build du 13 nov. avec le moteur final :
  SEO 55 / GEO 98 (avant-moteur-actuel.json, 572 pages). **Final, serveur neuf : SEO 95 (brut 93,1) / GEO 99** (final.json).
- Entre-temps ROBUSTESSE a corrigé dans le moteur plusieurs faux positifs que j'avais prouvés (demandes-SEOAUDIT.md) ;
  dernière mesure avec le moteur d'avant ces corrections (build presque final, m6.json) : SEO 85 (brut 87,1) / GEO 98.
## Fait
- Maillage : plus aucun lien vers les ~430 pages métier × ville sans données (noindex) ; catégories PME/e-commerce
  indexables (pages éditoriales, comme les pages métier : décision) ; /classement lié seulement si publié.
- robots : Disallow /app (couvrait mal /app?…) et /outils/api/, Allow /api/schema/. Entrées démo = boutons (formulaire GET,
  `DemoEntry`) avec le compte (les liens /app?visite=1 sans compte renvoyaient vers la connexion ; Link les préchargeait).
- Fiches démo /p : plus de JSON-LD d'entreprise fictive, noindex,follow, image OG propre ; rapport démo noindex,follow
  sans X-Robots ; liens /app et PDF du rapport en nofollow (components/report, hors table des périmètres : 3 attributs).
- Poids : menu mobile rendu à l'ouverture, 404 légère (était sérialisée dans CHAQUE page), styles des liens du pied de
  page factorisés, pied de page = 9 guides et 8 outils + « tous ». Titres, descriptions, H1, H2 (/audit, /inscription),
  og:image, ancres, images Article, BlogPosting, availability, liens vers les questions clés.
- Demandes intégrées : WIX, OPS (statut, ClientErrorReporter, global-error.tsx), LANCEMENT, GEO-MARQUE (identité,
  sameAs nommés, FAQ, maillage), OUTILS, GUIDES (schémas, liens internes, /guides en grappes), AGENCES, ROBUSTESSE
  (encadré d'accès, plateforme, notes). Tests : lib/seo/__tests__/v6-site-seo.test.ts ; v4-site et content mis à jour.
- tsc vert, vitest 139 fichiers / 1 980 tests verts, eslint 0 erreur. Captures : qa/v6/SITE-SEO-90/avant|apres.
## Reste (hors de mon périmètre ou hors code)
- GEO-MARQUE : title/H1 de /etudes/pourquoi-les-ia-recommandent-une-marque ; GUIDES : 3 alt > 125 car. ; OUTILS : liens
  entre outils V6 ; LANCEMENT : /presse (image prioritaire, captures non optimisées) ; EXECUTION (demandes-EXECUTION.md).
- Fondateur : /a-propos reste noindex tant qu'ENTITY_READY est faux ; sameAs vide tant qu'aucun profil réel n'est fourni ;
  aucun lien entrant (le score mesure le site, pas sa notoriété).
