# 02 — Teardown des outils GEO milieu de gamme

Agent TEARDOWN · 9 novembre 2026 · pour Repéré V3.
Périmètre : Peec AI, Otterly.AI, Goodie, Rankscale, Knowatoa, AI Peekaboo, LLMrefs, Trakkr, Nightwatch (AI tracking),
plus les acteurs 2026 utiles pour les PME (Mangools AI Search Watcher, Hall, AIClicks, Gauge, HubSpot AEO Grader,
rapports IA de Google Search Console et de Bing Webmaster Tools).
Méthode : 19 recherches web, environ 40 pages lues (pages tarifs officielles quand l'allowlist le permettait, docs,
blog produit, G2, OMR, Capterra, Reddit via archive, Product Hunt, comparatifs tiers). Plusieurs domaines officiels
(knowatoa.com, llmrefs.com, aipeekaboo.com, trakkr.ai/pricing) n'étaient pas lisibles depuis cette session : leurs
données viennent de sources tierces, citées et signalées.

Légende : **[V]** lu sur une page officielle de l'éditeur ; **[T]** lu sur une source tierce (souvent un concurrent,
donc partiale) ; **[non vérifié]** non lu ou sources contradictoires. Prix en USD sauf mention, relevés aux dates
indiquées.

Rappel des règles du brief : « cloner » = reproduire l'idée fonctionnelle avec notre design et notre code, jamais
copier textes, visuels, marques ou code. Aucun prix concurrent n'est à afficher sans source et date.

---

## 1. Synthèse en une page

1. **Le marché a convergé sur un socle commun** : suivi quotidien de prompts sur 3 à 8 moteurs, visibilité, part de
   voix, position, sentiment, sources citées (domaines, URL, catégories), concurrents, export CSV. Ce socle n'est plus
   différenciant ; son absence est éliminatoire.
2. **La bataille 2026 se joue sur l'action** : Peec a lancé *Actions* (février 2026, bêta) puis *Peec Agent* et des
   Actions étendues (23 octobre 2026) avec note d'impact à 5 niveaux, preuves, briefs et suggestions d'édition [V][T].
   Goodie vend des « action credits » et un rédacteur AEO [V]. Trakkr a un « recommended actions workflow » [T].
   Les critiques Reddit et G2 vont toutes dans ce sens : « dashboards with vibes », « still mostly observational »,
   « doesn't give clear recommendations ».
3. **Audit de page / citabilité** : Otterly (GEO audit : crawlabilité de ~20 agents IA, contenu statique ou dynamique,
   données structurées, *query fan-out*) [T], Rankscale (Page Audit à règles, sans LLM, 8 types de pages, 7 modules) [V].
   Peec n'en a pas, et un client G2 le réclame explicitement.
4. **Agences** : espaces de travail multi-clients (Otterly, Peec, Rankscale), projets de « pitch » gratuits 7 jours
   convertibles (Peec) [V], liens publics en marque blanche (Rankscale Growth, AI Peekaboo ≥ 100 $/mois, Trakkr Scale)
   [V][T], Looker Studio (Peec Advanced, Otterly Standard, Peekaboo tous plans, Knowatoa Growth).
5. **Le prix d'entrée PME est bas, mais les moteurs sont vendus à la découpe** : Otterly 29 $ (15 prompts, Gemini,
   AI Mode et Claude en options de 9 à 29 $), Rankscale 17 $/mois en annuel, Knowatoa 59 $, LLMrefs 79 $, Peec 95 $
   (3 moteurs au choix, Perplexity réservé à Enterprise depuis le 21 sept. 2026), Trakkr 100 $, Goodie 295 $.
6. **Gratuit = acquisition** : HubSpot AEO Grader (score en quelques secondes, rapport complet contre e-mail),
   Trakkr (AI Site Grader, Query Scanner, générateur llms.txt, Leaderboard, scan unique), AI Peekaboo (vérificateur
   concurrents, analyseur robots.txt, générateur llms.txt), LLMrefs (vérificateur de crawlabilité, générateur
   llms.txt, extension Chrome, trouveur de fils Reddit), Mangools (5 prompts gratuits), Hall (25 questions).
   Et surtout : **Google Search Console a ajouté un rapport « IA générative » le 3 juin 2026** et **Bing Webmaster
   Tools un rapport « AI Performance » (préversion depuis le 10 février 2026)** [T, pepper.inc] : deux sources gratuites
   et officielles que presque aucun outil milieu de gamme n'importe.
7. **Ce qui manque à tous** (opportunités Repéré) : prix tout compris en euros, français natif, exécution réelle
   (publication de FAQ, JSON-LD, fiche Google), attribution « action → effet » (critique G2 Peec), méthodologie
   transparente avec échantillonnage multiple (critique Reddit « directional at best » ; seul Mangools annonce 5
   exécutions par prompt).

---

## 2. Fiches par outil

### 2.1 Peec AI (Berlin)

