# 01 — Teardown des leaders GEO haut de gamme (Profound, AthenaHQ, Scrunch, Bluefish, Evertune)

Agent TEARDOWN enterprise. Recherches et lectures effectuées le 9 novembre 2026.
Règle : ce qui n'a pas été lu en source primaire ou secondaire est marqué **[non vérifié]**. Les prix sont en USD, tels que
publiés ou rapportés à la date indiquée. Beaucoup de sources secondaires sont des **concurrents** (geotoolbox, fixaeo,
tryanalyze, ampifire, review-human) : c'est signalé à chaque fois. Les sites athenahq.ai et scrunch.com (pages d'accueil)
n'ont pas pu être chargés directement (liste d'URL autorisées), donc leur hero n'est décrit que via des sources tierces.

Échelle de priorité dans `features-enterprise.json` : 5 = à cloner tout de suite, 1 = à ignorer pour nos cibles.

---

## Synthèse en une page

| | Profound | AthenaHQ | Scrunch | Bluefish | Evertune |
|---|---|---|---|---|---|
| Positionnement 2026 | « AI Marketer » : plateforme marketing agentique bâtie sur données AEO | GEO « mesurer, gouverner, agir », mi-marché → enterprise | Suivi AEO + AXP (rendu pour agents) ; racheté par Sitecore (juin 2026) | « Agentic marketing platform » Fortune 500 | Mesure statistique de marque dans les LLM (ad-tech) |
| Prix d'entrée publié | Essai gratuit 7 j ; payant = Enterprise sur devis (Starter 99 $ / Growth 399 $ retirés en sept. 2026) | Essential gratuit (300 crédits) ; Starter 295 $/mois | Starter 250 $/mois annuel (300 $ mensuel) ; Growth 417/500 $ | Sur devis | Pro 800 $/mois (source tierce) |
| Moteurs | jusqu'à 9 (dont Muse Spark, Exa) | 5 (gratuit) à 11 (Starter) | 7 à 9 | 5 + Rufus/Alexa | 11 surfaces |
| Signature | Prompt Volumes, Agent Analytics, Agents/AI Marketer, Shopping | Action Center, QVEM (volume), ACE (prob. de citation), Oracle (faits) | Personas/funnel, Agent Traffic CDN + GA4, AXP | Impact Score, Brand Vault, AI Accuracy, Collections | 100 échantillons/prompt, EverPanel, word association |
| Avis | G2 4,5/5 (1 133 avis) | G2 4,9/5 (39 avis) | G2 4,6/5 (74 avis) | pas d'avis lus | pas d'avis G2/Trustpilot (selon ampifire) |

Constat clé : **les leaders ont quitté le « tableau de bord de visibilité » pour l'exécution agentique** (Profound AI Marketer,
Athena content agent, Bluefish). Ce qui reste commun et attendu de base : suivi multi-moteurs, citations/sources, part de voix,
sentiment, concurrents, trafic des robots IA (logs CDN) + référents IA (GA4), personas/régions, export/API. Le haut de
gamme se différencie par : volumes de prompts (données panel), probabilité de citation, rendu dédié aux robots,
détection de faits erronés, shopping, et agents déclenchés par événements.

---

## 1. Profound (tryprofound.com)

### Positionnement
- Hero (page d'accueil lue) : « The AI marketing platform to win in [ChatGPT / Perplexity / Claude / Gemini / Copilot /
  DeepSeek / Google AI Overviews…] » (moteurs qui défilent). Sous-titre : un « AI Marketer » entraîné sur « ce que les
  consommateurs demandent, ce que les agents citent et le contexte de vos équipes ». CTA : « Get a demo » / « Get started ».
- Repositionnement autour de l'AI Marketer au moment d'une Série D de 180 M$ annoncée le 15 sept. 2026 (rapporté par
  geotoolbox, concurrent ; communiqué Profound **[non vérifié]**).
- Revendique « un tiers du Fortune 100 » ; logos et chiffres clients sur la home (Plaid +50 % de visibilité, MongoDB 30 %
  de temps gagné, Ramp ×7 sur un sujet, Zoom 16 concurrents dépassés).

