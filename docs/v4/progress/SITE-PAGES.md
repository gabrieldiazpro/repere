# SITE-PAGES — journal V4
## Fait
- Captures AVANT (qa/v4/SITE-PAGES/avant) : formulaire, attente, rapport (clair/sombre, 1440/390), outils, fonctionnalités, inscription.
- Mouvement réduit (règle corrigée) : tools.css, audit.module.css, report.module.css, AiAnswerCards : seul le déplacement est coupé.
- Rapport : synthèse V4 (Verdict.tsx, v4.module.css) — verdict dans le viseur, jauge + marge, 3 constats (findingsOf), extraits des IA, « Qui est cité à votre place » (barres qui se remplissent), LE bouton « Créer mon espace gratuit » (aussi dans la barre fixe). Sections secondaires repliées sur tous écrans. Mode sombre du rapport (.autoDark). Tests v4.test.tsx.
- Attente d'audit : 3 étapes qui s'allument, chronomètre réel, compteur « Question n sur 8 » par IA, questions qui apparaissent.
- Outils (9) : chargement à étapes, jauge qui compte, contrôles réussis regroupés, pont vers l'audit discret avant / « Étape suivante » après résultat (site pré-rempli).
- Fiches /fonctionnalites/[slug] : visuel dans l'en-tête, problème en une idée, étapes reliées par un trait qui se trace, sommaire, détails en cartes.
- Inscription : cases obligatoires agrandies (toujours obligatoires), rappel de l'audit rattaché.
- Rapport mobile : plus de défilement horizontal (barres concurrents), bouton suivant remonté sous les constats.
- Captures APRÈS (qa/v4/SITE-PAGES/apres), dont attente en mouvement réduit. tsc vert ; vitest vert sauf 1 test hors périmètre (Header importe site.css).
## Reste (non fait, temps)
- /outils hub, comparatifs, aide, nouveautés, méthode, pages légales : pas retouchés dans cette passe.
- Validateur JSON-LD : pont vers l'audit resté en version discrète (résultat interne aux onglets).
## À faire par d'autres
- SITE-ACCUEIL : ScoreGauge saute l'animation sous reduce (qa/v4/demandes-SITE-ACCUEIL.md).
- Config : vitest ne charge pas postcss.config (plugin en chaîne) → les tests qui rendent des modules CSS doivent les mocker (fait dans report).
