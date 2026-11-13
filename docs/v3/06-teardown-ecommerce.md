# 06 — Teardown des outils de visibilité IA pour l'e-commerce (Repéré V3)

> Agent TEARDOWN E-COMMERCE · 9 novembre 2026 · 16 recherches web, 24 pages lues.
> Convention : **[V]** = lu sur la page citée (date de lecture : 9 nov. 2026) · **[NV]** = non vérifié (résultat de recherche
> sans lecture de la page, souvenir, ou page inaccessible). Les prix sont ceux affichés le 9 nov. 2026, en USD sauf mention.
> Règle du brief : « cloner » = reproduire l'idée fonctionnelle avec notre design et notre code, jamais textes, visuels ni code.
> Les allégations de performance des éditeurs (ex. « +8 % de conversion ») sont rapportées comme allégations, jamais comme faits.

---

## 0. À retenir

1. **Les deux outils de mesure « shopping » sérieux sont chers ou récents.** Profound Shopping est réservé au plan Enterprise
   et ne couvre que ChatGPT Shopping [V]. Peec AI Shopping Analytics (17 juin 2026) fait du suivi par SKU, mais son prix n'est
   pas publié pour cette fonction [V]. Les deux sont en anglais, sans lecture de catalogue Shopify français ni correction des fiches.
2. **Les apps Shopify GEO sont jeunes, presque sans avis.** Sur 6 listings lus, 5 affichent 0 avis (une seule affiche 1 avis).
   Seul Judge.me (avis) a une vraie base : 5,0 sur 49 771 avis [V]. Conséquence : aucun standard établi, mais aussi aucune
   preuve que les marchands paient pour ces outils.
3. **Personne ne relie visibilité et chiffre d'affaires de façon vérifiable.** Triple Whale a racheté Anteater (21 janv. 2026) pour
   ajouter suivi IA, mapping SKU et attribution [V, article de presse]. Polar Analytics ne mentionne ni ChatGPT ni trafic IA sur sa fiche
   Shopify (à partir de 750 $/mois) [V]. FoundInAI promet une attribution via GA4 à 19 $/mois [V]. Shopify propose en natif un filtre
   « Referrer name » dans Analytics > Cibles [V, source tierce]. C'est notre créneau « preuve en CA ».
4. **Les outils de flux (Lengow, Channable, Feedonomics) vendent la distribution, pas la mesure.** Lengow valide le flux (champs
   manquants, prix invalides, URL cassées) [V]. Feedonomics ACE cible les grands comptes [V]. Aucun ne dit si le produit est cité.
5. **Les éditeurs d'avis ouvrent leurs avis aux IA** (Judge.me JSON-LD jusqu'à 50 avis + Q&R ; Yotpo ; Trustpilot AI Visibility
   Metrics). Repéré doit **lire et contrôler** ce balisage plutôt que de concurrencer ces outils.

---

## 1. Inventaire des concurrents lus

### 1.1 Apps Shopify GEO / llms.txt / AI visibility

