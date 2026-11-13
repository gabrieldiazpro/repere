# Mission ECOMMERCE (journal : docs/v3/progress/ECOMMERCE.md)

## À lire
- docs/v3/06-teardown-ecommerce.md en entier + docs/v3/features-ecommerce.json, docs/v2/02-marche-ecommerce.md,
  qa/v2/regard-client.md (verdict d'Inès).
- Code : src/lib/engine/index.ts (segment e-commerce, détection des marques), src/lib/tracking/** (t.js, conversions),
  src/lib/execution/ (livrables produits), src/lib/store.ts, src/lib/demo-v2.ts.
- 3 à 5 recherches web sur l'API Admin Shopify actuelle : OAuth, scopes read_products et read_orders, champs de
  commande pour l'attribution (referring_site, landing_site, customerJourneySummary en GraphQL), versions.

## Périmètre exclusif
src/lib/ecommerce/**, src/app/api/ecommerce/**. Pas d'écrans. Si public/t.js et src/app/api/t n'acceptent pas encore
une VALEUR de conversion (montant), ne les modifie pas : décris le patch précis dans « À faire par d'autres ».

## À livrer
1. **Catalogue suivi** : produits phares (nom, URL, catégorie, prix, GTIN facultatif), saisis à la main, importés
   depuis le sitemap ou des URL (audit de fiche produit de '@/lib/siteaudit'), ou via Shopify si branché.
2. **Suivi par produit** : dans les réponses des audits, détection des MARQUES et des PRODUITS cités (correspondance
   floue, variantes). Par question : produits recommandés, rang, présence du produit du client. Agrégats par produit
   et par catégorie.
3. **Revendeurs à la place de la marque** : dans les sources citées, repérer quand l'IA envoie vers une marketplace,
   un revendeur ou un comparatif plutôt que vers le site de la marque ; part par type ; recommandations.
4. **Comparatif prix et avis** : prix et note cités par les IA (règles + LLM en option) comparés à la fiche réelle ;
   les écarts alimentent la vérification des faits (erreur de prix).
5. **CA attribué aux IA** : modèle (commandes par moteur d'IA, panier moyen, conversion comparée aux autres sources).
   Sources : (a) valeur de conversion de t.js, (b) connecteur Shopify préparé (OAuth, lecture des commandes,
   attribution par referrer et UTM, jetons chiffrés ; désactivé sans `SHOPIFY_CLIENT_ID`), (c) démo réaliste pour
   `demo-ecom` (Maison Sora).
6. **Livrables** : FAQ produit, guide d'achat par catégorie (gabarits de qualité, LLM si clé), JSON-LD Product complet.
7. Routes /api/ecommerce/* (requireBusiness), seed de démonstration, tests.