**Prix** [V, peec.ai/pricing et pricingsaas.com, 9 nov. 2026] : Starter 95 $/mois (50 prompts, 3 moteurs au choix,
1 pays, 1 projet, 4 500 réponses/mois), Pro 245 $ (150 prompts, 3 pays, 2 projets, API), Advanced 495 $ (350 prompts,
5 projets, Looker Studio), Enterprise sur devis (jusqu'à 13 modèles, quotidien ou hebdo). −15 % en annuel. Moteur
supplémentaire : 30 / 70 / 140 $/mois. Sièges illimités partout, MCP et CSV partout. Agences : Essential 205 $,
Growth 420 $, Scale 675 $ (crédits, 3/10/25 projets de pitch) [V, peec.ai/for-agencies]. Essai gratuit annoncé,
durée non indiquée [non vérifié].

**Moteurs** : ChatGPT, AI Mode, AI Overviews, Copilot, Gemini, Naver (au choix 3 sur 6) ; Enterprise : + Claude
Sonnet 4, GPT‑5 Search, Grok, DeepSeek, Qwen, Mistral, Muse Spark (Meta), Perplexity [V]. Historique des changements :
Grok retiré le 8 juin 2026, AI Shopping ajouté le 22 juin, Perplexity passé en Enterprise seul le 21 sept. [V, pricingsaas].

| Fonction | Ce que voit l'utilisateur | Valeur | Critiques (source) | Implémentation probable |
|---|---|---|---|---|
| Suggestion de prompts à l'onboarding | ~50 prompts proposés après saisie de la marque | Démarrage sans page blanche ; « data started flowing at signup with zero setup » (G2, 17/07/2026) | « 40% of the prompts were overlapping » (G2, 14/07/2026) ; suggestions « off-target » (OMR) ; besoin de Semrush pour le volume (G2, 20/07/2026) | LLM sur le site + catégorie, pas de dédoublonnage sémantique ni de volume |
| Tags, sujets, pays | Filtres par modèle, sujet, pays, tag sur tous les écrans | Découper par gamme, marché, funnel | « navigation quite noisy » (G2, 15/09/2026) | Champs `tag[]`, `topic`, `country` sur le prompt, filtres globaux |
| Visibilité, position, sentiment, part de voix | Tableaux et courbes par marque | KPI de base | Gap-Score « pas intuitif » (OMR) ; « data rabbit hole » (OMR) | Extraction d'entités par LLM sur chaque réponse, agrégations SQL |
| Sources (domaines, URL, types) et gap | Tables de domaines/URL classés, « retrieval » vs « citation » | Savoir où obtenir des mentions | — | Parsing des citations, classification de domaines et de types de page |
| Actions (bêta fév. 2026) | Tracker d'actions en cartes, *owned* (contenus à créer) vs *earned* (éditorial, UGC, référence), score d'opportunité faible/moyen/élevé, to-do, « fait », onglet Impact [V, blog] | Passe de la mesure au plan | « cautious about the Earned and Owned Actions » (G2, 11/08/2026) ; « difficult to attribute actions… to improve » (G2, 31/08/2026) | Clustering des sources + score = usage de la source × retard sur les concurrents |
| Actions étendues + Peec Agent (23 oct. 2026) | Correctifs techniques, contenus, mentions tierces, corrections d'affirmations fausses ; impact sur 5 niveaux avec preuves ; briefs et suggestions d'édition ; agent conversationnel contextuel, 30 « skills », 25+ connecteurs (Webflow, HubSpot, Notion, Linear, Cloudflare) avec approbation [T, techintelpro] | Diagnostic « pourquoi la visibilité a baissé » | Crédits d'agent plafonnés (500 à 1 000/mois) [V] | Agent LLM à outils sur la base de données, OAuth par utilisateur |
| Agent analytics (visites de robots) | 4,5 M à 31,5 M visites de bots par mois selon plan [V] | Voir si GPTBot etc. lisent le site | — | Intégration CDN/logs (Cloudflare probable) [non vérifié] |
| AI Shopping, Naver | Catégorie shopping sur tous plans [V] | E-commerce | — | Scraping des carrousels produit |
| Exports | CSV tous plans, API dès Pro, MCP tous plans, Looker Studio (Advanced) [V] ; connecteur : dimensions marque, pays, date, modèle, prompt, domaine/URL, tag, sujet ; métriques visibilité, sentiment, position, part de voix [V, docs.peec.ai/looker] | Reporting client | Plus de modèles de rapports souhaités (OMR) | Community Connector Google Apps Script appelant l'API par clé de projet |
| Agences : pitch workspaces | Projet de prospect gratuit 7 jours hors quota, conversion en client en 3 clics avec historique conservé [V] | Signer des clients en montrant leurs données | — | Projet avec flag `pitch` + TTL, migration du flag |
| Rapports client | Pas de « marque blanche » nommée : modèle Looker cloné par client, liens lecture seule sans login ; résumé hebdo via MCP vers Slack ou Google Slides [V] | — | — | Looker + MCP plutôt qu'un module natif |
| Onboarding | « setup takes minutes », session d'onboarding quotidienne optionnelle [V, demo-self-serve] | Activation rapide | « onboarding… etwas komplex » ; demande d'onboarding in-app pour débutants (G2, 01/09/2026) ; pas d'historique rétroactif (OMR) | Wizard marque → concurrents → prompts |
| Prix | Public depuis le 3 août 2026 [V] | — | « pricing isn't super transparent » (OMR, avant août) ; « subscription wall between seeing all AI models » (G2, 04/08/2026) | — |

Note G2 : 4,7/5 sur 21 avis [V, G2 lu le 9 nov.] ; OMR 4,8/5 sur 18 avis.

### 2.2 Otterly.AI (Vienne)

**Prix** : Lite 29 $ (15 prompts), Standard 189 $ (100), Premium 489 $ (400), Enterprise dès 1 000 $ [V help.otterly.ai
pour les quotas ; prix T SE Visible et Capterra]. −15 % en annuel. Options moteurs (Lite / Standard / Premium) :
AI Mode et Gemini 9 / 59 / 149 $ chacun, Claude 29 / 109 / 439 $ ; 100 prompts supplémentaires 99 $/mois [T, SE Visible,
26 août 2026]. Essai sans carte bancaire, durée non indiquée [V].

**Inclus partout** [V] : ChatGPT, AI Overviews, Perplexity, Copilot ; suivi quotidien ; rapports de marque illimités ;
membres illimités ; 65+ pays ; outil de recherche de prompts ; Brand Visibility Index ; Domain Ranking ; analyse
des citations ; GEO audit (1 000 / 5 000 / 10 000 URL par mois) ; exports. Standard+ : espaces illimités, API, MCP,
Agent Analytics, Looker Studio.

| Fonction | Ce que voit l'utilisateur | Valeur | Critiques (source) | Implémentation probable |
|---|---|---|---|---|
| AI Keyword/Prompt Research | Prompts générés depuis un mot-clé, une marque ou une URL ; tag intention et étape du funnel ; *Query Fan-Out* (sous-requêtes générées par le moteur) ; alerte de dérive ; capture des emplacements publicitaires ChatGPT [V features, T SE Visible] | Choisir les bons prompts | — | LLM + taxonomie intention/funnel ; fan-out reconstitué par LLM ou lu dans les réponses AI Mode |
| Brand Visibility Index | Quadrant couverture × « probabilité d'achat » (Leaders, Niche, Low Conversion, Low Performance) [T] | Situer sa marque dans son secteur d'un coup d'œil | L'axe « likelihood to buy » est en fait la position moyenne (SE Visible) | Scatter : x = % de prompts avec mention, y = 1/position moyenne |
| Domain Citations | Table domaine × catégorie × couverture, donut par catégorie, filtre « Moi + concurrents » [V help] | Cibler RP et UGC | Catégories non modifiables [V] | Classification de domaines par liste + LLM |
| GEO audit | Crawlability Checker (~20 agents IA testés via robots.txt et fetch réel, rapport téléchargeable), Content Checker (rendu statique/dynamique, structured data), Query Fan-Out ; SWOT de marque, RP, on-page, UGC [T, V] | Corriger ce qui bloque les IA | « Very solid » (Reddit r/SEO_LLM, avr. 2026) ; aucune preuve publiée du lien score → citations (SE Visible) | Fetch avec user-agents IA + parse robots.txt + rendu headless pour comparer HTML brut et DOM |
| Sentiment | Mentionné via G2 | — | Classifieur « oversensitive », mention neutre classée négative (G2 cité par SE Visible) | LLM classifieur par mention |
| Espaces de travail | Un espace par marque/client, membres, prompts, audits séparés [V] | Agences | — | Multi-tenant classique |
| Exports, Looker Studio, API, MCP | CSV prompts/mentions/citations ; Looker dès Standard ; programme agence avec rapports Data Studio en marque blanche [V, T] | Reporting | Interface « plus fragmentée » (Reddit, avr. 2026) | Connecteur Apps Script |
| Onboarding | 3 étapes (ajouter prompts, attendre, recevoir insights hebdo), rapports « approx. 5 minutes » ; témoignage « within one hour » ; session de groupe ou perso selon plan [V] | Time-to-value court | — | — |
| Alertes e-mail | Non mentionnées sur les pages lues ; « insights hebdomadaires » [non vérifié] | — | — | — |

Note G2 : 4,7/5 sur 54 avis (Ease of Setup 9,2) [V G2]. Capterra : aucun avis [V].

### 2.3 Goodie (New York)

**Prix** [V, higoodie.com/pricing] : Core 295 $/mois (5 moteurs : ChatGPT, AI Overview, Perplexity, AI Mode, Copilot ;
110 prompts ; 50 crédits d'action ; 10 pages suivies ; 2 pays, 2 langues ; essai 7 jours), Pro 999 $ (8 moteurs dont
Gemini, Alexa, Sparky ; 250 prompts ; 100 crédits), Enterprise sur devis (jusqu'à 14 moteurs : + Claude, Meta AI,
DeepSeek, Grok, Muse). Sièges illimités, MCP partout, API en Enterprise. Incohérence relevée : 110 prompts sur la carte
Core contre « 30 research prompts » dans le comparatif.

| Fonction | Ce que voit l'utilisateur | Valeur | Critiques | Implémentation probable |
|---|---|---|---|---|
| Suivi visibilité + benchmark concurrents | Tableau de bord par moteur et concurrent | Socle | Métriques « plus dures à interpréter » que les positions SEO (NoGood, éditeur lié à Goodie) | — |
| Optimization Hub / crédits d'action | Recommandations de contenu sémantique, schema, accroches d'outreach ; actions consommant des crédits [V, T Writesonic 2025] | Passage à l'action | Recommandations plus faibles sur requêtes complexes (Writesonic, partial) | LLM + règles, compteur de crédits |
| Outreach agent | Opportunités de citation manquées + e-mails d'outreach rédigés pour les éditeurs [T NoGood] | RP automatisée | — | LLM sur les sources citées où la marque est absente |
| AEO Content Writer + optimiseur | Rédaction d'articles et audit des brouillons [V, T] | Produire du contenu citable | « Pas une suite de rédaction complète » (NoGood) | LLM avec checklist AEO |
| Agent analytics / Site 360 / attribution | Trafic, robots et crawlers, attribution de revenu [V] | Prouver le ROI | — | Snippet JS + logs serveur [non vérifié] |
| Agentic commerce | Visibilité au niveau SKU (Pro) [V] | E-commerce | — | Prompts shopping par produit |
| Pages suivies | 10 à 60+ pages suivies [V] | Suivi au niveau URL | — | Liste d'URL surveillées dans les citations |
| Onboarding | Appel de 30 min ; Enterprise : Slack, rythme bimensuel [V] | — | Nécessite adhésion interne (NoGood) | — |
| Outil gratuit | « Free AI-Search Assessment » avec feuille de route [T Writesonic, 2025] [non vérifié en 2026] | Acquisition | — | — |

### 2.4 Rankscale (Vienne)

**Prix** [V, rankscale.ai/pricing] : Essentials 17 $/mois (annuel seul ; 120 crédits, 480 réponses, 2 tableaux de bord,
10 audits de page), Pro 99 $ (1 200 crédits, 10 tableaux, 50 audits), Pro+ 229 $ (API, 5 recherches de prompts),
Growth 385 $ (liens de tableau de bord en marque blanche, programme agence, 200 audits), Enterprise 780 $. Crédits :
~0,25 crédit par moteur et par prompt ; report de crédits jusqu'à 2× ou 3×. 17+ moteurs sur tous plans (ChatGPT,
Perplexity, AI Mode, AI Overviews, Gemini, DeepSeek, Mistral, Claude, Copilot…). Essai 7 jours du plan Pro avec crédits
limités [V page-audit].

