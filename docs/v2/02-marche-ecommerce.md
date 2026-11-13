# 02 — Marché GEO e-commerce (parcours « E-commerce » de Repéré V2)

> Agent MARCHÉ GEO E-COMMERCE · état au 9 novembre 2026 · ~30 recherches et lectures web.
> Convention : **[V]** = vérifié dans une source datée (lien en fin de document) ; **[NV]** = non vérifié
> (souvenir, source secondaire non datée, ou déduction). Les pages d'aide OpenAI et Search Engine Land n'ont
> pas pu être lues directement (erreur d'accès) : ce qu'elles contiennent est rapporté de seconde main et marqué [NV].

---

## 0. À retenir en 10 lignes

1. Le **paiement dans l'IA recule** : OpenAI a déplacé Instant Checkout vers les « apps » marchandes (mars 2026) [V].
   La **découverte** (carrousels produits, shopping research) reste, et c'est elle qui compte pour une marque.
2. **En France, aucun paiement natif dans une IA** n'est confirmé pour une marque DTC en novembre 2026. Les annonces
   de Google (Canada, Australie puis Royaume-Uni), Microsoft (États-Unis) et Perplexity (États-Unis) excluent la France [V].
   La visibilité organique, elle, est disponible partout.
3. Le **trafic IA convertit désormais mieux** aux États-Unis : +60 % de conversion et +53 % de revenu par visite en
   juillet 2026 selon Adobe [V]. En France, le trafic IA vers 13 grandes enseignes a été multiplié par 18 sur 2025,
   avec un taux de conversion d'environ 1,7 %. Plus de 90 % de ce trafic vient de ChatGPT (Valiuz) [V].
4. Le levier n°1 est la **donnée produit** : un flux complet (GTIN, attributs, prix, stock, avis) plus le balisage
   schema Product/Offer. Shopify centralise cette donnée via Agentic Storefronts et Shopify Catalog [V].
5. Les **outils de mesure** sont nombreux et peu chers (Otterly dès 23 £/mois, Peec dès 89 €/mois [V]). Les apps
   Shopify « llms.txt » sont presque gratuites (0 à 9 $/mois [V]). Personne ne couvre en français la boucle
   **mesure → correction des fiches → preuve par le CA**. C'est là que Repéré doit se placer.

---

## 1. État des lieux par plateforme

### 1.1 ChatGPT (OpenAI)

| Élément | État | Statut |
|---|---|---|
| Résultats shopping (carrousels produits dans les réponses) | Lancés en avril 2025 pour tous les utilisateurs, y compris non connectés, sans publicité | [NV] (souvenir, aide OpenAI non lisible) |
| **Shopping research** (guide d'achat approfondi) | Lancé le 24 ou 25 novembre 2025, gratuit et quasi illimité pendant les fêtes, couvert par la presse française | [V] date et gratuité · [NV] disponibilité exacte en France (probable : déploiement mondial, utilisateurs connectés) |
| **Instant Checkout** (paiement dans le chat, via ACP) | Septembre 2025, aux États-Unis, un article à la fois, avec Etsy puis Shopify. En **mars 2026**, OpenAI le « déplace vers les Apps » : le paiement passe par les apps ChatGPT des marchands (Target, Instacart, DoorDash…) | [V] |
| **Agentic Commerce Protocol (ACP)** | Protocole ouvert d'OpenAI et Stripe. Il est maintenu comme « infrastructure » du parcours d'achat, mais n'est plus lié au paiement direct dans les réponses. PayPal l'a adopté en octobre 2025 | [V] |
| **Flux produit ChatGPT** | Spécification publiée sur developers.openai.com/commerce/specs/feed. Formats CSV, TSV, XML ou JSON. Champs `id`, `title`, `description`, `link`, `image_link`, `price`, `availability`, `brand`… Drapeaux `enable_search` et `enable_checkout`, politiques de retour et de livraison. Rafraîchissement fréquent | [V] (via Lengow) · [NV] qu'un formulaire de candidature public reste ouvert aux marchands français |
| Apps marchandes dans ChatGPT | **Carrefour** a été la première enseigne européenne, en mars 2026, avec une app en France : recettes, panier et créneau dans ChatGPT, mais **paiement sur carrefour.fr** | [V] |
| Classement | Résultats « choisis indépendamment, non sponsorisés, non influencés par des paiements ». OpenAI cite les métadonnées structurées (prix, description, avis) issues de fournisseurs tiers | [V] « non sponsorisés » (Lengow) · [NV] le détail des critères |

**Comment un marchand y apparaît** :
- de façon organique, via l'index web (Bing et le crawler OAI-SearchBot) et des fournisseurs de données produit tiers [NV] ;
- via un flux produit OpenAI, en direct ou par Shopify / Lengow [V] ;
- via une app ChatGPT, réservée aux grandes enseignes [V].

**En France, en novembre 2026** :
- découverte organique et shopping research : oui (shopping research [NV]) ;
- paiement natif : non pour une marque DTC [V par absence dans toutes les annonces, à re-vérifier].

**Intégrations** :
- **Shopify** : canal Agentic Storefronts (ChatGPT listé « disponible ») [V].
- **WooCommerce** : pas de connecteur officiel identifié. Possible via des flux tiers (Lengow, Channable…) [NV].
- **Prestashop** : idem, via Lengow ou des modules de flux [NV].

### 1.2 Google — AI Mode, AI Overviews, Gemini

| Élément | État | Statut |
|---|---|---|
| Source produit | **Google Merchant Center** (Shopping Graph) : le flux et les annonces gratuites alimentent AI Mode et Gemini | [V] (principe) |
| **Universal Commerce Protocol (UCP)** | Annoncé à Google I/O 2026, détaillé à Google Marketing Live le 20 mai 2026. Comprend Universal Cart (panier multi-marchands entre Search et Gemini), paiement Google Pay, marchand toujours « merchant of record », Direct Offers, BNPL Klarna et Affirm | [V] |
| Pays du paiement UCP | États-Unis d'abord, puis Canada et Australie « dans les prochains mois », puis Royaume-Uni. **France non annoncée** | [V] |
| **Conversational attributes** (Merchant Center) | Descriptions produit adaptées à la recherche conversationnelle. **Disponibles pour les marchands du monde entier** | [V] |
| **AI performance insights** (Merchant Center) | Part de voix de la marque sur les surfaces IA face à des marques comparables. Déploiement aux États-Unis, au Canada, en Australie, en Inde et en Nouvelle-Zélande. **Pas en France** | [V] |
| Shopify | Inscription automatique des marchands Shopify éligibles au paiement natif dans AI Mode et Gemini | [NV] (titre TechWyse, non lu) |

**En France, en novembre 2026** :
- AI Overviews et AI Mode sont disponibles en français (AI Mode : déploiement en France [NV] sur la date exacte) ;
- les fiches produits y apparaissent via Merchant Center ;
- pas de paiement UCP ;
- les conversational attributes sont utilisables.

**Intégrations** :
- **Shopify** : app Google & YouTube.
- **WooCommerce** : extension Google Listings & Ads.
- **Prestashop** : module PrestaShop Marketing with Google.

Ces trois modules existent depuis longtemps [NV pour leur nom exact en 2026].

### 1.3 Perplexity

| Élément | État | Statut |
|---|---|---|
| Merchant Program | Lancé en novembre 2024, **gratuit**, distinct de la publicité, avec un formulaire d'intérêt (sans garantie d'intégration) | [V] |
| Achat en un clic | Le 25 novembre 2025, le shopping devient gratuit pour tous les utilisateurs **américains**, avec paiement **PayPal** (« Instant Buy ») et le marchand comme merchant of record. Remplace le « Buy with Pro » de 2024, réservé aux abonnés Pro | [V] |
| Flux | Pas de spécification officielle publique. Un flux Google Shopping ne suffit pas toujours | [V] (Alhena, mis à jour le 5 novembre 2026) |
| Shopify | Listé « disponible » dans Agentic Storefronts | [V] |

**En France** :
- résultats produits organiques : oui [NV] ;
- paiement : non (États-Unis seulement) [V].

**Intégrations** : Shopify (Agentic Storefronts) ; PayPal pour les marchands qui l'utilisent [NV] ; WooCommerce et Prestashop par aucune voie officielle identifiée [NV].

### 1.4 Microsoft Copilot

| Élément | État | Statut |
|---|---|---|
| **Copilot Checkout** | Annoncé au NRF en janvier 2026. Paiement dans le chat propulsé par PayPal, Shopify et Stripe. Étendu à **plus de 500 000 marchands** et à l'app mobile le 22 avril 2026 (Etsy, Urban Outfitters, Ashley…). Marchand toujours merchant of record. Inclut aussi des « Brand Agents » | [V] |
| Pays | États-Unis | [V] |
| Source produit | Microsoft Merchant Center (Bing Shopping), Shopify et PayPal | [NV] pour le détail d'inscription |
| « Copilot Merchant Program » | Le nom n'a pas été retrouvé dans les sources officielles consultées. La page Microsoft Advertising « agentic commerce » existe | [NV] |

**En France** :
- Bing Shopping et Copilot affichent des produits via Microsoft Merchant Center [NV] ;
- pas de Checkout [V].

**Intégrations** : Shopify (Agentic Storefronts, « disponible ») ; WooCommerce et Prestashop via l'import de flux Google dans Microsoft Merchant Center [NV].

### 1.5 Shopify — le « hub » agentique

| Élément | État | Statut |
|---|---|---|
| **Agentic Storefronts** | Nouveau canal de vente (Winter '26 Edition) : une connexion dans l'admin, avec activation canal par canal. Disponible pour **ChatGPT, Copilot et Perplexity**, « bientôt » pour AI Mode et Gemini. Déploiement progressif, avec liste d'attente | [V] |
| **Shopify Catalog** | Catalogue central enrichi par LLM. Un « Agentic plan » (liste d'attente) permet aux marques non-Shopify (Magento, BigCommerce…) d'y verser leur catalogue | [V] |
| **Knowledge Base app** | FAQ, politiques et ton de marque fournis aux agents | [V] |
| Frais | Non annoncés | [V] |
| Pays | Non précisés publiquement. **Disponibilité pour les marchands français non confirmée** | [NV] |

### 1.6 Amazon (Rufus, « Buy for Me ») — pour mémoire

- Rufus et Alexa+ recommandent d'abord l'offre Amazon, donc une marque présente sur Amazon y gagne de la visibilité [NV].
- « Buy for Me » (achat sur des sites tiers) n'est déployé qu'aux États-Unis [NV].
- Amazon bloque une partie des crawlers IA tiers (ChatGPT, Perplexity) [NV]. Les fiches Amazon pèsent donc surtout dans les écosystèmes Amazon et Google.

### Synthèse France, novembre 2026

| Plateforme | Visible en organique | Flux marchand possible | Paiement dans l'IA |
|---|---|---|---|
| ChatGPT | Oui | Oui (spec OpenAI, Shopify) [V] / [NV] pour l'ouverture en France | Non (apps : grandes enseignes) |
| Google AI Mode / Gemini | Oui | Oui (Merchant Center) | Non (UCP hors France) |
| Perplexity | Oui [NV] | Formulaire / Shopify | Non (États-Unis) |
| Copilot | Oui [NV] | Microsoft Merchant Center / Shopify | Non (États-Unis) |

**Conséquence pour Repéré** : vendre de la **visibilité, de la donnée produit et de la preuve de trafic**, pas du « checkout ».

---

## 2. Signaux qui font recommander un produit

Aucune plateforme ne publie son algorithme. Ce classement combine les déclarations officielles [V] et le consensus des
praticiens [NV].

| # | Signal | Pourquoi | Statut |
|---|---|---|---|
| 1 | **Flux produit complet et frais** (GTIN, marque, attributs, prix, stock, livraison, retours) | Source directe des carrousels Google, Shopify et OpenAI. OpenAI parle de « métadonnées structurées » ; Google pousse les conversational attributes | [V] principe |
| 2 | **Avis clients** (note, volume, récence, texte riche d'usages) | Les cartes produits affichent note et nombre d'avis. Les avis répondent aux questions « pour peau sensible », « tient la chaleur » | [V] affichage · [NV] poids |
| 3 | **Comparatifs et tests média** (« meilleur X 2026 ») | Les IA citent massivement les listicles et les guides d'achat. Être dans les 3 à 5 premières pages citées pour la requête est décisif | [NV] (consensus, à mesurer avec le pilier Sources) |
| 4 | **Reddit et forums** (r/SkincareAddiction, forums Doctissimo, Hardware.fr…) | Fortement cités par ChatGPT, Perplexity et Google pour les questions de recommandation | [NV] |
| 5 | **Données structurées Product / Offer / AggregateRating / Review / FAQPage** sur la fiche | Lisibilité machine. Adobe constate que 34 % des pages produit ne sont pas correctement accessibles aux IA et que 39 % du contenu des pages d'accueil n'est pas lisible par une machine | [V] (constat) · [NV] (impact causal) |
| 6 | **Contenu de fiche « citable »** : description factuelle, usages, comparaison, FAQ | Les requêtes conversationnelles sont longues et à intention précise | [NV] |
| 7 | **Présence sur les marketplaces** (Amazon, Cdiscount, Fnac, Sephora, ManoMano) | Les IA renvoient souvent vers le revendeur à forte autorité | [NV] |
| 8 | **Accessibilité aux crawlers** (robots.txt pour OAI-SearchBot, PerplexityBot, Bingbot ; rendu sans JavaScript) | Prérequis technique | [V] principe |
| 9 | **llms.txt** | Effet non démontré. Aucune plateforme majeure n'a confirmé l'utiliser pour le classement | [NV] (à vendre comme « hygiène », pas comme levier) |

---

## 3. Leviers d'optimisation classés par impact

L'impact est estimé, l'automatisabilité est évaluée pour Shopify.

| Rang | Levier | Impact | Effort marchand | Automatisable par Repéré |
|---|---|---|---|---|
| 1 | Activer les canaux de flux : Merchant Center (Google), Microsoft Merchant Center, Agentic Storefronts (Shopify) | Très fort | Faible | Guidé (contrôle par API) |
| 2 | Compléter les attributs du flux (GTIN, matière, taille, usage, public, certifications) et les metafields | Très fort | Moyen | **Oui** : GraphQL Admin (`productUpdate`, `metafieldsSet`) avec validation par le marchand |
| 3 | Réécrire les titres et descriptions en style « conversationnel » (usages, pour qui, comparaison) | Fort | Moyen | **Oui** : génération plus validation, puis écriture par API |
| 4 | Collecter des avis : volume, récence, texte qualitatif | Fort | Moyen | Partiel : intégration Judge.me, Avis Vérifiés, Trustpilot, emails post-achat. **Jamais de faux avis** |
| 5 | Viser les sources citées (comparatifs, médias, Reddit) : relations presse produit, échantillons, AMA | Fort | Élevé | Détection et priorisation automatiques, exécution guidée |
| 6 | Schema Product / Offer / AggregateRating / FAQPage complet et valide | Moyen | Faible | **Oui** : extension de thème (app embed) ou correction des snippets |
| 7 | FAQ produit et pages « guide d'achat » / « X vs Y » | Moyen | Moyen | **Oui** : génération, puis publication en pages ou en metaobjects |
| 8 | Ouvrir robots.txt aux bots IA et contrôler le rendu | Moyen (bloquant si raté) | Faible | Audit automatique, correction guidée (`robots.txt.liquid`) |
| 9 | Présence et cohérence sur les marketplaces | Moyen | Élevé | Audit seulement |
| 10 | llms.txt | Faible / incertain | Très faible | **Oui** (proxy d'app ou page) |

---

## 4. Ce qui est automatisable pour un marchand Shopify

Le tableau suppose une app Shopify publique ou custom ; les scopes sont à confirmer dans la doc Shopify [NV].

| Action | Moyen technique | Statut |
|---|---|---|
| Lire catalogue, variantes, prix, stock, metafields, avis (si l'app d'avis les écrit en metafields) | GraphQL Admin API (`products`, `productVariants`, `metafields`), scope `read_products` | [V] principe |
| Enrichir titres, descriptions, SEO title et meta, tags, `productType`, catégorie de la Standard Product Taxonomy | `productUpdate`, scope `write_products`, toujours avec **validation humaine avant écriture** | [V] principe |
| Ajouter des attributs structurés (matière, usage, certifications) | `metafieldsSet` et category metafields de la taxonomie Shopify | [V] principe |
| Injecter ou réparer le JSON-LD Product / Offer / AggregateRating / FAQPage | Theme app extension (app embed block), sans modifier le code du thème | [V] principe |
| Publier llms.txt / llms-full.txt | App proxy (`/apps/...`) ou redirection vers un fichier. Au moins 10 apps le font déjà | [V] |
| FAQ produit | Metaobjects ou metafields, plus un bloc d'app sur la fiche | [V] principe |
| Pages « guide d'achat » / comparatifs | `pageCreate` / articles de blog via l'API | [V] principe |
| Flux Google / OpenAI / Perplexity | **Ne pas reconstruire** : s'appuyer sur Google & YouTube, Agentic Storefronts ou Lengow, et ne contrôler que la qualité des attributs | Recommandation |
| Mesurer le trafic IA et le CA associé | ShopifyQL et `orders` (`customerJourneySummary`, referrer et UTM de la première visite), plus une détection des referrers chatgpt.com, perplexity.ai, gemini.google.com, copilot.microsoft.com | [V] principe · [NV] fiabilité du referrer (souvent absent dans les apps mobiles) |
| robots.txt | `robots.txt.liquid` : modification par le thème. L'app ne peut que le guider | [NV] (pas d'API d'écriture connue) |

**WooCommerce** : REST API `wc/v3/products` (lecture et écriture) et plugin léger pour le JSON-LD ; Yoast et Rank Math couvrent déjà une partie du schema [NV].
**Prestashop** : Webservice API (lecture et écriture produits) ; JSON-LD par module [NV].
**Ordre recommandé** : Shopify d'abord, puis WooCommerce. Prestashop seulement à la demande.

---

## 5. Concurrence

| Outil | Positionnement | Prix public | E-commerce / shopping | Statut |
|---|---|---|---|---|
| **Profound** | Enterprise, analytics de citations ; module « shopping » mis en avant | dès ~399 £/mois, puis sur devis | Oui (suivi des carrousels produits) | [V] prix (comparatif T2 2026) · [NV] périmètre shopping |
| **Peec AI** (Berlin) | Monitoring de la visibilité IA, multi-langue dont le français | 89 € → 499 €/mois | Partiel (prompts produits, pas d'écriture catalogue) | [V] prix |
| **Otterly.AI** | Monitoring des citations, entrée de gamme | 23 £ → 789 £/mois | Non spécifique | [V] prix |
| Semrush (AI Toolkit) / Ahrefs (Brand Radar) / SE Ranking | Suites SEO avec un module IA | 79 £/mois ; SE Ranking 99 £ + 71 £ pour l'add-on IA | Non spécifique | [V] |
| HubSpot AEO Grader, GetCito | Gratuits, utilisés comme aimants à leads | 0 € | Non | [V] |
| **Apps Shopify « AI visibility / llms.txt »** (LLM Rank, ShopGPT, FoundInAI, StoreRank, AIVisible, RushGPT, Revhope…) | Génèrent llms.txt et du schema, parfois avec un « suivi ChatGPT » | Gratuit → ~9 $/mois (LLM Rank Pro à 9 $) ; d'autres jusqu'à ~50 $ [NV] | Exécution technique, **mesure faible**, en anglais | [V] pour LLM Rank, [NV] pour les autres |
| **Adobe LLM Optimizer / AI Content Visibility Checker** | Grands comptes | Sur devis | Oui | [NV] prix |
| **Google Merchant Center « AI performance insights »** | Part de voix IA **gratuite** pour les marchands | 0 € | Oui | [V] · **pas en France** pour l'instant : menace future sur la brique « mesure » |
| Lengow, Channable, DataFeedWatch | Flux multi-canal, dont OpenAI | ~100 → 1 000 €+/mois [NV] | Flux, pas de mesure de visibilité | [V] support OpenAI chez Lengow |

**Trou de marché** : aucun acteur francophone, à prix PME, ne relie les quatre briques suivantes :
1. les requêtes produit en français ;
2. les sources citées (comparatifs FR, Reddit FR, médias) ;
3. la correction automatique des fiches Shopify ;
4. la preuve en chiffre d'affaires (commandes venues des IA).

Les apps Shopify font la brique 3 sans 1, 2 ni 4. Peec et Otterly font la brique 1 sans 3 ni 4.

---

## 6. Statistiques clés

| Chiffre | Périmètre | Source | Statut |
|---|---|---|---|
| Trafic IA vers le retail US : **+393 %** au T1 2026 sur un an ; +693 % pendant les fêtes 2025 | US, plus de 1 000 milliards de visites | Adobe, avril 2026 | [V] |
| Conversion du trafic IA : **+42 %** face au trafic non-IA en mars 2026 (contre −38 % en mars 2025) ; revenu par visite +37 % | US | Adobe | [V] |
| Juillet 2026 : trafic IA +62 % sur un an, **conversion +60 %**, **revenu par visite +53 %**, temps passé +59 %, rebond −33 %, ajouts au panier +28 % ; 11e mois consécutif de surperformance | US | Adobe, 19 août 2026 | [V] |
| 39 % des Américains ont utilisé l'IA pour leurs achats en ligne | Sondage de 5 000 personnes | Adobe | [V] |
| Lisibilité des pages d'accueil par les IA, par catégorie : mode 76 %, cosmétique 68 %, sport 67 %, maison 64 %, alimentaire 59 % | US | Adobe AI Content Visibility | [V] |
| **France** : trafic IA vers 13 grandes enseignes (Decathlon, Leroy Merlin, Kiabi, Auchan, Alinéa…) **×18** de décembre 2024 à décembre 2025 | FR | Baromètre Valiuz, février 2026 | [V] |
| France : **plus de 90 %** de ce trafic vient de ChatGPT ; 9 visiteurs IA sur 10 arrivent directement sur une fiche produit (contre 6 sur 10 pour les autres sources) ; 72 % de nouveaux visiteurs | FR | Valiuz | [V] |
| France : taux de conversion du trafic IA d'environ **1,7 %**, qui se rapproche de celui des autres canaux | FR | Valiuz | [V] |
| ~26 millions d'utilisateurs de ChatGPT en France | FR | RetailDetail (mars 2026) | [V] (chiffre rapporté) |
| Part du trafic IA dans le trafic total e-commerce | — | Non publiée par Adobe ; ordre de grandeur de 1 % ou moins | [NV] |
| Shopify : trafic et commandes venant de l'IA en forte hausse en 2026 | Monde | Résultats Shopify | [NV] (source non lisible) |
| Salesforce : part des commandes influencées par les agents IA pendant les fêtes | Monde | Salesforce Shopping Index | [NV] (non consulté) |

**Message commercial défendable** : « Le trafic venu des IA est encore petit en volume, mais il grandit vite. Aux
États-Unis, il convertit désormais mieux que la moyenne (Adobe). En France, il a été multiplié par 18 en un an chez
les grandes enseignes (Valiuz). »
**À ne jamais promettre** : un volume de ventes ou une position garantie.

---

## 7. Vingt requêtes types (français)

Le panel par défaut du parcours e-commerce est à décliner avec la marque, la catégorie et le concurrent du client.

**Mode**
1. Meilleure marque française de jean éthique pour homme
2. Alternative à Sézane moins chère
3. Basket blanche fabriquée en Europe moins de 150 €
4. Quel pull en laine mérinos ne gratte pas ?

**Beauté**
5. Meilleure crème solaire bio visage SPF 50 pour peau sensible
6. Sérum vitamine C efficace et pas cher recommandé par les dermatologues
7. Shampoing solide pour cheveux bouclés : lequel choisir ?
8. Alternative à The Ordinary fabriquée en France

**Maison**
9. Meilleur matelas en mousse pour mal de dos, rapport qualité-prix
10. Poêle sans PFAS qui dure : quelle marque ?
11. Linge de lit en lin lavé français : avis et comparatif
12. Aspirateur balai silencieux pour appartement

**Alimentaire**
13. Meilleur café en grains de torréfacteur artisanal livré à domicile
14. Box apéro produits du terroir à offrir
15. Granola protéiné sans sucre ajouté : quelle marque ?
16. Huile d'olive française de qualité à acheter en ligne

**Sport**
17. Meilleures chaussures de trail pour débutant
18. Tapis de yoga antidérapant écologique
19. Gourde isotherme qui garde au frais 24 h : comparatif
20. Vêtements de running femme : marque française recommandée

Variantes à générer automatiquement pour chaque client :
- « [marque] avis » ;
- « [marque] vs [concurrent] » ;
- « alternative à [concurrent] » ;
- « [produit phare] est-il bien ? ».

---

## 8. Proposition de parcours « E-commerce » pour Repéré

### 8.1 Promesse

« On mesure si ChatGPT, Gemini et Perplexity recommandent vos produits, on vous dit pourquoi un concurrent passe
devant, on corrige vos fiches Shopify pour vous, et on vous montre les ventes qui en viennent. »

### 8.2 Onboarding (10 minutes)

1. L'utilisateur saisit l'URL de sa boutique. La plateforme est détectée (Shopify, Woo, Presta), puis le catalogue est lu (`/products.json` public sur Shopify, sitemap sinon).
2. Repéré propose 10 à 30 requêtes à partir des catégories, des best-sellers et des concurrents auto-détectés.
3. L'utilisateur installe l'app Shopify (OAuth). Cela débloque la lecture des commandes et l'écriture des fiches.

### 8.3 Mesure

- Interrogation hebdomadaire des API ChatGPT, Gemini, Perplexity et Copilot (moteur V1 existant) sur le panel de requêtes.
- Extraction des **produits et marques cités**, des **URL sources** et des **revendeurs** (marque.fr, Amazon, Sephora…).
- **Part de voix** par requête et par catégorie, comparée à 3 à 5 concurrents.
- **Audit des fiches** :
  - complétude des attributs (GTIN, marque, matière…) ;
  - schema Product/Offer/AggregateRating valide ;
  - accès des bots IA ;
  - volume et note des avis ;
  - présence dans Merchant Center (contrôle guidé).
- **Preuve** : sessions et commandes dont le referrer ou l'UTM est une IA, chiffre d'affaires attribué, avant/après.

### 8.4 Pourquoi

Pour chaque requête perdue, Repéré compare le concurrent cité au client sur les avis, la présence dans les sources
citées, les attributs de fiche et le schema. Il en tire trois causes principales.

### 8.5 Exécution (« on le fait pour vous »)

| Tâche | Mode |
|---|---|
| Réécriture titres et descriptions + attributs et metafields | Automatique **après validation** fiche par fiche ou par lot (diff avant/après, retour arrière possible) |
| JSON-LD Product / Offer / AggregateRating / FAQPage | Automatique (app embed) |
| FAQ produit (5 questions par best-seller) | Généré puis publié après validation |
| llms.txt | Automatique (présenté comme « hygiène ») |
| Pages guides et comparatifs (« X vs Y », « comment choisir ») | Généré, publié en brouillon |
| Merchant Center, Agentic Storefronts, Microsoft Merchant Center | Checklist guidée avec vérification |
| Sources tierces (comparatifs, Reddit, médias) | Liste priorisée, modèles de pitch presse et d'envoi d'échantillons, suivi |
| Avis | Séquence de demande post-achat via l'app d'avis existante. **Aucune génération d'avis** |

### 8.6 Rituel

- Rapport hebdomadaire : part de voix, nouvelles sources, top 5 des tâches, CA IA.
- Alertes : un concurrent apparaît, un produit disparaît d'un carrousel, une fiche est cassée.

### 8.7 Garde-fous

- Aucune promesse de position ni de ventes.
- Le marchand valide toujours avant écriture.
- Respect des CGU des API.
- Pas de faux avis (DGCCRF, directive Omnibus).
- Données de commandes minimisées (agrégats seulement, RGPD).

---

## 9. Prix acceptable

Les repères suivants viennent de la concurrence (§5) et de la cible, des marques DTC françaises à 0,3 à 10 M€ de CA [NV].

| Offre | Contenu | Prix proposé | Logique |
|---|---|---|---|
| **Audit gratuit** | 10 requêtes, 1 IA, score et 3 causes, sans app | 0 € | Aimant à leads, face au gratuit de HubSpot et GetCito |
| **Essentiel** | 30 requêtes × 4 IA, 3 concurrents, audit de 50 fiches, schema et llms.txt automatiques, preuve de trafic | **49 €/mois** | Au-dessus des apps Shopify (0 à 9 $), en dessous de Peec (89 €), avec en plus l'exécution et la preuve en CA |
| **Croissance** | 100 requêtes, 5 concurrents, réécriture jusqu'à 300 fiches par mois, FAQ et guides, sources tierces priorisées, rapport hebdomadaire | **149 €/mois** | Dans le budget d'un outil marketing PME ; reste sous un freelance SEO (≥ 500 €/mois) |
| **Pro / agence** | 300 requêtes, plusieurs boutiques ou langues, accès API et exports, marque blanche | **349 à 449 €/mois** | Sous Profound (≥ 399 £ pour de la mesure seule) |
| Option « fait pour vous » | Optimisation initiale de 100 fiches et plan de sources | **490 € une fois** | Équivalent du plan d'action V1, version e-commerce |

**Hypothèses à tester** :
- [NV] la disposition à payer réelle, à valider sur 10 à 15 marques Shopify FR ;
- [NV] le passage par le Shopify App Store, qui prélève 0 % jusqu'à 1 M$ de revenus d'app puis 15 % (à re-vérifier).

Facturer via Shopify Billing réduit la friction. Facturer via Stripe hors App Store est possible pour une app custom ou non listée [NV].

---

## 10. Risques et inconnues

- **Google AI performance insights gratuit** pourrait arriver en France et banaliser la mesure. La parade est l'exécution, la preuve en CA et les sources tierces.
- **Shopify** internalise la donnée agentique (Catalog, Knowledge Base). Repéré doit être complémentaire (qualité des données et mesure), pas concurrent.
- **Referrers IA incomplets** (apps mobiles, navigateurs agentiques) : sous-estimation du trafic IA. Il faut l'indiquer dans les rapports.
- **Variabilité des réponses LLM** : multiplier les tirages et afficher des intervalles (méthode V1).
- Les **API des LLM ne reflètent pas exactement** l'interface grand public (carrousels shopping absents de l'API) [NV]. Prévoir un échantillonnage de l'UI, en respectant les CGU, sinon documenter cet écart.

---

## 11. Sources

**OpenAI, ChatGPT, ACP**
- Digital Commerce 360, « OpenAI expands agentic commerce push » (16 février 2026) : https://www.digitalcommerce360.com/2026/02/16/openai-expands-agentic-commerce-push/
- Digital Commerce 360, « OpenAI shifts checkout plans » (6 mars 2026) : https://digitalcommerce360.com/2026/03/06/openai-shifts-checkout-plans-agentic-commerce-strategy/
- Shopifreaks, « OpenAI pivots from Instant Checkout to an app-based shopping model » : https://www.shopifreaks.com/openai-pivots-from-instant-checkout-to-an-app-based-shopping-model-inside-chatgpt/
- RetailDetail, Carrefour dans ChatGPT (27 mars 2026) : https://www.retaildetail.eu/news/food/grocery-shopping-via-chatgpt-how-carrefour-is-embracing-ai/
- Lengow, flux produit ChatGPT (spec OpenAI) : https://www.lengow.com/get-to-know-more/how-brands-and-retailers-can-get-recommended-in-chatgpt
- OpenAI Help, « Shopping in ChatGPT » (non lisible le 9 novembre 2026) : https://help.openai.com/en/articles/11128490
- Siècle Digital, Shopping research (25 novembre 2025) : https://siecledigital.fr/2025/11/25/openai-lance-shopping-research-un-guide-dachat-intelligent-capable-de-trouver-le-meilleur-produit-pour-vous/
- Ecommerce Nation, Shopping research : https://www.ecommerce-nation.fr/chatgpt-defie-google-black-friday-tout-savoir-sur-shopping-research/

**Google**
- Google Marketing Live 2026 (20 mai 2026) : https://blog.google/products-and-platforms/products/shopping/shopping-updates-google-marketing-live
- Search Engine Land, extension de l'UCP (non lisible) : https://searchengineland.com/google-expands-universal-commerce-protocol-and-launches-new-agentic-shopping-tools-478113

**Shopify**
- Ringly, guide Agentic Storefronts 2026 : https://www.ringly.io/blog/agentic-storefront-shopify
- PYMNTS, catalogues Shopify dans ChatGPT, Perplexity et Copilot : https://www.pymnts.com/?p=3304089

**Perplexity**
- Alhena, Perplexity Merchant Program (mis à jour le 5 novembre 2026) : https://alhena.ai/blog/perplexity-shopping-merchants-setup-guide/
- Shopifreaks, Perplexity et PayPal Instant Buy : https://www.shopifreaks.com/paypal-and-perplexity-deepen-their-partnership-with-instant-buy/

**Microsoft**
- Windows Central, Copilot Checkout mobile et 500 000 marchands (22 avril 2026) : https://www.windowscentral.com/microsoft/windows-11/copilots-shopping-upgrade-brings-checkout-to-the-mobile-app-with-deeper-data-from-half-a-million-merchants
- Retail TouchPoints, Copilot Checkout (janvier 2026) : https://www.retailtouchpoints.com/news/etsy-shopify-among-early-partners-for-microsofts-copilot-checkout/156346/

**Statistiques**
- TechCrunch, Adobe T1 2026 (16 avril 2026) : https://techcrunch.com/2026/04/16/ai-traffic-to-us-retailers-rose-393-in-q1-and-its-boosting-their-revenue-too/
- Digital Commerce 360, Adobe juillet 2026 (19 août 2026) : https://www.digitalcommerce360.com/2026/08/19/adobe-ai-referral-traffic-data-july-2026/
- Adobe, AI Traffic Trends Report (août 2026, PDF) : https://business.adobe.com/assets/pdfs/resources/sdk/ai-traffic-trends-report-august-2026/ai-traffic-trends-report-2026-08-19.pdf
- The Media Leader FR, baromètre Valiuz (6 février 2026) : https://fr.themedialeader.com/?p=210038

**Concurrence**
- SEO Compare, comparatif des prix T2 2026 (14 avril 2026) : https://seocompare.pages.dev/blog/tool-pricing-comparison-q2-2026/
- Shopify App Store, LLM Rank : https://apps.shopify.com/llm-rank
- Autres apps Shopify : https://apps.shopify.com/foundinai, https://apps.shopify.com/umegs-llms-txt, https://apps.shopify.com/storerank-ai, https://apps.shopify.com/aivisible-ai-geo-aeo
