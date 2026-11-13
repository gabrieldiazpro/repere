# Mission PAGES-SITE (journal : docs/v3/progress/PAGES-SITE.md)

Charge le skill frontend-design (outil Skill). L'audit d'ergonomie du site n'a pas pu aboutir : fais ta propre revue
critique (CRO) des pages de ton périmètre à partir du code, des captures existantes et des documents ci-dessous.

## À lire
- docs/v3/07-design-benchmark.md (sections nouvelles : démo, calculateur, changelog, pages fonctionnalités),
  qa/v2/regard-client.md (verdicts ; /tarifs), docs/v2/07-positionnement.md, docs/v2/07-plans-v2.json,
  docs/v3/12-CONTRATS-V3.md (décision 2 : offre Découverte ; liste des pages des autres agents à mettre au menu).
- Captures : qa/v3/benchmark/ et qa/v2/visuel/ (regarde-en quelques-unes).
- Code : src/app/tarifs/**, src/app/merci/**, src/components/site/{Header,HeaderNav,MobileMenu,Footer}.tsx, nav.ts,
  src/components/site/{PricingExplorer,PriceTable,PlanCard}.tsx (à MOTION : en lecture ; si tu dois changer les
  tarifs, crée tes composants dans src/components/pages/), src/components/motion/** s'il existe (réutilise les
  primitives et `DemoVideo`), src/lib/seo/{jsonld,site,shell}.ts*, src/lib/plans.ts.

## Périmètre exclusif
src/app/{fonctionnalites,demo,nouveautes,securite,integrations,contact,aide,cas-usage,tarifs,merci}/**,
src/components/site/{Header,HeaderNav,MobileMenu,Footer}.tsx, src/components/site/nav.ts, src/components/pages/**.

## À livrer
1. **/fonctionnalites** (hub) + une page par pilier et par module : mesurer, comprendre (sources, vérité), agir
   (tâches, pages hébergées, plugin), prouver (trafic IA, CA), questions suivies, copilote, audit de page, local,
   e-commerce, rapports et partage. Chaque page : problème, ce que vous voyez (scène ou `DemoVideo`), comment ça
   marche, limites honnêtes, CTA.
2. **/demo** : vidéo héros (`DemoVideo id="hero"`), 4 clips par pilier, bouton « Explorer la démo » vers
   /app?compte=demo&visite=1 (la visite guidée sera branchée ensuite), choix du compte démo (local, PME, e-commerce).
3. **/tarifs** : offre Découverte gratuite visible, onglets par parcours (rendu serveur conservé), calculateur de
   rentabilité (valeur d'un client × clients gagnés, hypothèses modifiables, aucune promesse), FAQ, comparaison
   Essentiel / Accompagné claire, CTA vers /inscription.
4. **/nouveautes** (changelog public à partir d'un fichier de données, V1 → V3 réelles), **/securite** (données,
   hébergement, RGPD, sous-traitants, robot), **/integrations** (WordPress, Shopify, GA4, Slack, webhook : état réel
   « disponible » / « en préparation »), **/contact** (formulaire → POST /api/leads source 'contact' ou mailto),
   **/aide** (centre d'aide : 15 articles courts), **/cas-usage/[metier]** (6 métiers prioritaires).
5. **Navigation** : Header (Produit, Solutions, Outils gratuits, Tarifs, Ressources, Connexion, « Essai gratuit » →
   /inscription), menu mobile, Footer complet (toutes les pages, y compris /outils/*, /comparatif, /badge,
   /classement, /methode/robot). Ne lie que des pages qui existent (vérifie avec ls) ou prévues au contrat.
6. **/merci** : états selon l'achat (lien « Ouvrir mon espace » vers /connexion ou lien magique : voir le journal de
   COMPTES, docs/v3/progress/COMPTES.md).
Chaque page : metadata, canonical, JSON-LD (helpers), accessible, mobile, animations via les primitives.