### Prix (page /pricing lue le 9 nov. 2026)
- **Trial** gratuit : 50 prompts imposés, exécutés chaque jour pendant 7 jours, ChatGPT + Gemini + AI Overviews, sièges
  illimités, crédits AI Marketer « limités », Agent Analytics (domaines illimités), 5 recherches Prompt Volumes, pas
  d'export/API/historique.
- **Enterprise** sur devis : plan de prompts sur mesure, 9 moteurs (ChatGPT, Perplexity, AI Mode, Gemini, DeepSeek, Claude,
  AI Overviews, Exa, Muse Spark), ChatGPT Shopping, régions/langues sur mesure, historique complet, CSV/JSON, API, SSO/SAML,
  SOC 2, Slack dédié / spécialiste SLA 24 h. Estimation tierce 2 000 à 5 000 $+/mois (Maintouch via geotoolbox) **[non vérifié]**.
- **Agency Growth** (self-serve) : 400 crédits/mois par espace client ; prix non affiché.
- Historique (PricingSaaS + geotoolbox) : Starter 99 $ (ChatGPT seul, 50 prompts) et Growth 399 $ (3 moteurs) publiés en
  juin 2026, **retirés le 21 sept. 2026** ; essai élargi de 10 à 50 prompts le 28 sept. ; « Opportunities » renommé
  « Suggestions » le 19 oct.