| Fonction | Ce que voit l'utilisateur | Valeur | Critiques (source) | Implémentation probable |
|---|---|---|---|---|
| Suivi à crédits, fréquence au choix | Calculateur de crédits ; 50 prompts/semaine ≈ 162,5 crédits/mois [V] | Payer à l'usage | « Credit costs can be difficult to forecast » (Dageno, concurrent, 15/10/2026) | Compteur de crédits par exécution |
| Page Audit | Typage de page (8 types : local, YMYL, e-commerce, éditorial…), modules SEO, RAG, AI Readiness, liens, schema, E-E-A-T, filtre de subjectivité (pénalise « world-class ») ; statut perfect-mix / ai-trap / hidden-gem ; recommandations priorisées ; **à règles, sans LLM** [V] | Corriger la page avant de suivre | « Passing an audit does not guarantee a citation » (Dageno) | Crawler + parseurs HTML + règles pondérées par type de page |
| Sentiment, citations, concurrents | Positif/neutre/négatif ; domaines, URL, catégories, part par mentions/URL/domaines [T] | Socle | « Automated competitor discovery still needs review » ; « more data than a small team can act on » (Dageno) | — |
| Tableaux personnalisés, Data Studio, exports | Dès Pro [V] | Reporting | — | — |
| Liens partagés en marque blanche | Growth et plus, avec API [V] | Agences | — | Route publique signée, logo client |
| Local, AI visits, shopping, ads | Absents d'Essentials, présents dès Pro [V] | — | — | [non vérifié] détail |

