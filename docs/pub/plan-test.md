# Plan de test Meta (Facebook + Instagram) — 14 jours, 20 €/jour

Agent PUBLICITE, 22 nov. 2026. Budget, seuils et audiences sont des **propositions** à valider par le fondateur.

## Étape 0 — conditions avant de dépenser 1 € (bloquantes)
1. Site en ligne sur repere-ia.fr avec les vraies clés d'IA ; /analyse et /visibilite-ia testées sur 3 vrais sites.
2. Pixel Meta + API Conversions installés **avec bandeau de consentement** (CNIL : pas de pixel avant accord).
   Événements : `ViewContent` (page d'arrivée), `Lead` = analyse terminée (verdict affiché), `CompleteRegistration` =
   espace créé. Sans pixel, mesurer avec les UTM dans /app/trafic et les inscriptions par `utm_campaign`.
3. Plan de lancement respecté : pas de payant tant que /analyse ne convertit pas en organique (repère proposé :
   ≥ 25 % des visiteurs de /analyse lancent une analyse sur les 2 premières semaines organiques).
4. regles.md relu ; preuves datées des allégations rangées dans docs/pub/preuves/ (captures de /analyse, /tarifs, plans.ts).
5. Page Facebook + compte Instagram Repéré créés avec les textes d'identité (docs/visibilite-repere/01-textes-identite.md).

## Structure : 1 campagne « Prospects », objectif Prospects (ou Ventes avec l'événement Lead), 2 ensembles × 3 créations
| Ensemble (10 €/j chacun) | Audience | Créations (3) |
|---|---|---|
| A — Commerces et artisans | France, 25–65 ans ; centres d'intérêt : petites entreprises, entrepreneuriat, Google My Business / fiche d'établissement, artisanat, commerce de proximité ; administrateurs de Pages professionnelles. Placements Advantage+ | V1 (r1-local-horaires), V2 (r2-60-secondes), s2-test-de-marque |
| B — E-commerce | France, 25–55 ans ; centres d'intérêt : Shopify, PrestaShop, WooCommerce, e-commerce, marketing numérique | V4 (r4-ecommerce), V2 (r2-60-secondes), s6-simulation-boutique |

Pourquoi ce choix : un angle « peur » (1), un angle « gratuit 60 s » (3), et un format statique par audience ; V2 sert
de témoin commun aux deux audiences. Les PME B2B et agences passent mieux par LinkedIn (plan de lancement) : on les
teste sur Meta en semaine 3 seulement si A ou B tient ses seuils (V5, V6, s8, s7).

Réglages : budget au niveau des ensembles (pas d'Advantage campaign budget pendant le test, pour garder 10 €/10 €),
enchère « volume le plus élevé », exclusion des visiteurs et inscrits des 30 derniers jours, langue français,
aucune audience similaire avant 50 conversions.

## Calendrier
- J1–J3 : apprentissage. **On ne touche à rien** sauf rejet ou problème de suivi.
- J4 : premier tri (critères d'arrêt ci-dessous), une seule modification par ensemble.
- J7 : bilan ; la meilleure création de chaque ensemble garde son budget, la plus faible est remplacée par une variante
  de la gagnante (même visuel, autre accroche dans accroches.md — une seule variable à la fois).
- J14 : bilan final, décision : doubler (40 €/j) la combinaison gagnante, ou arrêter.

## Critères d'arrêt (par création, à partir de 30 € dépensés ou 3 000 impressions)
| Signal | Seuil d'arrêt | Lecture |
|---|---|---|
| Taux de clic sur le lien (CTR lien) | < 0,6 % | l'accroche ne prend pas |
| Vidéo : lecture à 3 s / impressions (hook rate) | < 20 % | le premier carton est à refaire |
| Vidéo : lectures jusqu'à 50 % | < 15 % des lectures 3 s | milieu trop long |
| Coût par clic lien | > 1,50 € | trop cher pour une offre gratuite |
| Coût par analyse terminée (Lead) | > 12 € après 60 € dépensés | la page d'arrivée ou la promesse ne convertit pas |
| Fréquence | > 3,5 sur 7 jours | lassitude : changer de visuel |
| Commentaires négatifs / masquages | > 1 % des interactions | message mal perçu : relire regles.md |
Arrêt de tout l'ensemble si coût par analyse terminée > 20 € à J7. Arrêt de toute la campagne si une annonce est
rejetée deux fois pour la même règle (revoir la règle avant de relancer).

## Critères de réussite (à J14)
- Coût par analyse terminée ≤ 6 € et ≥ 10 % des analyses terminées qui créent un espace gratuit.
- Au moins 1 inscription payante ou 1 candidature /pilotes qualifiée par 100 € dépensés (indicatif, faible volume).
- Note qualitative : relire les 20 premiers sites analysés venus de Meta (bonne cible ? commerces/boutiques réels ?).

## Budget
20 €/jour × 14 jours = **280 € TTC maximum**, plafond de dépense de compte fixé à 300 € dans le Gestionnaire.

## Suivi
Un tableau hebdomadaire dans docs/lancement/kpi.md (section « Meta payant ») : dépense, impressions, CTR lien,
hook rate, analyses terminées, espaces créés, payants, coût par étape, décision prise.
