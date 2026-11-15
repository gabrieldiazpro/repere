# Ce qui fait qu'une IA cite une marque — état des preuves (15 nov. 2026)

Agent GEO-MARQUE. Sources lues le 15 novembre 2026 sauf mention. Niveaux : **démontré** (documentation de l'opérateur
ou expérience contrôlée relue), **probable** (corrélation à grande échelle ou recommandation d'opérateur sans mesure),
**hypothèse** (bonne pratique sans preuve publique). Version publique sur le site :
/etudes/pourquoi-les-ia-recommandent-une-marque (sources numérotées dans app/src/app/questions/_lib/sources.ts).

## 1. Ce que disent les opérateurs (démontré)
| Opérateur | Règle | Source (date) |
|---|---|---|
| Google | Les fonctions IA (AI Overviews, AI Mode) reposent sur les systèmes de classement de la recherche ; « best practices for SEO continue to be relevant » ; pas besoin de llms.txt, de Markdown ni de schema.org spécial ; pas besoin de découper en petits morceaux ; « seeking inauthentic "mentions" across the web isn't as helpful as it might seem » ; contenu original (non « commodity ») = facteur principal à long terme ; Business Profile et Merchant Center aident à être visible dans les réponses IA | developers.google.com/search/docs/fundamentals/ai-optimization-guide (mis à jour le 10 juil. 2026) ; billet du blog Search Central, mai 2026 |
| OpenAI | « Any public website can appear in ChatGPT search » ; ne pas bloquer OAI-SearchBot pour figurer dans les résumés et extraits (sinon lien + titre au mieux) ; utm_source=chatgpt.com ajouté aux liens | help.openai.com/en/articles/12627856 (Publishers and developers FAQ) |
| Microsoft | Consignes Bing réécrites (27 fév. 2026) : Copilot et API d'ancrage couverts ; GEO officiel, sans garantie ; noms d'entités clairs et cohérents, un sujet par URL, faits explicites, l'essentiel en haut ; « Artificially Engineered Language » et « Prompt Injection and AI Manipulation » = abus ; NOARCHIVE exclut de Copilot. Rapport « AI Performance » dans Bing Webmaster Tools (préversion, 10 fév. 2026) : citations, pages citées, requêtes d'ancrage | Search Engine Journal 27/02/2026 ; PPC Land 14/02/2026 |
| Perplexity, Anthropic, Mistral | Robots de recherche distincts des robots d'entraînement (PerplexityBot, Claude-SearchBot, MistralAI-Index/User), respect de robots.txt | docs officielles (cf. docs/v5/geo-methode.md § 1) |

## 2. Expériences contrôlées (démontré en laboratoire)
- Aggarwal et al., KDD 2024 : citations +41 %, statistiques +31 %, sources +27 %, fluidité +28 %, bourrage −8 %.
- Fang et al., 2025 (prépublication) : préférence des reclasseurs LLM pour les passages récents.

## 3. Corrélations (probable ; presque toutes publiées par des vendeurs d'outils)
| Constat | Chiffre | Source |
|---|---|---|
| Les IA préfèrent les médias tiers (« earned ») aux sites de marque ; Google plus équilibré | qualitatif | Chen et al., Univ. Toronto, arXiv 2509.08919, 10 sept. 2025 (non relu) |
| Mentions de marque ≫ liens | ρ 0,664 (mentions) ; 0,527 (ancres de marque) ; 0,392 (recherches de marque) ; 0,218 (backlinks) | Ahrefs, 75 000 marques, 26 mai 2025 |
| Listes « best X » = 1er type de page cité par ChatGPT sur les requêtes de comparaison | 43,8 % ; 79,1 % mises à jour en 2025 ; 35 % sur des domaines faibles ; 67,6 % des SERP « best X software » montrent une liste où l'éditeur se classe 1er | Ahrefs, 4 déc. 2025 (750 requêtes) |
| Se classer soi-même 1er dans sa liste : effet faible | recommandation 4 % → 7 % ; ~¼ à ⅓ placebo ; concurrent recommandé à la place dans 24,3 % des cas | Scrunch via PPC Land, 24 sept. 2026 |
| Logiciels B2B (ChatGPT API + Perplexity) | ~79 % contenu indépendant + pages éditeurs ; sites d'avis 7,3 % ; G2 41 citations, Capterra/GetApp à peine ; YouTube 47 (Perplexity seul) ; Reddit 11 (Perplexity seul) ; TechRadar 1er domaine | Growfusely, 28 juil. 2026 (128 requêtes, 1 739 citations) |
| Position dans la page | 44 % des citations ChatGPT dans le 1er tiers | K. Indig / Search Engine Land |
| llms.txt | aucun effet mesurable | SE Ranking, 300 000 domaines, nov. 2025 |

## 4. Qui est cité aujourd'hui sur nos questions cibles (recherche web du 15 nov. 2026, résultats Google-like)
Ce n'est **pas** une mesure des réponses des IA (elle sera faite par le compte interne, voir 05-mesure.md) : ce sont les
pages francophones qui se classent sur ces requêtes, donc les sources que les IA avec recherche ont le plus de chances
de lire.
- « meilleurs outils GEO » : SE Ranking (blog FR), comparateur-ia.com, tool-advisor.fr, La Fabrique du Net, geotoolbox.ai,
  leblogdudirigeant.com, codeur.com/comparatif, digitiz.fr (2 pages), dixmilleheures.fr, logiciels.pro.
  Outils qui reviennent : Qwairy, Meteoria, BotRank.ai, GetMint, Hikoo, Otterly, Peec AI, Semrush, Ahrefs Brand Radar,
  Profound, SE Visible, Rankscale, Knowatoa, Surfer, AthenaHQ, LLMRefs.
  La Fabrique du Net (13 nov. 2026) et Codeur (juin 2026) **déclarent des positions pouvant être rémunérées**.
- « alternative à Semrush » : La Fabrique du Net (SE Ranking, Ahrefs, Haloscan, Ranxplorer, Ubersuggest, Mangools, Moz,
  Serpstat, Sistrix, Majestic, SEO PowerSuite), Appvizer magazine, Journal du Geek, lucasfonseque.fr, hackceleration,
  LeptiDigital, impli.fr, journaldufreenaute.fr.
- « audit SEO gratuit » : geotoolbox.ai, experte.com, webandseo.fr, Capterra (Sitechecker), codeur.com/blog, thecmo.com,
  Ahrefs (blog FR), seocrawl.ai.
- « savoir si mon entreprise est recommandée par ChatGPT » : leblogdudirigeant.com, SE Ranking (page FR), contenus
  anglophones (lilachbullock.com, zarla.com, dev.to), Product Hunt (LLM Exposure).
- Concurrent à surveiller : **geotoolbox.ai** publie des guides FR/EN en .md qui se classent sur plusieurs de nos questions.

## 5. Ce qui est supposé (hypothèse) — à ne pas présenter comme prouvé
- Wikidata / sameAs / Knowledge Graph aident à désambiguïser une entité : plausible, aucun effet publié.
- Les avis G2/Capterra augmentent les recommandations : la confiance des acheteurs est mesurée (G2, 45 %), l'effet sur
  les citations ne l'est pas ; Growfusely trouve peu de citations Capterra/GetApp en 2026.
- Les publications LinkedIn sont citées : pas de chiffre fiable lu ; LinkedIn sert surtout à créer des mentions et des
  relations avec les auteurs de comparatifs.

## 6. Conséquences pour Repéré (ordre d'effort utile)
1. Site lisible et indexé (fait côté code ; Search Console + Bing Webmaster à la mise en ligne).
2. Pages originales et sourcées sur nos questions cibles (fait : /questions/*, /etudes/*, /glossaire).
3. **Être dans les comparatifs francophones qui se classent** (levier n° 1 selon les études ; sans payer de position
   non signalée).
4. Mentions gagnées : presse spécialisée, newsletters, podcasts, avec des données que nous seuls avons (Baromètre, quand réel).
5. Identité identique partout + profils officiels reliés (sameAs).
6. Vrais avis de clients pilotes sur G2/Capterra.
7. Vidéos de démonstration sur YouTube (Perplexity cite YouTube sur les requêtes logiciels).
Interdits : faux avis, comptes multiples, texte caché, consignes aux IA, pages en série, comparatifs truqués.
