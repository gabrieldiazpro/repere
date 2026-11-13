# Mission ACTION (journal : docs/v3/progress/ACTION.md)

Lis _COMMUN.md puis _APP-COMMUN.md. Journaux utiles : DONNEES (mesure avant/après, partage, exports, annotations),
AUDIT-SITE, COPILOTE, MOTEUR (buildContentBrief, explainChange), CROISSANCE, ECOMMERCE (ventes), TACHES-FOND.

## À livrer (écrans « Agir » et « Prouver »)
1. **/app/actions — Centre d'actions** (remplace et absorbe /app/taches, qui redirige) : actions classées par score
   (impact × effort), regroupées « sur votre site » / « ailleurs sur le web » / « technique » / « corriger une
   erreur », chacune avec sa preuve (question perdue, source où vous manquez, erreur citée), son livrable prêt à
   copier, « C'est fait ». Après complétion : suivi **avant / après** (getActionImpact : avant, après à J+14 et J+30,
   marge, verdict honnête « dans la marge d'erreur »), annotation automatique sur les courbes. Vue calendrier simple.
2. **/app/pages — Audit de page** : saisir une URL → score de citabilité (20 règles), extraits citables, corrections,
   suggestion de réécriture (mode IA si disponible), historique par page, « créer la tâche ». Liste des pages suivies.
3. **/app/technique — Prêt pour les IA** : score /100 du site, contrôles (robots par robot IA, rendu sans JavaScript,
   JSON-LD, sitemap…), plafond expliqué, correctifs, relance, historique ; état du balisage servi par Repéré et du
   plugin WordPress.
4. **/app/rapports** : historique des audits, PDF, **liens de partage** (créer, expiration, mot de passe, révoquer,
   aperçu ; marque blanche si l'offre le permet), **rapports planifiés** (destinataires, fréquence), carte de score
   partageable (activer / copier le lien), bilan trimestriel.
5. **/app/trafic — Trafic et ventes venus des IA** : visites par moteur, part, pages d'arrivée, robots d'IA,
   conversions et valeur (CA si disponible), annotations, installation (script, WordPress, GA4, Shopify : état réel),
   export CSV.
6. **/app/verite** : fiche de vérité + erreurs détectées, « corriger » → action ; historique des erreurs résolues.
7. **/app/copilote** : suggestions selon l'écran d'origine (?context=), affichage des sources et des actions proposées
   par le copilote, téléchargement des livrables (CSV, HTML), historique des conversations.
8. /app/plan et /app/taches : redirections propres.
Pose les attributs `data-visite` (`"actions"`, `"pages"`, `"technique"`, `"rapports"`, `"trafic"`, `"copilote"`).