### 2.5 Knowatoa

**Prix — sources contradictoires [non vérifié]** : Rankability (26 mai 2026) donne Free 0 $ (10 questions, ChatGPT,
CSV), Premium 99 $ (30), Pro 249 $ (300, 6 moteurs, API), Agency 749 $ (1 500) ; IndustryLens (page tarifs relevée le
24 mai, article du 3 août 2026) et Analyze AI (21 mai) donnent Starter 59 $ (30 questions ; ChatGPT, AI Overviews,
AI Mode ; CSV) et Growth 199 $ (100 questions ; 7 moteurs dont Claude, Gemini, Meta AI, Perplexity ; API, MCP, Looker
Studio, NinjaCat), Enterprise dès 499 $. Option onboarding avec les fondateurs 299 $ (Rankability).

| Fonction | Ce que voit l'utilisateur | Valeur | Critiques | Implémentation probable |
|---|---|---|---|---|
| Suivi quotidien, conditions identiques | Snapshots complets (prompt, sources, horodatage) [T Analyze] | Preuve vérifiable | — | Stockage des réponses brutes |
| « AI Search Console », « Intent Research » (volume et classification de recherche IA) | Listés sur tous plans [T Rankability] | Prioriser les questions | Détail non documenté [non vérifié] | — |
| Exports, Looker, NinjaCat, API, MCP | Réservés au plan supérieur [T IndustryLens] | Reporting dirigeants | Le palier est « là où les données peuvent sortir » | — |
| Optimisation | Aucune | — | « limited optimization tools and integrations » (Reddit cité par IndustryLens, 6 juil. 2026) ; « grader » qui ne corrige rien ; pas de lien GA4 (Analyze) | — |
| Avis | Très rares (« scarcity of public user-generated reviews », Rankability) | — | — | — |

### 2.6 AI Peekaboo

**Prix** [T, LLM Pulse, mis à jour le 16 oct. 2026] : configurateur (marques, prompts, moteurs, cadence) dès 29 $/mois ;
essai 14 jours avec carte bancaire sous 100 $/mois ; marque blanche et liens partagés dès 100 $/mois ; Looker Studio sur
tous plans ; sièges illimités. Capterra : « contact vendor », aucun avis [V]. 5 surfaces : ChatGPT, Gemini, Perplexity,
AI Mode, AI Overviews.