### Inventaire des fonctionnalités
| Fonction | Ce que voit l'utilisateur | Implémentation probable | Niveau |
|---|---|---|---|
| **Answer Engine Insights** | Visibilité, citations, sentiment, position par moteur ; vues personnalisables, menu *Compare* (plateformes / régions / personas), filtre concurrents, **heatmaps** personnalisées (ex. tags × concurrents), **Visibility Trends** (pics et creux), bouton « Investigate » sur un point de graphique ou une cellule (changelog 25 sept. et 30 oct. 2026) | Exécution quotidienne des prompts par moteur (UI ou API), extraction marques/URL par LLM, entrepôt analytique (ClickHouse/Snowflake cités dans le billet Prompt Volumes) | Essai (3 moteurs) / Enterprise |
| **Prompt Volumes / Conversation Explorer** | Recherche par thème/marque, volumes estimés par moteur, termes en tendance, intention ; API Prompt Volumes (sept. 2026) | « Dizaines de millions de conversations réelles » + modélisation probabiliste et « Panel Projection » (correction démographique) ; stack dbt, Modal, Snowflake, ClickHouse, Dagster (billet GA, juin 2025). Taille de 200 M+ prompts selon review-human **[non vérifié]** | 5 recherches en essai, Enterprise |
| **Query fanouts** | Sous-requêtes générées par le moteur pour un prompt, dans l'onglet Prompts | Capture des recherches web lancées par le moteur (ChatGPT search) | Enterprise |
| **Agent Analytics** | Robots IA (OpenAI, Anthropic, Google, Perplexity, Microsoft, Apple, Meta, DeepSeek) : événements de crawl, tendances, pages, temps de réponse, cache, géographie ; annotations de graphiques ; « investiguer un pic » avec l'AI Marketer (30 oct. 2026) ; attribution humaine mentionnée pour AWS | Logs côté serveur/edge : Vercel Marketplace, Cloudflare Worker ou Logpush, CloudFront → Firehose, Fastly/Netlify log forwarding, S3 (sept. 2026), plugin WordPress, API de logs ; validation par plages IP publiées | Tous plans (domaines illimités) |
| **Dynamic Bot Rendering** | Politiques par page/motif/domaine et par robot pour servir une page entièrement rendue aux agents, sans toucher au CMS (18 sept. 2026) | Règle edge (CloudFront/Cloudflare/Vercel) qui détecte l'user-agent IA et sert un pré-rendu | Enterprise **[niveau non vérifié]** |
| **Shopping** | Analytics › Shopping : *Shopping Mode Rate* (part des prompts déclenchant le mode shopping), *Shopping Visibility Score* par sujet, couche marchands (qui fournit les liens d'achat), couche produits (SKU, attributs décrits, placements concurrents) | Exécution des prompts, détection du mode shopping, capture des tuiles produit (image, prix, marchand, bouton) ; ChatGPT seulement, Perplexity/Gemini en cours (docs) | Enterprise |
| **Pages + SEO** | Par page : Search Console (clics, impressions, CTR, position), mots-clés AEO, données Moz (autorité, domaines référents), *Citation Opportunities* = sites qui lient les concurrents mais pas vous (9 oct. 2026) | Jointure GSC + Moz + citations IA par URL | **[niveau non vérifié]** |
| **AI Marketer + Projects** | Chat agent ; Projects = espaces avec contexte, conversations, livrables (« Artifacts »), modèles, tâches suggérées en un clic ; génération d'images ; tableaux de bord construits par description et partageables (lien public avec plage de dates) | LLM avec outils sur les données Profound + connecteurs | Crédits (limités en essai) |
| **Agents / Workflows** | Agents décrits en langage naturel avec panneau d'instructions, outils autorisés et planning ; **déclencheurs** : article concurrent, variation de visibilité de 5 %, message Slack (16 oct. 2026). Anciens agents à nœuds = Workflows (conditions, itérations, Sheets ligne par ligne). Modèles : rafraîchissement de contenu AEO, FAQ optimisée, estimation des fanouts, article depuis une vidéo YouTube, insights vers Slack | Orchestrateur type n8n + LLM ; Secret Manager pour les clés API | Crédits |
| **Context Manager** | Synthèse vivante marque/audience/concurrents/offres/stratégie, détection des « trous » de contexte, questions guidées ; imports Granola, SharePoint, ChatGPT/Claude | RAG sur base de connaissances | Essai + Enterprise |
| **Sheets** | Modèles : traducteur d'articles, rafraîchissement de contenu, générateur de FAQ, suggestions de liens internes | Tableur où chaque ligne lance un appel LLM | Essai + Enterprise |
| **FactCheck, Benchmarking, Sentiment** | Cités sur la home comme modules ; Muse Spark : « repérer les affirmations inexactes » (6 nov. 2026) | **[détail non vérifié]** | — |
| **Profound Ads (bêta)** | Opportunités d'annonces Google/Meta/LinkedIn/ChatGPT, rédaction, suivi au revenu | **[non vérifié]** | clients sélectionnés |
| **Intégrations** | Slack (bot, commandes), Microsoft 365 et Teams, GitHub (édition de pages/code), Jira, Adobe Workfront, Bazaarvoice (avis, Q&A), Getty Images, GA4, GSC ; liste blanche d'intégrations par admin ; « 200+ intégrations » sur la home | OAuth + nœuds de workflow | — |
| **Gouvernance** | RBAC, SCIM, SSO/SAML, SOC 2, Teams avec portefeuilles de crédits, Command Center | — | Enterprise |

### Ce que les clients en disent
- Aimé : « finally able to see how we show up in AI answers » ; « The product is constantly developing » ; « Profound's
  agents are extremely helpful for brands who are unsure what to do » (G2, 2026).
- Critiqué : « the pricing feels a bit high » ; « the reporting can take a little getting used to » ; « not a lot of habits
  built into where to look for certain things » ; « limited to a select number of LLMs » (G2, 2026). Tableaux de bord
  « data-heavy », courbe d'apprentissage raide, bugs et exports lents (paraphrase review-human).

### Forces / faiblesses
- Forces : données propriétaires (volumes), couverture logs CDN la plus large, cadence de livraison hebdomadaire, agents
  déclenchés par événements, shopping.
- Faiblesses : plus d'offre payante self-serve (porte fermée aux PME), complexité de l'UI, coût.

### Ce que le site marketing fait de mieux
- Hero avec **noms de moteurs qui défilent** dans le titre.
- **Démo produit animée cliquable** juste sous le hero (liste « Recents », changement de projet au clic), pas de vidéo.
- Onglets par métier (Contenu AEO/SEO, Social, RP, Product marketing, Marque) avec cartes de résultats.
- Preuves chiffrées **attachées à un logo et un témoignage nommé** ; compteur « Command Center » (263 867 runs d'agents).
- Carrousel accessible (flèches clavier, Échap stoppe la rotation).
- Section Recherche (rapports filtrables par moteur et secteur) = moteur d'acquisition SEO.

---

## 2. AthenaHQ

### Positionnement
Plateforme GEO orientée action et gouvernance (SOC 2 Type 2, RGPD, NIST CSF selon fixaeo). Hero non lu directement
**[non vérifié]** ; fixaeo décrit en juillet 2026 une home « mesurer, gouverner et agir sur les réponses IA ». Offre un
« audit de marque gratuit de 10 minutes » comme aimant à leads (review-human).

### Prix (page /pricing lue le 9 nov. 2026)
- **Essential** gratuit : 25 $ de crédit = 300 crédits, 5 modèles (ChatGPT, Perplexity, AI Overviews, Gemini, Copilot),
  utilisateurs illimités, analyse prompts/réponses, sources et concurrents, recommandations de contenu, agent Athena.
- **Starter 295 $/mois** (−17 % en annuel ≈ 245 $) : 3 600 crédits/mois (1 crédit = 1 réponse IA d'un moteur), report d'un
  mois, 11 modèles, sujets/prompts/concurrents illimités, un pays, intégrations, CSV, actions on-page/off-page, agent
  d'optimisation de contenu, gestion robots.txt/llms.txt. API et crédits en plus = add-ons (100 $ les 1 250 crédits selon
  review-human).
- **Enterprise** sur devis : Knowledge Base + revue des affirmations, **Oracle** (détection d'écarts), **ACE**, multi-pays
  (60+ selon review-human) et multi-langues, personas, Recommendation Engine, tableau de bord exécutif + Tableau/Power BI/
  Looker, SAML, journal d'audit, Slack dédié, SLA 2 h, spécialiste GEO certifié.
- G2 affiche un « Self-Serve 95 $/mois » ; fixaeo pense que c'est une erreur. Review-human mentionne un premier mois à 95 $
  **[non vérifié]**.

### Inventaire
| Fonction | Ce que voit l'utilisateur | Implémentation probable | Niveau |
|---|---|---|---|
| **Gestion des prompts** (docs lues) | Page Prompts à 4 onglets : *Manage* (prompts groupés par sujet, glisser-déposer, tri IA des prompts non classés), *Personas*, *Locations* (pays par prompt, édition en masse), *Discover* (nouvelles opportunités) ; tags, pause, import CSV ; texte figé une fois des réponses enregistrées ; panneau analytique par prompt (Overview, Search queries) | CRUD + classification LLM | Discover/Personas verrouillés selon plan |
| **Volume par prompt (QVEM)** | Volume mensuel et valeur estimée par prompt, bouton « Refresh Volume » ; **impressions estimées = requêtes mensuelles × % de mention** | Modèle propriétaire d'estimation de volume (méthode non publiée) **[non vérifié]** | Starter (numérique) ; rafraîchissement en masse Enterprise |
| **Suivi de visibilité / dashboard** | Mentions, citations et position par moteur ; donut de part de voix ; tendances par moteur/région/sujet ; sentiment « temps réel » | Exécution des prompts × moteurs, 1 crédit par réponse | Tous |
| **Citations / sources** | Domaines et URL les plus cités de la catégorie, fréquence, prompts déclencheurs | Extraction d'URL + agrégation | Tous |
| **Action Center** | Liste priorisée d'actions avec preuves ; relance du jeu de prompts après changement pour mesurer l'effet (tryanalyze) | Règles + LLM sur écarts de citation × volume | Tous (version de base) |
| **Agent de contenu** | Actions on-page/off-page, « amélioration de contenu auto-apprenante », respect de la charte de marque ; version avancée avec Deep Research en Enterprise ; publication Shopify | LLM + intégrations CMS | Starter / Enterprise |
| **ACE** | Probabilité qu'un contenu soit cité par les IA (annoncé le 29 sept. 2025) ; UI non décrite | Modèle ML entraîné sur « des millions » de résultats de recherche IA | Enterprise |
| **Knowledge Base + Oracle** | Faits de marque de référence ; détection des affirmations fausses (exemple G2 rapporté : tarifs cités au double) | Comparaison réponse IA ↔ base de faits par LLM | Enterprise |
| **Usurpation / impersonation** | Suivi « impersonation » listé dans le tableau | **[non vérifié]** | Starter |
| **Intégrations** | GA4, GSC, Shopify (publication + attribution de revenu), Webflow, Framer ; BI en Enterprise | OAuth | Starter |
| **Agences** | Espaces « pitch », multi-marques, routage de leads (review-human) | — | **[non vérifié]** |

### Ce que les clients en disent
- Aimé : support très réactif (G2, paraphrase review-human) ; détection d'hallucination tarifaire.
- Critiqué : crédits épuisés « dans la première semaine » (paraphrase tryanalyze et review-human) ; brouillons IA génériques
  sans réglage de charte ; difficulté d'accès aux volumes ; UI qui change souvent (tryanalyze) ; pas d'attribution au
  revenu par défaut. Verbatims G2 non accessibles : **[non vérifié]**.

### Forces / faiblesses
- Forces : offre gratuite utile, 11 moteurs à 295 $, Action Center avec boucle de mesure, gouvernance.
- Faiblesses : crédits imprévisibles, meilleures fonctions en Enterprise, « la plateforme de la démo n'est pas celle que
  295 $ achètent » (fixaeo).

### Site marketing
Non lu directement **[non vérifié]**. Leviers observés : audit gratuit de 10 minutes, pages comparatives
(athenahq.ai/articles/athenahq-vs-semrush-comparison), page « LLM » dédiée au modèle QVEM.

---

## 3. Scrunch (scrunch.com, groupe Sitecore)

### Positionnement
Suivi AEO + **Agent Experience Platform (AXP)**. Racheté par **Sitecore** (annoncé début juin 2026, jusqu'à 225 M$ selon
Bloomberg via B&T) pour combiner visibilité IA et plateforme de contenu. Clients cités : Lenovo, Skims, Headspace, Penn State.

### Prix (page /pricing lue le 9 nov. 2026)
- **Starter** 250 $/mois annuel ou 300 $ mensuel : 350 prompts personnalisés, 1 000 prompts sectoriels, 3 sièges,
  3 personas, 5 audits de page, moteurs ChatGPT, Claude, Gemini, Perplexity, AI Mode/AI Overviews, Meta ; Prompt Manager,
  Insights, citations, reporting, sujets illimités, trafic des agents, intégrations, Google SSO, onboarding 30 min.
- **Growth** 417/500 $ : 700 prompts, 2 500 sectoriels, 5 sièges, 5 personas, 10 audits, revues stratégiques.
- **Enterprise** : SAML/OIDC, Enterprise Data API, Slack, GTM dédié. Essai 7 jours sans carte. On n'est pas bloqué
  en cas de dépassement.
- geotoolbox (concurrent) signale des tests A/B de grilles (« Core » 4 moteurs à 250 $) : packaging instable.

### Inventaire
| Fonction | Ce que voit l'utilisateur | Implémentation probable | Niveau |
|---|---|---|---|
| **Prompt Manager** | Mapping prompts ↔ sujets, tags, modèles, **étapes du funnel** ; édition en masse ; « familles de prompts » ; prompts sectoriels fournis | CRUD + génération LLM | Tous |
| **Personas** | Personas par caractéristiques et géographie ; génération auto de prompts ou affectation ; filtres persona × funnel | Prompt préfixé du contexte persona | 3 à 5 selon plan |
| **Insights / visualisations** | Présence de marque, citations, sentiment, tendances concurrentielles, graphiques personnalisables et partageables (changelog) ; position dans la réponse ; évolution | Collecte par **automatisation de navigateur et API officielles** (FAQ) | Tous |
| **Citations** | Sources citées, qualité vs fréquence, priorisation des sources | Agrégation + score | Tous |
| **Agent Traffic** | Visites des agents en temps réel classées **entraînement / indexation / récupération en direct**, tendances par modèle, pages les plus demandées, humains vs robots, flux des dernières requêtes | Intégrations Akamai, CloudFront, Cloudflare, Fastly, Vercel, WordPress ; proxy Cloudflare pour Shopify/Wix/Webflow/HubSpot… | Tous |
| **AI Referrals (GA4)** | Sessions et pages vues venues des IA, plateformes, pages d'entrée, **revenu et taux de conversion IA vs non-IA** ; avertit que c'est une sous-estimation | API GA4 Data, filtre des référents IA | Tous |
| **Audit de page / préparation technique** | Accessibilité aux robots, complétude du rendu, URL couvertes | Crawler sans JS vs avec JS | 5 à 10 audits/mois |
| **AXP** | Version de site optimisée IA servie aux seuls robots de récupération (pas Googlebot/Bingbot) : intercepter → traduire (retrait du code inutile, restructuration) → servir | Edge sur Akamai, Cloudflare, Vercel ; étude Akamai : +364 % de présence sur prompts non marqués et +218 % de citations (B&T) **[chiffres non vérifiés indépendamment]** | Enterprise |
| **AI Search Trends** | Volumes de recherche IA par sujet ; 3 sujets en Core (geotoolbox) | Méthode d'estimation non lue **[non vérifié]** | — |
| **Export / API** | CSV ; API renvoyant le texte complet + URL de citation (avis G2) ; Looker Studio en Enterprise | — | Enterprise pour Data API |

### Ce que les clients en disent (G2, verbatims lus)
- Aimé : « the most intuitive interface of all I looked at » ; « granular data » ; « best price… most intuitive and
  actionable way » ; « the API returns full response text with citation URLs ».
- Critiqué : « recent overhaul of the Scrunch AI UI has made it a little difficult to use » ; bugs GA4 multi-propriétés ;
  fonctions sur l'API avant l'UI ; veut des **mentions brutes** et pas que des pourcentages ; contrat différent des promesses
  orales. geotoolbox : « strong diagnosis, thin execution » (pas d'exécution CMS/outreach).

### Site marketing
Page d'accueil non chargée **[non vérifié]**. Points vus : essai 7 j sans carte, grille tarifaire transparente, centre FAQ
très riche (27 questions fonctionnelles, bon pour le GEO), billets « changelog » par fonctionnalité.

---

## 4. Bluefish (matière limitée, sources secondaires concurrentes)
- « Agentic marketing platform for enterprises », Fortune 500 ; 68 M$ levés dont Série B 43 M$ (avril 2026). Clients cités
  par tryanalyze : Adidas, American Express, Hearst, Ulta Beauty, Tishman Speyer.
- Cinq piliers : AI Monitoring, GEO Optimization, GEO Measurement, AI Commerce (Amazon Rufus, Alexa for Shopping), AI Accuracy.
- **Impact Score** (proximité entre contenu cité et texte de réponse), **Influence Rank** (sources les plus influentes),
  **AI Brand Vault** (faits de marque structurés pour les IA), **Collections** (févr. 2026 : contenu propre + presse +
  visibilité regroupés par campagne), **AI Accuracy** (mai 2026 : hallucinations quasi temps réel), Custom AI Audiences.
- Prix sur devis ; fourchettes rapportées 99–799 $/mois et contrats à 5–6 chiffres **[non vérifié]**. Pas de GA4 ni
  d'attribution de conversion (tryanalyze).

## 5. Evertune (matière limitée, sources secondaires dont une concurrente)
- Fondateurs issus de The Trade Desk ; ≈20 M$ levés (Série A 15 M$ août 2025, Felicis).
- **AI Brand Score / AI Brand Index** (fréquence × rang, classements sectoriels), mesure **modèle de base vs application
  grand public**, **100 échantillons par prompt et par modèle** (marge d'erreur ≈1 pt, 2 pts par sujet), **EverPanel**
  (« 150 M+ conversations réelles ») pour les volumes, **association de mots** (« fiable », « cher »), Content Studio,
  Site Audit, Content Analytics (*Opportunity URLs* = sources influentes qui ne vous citent pas ; *Strength URLs*),
  Partner Connect (affiliation), AI Retargeting.
- Prix : Pro 800 $/mois (100 000 prompts suivis, 25 articles/mois) ; Enterprise sur devis (ampifire, guptadeepak).
  Démo obligatoire.
- Études de cas (Absolute Collagen ×4 en un mois, Halo Collar n° 1 en deux mois) : chiffres d'éditeur, non audités.

---

## Leçons pour Repéré (PME françaises, solo, budget minimal)

1. **Ne pas suivre la course au « AI Marketer » généraliste.** Notre avantage est l'exécution concrète déjà livrée (fiche
   Google, JSON-LD, plugin WP, FAQ hébergée). Il manque la **boucle de mesure** d'Athena : action → relance des prompts →
   delta affiché.
2. **Volumes** : personne ne publie sa méthode ; nous pouvons proposer une estimation transparente (Google Ads/GSC/suggest
   + coefficient IA) étiquetée « estimation », et la multiplier par le % de mention (formule Athena) pour un chiffre parlant.
3. **Robots IA** : les leaders lisent les **logs serveur/CDN**, car les robots n'exécutent pas le JavaScript. Notre script
   t.js ne peut voir que les humains référés ; il faut un collecteur côté serveur (plugin WordPress, Worker Cloudflare,
   log drain Vercel) pour la partie robots.
4. **Échantillonnage statistique** (Evertune) : exécuter chaque prompt plusieurs fois et afficher un intervalle, c'est un
   argument d'honnêteté fort et peu coûteux en mode léger (3 à 5 tirages).
5. **Ergonomie** : critiques récurrentes sur les UI « data-heavy » et les refontes. Les PME veulent un « que faire lundi »,
   ce que notre digest fait déjà ; ajouter un bouton « Expliquer ce changement » sur chaque graphique.
6. **Site** : démo produit animée cliquable sous le hero, moteurs qui défilent dans le titre, preuves rattachées à une
   source, FAQ fonctionnelle riche, pages rapports/recherche. Pas de faux logos (contrainte du brief).

---

## Sources
- Profound tarifs : https://www.tryprofound.com/pricing
- Profound historique de prix : https://pricingsaas.com/companies/tryprofound ; https://geotoolbox.ai/blog/profound-pricing.md (concurrent)
- Profound changelog : https://product.tryprofound.com/changelog
- Profound Agents : https://help.tryprofound.com/articles/9762251986-agents-overview
- Profound Prompt Volumes : https://www.tryprofound.com/blog/prompt-volumes-general-availability ; https://www.tryprofound.com/blog/introducing-conversation-explorer
- Profound Agent Analytics : https://docs.tryprofound.com/agent-analytics/overview.md ; https://www.tryprofound.com/blog/agent-analytics-integrations
- Profound Shopping : https://docs.tryprofound.com/shopping/about
- Profound accueil : https://www.tryprofound.com
- Profound avis : https://www.g2.com/products/profound/reviews ; https://review-human.pages.dev/reviews/profound
- AthenaHQ tarifs : https://www.athenahq.ai/pricing
- AthenaHQ docs prompts : https://docs.athenahq.ai/guides/prompts
- AthenaHQ ACE : https://athenahq.ai/blog/announcing-athena-citation-engine-ace
- AthenaHQ revues : https://review-human.pages.dev/reviews/athenahq ; https://fixaeo.com/blogs/athenahq-ai-review/ (concurrent) ; https://www.tryanalyze.ai/blog/athenahq-ai-review (concurrent) ; https://www.g2.com/products/athenahq/reviews
- Scrunch tarifs : https://www.scrunch.com/pricing
- Scrunch FAQ : https://scrunch.com/faqs/category/features ; https://scrunch.com/faqs/how-does-scrunch-track-ai-search-visits-to-my-website ; https://origin.scrunchai.com/faqs/what-is-scrunch-agent-experience-platform-axp-and-how-does-it-work
- Scrunch changelog : https://ai-cdn.scrunchai.com/blog/tag/changelog
- Scrunch avis : https://www.g2.com/products/scrunch-ai/reviews ; https://geotoolbox.ai/blog/scrunch-ai-review.md (concurrent)
- Rachat Sitecore : https://www.bandt.com.au/sitecore-acquires-scrunch-in-potential-225-million-deal/
- Bluefish : https://tryanalyze.ai/blog/bluefish-ai-review (concurrent) ; https://guptadeepak.com/geo-compass/vendors/bluefish-ai/
- Evertune : https://ampifire.com/blog/evertune-ai-reviews-pricing-is-this-geo-platform-legit/ (concurrent) ; https://guptadeepak.com/geo-compass/vendors/evertune/
