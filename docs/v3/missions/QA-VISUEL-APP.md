# Mission QA-VISUEL-APP (journal : docs/v3/progress/QA-VISUEL-APP.md)
Lis _COMMUN.md, _QA-COMMUN.md puis _APP-COMMUN.md. Charge le skill frontend-design. Audit de référence : docs/v3/09-audit-app.md.
Aucun écran de l'app V3 n'a été vu dans un navigateur avant aujourd'hui : attends-toi à des défauts.

## À faire
1. Passe en revue, en bureau 1440 et en mobile (iPhone 13), TOUS les écrans pour les 3 comptes démo : Lundi,
   Questions (+ détail d'une question, ajout, suggestions, import), Réponses (+ comparaison), Sources, Pages citées,
   Concurrents, Ce que disent les IA, Vérité, Centre d'actions (+ livrable, « C'est fait », avant/après, calendrier),
   Pages (audit d'une URL), Technique, Trafic et ventes, Rapports (lien de partage, planification), Copilote (5
   questions), Réglages (toutes les sections), Notifications, Plus, Bienvenue (onboarding complet), Local (fiche
   Google, carte, annuaires, avis), E-commerce (produits, revendeurs, prix et avis, ventes, retour Shopify).
2. Teste et corrige : navigation (barre latérale, onglets mobile, groupes, entrée active), recherche Cmd+K et
   raccourcis, cloche, mode sombre sur CHAQUE écran (contrastes, graphiques lisibles : couleurs de Charts.tsx),
   visite guidée /app?compte=demo&visite=1 de bout en bout (les 8 étapes trouvent bien leur cible `data-visite`),
   verrous par offre, états vides / chargement / erreur, débordements, tableaux sur mobile, focus et clavier.
3. Défauts déjà repérés par l'orchestrateur : sur /app/local/carte les disques des zones se chevauchent et sont
   illisibles (refais une disposition propre : grille schématique des arrondissements ou liste-carte) ; le bandeau
   démo prend deux lignes ; vérifie la cohérence des chiffres entre écrans (score, rang, nombre de questions, parts).
4. Entrées de menu demandées par les autres agents (voir « À faire par d'autres » des journaux MESURE, ACTION,
   METIERS, COQUILLE) : « Actions » au lieu de « Tâches », /app/pages, /app/technique, /app/produits/prix-avis,
   ancre #integrations des réglages, bouton de recherche dans l'en-tête mobile, `?q=` et `?context=` du copilote.
5. Passe « finition » : densité, hiérarchie, alignements, micro-interactions, cohérence des composants entre les
   écrans écrits par 4 agents différents (titres de page, cartes, tableaux, boutons, pastilles).
6. Rapport : défauts trouvés / corrigés / restants, + chemins des 8 meilleures captures après correction (dont 2 en
   mode sombre et 2 en mobile).