| Fonction | Ce que voit l'utilisateur | Valeur | Critiques | Implémentation probable |
|---|---|---|---|---|
| Configurateur de prix | Curseurs marques × prompts × moteurs × fréquence | Payer exactement ce qu'on suit | — | Formule de prix côté front + Stripe metered |
| Rapports marque blanche, liens partagés, exports brandés | « genuinely well-implemented » (LLM Pulse, concurrent) | Agences | — | Rendu public par token + logo/couleurs |
| Intégration Google Search Console | Données GSC à côté de la visibilité IA | Relier SEO et IA | Centré sur les métriques SEO classiques (LLM Pulse) | OAuth Google, API Search Analytics |
| Chatbot sur les données | Questions en langage naturel | Explorer sans tableaux | — | LLM + outils SQL |
| Sentiment et cadrage | — | — | Moins profond (LLM Pulse) | — |
| API REST, MCP hébergé | — | Intégrations | — | — |
| Outils gratuits | Vérificateur de concurrents, analyseur robots.txt, générateur llms.txt | Acquisition SEO | — | Pages outils sans compte |
| Limites | Petite équipe, moins d'historique, moins de suggestions de prompts, pas de SOC 2 (LLM Pulse) | — | — | — |

### 2.7 LLMrefs

**Prix — sources contradictoires [non vérifié]** : plan unique ~79 $/mois mensuel (Trakkr, 1er sept. 2026 : « 500 prompts »,
essai 7 jours ; ColdIQ : « 50 keywords », par siège ; Superframeworks, 1er août 2026 : gratuit 10 prompts + Pro 79 $).
Projets et membres illimités, 8 à 11+ moteurs (dont Grok, AI Mode, Copilot), géo et multilingue.

| Fonction | Ce que voit l'utilisateur | Valeur | Critiques | Implémentation probable |
|---|---|---|---|---|
| Suivi par « mots-clés » agrégés en prompts | Rapport hebdo par défaut, quotidien en payant ; part de voix et position ; réponses verbatim [T] | Modèle mental SEO familier | Pas de sentiment, pas d'alertes, pas d'actions, pas de marque blanche, diagnostic limité (Trakkr, concurrent) | Mot-clé → n prompts générés, agrégation |
| Outils AEO groupés | Vérificateur de crawlabilité, générateur llms.txt, extension Chrome, trouveur de fils Reddit [T] | Acquisition + utilité | — | Outils statiques |
| CSV, API | [T] | — | — | — |

### 2.8 Trakkr (Londres)

**Prix** [T, LLM Pulse vérifié le 20 juil. 2026 ; Trakkr compare, 1er oct. 2026] : Growth 100 $/mois (1 marque, 50 prompts,
25 articles, 8 modèles, essai 14 jours), Scale 500 $ (10 marques, 50 prompts par marque, 100 articles, API, portails
clients en marque blanche, sièges illimités). Pas d'offre gratuite permanente, mais un scan de visibilité unique gratuit.
Modèles : ChatGPT, Claude, Gemini, Perplexity, Grok, DeepSeek, Meta AI, AI Overviews.

| Fonction | Ce que voit l'utilisateur | Valeur | Critiques | Implémentation probable |
|---|---|---|---|---|
| Suivi quotidien 8 moteurs + alertes temps réel | [T, Trakkr] | Large couverture | Profondeur inégale par moteur (LLM Pulse) | — |
| Diagnostics au niveau prompt, citations, sentiment (confiance, qualité, innovation) | [T] | — | Sentiment moins développé (LLM Pulse) | Sentiment multi-axes par LLM |
| Recommandations + génération d'articles (25 à 100/mois) | [T] | Produire du contenu | — | LLM |
| Reddit / source intelligence | [T] | UGC | Détail non documenté [non vérifié] | — |
| Portails clients marque blanche | Scale seulement [T] | Agences | Multi-marque à 500 $ (LLM Pulse) | — |
| Outils gratuits | AI Site Grader, AI Query Scanner, générateur llms.txt, **Leaderboard** (classements publics) [T, trakkr.ai] | Acquisition et SEO programmatique | — | Pages publiques alimentées par leurs données |
| Pages comparatives | Dizaines de pages « Trakkr vs X » datées avec prix vérifiés | SEO bas de funnel | Partialité assumée | Template + données |
| Limites déclarées | Pas de détection d'hallucinations, peu d'intégrations [T, Trakkr] | — | — | — |

### 2.9 Nightwatch — AI / LLM tracking

**Prix** : non affichés sur les pages lues [non vérifié] ; essai 14 jours sans carte ; sièges illimités ; SOC 2 ; promo
Black Friday −30 % visible le 9 nov. 2026 [V v3.nightwatch.io/ai-tracking]. Gemini seulement sur les plans de 300+ prompts [V docs].

