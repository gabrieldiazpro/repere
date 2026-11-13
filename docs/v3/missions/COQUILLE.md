# Mission COQUILLE (journal : docs/v3/progress/COQUILLE.md)

Lis _COMMUN.md puis _APP-COMMUN.md. Journaux utiles : COMPTES, DONNEES, TACHES-FOND, INTEGRATION-FONDATIONS, CROISSANCE.

## À livrer
1. **Navigation V3** (barre latérale bureau, 5 onglets mobile + « Plus ») regroupée : Lundi · Mesurer (Questions,
   Réponses, Sources & citations, Concurrents) · Comprendre (Ce que disent les IA, Vérité) · Agir (Centre d'actions,
   Pages, Technique) · Prouver (Trafic & ventes, Rapports) · Copilote · selon le parcours : Local (Fiche Google, Carte,
   Annuaires, Avis) ou E-commerce (Produits, Revendeurs, Ventes IA). Entrées prévues même si la page est livrée par un
   autre agent (routes : /app/questions, /app/reponses, /app/citations, /app/sources, /app/concurrents, /app/ia,
   /app/verite, /app/actions, /app/pages, /app/technique, /app/trafic, /app/rapports, /app/copilote, /app/local/*,
   /app/produits/*). Sélecteur de commerce (multi-commerces, /api/account/businesses) et sélecteur de compte démo.
2. **Onboarding guidé** /app/bienvenue + liste de démarrage persistante sur le Lundi (docs/v3/09-audit-app.md §
   onboarding cible) : première valeur en moins de 5 minutes — site → questions suggérées → premier audit (état de la
   tâche via /api/jobs/[id]) → fiche de vérité → installer le suivi du trafic. États vides utiles partout.
3. **Recherche globale et palette de commandes** (Cmd+K / Ctrl+K) : pages, questions, concurrents, tâches, actions
   (« lancer une mesure », « exporter »), raccourcis clavier (g puis l…), accessible.
4. **Centre de notifications** (cloche, /api/notifications, lu / non lu) et page /app/notifications.
5. **Mode sombre** : tokens sombres dans app.css, bascule (système / clair / sombre) mémorisée.
6. **Réglages** : Compte, Équipe (invitations, rôles — /api/team), Offre et facturation (droits actuels, quotas
   consommés, portail Stripe), Alertes (côté serveur : /api/alerts/prefs), Rapports planifiés, Intégrations (Slack,
   webhook avec test, WordPress, GA4, Shopify : état réel), Partage et marque blanche, Badge / carte / classement /
   parrainage (/api/growth/*), Données (export et suppression RGPD : /api/account/data).
7. **Lundi** (accueil) : phrase de la semaine, rang, score avec marge d'erreur, « Expliquer ce changement »
   (explainChange du moteur), 3 tâches, alertes, liste de démarrage, annotations récentes.
8. **Visite guidée** : /app?visite=1 (et &segment=…) lance un parcours en 8 étapes avec infobulles sur le compte démo
   (composant léger maison, accessible, quittable, mémorisé). Les étapes pointent des éléments par attribut
   `data-visite="…"` : documente la liste dans ton journal pour que les autres agents posent les attributs.
9. Verrouillage par offre (composant `Verrou` réutilisable dans src/components/app/shell/, à documenter dans le journal).