| App | Éditeur, date | Note / avis | Prix | Fonctions | Statut |
|---|---|---|---|---|---|
| **AI Visibility & LLMs for GEO** | Kebbz (Montréal), 10 déc. 2025 | 0,0 / 0 avis | Gratuit | llms.txt mis à jour chaque jour ; produits, collections, pages, blog ; demande l'accès aux commandes des 60 derniers jours | [V] https://apps.shopify.com/geo-ai-visibility-llms-txt |
| **GEOde : AI SEO & GEO Audit** | Violet Rome LLC, 11 mai 2026 | 0,0 / 0 avis | 29 $ → 59 $ → 119 $ → 249 $/mois (essai 7 jours ; -17 % en annuel) | **Score GEO unique** ; correctifs en un clic (schema, alt, meta, llms.txt) ; réécriture IA de descriptions faibles (50 → illimité/mois) ; FAQ et schema FAQ (à partir de 119 $) ; produits que l'IA ne remonte pas, avec raisons ; suivi de mentions IA (à partir de 59 $) ; alerte si le score baisse ; historique et retour arrière | [V] https://apps.shopify.com/geode |
| **FoundInAI** | n.c. | 0,0 / 0 avis | Gratuit ; 9 $ ; 19 $ ; 49 $/mois | Scan de visibilité ; llms.txt, llms-full.txt, agents.md ; suivi de citations sur 5 IA (5 → 25 vérifications/jour) ; **attribution du CA IA dans GA4** (dès 19 $) ; **suivi de citation par SKU** (49 $) ; écart de mots-clés concurrents ; rapport PDF « Visibilité et revenu » ; interface en français | [V] https://apps.shopify.com/foundinai |
| **LLM Rank** | n.c. | 5,0 / 1 avis | Gratuit (100 produits, 50 collections) ; Pro 9 $/mois | llms.txt, agents.md, produits mis en avant pour les agents, consignes personnalisées, UCP, MCP, contrôle de 100+ bots | [V] https://apps.shopify.com/llm-rank |
| **Scurix Product Enrichment AI** | n.c. | 0,0 / 0 avis | Gratuit (10 produits) ; 19 $ (500) ; 49 $ (2 500) ; 99 $ (10 000) | 12+ attributs structurés par produit, 20 catégories, écrits en **metafields** ; **score de complétude du catalogue** (dès 49 $) ; aperçu avant application ; JSON-LD sur chaque fiche ; export flux Google Shopping ; multilingue | [V] https://apps.shopify.com/scurix-product-attributes-ai |
| GEO Rocket, Alignment GEO, Pattern GEO Scorecard, CiteShop, LLMs.txt Generator for GEO, AEO LLMs.txt | divers | n.c. | n.c. | Apparaissent dans la recherche « Shopify AI visibility » | **[NV]** (listings non ouverts) |

**Lecture.** Le marché Shopify est une course au bas prix sur llms.txt (0 à 9 $) avec deux acteurs qui montent en gamme : GEOde
(score + réécriture + FAQ) et FoundInAI (suivi + attribution). Aucun n'a d'avis : la crédibilité se gagne par la preuve, pas par le
nombre de fonctions. Aucun ne cite explicitement les revendeurs ni ne compare prix et avis cités.

### 1.2 Mesure shopping : Profound, Peec

