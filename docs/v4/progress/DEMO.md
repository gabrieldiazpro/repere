# DEMO — passe V4 « clarté et dynamisme » (demo/index.html)

Date : 13 novembre 2026. Sauvegarde : `demo/index.avant-v4.html`. Captures : `qa/v4/DEMO/avant/` et `qa/v4/DEMO/apres/`
(1440 et 390, clair et sombre, page en tranches + 8 écrans × 3 comptes ; `apres/motion-*` = états d'animation).
Scripts : scratchpad `demo-shots.js` (statique, mouvement réduit) et `demo-motion.js` (animations).

## Fait
- Héros : ligne « pour qui », H1 inchangé, accroche raccourcie (≈ −40 %), scène animée (question tapée → réponse qui s'écrit →
  « absent » → seconde question → votre nom repéré par le cadre de visée → score 52 → 61). Données du compte démo fictif uniquement
  (réponses, rang, score, marge), libellée « compte démo fictif », jouée une fois à l'entrée dans l'écran, bouton « Rejouer »,
  suit le parcours choisi, description texte pour lecteur d'écran, état final direct en mouvement réduit.
  Mobile : bouton principal « Tester gratuitement » vers le formulaire.
- Schéma SVG maison « Question → IA → Sources → Réponse → Vous » (pictos génériques, aucun logo), traits qui se tracent.
  Piliers : listes remplacées par une phrase.
- Espace démo : chaque écran a un en-tête résultat (titre-résultat, chiffre clé qui monte, une action principale), titres tirés
  des données existantes (aucun nouveau chiffre) ; KPI en double retirés ; transitions directionnelles (avant/arrière selon le menu),
  fondu au changement de compte, cascade des blocs, repère ambre animé dans le menu ; « C'est fait » : pression, coche tracée,
  barre qui avance, toast (annonce lecteur d'écran inchangée via #live) ; mises à jour sur place sans rejouer l'entrée ;
  courbe trafic : tracé puis aire et points d'arrivée ; grille thème × IA en cascade.
- Offres : bascule à indicateur glissant, cartes en cascade, offre recommandée avec bandeau « Recommandé : on le fait pour vous ».
- Rapport d'exemple replié (couverture + formulaire de lead visibles, « Voir le rapport d'exemple complet ») : page 12 545 → 6 833 px,
  texte visible 18 241 → 9 221 caractères. Un vrai rapport (non exemple) n'est jamais replié.
- Textes coupés : héros, preuves, « comment ça marche », visite, offres, en-têtes d'écran.

## Vérifié
- 0 erreur console (polices Google bloquées en test), 0 débordement à 390 (page et 24 écrans, clair et sombre).
- Inchangés (diff) : lignes `window.claude.*`, bloc capture de lead `leads/{self}`, jetons `:root` / sombre, `<title>`.
- Aucune ressource externe ajoutée ; localStorage toujours via `ls` (try/catch). Taille 256 Ko.

## Réserve
- La scène montre le score d'il y a un mois (52) pendant des réponses de la mesure actuelle ; libellés exacts, mais le
  fondateur peut préférer une scène sans score « avant ».
