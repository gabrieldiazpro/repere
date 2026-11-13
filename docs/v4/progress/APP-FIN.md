# APP-FIN — journal V4
## Journal
- Démarrage : lecture docs, inventaire des routes /app.
- Repris : scripts scratchpad/appfin (crawl.py, toast.py, sheet.py) ; captures avant (local, 1440) faites.
- Vérifié (toast.py, local 1440/390) : « C'est fait » → toast visible à 350 ms avec « Annuler », badge menu 3→2, progression à jour ; Annuler rétablit. Captures qa/v4/APP-FIN/now/toast-*.
- Notifications : déjà en V4 (PageIntro + Tabs) ; OK 1440/390.
- Fait : /app/bienvenue refait (Onboarding.tsx + v4.css « ob-* ») : titre-résultat, « Étape n sur 3 » + barre qui se remplit, coches dessinées, une question par étape (question perso repliée), transition avant/arrière, aperçu du résultat vivant (question choisie, site saisi, zone de l'étape surlignée, score réel si mesuré). Correctif app-shell.css : .rp-ph-intro collé au menu entre 1264 et ~1500 px.
- Fait : /admin restylé (ui-card, ui-btn, titre-résultat « N messages à traiter », compteurs, messages à traiter liserés ambre ; connexion en carte).
- Fait : en-têtes V4 ajoutés : Sources, Rapports, Fiche Google, Avis, Question (détail), Brief (Verdict) ; Pages, Technique, Réglages (PageHeader result). Plus / hors-ligne / retour Shopify : écrans de navigation, laissés sans titre-résultat.
- À vérifier : /app/concurrents déborde à 1440 (scrollWidth 1451, un svg).
- Fait (contrôle) : 3 comptes × 1440/390 → qa/v4/APP-FIN/apres. Corrigé : bouton d'action du Verdict qui débordait à 390 (Questions PME/E-com), lignes de notifications serrées à 390, score Fiche Google en double, texte d'intro en double au-dessus des onglets (Annuaires, Carte). Tableaux et onglets à 390 : défilent dans leur conteneur (pas de défilement de page).
- Hors périmètre : test src/components/pages pages.test.ts (17 fonctionnalités ≠ 10, SITE-PAGES) ; /app/agent apparu en parallèle (V5 ?), non retouché. Serveur 4102 tombé 2 fois (mémoire), relancé.
- Fait : 157 captures qa/v4/APP-FIN/apres (3 comptes × 1440/390 ; sombre 1440/390 et mouvement réduit 390 pour Lundi, Actions, Bienvenue, Sources, Notifications, Fiche Google). tsc vert ; vitest src/components src/app/app : 224/225 (échec SITE-PAGES).
- Reste : capture local Réglages 390 impossible (le serveur 4102 est tué par manque de mémoire en chargeant l'écran ; PME/E-com 390 OK).
## À faire par d'autres
- SITE-PAGES : src/components/pages/__tests__/pages.test.ts attend 10 fonctionnalités, il y en a 17.
