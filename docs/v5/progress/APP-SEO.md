# APP-SEO — journal (13 nov. 2026)

Périmètre : src/app/app/seo/**, src/components/app/seo/** ; ajouts : 5 entrées de menu (nav.ts) ; NOUVEAU fichier de
données démo src/lib/seoaudit/demo-crawl.ts (aucun autre fichier de src/lib modifié).

## Fait
- Données démo : `demoSiteCrawl(id, stage)` — 3 sites fictifs (Plomberie Martin, Paysia, Maison Sora) en HTML passé à
  l'extracteur réel de CRAWL ; mêmes domaines/pages que les mots-clés démo de SEO-DATA, faits de la fiche de vérité démo ;
  4 étapes (toutes les 4 semaines) avec défauts corrigés → évolution et « ce qui a changé » réels. Étiquetés démo partout.
- Écrans : /app/seo (double score Google/IA, évolution, changements, top 5 + « Repéré peut le faire », connexions,
  retour OAuth ?gsc=… + choix de propriété), /technique (12 sections, filtres, pages concernées, CSV, relance avec droits),
  /positions (mots-clés, variations, part de visibilité, concurrents, aperçu IA, suggestions, ajout/suppression),
  /search-console (28 j, 16 mois, requêtes/pages, progression/recul, opportunités 4–15), /performance (terrain + labo,
  mobile/ordinateur, modèles de page), /liens (liens entrants si fournisseur, sinon explication ; maillage), /geo.
- Comptes réels : explorations stockées dans `appseo.run` (action serveur `relancerExploration`, 50 s max) ; états vides.
- Menu (nav.ts, ajouts seuls) : Mesurer « SEO et GEO », « Positions Google » ; Comprendre « Audit du site » (+ vitesse, liens),
  « Lisible par les IA » ; Prouver « Clics Google ». Sous-navigation par onglets dans chaque écran SEO.
- Tests : 9 verts (src/components/app/seo/__tests__ : démo cohérente avec SEO-DATA, progression, CSV anti-formules,
  quotas, opportunités) ; tsc propre sur le périmètre ; tests shell verts. Captures : qa/v5/APP-SEO/ (1440/390, clair/sombre).
- Limite connue : la position moyenne démo Search Console vient de SEO-DATA (même formule pour les 3 comptes).

## Décisions
- Droits d'exploration proposés (model.ts `CRAWL_RIGHTS`) : Découverte 1/sem. 60 p. ; Essentiel 1/j 300 p. ;
  Accompagné 3/j 1 000 p. ; Agence 10/j 2 000 p. (plafonnées par 50 s).

## À faire par d'autres
- Serveur 4103 : redémarre souvent (seuil mémoire 1,4 Go) quand APP-AGENT et APP-SEO compilent en même temps.
- entitlements.ts : reprendre `CRAWL_RIGHTS` (champ `crawl`) ; idéalement une tâche de fond `seo.crawl` (JOB_TYPES)
  pour dépasser 50 s et une exploration programmée.
- APP-AGENT : liens « Repéré peut le faire » → /app/agent?source=seo|geo&constat=<id du constat> (autoFix du constat
  dans le dernier `appseo.run`, ou demoSiteCrawl pour la démo).
