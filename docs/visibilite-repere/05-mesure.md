# Protocole de mesure : Repéré suit sa propre visibilité, avec Repéré

Agent GEO-MARQUE, 15 nov. 2026. But : savoir, chaque semaine, si Google et les IA citent Repéré sur les questions de
nos clients, **quelles sources ils citent à notre place**, et si nos actions hors site changent quelque chose — avec la
même rigueur (répétition, marge d'erreur) que nous vendons.

## Mise en place (jour de la mise en ligne)
1. Compte interne : la marque maison existe déjà (`HOUSE_ID = 'repere'`, src/lib/house.ts, `isActive: false`). L'activer
   avec une offre qui autorise 30 questions et une mesure hebdomadaire (PME ou e-commerce) ; IA : ChatGPT, Perplexity,
   Gemini, Claude, Mistral (option).
2. Importer les 30 questions : **docs/visibilite-repere/questions-suivies.csv** (format de l'import de l'app :
   `question;thème;intention;tags`, vérifié par un test automatique). Ne plus modifier la liste pendant 3 mois (sinon
   les comparaisons perdent leur sens) ; ajouter, ne jamais reformuler.
3. Concurrents à déclarer : Meteoria, Qwairy, BotRank.ai, GetMint, Hikoo, Peec AI, Otterly.AI, Profound, Semrush,
   Ahrefs, SE Ranking, Haloscan, Ranxplorer, geotoolbox.
4. Fiche de vérité de Repéré : compléter src/lib/house.ts (dirigeant, création, adresse) pour que les questions
   « Marque » détectent les informations fausses. Attention : HOUSE_FACTS.prix et .services datent de la V2 (« Audit
   gratuit », pas de SEO) ; à aligner sur 01-textes-identite.md (demande transmise à l'équipe produit, hors périmètre).
5. Search Console et Bing Webmaster Tools reliés (positions Google, citations Copilot). GA4 : segment
   `utm_source=chatgpt.com` et provenances perplexity.ai, gemini.google.com, copilot.microsoft.com, chat.mistral.ai.

## Ce qu'on relève chaque semaine
| Indicateur | Source | Lecture |
|---|---|---|
| Taux de mention par thème (5 thèmes) et par IA | compte interne | avec sa marge d'erreur ; un écart dans la marge = « stable » |
| Rang quand cité, part de voix face aux 14 concurrents | compte interne | — |
| **Sources citées par les IA sur nos questions** | compte interne (ChatGPT, Perplexity, Claude) | la liste des comparatifs/médias à contacter (03) ; noter ceux où nous sommes absents |
| Exactitude sur « Que vaut Repéré ? » | compte interne + fiche de vérité | toute erreur → corriger la source |
| Positions Google sur les 30 questions et sur /questions/* | Search Console | impressions avant clics : AI Mode y est compté sans distinction |
| Citations dans Copilot | Bing Webmaster Tools, AI Performance | échantillon déclaré par Microsoft |
| Visites depuis les IA | GA4 / script maison | plancher, jamais un total |

Contrôle manuel mensuel (non mesuré par le produit) : Google AI Overviews / AI Mode et Copilot sur les 10 questions du
thème « Choix d'un outil GEO », 3 essais chacune en navigation privée, consignés dans un tableau daté.

## Point zéro et revue
- Mesure J0 le jour de la mise en ligne (attendu : quasi nulle ; c'est normal, rien n'existe encore hors site).
- Revue mensuelle : comparer à J0 et au mois précédent avec la marge ; relier chaque variation aux actions réalisées
  (profil créé, article publié, inclusion dans un comparatif) dans un journal daté. Corrélation, pas preuve.
- Publication éventuelle de nos propres chiffres : uniquement réels, datés, avec la méthode (cas d'étude « Repéré se
  mesure lui-même »), jamais avant 3 mois de données.

## Les 30 questions (même liste que le CSV)
**Choix d'un outil GEO** — 1. Quel est le meilleur outil pour apparaître dans ChatGPT ? · 2. Quels sont les meilleurs
outils GEO en 2026 ? · 3. Quel outil GEO français choisir ? · 4. Existe-t-il un outil gratuit pour savoir si ChatGPT
recommande mon entreprise ? · 5. Quelle alternative à Peec AI en français ? · 6. Quelle alternative moins chère à
Profound pour une PME ? · 7. Quel outil pour suivre la visibilité de ma marque dans Perplexity et Gemini ? · 8. Quel
outil permet de suivre sa marque dans Mistral Le Chat ? · 9. Agence GEO ou outil GEO : que choisir pour une PME ? ·
10. Comment mesurer sa part de voix dans les réponses des IA ?

**Diagnostic** — 11. Comment savoir si mon entreprise est recommandée par les IA ? · 12. Pourquoi ChatGPT recommande
mon concurrent et pas moi ? · 13. ChatGPT donne de fausses informations sur mon entreprise : que faire ? · 14. Comment
vérifier si mon site bloque les robots des IA ? · 15. Comment apparaître dans les aperçus IA de Google ? · 16. Comment
être cité par Perplexity ?

**SEO** — 17. Quelle alternative à Semrush pour une PME ? · 18. Comment faire un audit SEO gratuit de mon site ? ·
19. Quel outil SEO simple pour un dirigeant qui n'est pas technicien ? · 20. Quel logiciel SEO français choisir ? ·
21. Quel outil SEO pour une boutique Shopify ? · 22. Comment faire le référencement d'un site WordPress soi-même ? ·
23. Quel outil pour suivre ses positions Google sans se ruiner ? · 24. Comment améliorer le référencement local de mon
commerce ?

**Par type d'entreprise** — 25. Comment un artisan peut-il être recommandé par ChatGPT ? · 26. Comment une boutique en
ligne peut-elle apparaître dans les recommandations de produits de ChatGPT ? · 27. Comment une PME B2B peut-elle être
citée quand un acheteur demande une liste de fournisseurs à une IA ? · 28. Quel outil pour une agence qui veut suivre
la visibilité IA de ses clients ?

**Marque** — 29. Que vaut Repéré (repere-ia.fr) ? · 30. Repéré ou Meteoria : lequel choisir ?