| Outil | Ce que voit l'utilisateur | Prix / accès | Statut |
|---|---|---|---|
| **Profound Shopping** | **Taux de mode shopping** (part des requêtes suivies qui déclenchent un carrousel produit) ; **score de visibilité shopping** par thème ; **couche marchand** (quels revendeurs apparaissent, combien de fois, quelle part de leurs produits recommandés est la vôtre) ; **couche produit** (SKU, prompts qui les font remonter, attributs tels que l'IA les décrit) ; prix affichés ; liens de paiement (site de la marque ou tiers) | **Enterprise uniquement.** ChatGPT seulement ; Perplexity et Gemini « en développement ». Plans publics Starter 99 $ et Growth 399 $/mois (annuel) selon une source tierce | [V] https://docs.tryprofound.com/shopping/about ; prix [V, source tierce] https://www.anagram.ai/blog/best-chatgpt-visibility-tools-shopify-brands-2026 |
| **Peec AI Shopping Analytics** (17 juin 2026) | Par produit : **visibilité**, **taux de victoire** (1re recommandation), **position**, **prix cité vs prix catalogue**, **attributs de comparaison** classés par fréquence ; **où l'IA envoie l'acheteur** (boutique, marketplace, revendeur) ; écarts entre ce que l'IA évalue et ce que dit la fiche ; produits qui gagnent ou perdent des places ; prompts moteurs et absents. Import du catalogue par domaine Shopify, CSV ou flux Merchant Center ; correspondance sur les 30 derniers jours de chats. **À venir : « Shopping Actions »** (liste classée de changements de fiche), prompts générés par IA, API et MCP | Prix de la fonction non publié ; essai gratuit. Starter : 50 prompts, 3 modèles, 1 projet (source tierce) | [V] https://peec.ai/blog/ai-shopping-analytics ; https://docs.peec.ai/setting-up-shopping-prompts (les prompts de catégorie et de produit ; chaque produit du catalogue est suivi automatiquement) |
| Otterly | Citations, classement de domaines, audits GEO | Lite 29 $ (15 prompts), Standard 189 $, Premium 489 $ (source tierce) | [V, source tierce] |
| Scrunch, AthenaHQ, Anagram | Surveillance et actions, quelques liens avec Shopify ; aucun n'est décrit comme reliant visibilité et revenu par la source lue | Scrunch dès 250 $/mois ; AthenaHQ dès 295 $ ; Anagram dès 299 $ | [V, source tierce] |

**Écart à noter avec le doc V2 (02-marche-ecommerce.md).** Il cite Peec « partiel (pas d'écriture catalogue) » et Profound « périmètre
shopping NV ». C'est corrigé : Peec fait désormais du suivi par SKU et annonce des actions ; Profound a un module shopping Enterprise
avec couche marchand. Le prix de Peec en dessous de 89 €/mois n'a pas été revérifié [NV].

### 1.3 Flux produits : Channable, Feedonomics, Lengow, Shoppingfeed

| Outil | Fonctions « IA / agentic » lues | Statut |
|---|---|---|
| **Lengow** | Canal flux ChatGPT conforme à la spécification OpenAI ; **validation du flux** (champs manquants, prix invalides, URL cassées) ; tests en sandbox ; enrichissement des titres, descriptions, attributs (NetAmplify) et adaptation marketplaces (NetMarkets) ; suivi de prix concurrents (NetRivals) pour choisir quoi pousser sur les canaux IA. Champs obligatoires : id, titre, description, image, prix, disponibilité, marque, catégorie ; recommandés : notes et nombre d'avis, GTIN, images secondaires, regroupement de variantes. **OpenAI n'a publié aucun critère d'éligibilité ; programme en bêta limitée, marché par marché ; aucune date pour la France** | [V] https://www.lengow.com/fr/aller-plus-loin/comment-faire-apparaitre-vos-produits-dans-les-resultats-ia-et-le-commerce-agentique/ ; https://www.lengow.com/fr/aller-plus-loin/chatgpt-shopping-eligibilite-calendrier-et-comment-preparer-votre-flux |
| **Channable** | Flux « prêts pour l'IA » depuis une source unique ; **AI Product Listing** (structure et enrichit les données) ; flux OpenAI pour ChatGPT ; « AI Max for Google » ; recommande d'auditer le flux et d'unifier les attributs. Pas de prix dans l'article | [V] https://www.channable.com/blog/agentic-commerce (2 juil. 2026) |
| **Feedonomics** (groupe Commerce) | **Agentic Catalog Exports (ACE)**, 27 avr. 2026 : catalogues prêts pour les agents vers OpenAI, Google/Gemini, Copilot, PayPal, Stripe, Perplexity, Amazon ; service **entreprise** ; exemple Dell (~7 000 références) ; outils en libre-service « prévus » | [V] https://www.nasdaq.com/press-release/feedonomics-unlocks-agentic-discovery-agentic-catalog-exports-2026-04-27 |
| **Shoppingfeed** | Le site officiel n'était pas accessible dans cette session (hors liste autorisée). Aucune fonction IA lue | **[NV]** |
| **Shopify Agentic Storefronts** (version FR) | Activé **automatiquement** pour les boutiques admissibles ; Catalog structure les données ; **Knowledge Base** ; un **tableau de bord évalue la qualité des fiches** (exhaustivité des descriptions, couverture d'images, compétitivité des prix, exhaustivité des politiques) ; pas de frais mentionnés ; conditions d'éligibilité et pays non détaillés | [V] https://www.shopify.com/fr/agentic-storefronts |

**Lecture.** Le « score de qualité des fiches » est en train de devenir une **fonction native de Shopify**. Le score de Repéré ne doit
donc pas être la seule promesse : il faut y ajouter la preuve (citée ou non dans les IA) et la correction.

### 1.4 Enrichissement des fiches par IA

Lu : Scurix (§1.1) et GEOde (réécritures). Dans la recherche, apparaissent aussi Describely, Anglera, Bluestone PIM, Akeneo/Induxx,
Piminto, Wisepim, Automated Commerce : **[NV]** (pages non lues). Constat vérifié : l'enrichissement par attributs écrits en metafields,
avec aperçu avant application, existe déjà à 19-99 $/mois ; l'écriture « conversationnelle » (usages, pour qui) est portée par GEOde.

### 1.5 Avis

| Outil | Fonctions pour les IA | Statut |
|---|---|---|
| **Judge.me** | Avis rendus en HTML côté serveur (lisibles sans JavaScript) ; JSON-LD avec la note agrégée, **jusqu'à 50 avis récents riches** et les entrées Q&R ; résumés IA et mots-clés de sentiment ; réponses du marchand ; réponses à questions personnalisées (taille, type de peau) ; option « AI visibility » activée par défaut (Réglages > Google, SEO et IA), exige un bloc d'app dans le thème. Note 5,0 sur 49 771 avis ; plan Gratuit, puis Awesome 15 $/mois (réponses et résumés IA, Q&R, Google Shopping) | [V] https://judge.me/help/en/articles/15860924-making-reviews-visible-to-ai-shopping-assistants ; https://apps.shopify.com/Judgeme |
| **Yotpo** | Balisage schema des avis, résumés IA, rendu au chargement, mises à jour auto, choix des fiches optimisées, syndication vers Google et détaillants. Chiffres de performance **auto-déclarés** (+5,4 % de conversion, etc.), **sans donnée sur les citations par les IA** | [V] https://www.yotpo.com/platform/reviews/llm-discoverability.md |
| **Trustpilot** (7 avr. 2026) | Outils récence / pertinence / classement ; collecte dans l'app ; **Invitation Optimizer** ; **AI Visibility Metrics** (où les signaux Trustpilot influencent les recommandations IA) | [V, article de presse] https://www.pulse.bot/marketing/news/trustpilot-launches-new-features-to-help-brands-get-found-and-chosen-in-the-age-of-ai-9e3797e3-9f5b-4457-999d-e8678a2e8b0e/ |
| **Avis Vérifiés (Skeepers)** | Aucune fonction IA lue ; seuls des documents contractuels sont sortis de la recherche | **[NV]** |

### 1.6 Attribution du chiffre d'affaires IA

| Outil | Ce qu'il fait | Statut |
|---|---|---|
| **Shopify Analytics > Cibles** | Filtre « Referrer name » et « Landing page path » sur chaque métrique de sessions ; **un seul filtre par cible** ; pas de rapport IA dédié ; liste exacte des valeurs de referrer non donnée | [V, source tierce] https://atomz.beehiiv.com/p/how-to-track-ai-traffic-inside-shopify-without-a-third-party-tool |
| **Triple Whale** | Rachat d'**Anteater** (21 janv. 2026) : suivi de visibilité IA, **mapping de réponses IA vers SKU**, attribution du CA IA, dans le tableau de bord. Modèles first-click, last-click, « Total Impact » ; l'article éditeur reconnaît que l'attribution « ne sera jamais parfaite » et ne dit pas comment les visites IA sont classées | [V, article de presse] https://www.pulse.bot/ecommerce/news/triple-whale-acquires-anteater-to-track-ai-search-visibility-22bc77a5-488e-444b-a462-48e702fd5f62/ ; https://www.triplewhale.com/blog/seo-attribution-how-ai-attribution-models-are-breaking-shopify-data |
| **Polar Analytics** | 4,9 sur 116 avis ; Core **dès 750 $/mois** selon le GMV ; 45+ sources ; la fiche **ne mentionne ni ChatGPT ni trafic IA** | [V] https://apps.shopify.com/polar-analytics |
| **Lifetimely (Amp)** | Rien de vérifié sur une fonction IA | **[NV]** |
| **FoundInAI** | Attribution du CA IA via GA4 (dès 19 $) ; rapport PDF « Visibilité et revenu » | [V] https://apps.shopify.com/foundinai |

---

## 2. Inventaire des fonctionnalités à cloner (parcours E-commerce)

Notation : effort S ≤ 1 semaine, M = 2 à 4 semaines, L > 1 mois (fondateur solo). Priorité 1 à 5 (5 = indispensable).
Intégrations : **Crawl** = URL produit publique (zéro intégration, sert d'audit gratuit) ; **Shopify** = Admin GraphQL ;
**Woo** = REST `wc/v3`. Les scopes exacts sont à confirmer dans la doc Shopify [NV].

### F1. Audit de fiche produit pour les IA (score par fiche) — priorité 5, effort M
- **Voit l'utilisateur** : liste de produits triée par score (0-100), avec pour chaque fiche : balisage Product/Offer/AggregateRating/Review
  détecté et valide ou non, attributs manquants (GTIN, marque, matière, taille, usage), contenu de réponse (FAQ, usages), accès des bots IA.
- **Valeur** : transforme « on est mal cités » en une liste de corrections fiche par fiche.
- **Concurrents** : GEOde (score GEO unique), Scurix (complétude du catalogue), Shopify (qualité des fiches), Lengow (validation).
- **Crawl** : on lit le HTML rendu et le JSON-LD de l'URL ; on contrôle les champs requis Google/OpenAI listés par Lengow.
  **Shopify** : `products`, `variants`, `metafields` (`read_products`). **Woo** : `GET /wc/v3/products`.
- **Différence** : le score s'accompagne de la **preuve** (la fiche est-elle citée pour ses requêtes ?).

### F2. Suivi des requêtes produit : marques ET produits cités — priorité 5, effort L
- **Voit l'utilisateur** : par requête (catégorie ou produit), tableau des marques et produits cités, rang, part de voix, avec les concurrents ;
  par produit : visibilité, taux de 1re place, position.
- **Valeur** : cœur de la mesure ; la citation de marque seule ne suffit plus, le SKU compte.
- **Concurrents** : Peec Shopping Analytics (visibilité, win rate, position), Profound (SKU), FoundInAI (SKU, 49 $).
- **Construction** : moteur V2 existant sur 20 requêtes types FR (doc V2 §7) ; extraction des produits cités (nom, prix, URL) ; appariement
  avec le catalogue (domaine Shopify, CSV, `/products.json` public). Sans intégration : import par URL de boutique.
- **Limite** : les API des LLM ne reproduisent pas les carrousels shopping de l'interface [NV, doc V2 §10] ; l'écart doit être affiché.

### F3. Revendeurs et marketplaces cités à la place de la marque — priorité 5, effort M
- **Voit l'utilisateur** : pour chaque requête, où l'IA envoie l'acheteur (site de la marque, Amazon, Sephora, Cdiscount, etc.), la part
  des citations qui vont chez des tiers, et la liste des revendeurs qui vous « volent » la recommandation.
- **Valeur** : décide d'actions concrètes (renforcer la fiche chez le revendeur, négocier, pousser le site direct).
- **Concurrents** : Profound « couche marchand », Peec « où l'IA envoie l'acheteur ».
- **Construction** : réutiliser le classement de 436 domaines (V2) ; classer chaque URL citée en « marque / revendeur / marketplace / média /
  forum ». Sans intégration.

### F4. Comparatif prix et avis cités — priorité 4, effort M
- **Voit l'utilisateur** : pour chaque produit, le prix et la note cités par l'IA, comparés au prix et aux avis de la fiche, et au
  concurrent cité ; alerte en cas d'écart.
- **Valeur** : détecte un prix périmé repris par l'IA ou un déficit d'avis face au concurrent cité (cause de perte, doc V2 §8.4).
- **Concurrents** : Peec (prix cité vs prix catalogue ; attributs comparés), Profound (prix des tuiles), Lengow NetRivals (prix concurrents, hors mesure IA).
- **Construction** : extraction (prix, note, nombre d'avis) dans les réponses ; comparaison avec `variants.price` (Shopify), ou le prix lu sur la fiche (crawl).

### F5. Attribution du chiffre d'affaires IA — priorité 5, effort M
- **Voit l'utilisateur** : sessions, commandes et CA dont le referrer est chatgpt.com, perplexity.ai, gemini.google.com, copilot.microsoft.com,
  par page d'atterrissage ; avant/après correction ; taux de conversion ; **mention claire de la sous-estimation** (apps mobiles sans referrer).
- **Valeur** : la preuve que justifie l'abonnement ; aucune app Shopify ne la donne de façon fiable, hors GA4 (FoundInAI) et Triple Whale (cher).
- **Concurrents** : Triple Whale + Anteater, FoundInAI (GA4), Shopify Cibles (filtre referrer). Polar : non mentionné.
- **Construction** : **Shopify** `orders` (`customerJourneySummary`, referrer et UTM de la 1re visite) agrégé en CA par source IA ;
  **sans intégration** : script `t.js` sans cookie existant (V2) ; **GA4** déjà préparé. **Woo** : attributs d'origine de commande (WooCommerce
  Order Attribution) [NV]. Données minimisées : agrégats seulement.

### F6. Génération de FAQ produit et de guides d'achat — priorité 4, effort S/M
- **Voit l'utilisateur** : 5 questions-réponses par best-seller, à valider, avec balisage FAQPage ; guides « Comment choisir » et « X vs Y »
  en brouillon.
- **Concurrents** : GEOde (FAQ + schema FAQ), Judge.me (Q&R dans le JSON-LD), Shopify Knowledge Base (FAQ, politiques aux agents).
- **Construction** : tâche existante « page FAQ hébergée /p/[slug] » étendue aux produits. Shopify : metaobjects ou `pageCreate`/articles ;
  Woo : `wc/v3/products` ou plugin JSON-LD. **Jamais de faux avis** ; les réponses se fondent sur la fiche de vérité.

### F7. Vérification du flux produit — priorité 4, effort M
- **Voit l'utilisateur** : liste d'erreurs et d'avertissements sur le flux (Merchant Center, flux OpenAI, flux Shopify) : champs
  obligatoires manquants, prix invalides, URL cassées, GTIN absent, disponibilité, politique de retour.
- **Concurrents** : Lengow (validation et sandbox), Channable (audit), Shopify (qualité des fiches), Scurix (export Google Shopping).
- **Construction** : **ne pas reconstruire un outil de flux** (reco V2 §4). Lire le flux ou `/products.json` ; contrôler selon les champs
  OpenAI (id, titre, description, image, prix, disponibilité, marque, catégorie) et Google. Sans intégration pour un flux public.
  **Avertissement** : OpenAI n'a pas ouvert de critères d'éligibilité en France [V, Lengow] : la fonction vérifie la *préparation*, pas l'inscription.

### F8. Enrichissement des attributs et écriture validée — priorité 4, effort M
- **Voit l'utilisateur** : diff avant/après par fiche (attributs, titre, description), application par lot, retour arrière.
- **Concurrents** : Scurix (aperçu, metafields), GEOde (historique et revert), Lengow NetAmplify (flux).
- **Construction** : Shopify `productUpdate`, `metafieldsSet` (`write_products`) ; Woo `PUT /wc/v3/products/{id}`. Validation humaine obligatoire.

### F9. Contrôle du balisage d'avis (lecture) — priorité 3, effort S
- **Voit l'utilisateur** : « Vos avis sont-ils lisibles par les IA ? » : rendu HTML sans JavaScript, JSON-LD AggregateRating/Review,
  Q&R, volume et récence ; diagnostic selon l'app d'avis détectée (Judge.me, Yotpo, Avis Vérifiés, Trustpilot).
- **Valeur** : l'erreur la plus fréquente est un widget d'avis rendu en JavaScript (invisible pour les crawlers). Judge.me l'indique lui-même :
  le widget « vintage » ne sort ni contenu ni schema [V].
- **Construction** : crawl pur. Pas de concurrence directe sur le diagnostic multi-éditeurs [NV : non cherché de façon exhaustive].

### F10. Alertes et rapport « visibilité et revenu » — priorité 3, effort S
- Alerte quand le score baisse (GEOde), rapport PDF visibilité + revenu (FoundInAI), produits qui gagnent ou perdent des places (Peec).
- Réutiliser digest du lundi et alertes V2.

### F11. llms.txt / llms-full.txt / agents.md — priorité 2, effort S
- Trivial et commoditisé (0 à 9 $). À fournir comme **hygiène** sans le vendre comme levier (effet non démontré, doc V2 §2).

### F12. Panel de requêtes généré à partir du catalogue — priorité 3, effort S
- Peec annonce des « prompts générés par IA » [V, à venir]. Repéré génère 10 à 30 requêtes en français à partir des catégories et
  best-sellers (doc V2 §8.2), avec les variantes « [marque] avis », « alternative à ».

### F13. « Actions » classées par impact (Shopping Actions) — priorité 4, effort M
- Peec annonce une liste classée de changements de fiche [V, à venir]. C'est la jonction F1 + F2 : à chaque requête perdue, la correction
  de fiche attendue, classée par impact estimé, avec validation et écriture (F8). **C'est la place à prendre avant Peec.**

---

## 3. Où se placer

| Brique | Apps Shopify GEO | Peec / Profound | Flux (Lengow...) | Avis | Triple Whale / Polar | **Repéré** |
|---|---|---|---|---|---|---|
| Mesure par requête et par SKU | Faible (FoundInAI 49 $) | Oui (cher / Enterprise) | Non | Non | Partiel (Anteater) | **Oui, en français, prix PME** |
| Revendeurs cités | Non lu | Oui | Non | Non | Non | **Oui** |
| Audit de fiche + correction | Oui (GEOde, Scurix) | Annoncé (Peec) | Validation de flux | Balisage avis | Non | **Oui, relié à la mesure** |
| Preuve en CA | GA4 (FoundInAI) | Non | Non | Non | Cher / non lu | **Oui** |
| Avis | Non | Non | Non | Oui | Non | Lecture et diagnostic |

**Recommandation de portée V3** : cloner d'abord F1, F2, F3, F5, puis F13 (liaison) ; F4, F6, F7, F8 ensuite ; F9 à F12 en finitions. Le crawl
d'une URL publique permet un **audit gratuit sans installation** (F1, F7, F9) ; Shopify débloque F5 et F8 ; WooCommerce reste après Shopify.

## 4. Limites de ce teardown

- Aucune app n'a été installée ni testée : tout vient des pages publiques. Les fonctions annoncées ne sont pas mesurées.
- Les notes d'apps et nombres d'avis sont ceux du 9 nov. 2026 et changent vite ; presque toutes sont à 0 avis.
- Plusieurs sources sont **secondaires** (comparatifs, articles de presse) : marquées « source tierce ».
- Non vérifiés : Shoppingfeed, Avis Vérifiés / Skeepers, Lifetimely, GEO Rocket, Alignment GEO, Pattern GEO Scorecard, CiteShop, les outils
  d'enrichissement hors Scurix et GEOde, le prix d'entrée actuel de Peec, les prix Channable et Lengow.
- Les scopes API Shopify cités sont des principes à confirmer dans la documentation avant développement.

## 5. Sources (lues le 9 novembre 2026)

- Shopify App Store : https://apps.shopify.com/geo-ai-visibility-llms-txt · https://apps.shopify.com/geode · https://apps.shopify.com/foundinai · https://apps.shopify.com/llm-rank · https://apps.shopify.com/scurix-product-attributes-ai · https://apps.shopify.com/polar-analytics · https://apps.shopify.com/Judgeme
- Shopify Agentic Storefronts (FR) : https://www.shopify.com/fr/agentic-storefronts
- Profound : https://docs.tryprofound.com/shopping/about
- Peec AI : https://peec.ai/blog/ai-shopping-analytics · https://docs.peec.ai/setting-up-shopping-prompts · https://www.shopifreaks.com/peec-ai-launches-sku-level-analytics-showing-brands-which-of-their-products-chatgpt-recommends-at-what-price-and-where/
- Comparatif de prix des outils : https://www.anagram.ai/blog/best-chatgpt-visibility-tools-shopify-brands-2026
- Lengow : https://www.lengow.com/fr/aller-plus-loin/comment-faire-apparaitre-vos-produits-dans-les-resultats-ia-et-le-commerce-agentique/ · https://www.lengow.com/fr/aller-plus-loin/chatgpt-shopping-eligibilite-calendrier-et-comment-preparer-votre-flux
- Channable : https://www.channable.com/blog/agentic-commerce
- Feedonomics : https://www.nasdaq.com/press-release/feedonomics-unlocks-agentic-discovery-agentic-catalog-exports-2026-04-27
- Judge.me : https://judge.me/help/en/articles/15860924-making-reviews-visible-to-ai-shopping-assistants
- Yotpo : https://www.yotpo.com/platform/reviews/llm-discoverability.md
- Trustpilot : https://www.pulse.bot/marketing/news/trustpilot-launches-new-features-to-help-brands-get-found-and-chosen-in-the-age-of-ai-9e3797e3-9f5b-4457-999d-e8678a2e8b0e/
- Triple Whale : https://www.pulse.bot/ecommerce/news/triple-whale-acquires-anteater-to-track-ai-search-visibility-22bc77a5-488e-444b-a462-48e702fd5f62/ · https://www.triplewhale.com/blog/seo-attribution-how-ai-attribution-models-are-breaking-shopify-data
- Suivi du trafic IA dans Shopify (Cibles) : https://atomz.beehiiv.com/p/how-to-track-ai-traffic-inside-shopify-without-a-third-party-tool
