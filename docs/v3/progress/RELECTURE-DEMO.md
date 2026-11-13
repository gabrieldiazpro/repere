# RELECTURE-DEMO — relecture écran par écran de demo/index.html

Date : 13 novembre 2026. Sauvegarde avant relecture : `demo/index.avant-relecture.html`.
Méthode : Playwright (Chromium, file://, deviceScaleFactor 1), 1440 px et 390 px, clair et sombre, plus une passe `prefers-reduced-motion: reduce`. 3 parcours × 8 écrans capturés et relus, plus la page complète. Script d'interaction : clic sur chaque onglet, « C'est fait », ajout de source, filtres IA, copie, copilote, liens internes, onglets d'offres, rechargement (persistance).

## Espace client (visite) — tous parcours

| Écran | Défaut trouvé | Correction |
|---|---|---|
| Lundi | Titre « Mardi 10 novembre » sur l'écran « Lundi » | « Lundi 9 novembre » |
| Lundi | « n/3 faites » codé en dur, durée totale figée | Compteur sur le nombre réel de tâches, minutes restantes mises à jour, barre de progression accessible (role progressbar) |
| Tous | `#screen` en `aria-live` : tout l'écran relu à chaque clic | Live retiré, écran étiqueté par son titre ; annonce courte (écran, compte, action faite et tâches restantes) |
| Tous | Focus perdu après « C'est fait », filtre IA ou ajout (re-rendu) | Focus rendu au bouton cliqué |
| Tous | Espaces sécables avant « : ? ; % », après « « », dans « 1 113 » : retours à la ligne orphelins (« ? » seul, « : » seul) | Espaces insécables appliqués au texte rendu (hors balises) |
| Réponses | « Information fausse : voir Vérité. » sans lien | Bouton « Voir la fiche de vérité » |
| Réponses | « le texte intégral » alors qu'on montre 3 ou 4 réponses sur 48 | « texte des réponses, mot pour mot » + mention « Extrait de N réponses sur 48 » ; état vide prévu pour un filtre sans réponse |
| Sources | « Ajouter à mes tâches » sans effet (état jamais utilisé) | Ajoute une action guidée au Centre d'actions (persistée, retirable, comptée dans les totaux) ; si l'action existe déjà (PagesJaunes, G2, Trustpilot) : « Déjà dans vos actions » qui y mène |
| Sources (390 px) | Bouton à droite écrasait la colonne : « Effort / S · ≈ / 30 min » sur 4 lignes, nom tronqué (« PagesJ… ») | Bouton passé sous le titre en mobile |
| Concurrents | « ± 7 pts · dans la marge » sans objet | « ± 7 pts » |
| Concurrents | Texte gris sur les cases foncées de la grille thème × IA (contraste faible en clair) | Texte des cases en couleur d'encre |
| Vérité | « Créer la tâche de correction » alors que la tâche existe | « Voir la tâche de correction » |
| Centre d'actions | Livrables ouverts/fermés réinitialisés à chaque clic | État d'ouverture conservé |
| Trafic | Période « 13 août – 10 nov. » incohérente avec le lundi 9 | « 12 août – 9 nov. » (90 jours) |
| Trafic | « Premier moteur », « par moteur » | « Première IA », « par IA » |
| Trafic (390 px) | Dates de l'axe illisibles (texte SVG réduit à ~5 px) | Dates sorties du SVG |
| Copilote | « Chaque chiffre renvoie à l'écran » sans lien | Sources cliquables vers l'écran ; texte ajusté |

## Parcours Local — Plomberie Martin
- Sources : « Ets Perrin » ne correspond à aucun nom cité (réponses : « Perrin & Fils ») → corrigé.
- Centre d'actions : page « Dépannage de fuite » justifiée par une question sur le débouchage → action et livrable réécrits en page « Débouchage ».
- Copilote : « cette semaine en 20 minutes » proposait 15 + 5 min alors que la demande d'avis est chiffrée à 15 min → « en 15 minutes », suite optionnelle de 15 min.
- Copilote : « Combien de clients m'a envoyé ChatGPT » répondait avec le total toutes IA et des clics, sans dire que les clients ne sont pas mesurés → « visites », ≈ 66 depuis ChatGPT (63 % de 104), limite dite.
- Copilote : « cité 29 fois » → « cité dans 29 réponses » (même unité que Lundi).

## Parcours PME — Paysia
- Lundi : « Novapaie juste devant, avec 4 citations de plus » ; part de voix 9 % contre 8 % ≈ 2 citations → « 2 citations de plus ».
- Sources : Trustpilot, LinkedIn, Reddit sans chiffres (« Souvent cité… ») → fréquences sur 32 réponses, comme les autres sources ; preuve de l'action Trustpilot alignée.
- Copilote : « Paylo domine Alternatives et Meilleur choix » contredit la grille (il n'y est en tête que sur une IA chacun) → formulation exacte ; unités harmonisées.
- Trafic : courbe trop basse pour 1 113 visites en 30 jours → séries recalées.

## Parcours E-commerce — Maison Sora
- Rang « 10e sur 10 » (Lundi, Réponses, Concurrents) alors que la part de voix la classe 8e et que « Comptoir Argile est juste devant » → 8e.
- Concurrents : la grille ne totalisait que 42 réponses sur 48 (7 questions sur 8) → thème « Où acheter » sur 2 questions (0/4).
- Vérité : « Date de création » vérifiée mais absente de la fiche de vérité → ajoutée (2019).
- Sources : fréquences manquantes → ajoutées ; preuves des actions Trustpilot alignées.
- Trafic : « Soin visage solide » vs action « Soin visage solide « Lueur » » → nom harmonisé ; « 10 cde » → « 10 commandes » ; KPI Commandes lu dans les données (plus codé en dur) ; tableau produits tronqué à 390 px → en-têtes courts, tient sans défilement.
- Copilote : unités harmonisées (réponses, part de voix).

## Hors espace client
- Exemple de rapport Local : même nom « Plomberie Martin » que le compte démo mais adresse, horaires, concurrents et erreur différents → renommé « Plomberie Lambert » (exemple fictif distinct, comme Paie Facile et Soleil Doux).
- Formulaire de rapport (exemple) : « l'offre choisie pour Soleil Doux » → « pour votre entreprise » en mode exemple (code de capture de lead inchangé).
- Offres, comparées à `app/src/lib/plans.ts` : prix tous conformes ; contenus corrigés — Découverte (« Gratuit, sans carte bancaire, sans limite de durée ») ; Local Essentiel (alerte concurrent au lieu d'un « rapport mensuel » non prévu, résiliable en 1 clic) ; Local Accompagné (4 IA dont Claude, campagne de demande d'avis, rapport avant/après, « rien n'est publié sans votre validation ») ; PME et E-commerce Essentiel (4 IA dont Claude) ; Accompagné PME/E-commerce (5 IA dont Mistral, robots IA, flux Merchant) ; audits approfondis (déduction « si souscrit sous 30 jours », remboursement 14 jours, livrables manquants).
- Hero : « Mistral (option) » → « Mistral » (Mistral est inclus en Accompagné PME/E-commerce, pas une option payante).
- FAQ « Quelles IA suivez-vous ? » : « Claude en Accompagné ; Mistral en option » faux → répartition exacte par offre. FAQ « entreprises fictives » : exemples de rapport ajoutés.
- Pied de page : Mistral AI / Le Chat ajoutés à la mention d'indépendance et des marques.

## Vérifications finales
- Console : 0 erreur hors polices Google bloquées (réseau coupé dans le test) et absence de `window.claude`.
- Aucun débordement horizontal à 390 px (page et 24 écrans, clair et sombre).
- Chaque onglet des 3 parcours cliqué ; « C'est fait » met à jour badge du menu, carte Lundi, compteurs du Centre d'actions, et se défait au clavier ; état conservé après rechargement (localStorage sous try/catch).
- Mouvement réduit : compteurs, jauges, courbes, apparitions et « en train d'écrire » désactivés.
- Focus visible (contour ambre) y compris dans la barre latérale sombre.
- Inchangés : `<title>`, jetons `:root` et mode sombre, code `window.claude.*`, capture de lead `leads/{self}` et ses champs. Aucune ressource externe ajoutée. Taille ≈ 230 Ko.
- Honnêteté : bandeau « Compte démo », données fictives étiquetées, aucune promesse de résultat, AI Overviews explicitement non suivis.

## Non vérifié
- Mesure en direct et enregistrement du lead (nécessitent claude.ai et `window.claude`).
- Copie réelle vers le presse-papiers (refusée en test ; la sélection de secours fonctionne).
- Rendu avec les polices Google (bloquées pendant les tests) et lecteurs d'écran réels.
- Si les noms de concurrents fictifs (ex. « SOS Plombier Paris 11 », « Dépannage Charonne ») ressemblent à des entreprises réelles : à contrôler à la main.