| Fonction | Ce que voit l'utilisateur | Valeur | Critiques | Implémentation probable |
|---|---|---|---|---|
| Prompts avec pays, langue et tags (sujet, client, campagne) | Formulaire « Add Prompt » : fournisseur, lieu, langue, tags [V docs] | Organisation agence | — | — |
| Prompt Research via « SEO Agent » | Modèles prédéfinis ou instructions ; crédits en option à activer via le support [V docs] | — | Friction (activation manuelle) | LLM |
| Tableaux | Overview (visibilité moyenne, part de voix, sentiment), Prompts (visibilité, mentions, position, nb d'entités, dernière mise à jour), Brand Entities, Citations (domaines, nb, position moyenne, prompts déclencheurs), **Source Matrix (bêta)**, Classifications ; aperçu de la réponse complète [V docs] | Lien prompt → source | — | — |
| Citation Intelligence | Citations rattachées aux URL, « force de citation » dans le temps, gaps de contenu [V] | — | — | Score par URL = fréquence × position |
| Pipeline IA | Chemin index → réponse (OpenAI, Perplexity, Google, Bing, YouTube, Maps) [V] | Pédagogie | — | — |
| Intégration au suivi SEO classique | Même outil que le rank tracking | Pas de second outil | — | — |

### 2.10 Acteurs 2026 utiles pour les PME

| Acteur | Ce qu'il apporte | Prix | Source |
|---|---|---|---|
| **Google Search Console** | Rapport « IA générative » (impressions AI Overviews, AI Mode, Discover IA), ajouté le 3 juin 2026 | Gratuit | [T, pepper.inc, 9 juil. 2026] [non vérifié sur la doc Google] |
| **Bing Webmaster Tools** | « AI Performance » : URL citées, requêtes déclenchantes, part de citations (préversion depuis le 10 févr. 2026 ; on ne sait pas si cela couvre ChatGPT ou Copilot seul) | Gratuit | [T, pepper.inc] [non vérifié] |
| **HubSpot AEO Grader** | 4 champs (nom, région, produits, secteur), score par moteur (OpenAI, Perplexity, Gemini) en quelques secondes, 5 dimensions (perception /40, notoriété /20, qualité /20, exposition /10, position /10), rapport complet contre e-mail (PDF ou lien), archétype de marque, thèmes narratifs | Gratuit | [T, Salesdorado, 29 juil. 2026] ; critiques : modèles « mini/flash » anciens, volumes incomparables, instantané unique |
| **Mangools AI Search Watcher** | Gratuit 5 prompts ; **chaque prompt exécuté 5 fois** | dès 15,60 $/mois (annuel) | [T, Superframeworks, 1er août 2026] |
| **Hall** | Gratuit 25 questions, suivi de l'activité des crawlers IA | Pro 199 $ | [T, idem] |
| **AIClicks** | Transforme les gaps en brouillons de contenu | 59–499 $, essai 7 j | [T, idem] |
| **Gauge** | Espaces multi-clients agences | 99 $ ; Agency Mode 300 $/client | [T, idem] |
| **AEO GEO AI (Product Hunt, 2026)** | Vérificateur gratuit sans inscription, 3 analyses/jour, ChatGPT + Claude + Gemini | Pro 9,99 $ | [V Product Hunt] ; 2 upvotes : traction nulle |

---

## 3. Inventaire transversal des fonctionnalités

✓ = documenté ; ~ = partiel ; — = absent des sources lues ; ? = non vérifié.

| Fonction | Peec | Otterly | Goodie | Rankscale | Knowatoa | Peekaboo | LLMrefs | Trakkr | Nightwatch |
|---|---|---|---|---|---|---|---|---|---|
| Suggestion de prompts | ✓ | ✓ (URL, intention, funnel, fan-out) | ✓ | ✓ (Pro+) | ~ (Intent Research) | ~ | ✓ (via mots-clés) | ? | ✓ (SEO Agent) |
| Tags / sujets | ✓ | ✓ | ? | ? | ? | ? | ? | ? | ✓ |
| Pays / langues | 1–3 pays, ∞ Ent. | 65+ pays | 2–8 | ✓ local dès Pro | ? | ? | ✓ | ? | ✓ |
| AI Overviews / AI Mode | ✓ / ✓ | ✓ / option (US seul) | ✓ / ✓ | ✓ / ✓ | ✓ / ✓ | ✓ / ✓ | ✓ / ✓ | ✓ / ? | ✓ / ✓ |
| Copilot | ✓ | ✓ | ✓ | ✓ | ? | — | ✓ | — | ✓ |
| DeepSeek / Grok / Meta AI | Ent. | — | Ent. | DeepSeek ✓ | Meta ✓ (Growth) | — | Grok ✓ | ✓ / ✓ / ✓ | — |
| Fréquence | quotidien | quotidien | ? | au choix (crédits) | quotidien | configurable | hebdo, quotidien payant | quotidien | quotidien |
| Sources : domaines / URL / catégories | ✓✓✓ | ✓✓✓ | ✓ | ✓✓✓ | ✓✓ | ? | ✓ | ✓ | ✓✓ + Source Matrix |
| Gap concurrentiel | ✓ (Gap-Score) | ✓ | ✓ | ✓ | ✓ | ? | ~ | ✓ | ✓ |
| Concurrents auto-détectés | ✓ | ✓ | ? | ✓ (à revoir) | ? | outil gratuit | ? | ✓ | ✓ (entités) |
| Visibilité / position / sentiment | ✓✓✓ | ✓✓~ | ✓✓? | ✓✓✓ (Pro) | ✓✓✓ | ✓✓✓ | ✓✓— | ✓✓✓ | ✓✓✓ |
| Recommandations | ✓ Actions + Agent | ~ (GEO recos) | ✓ crédits | ✓ (audit) | — | ? | — | ✓ | ~ |
| Audit de page / citabilité | — (réclamé) | ✓ GEO audit | ~ (pages suivies, optimiseur) | ✓ Page Audit | — | — | — | ✓ (Site Grader) | — |
| robots.txt IA / llms.txt | ✓ (actions techniques) | ✓ crawlabilité ~20 bots | ? | ✓ (pénalités) | ? | outils gratuits | outils gratuits | llms.txt gratuit | — |
| Analytics des robots IA / trafic IA | ✓ | ✓ (Standard+) | ✓ + attribution | ✓ AI visits (Pro) | — | GSC | — | ~ | — |
| CSV / Looker / API / MCP | ✓ / Adv. / Pro / ✓ | ✓ / Std / Std / Std | ? / ? / Ent. / ✓ | Pro / Pro / Pro+ / ? | ✓ / Growth / Growth / Growth | ✓ / ✓ / ✓ / ✓ | ✓ / ? / ✓ / ? | Scale / — / Scale / ✓ | ? |
| Espaces agences | ✓ + pitch | ✓ | Ent. multi-marques | ✓ (programme Growth) | ✓ | ✓ | ✓ projets ∞ | Scale | ✓ tags client |
| Marque blanche / lien public | ~ (Looker) | ~ (agence) | ? | ✓ Growth | ? | ✓ ≥100 $ | — | ✓ Scale | ? |
| Alertes e-mail | ? | ? (insights hebdo) | ? | ? | ? | ✓ (Capterra) | — | ✓ temps réel | ? |
| Onboarding annoncé | « minutes » | « ~5 min » | appel 30 min | checklist | webinar payant | ? | ? | scan gratuit | 4 étapes |
| Essai | oui, durée ? | oui, sans CB | 7 j (Core) | 7 j Pro | plan gratuit ? | 14 j avec CB | 7 j / gratuit ? | 14 j | 14 j sans CB |
| Entrée de gamme | 95 $ | 29 $ | 295 $ | 17 $ (annuel) | 59 $ ou 99 $ | dès 29 $ | ~79 $ | 100 $ | ? |

---

## 4. Ce que leurs sites marketing font de mieux

| Pratique | Qui | Ce qu'on en retient pour Repéré |
|---|---|---|
| **Outil gratuit à résultat immédiat, rapport complet contre e-mail** | HubSpot AEO Grader (score en secondes, e-mail pour le PDF/lien) ; Trakkr (scan unique) ; AEO GEO AI (3/jour sans inscription) | Notre audit gratuit existe : rendre le premier score visible sans e-mail, ne demander l'e-mail que pour le rapport complet et le suivi |
| **Batterie d'outils gratuits SEO-friendly** | Trakkr (Site Grader, Query Scanner, llms.txt, Leaderboard), Peekaboo (concurrents, robots.txt, llms.txt), LLMrefs (crawlabilité, llms.txt, Reddit finder, extension Chrome) | Pages /outils : vérificateur robots.txt IA, générateur/validateur llms.txt, testeur JSON-LD, générateur de prompts — chacune indexable, en français |
| **Classement public (leaderboard)** | Trakkr ; Brand Visibility Index d'Otterly en quadrant | Classements sectoriels français mensuels (« plombiers à Lyon dans ChatGPT »), données étiquetées, méthode publiée : SEO programmatique + RP |
| **Pages comparatives datées avec prix vérifiés** | Trakkr (« prices last verified 1 Oct 2026 »), LLM Pulse, Rankscale | Notre /comparatif : ajouter « prix vérifiés le … » et une ligne par concurrent, sans dénigrement |
| **Onboarding promis en minutes** | Otterly « approx. 5 minutes », Peec « Get started without the call » | Afficher une durée mesurée (pas promise) et un compteur d'étapes |
| **Self-serve + appel facultatif** | Peec (session d'onboarding quotidienne ouverte), Goodie (30 min) | Créneau collectif hebdo « premiers pas » en visio |
| **Calculateur de prix / configurateur** | Rankscale (calculateur de crédits), AI Peekaboo (configurateur) | Simulateur « nombre de questions × IA × fréquence » si l'offre devient modulaire |
| **Historique des prix public** | (fait par pricingsaas.com, pas par les éditeurs) | Page « journal des prix et des fonctions » : argument de transparence face aux hausses (Perplexity passé en Enterprise chez Peec) |
| **Démo interactive / vidéo** | Aucune démo interactive ni vidéo vue sur les pages lues de Peec (demo-self-serve statique), Nightwatch (aucune vidéo) ou Otterly [non vérifié pour les autres] | Espace libre : une démo cliquable sur données « démo » et une vidéo courte nous différencieraient réellement |
| **Signaux de confiance** | Logos, « 4000+ brands », note G2, SOC 2 (Peec, Nightwatch) | Chez nous : uniquement méthode, hébergement UE, conformité CNIL ; aucun faux logo |

---

## 5. Recommandations pour Repéré (lecture rapide)

Repéré a déjà (V2) : audit multi-IA, sources citées classées, perception, faits, gaps, benchmark, tâches avec
livrables, trafic IA, digest, alertes, copilote, rapports. Il lui manque surtout, par ordre de priorité :

1. **Recherche de prompts guidée** depuis l'URL : intention, étape du funnel, dédoublonnage sémantique, tags, pays,
   langue (Otterly, Peec, Nightwatch ; critique G2 sur les doublons).
2. **Actions avec score d'opportunité et suivi d'impact avant/après** (Peec Actions ; critique G2 « difficult to
   attribute ») : brancher nos tâches existantes sur un score et une courbe « avant / après ».
3. **Audit de page « citabilité » à règles + vérificateur des robots IA** (Rankscale, Otterly ; manque chez Peec).
4. **Outils gratuits sans inscription** (robots.txt IA, llms.txt, score express) en pages indexables.
5. **Rapports partagés par lien public, marque blanche et PDF** (Rankscale, Peekaboo, Trakkr).
6. **Mode agence** : espaces multi-clients et projets de prospection 7 jours convertibles (Peec, Otterly).
7. **Import Search Console (rapport IA générative) et Bing Webmaster (AI Performance)** : données officielles
   gratuites, quasi absentes chez les concurrents milieu de gamme (seul Peekaboo connecte GSC, sur le SEO classique).
8. **Exports CSV client, connecteur Looker Studio, API/MCP** (Peec, Otterly, Peekaboo, Knowatoa).

Différenciateurs à afficher ensuite : échantillonnage multiple par question avec marge d'erreur (Mangools, critique
Reddit), prix en euros tout compris, réponses brutes horodatées consultables (Knowatoa), classement sectoriel public.

Le détail (valeur, construction, effort, segments, priorité) est dans `features-midmarket.json`.

---

## 6. Sources (lues le 9 novembre 2026)

Officielles [V]
- Peec : https://peec.ai/pricing · https://peec.ai/for-agencies · https://peec.ai/demo-self-serve · https://peec.ai/blog/introducing-actions · https://docs.peec.ai/looker/introduction
- Otterly : https://help.otterly.ai/pricing-of-otterlyai · https://webflow.otterly.ai/features · https://help.otterly.ai/what-insights-can-i-gain-from-domain-citations-analysis
- Goodie : https://higoodie.com/pricing/
- Rankscale : https://www.rankscale.ai/pricing · https://rankscale.ai/features/page-audit
- Nightwatch : https://docs.nightwatch.io/en/articles/13842311-ai-llm-tracking-in-nightwatch · https://v3.nightwatch.io/ai-tracking/
- Trakkr (pages comparatives de l'éditeur, partiales) : https://www.trakkr.ai/compare/trakkr-vs-llmrefs · https://trakkr.ai/compare/trakkr-vs-peec
- Product Hunt : https://www.producthunt.com/products/aeo-geo-ai-free-ai-visibility-checker

Historique de prix
- https://pricingsaas.com/companies/peec

Avis
- G2 Peec : https://www.g2.com/products/peec-ai/reviews_and_filters
- OMR Peec : https://omr.com/en/reviews/product/peec-ai/all
- G2 Otterly (note seule, avis non affichés) : https://g2.com/products/otterlyai/reviews
- Capterra Otterly : https://www.capterra.com/p/10023384/Otterly-AI/pricing/ · Capterra Peekaboo : https://www.capterra.com/p/10031731/Peekaboo/
- Reddit r/SEO_LLM « Updated review of AEO tools April 2026 » (archive) : https://reddit.sentinel-team.org/posts/1sts45l/snapshots/2026-04-25T00%3A48%3A36.296808Z
- Reddit r/AiForSmallBusiness (archive) : https://reddit.sentinel-team.org/posts/1rkhihz/snapshots/2026-03-06T19%3A44%3A20.562281Z

Tiers (souvent concurrents, à lire comme tels)
- SE Visible, revue Otterly (26 août 2026) : https://visible.seranking.com/blog/otterly-ai-review/
- NoGood, revue Goodie (lié à Goodie) : https://nogood.io/blog/goodie-ai-review/
- Writesonic, revue Goodie (2025) : https://writesonic.com/blog/goodie-ai-review
- Dageno, revue Rankscale (15 oct. 2026) : https://dageno.ai/blog/rankscale-ai-review-2026
- Rankability, Knowatoa (26 mai 2026) : https://www.rankability.com/blog/knowatoa-ai-review/
- IndustryLens, Knowatoa (3 août 2026) : https://industry-lens.com/reports/signal-spotlight-knowatoa
- Analyze AI, Knowatoa (21 mai 2026) : https://www.tryanalyze.ai/blog/knowatoa-ai-review
- LLM Pulse, alternatives Peekaboo (16 oct. 2026) : https://llmpulse.ai/blog/best-ai-peekaboo-alternatives/
- LLM Pulse, alternatives Trakkr (30 oct. 2026) : https://llmpulse.ai/blog/best-trakkr-alternatives/
- ColdIQ, LLMrefs : https://coldiq.com/tools/llmrefs
- TechIntelPro, Peec Agent (23 oct. 2026) : https://techintelpro.com/news/marketing/ai/peec-ai-launches-peec-agent-expanding-actions-for-ai-search-optimization
- Superframeworks (1er août 2026) : https://superframeworks.com/articles/best-ai-search-visibility-tools
- Pepper, outils gratuits (9 juil. 2026) : https://www.pepper.inc/blog/best-free-geo-and-ai-search-tools/
- Salesdorado, HubSpot AEO Grader (29 juil. 2026) : https://salesdorado.com/en/ai/review-hubspot-aeo-grader/

Non lus (allowlist) : knowatoa.com, llmrefs.com, aipeekaboo.com, trakkr.ai/pricing, otterly.ai/pricing. Non couverts :
avis G2 détaillés d'Otterly, Rankscale, Trakkr ; vidéos et démos des sites (non vérifié au-delà des pages listées) ;
documentation Google et Bing des rapports IA.
