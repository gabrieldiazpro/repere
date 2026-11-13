# 03 — Pilier SOURCES & CITATIONS (V2)

> Agent SOURCES & CITATIONS. Recherche web du 9 novembre 2026. Complète `docs/03-methode-score.md` (détection, score) et `docs/04-api-ia.md` (formats d'API).
> Table de domaines : `docs/v2/03-domains.json` (436 domaines pré-classés).
> ✅ = vérifié dans une source citée · ⚠️ = non vérifié ou déduit.

---

## 0. Résumé

**Promesse du pilier** : « Voici les 10 sites que les IA lisent pour répondre à vos clients. Vos concurrents y sont, vous non. Voici comment y entrer, et on peut le faire pour vous. »

| Étape | Ce qu'on fait | Coût marginal |
|---|---|---|
| Collecte | On garde chaque URL citée (ou consultée) par l'IA, avec titre, extrait, position, requête, IA et exécution | 0 € (déjà dans les réponses) |
| Normalisation | URL canonique, domaine enregistrable (`tldts`), règles d'hôte et de chemin | 0 € |
| Classification | 13 catégories : table de 436 domaines, puis heuristique, puis LLM en lot (avec cache global) | ≈ 0,0005 € par audit |
| Présence | Nom du client et des concurrents dans le titre ou l'extrait, puis une requête HTTP légère et optionnelle par URL prioritaire (robots.txt respecté), puis l'auto-déclaration du client | 0 € |
| Scores | Citation share, taux de citation, opportunité = fréquence × poids × absence × faisabilité | 0 € |
| Rendu | « Vos 10 sources prioritaires » : pourquoi, comment y entrer, effort, impact, bouton « On le fait pour vous » | — |

**Règle d'or** : Gemini avec ancrage est **exclu** du pilier Sources (les CGU interdisent d'analyser les Grounded Results, voir §3.4). Le pilier repose sur ChatGPT, Perplexity et Claude, qui renvoient des URL exploitables.

---

## 1. Ce que disent les études

### 1.1 Chiffres de référence

| Étude | Périmètre | Ce qui en ressort |
|---|---|---|
| **Profound** (680 M de citations, août 2024 à juin 2025) ✅ | ChatGPT, AI Overviews, Perplexity | ChatGPT : Wikipédia 7,8 % de toutes les citations, Reddit 1,8 %, Forbes 1,1 %, G2 1,1 %. AI Overviews : Reddit 2,2 %, YouTube 1,9 %, Quora 1,5 %, LinkedIn 1,3 %. Perplexity : Reddit 6,6 %, YouTube 2,0 %, Gartner 1,0 %, **Yelp 0,8 %** ([Profound](https://www.tryprofound.com/blog/ai-platform-citation-patterns)) |
| **Semrush** (230 000 prompts, plus de 100 M de citations, juillet à octobre 2025) ✅ | ChatGPT Search, AI Mode, Perplexity | Mi-septembre 2025, la part de réponses ChatGPT citant Reddit chute d'environ 60 % à environ 10 %, et celle citant Wikipédia de 55 % à moins de 20 %. AI Mode cite surtout LinkedIn (≈ 15 % des réponses), YouTube, Reddit et des propriétés Google. Perplexity : Reddit, LinkedIn, NIH ([Semrush](https://www.semrush.com/blog/most-cited-domains-ai/)) |
| **Similarweb** (≈ 600 000 citations, États-Unis, janvier et février 2026) ✅ | ChatGPT, AI Mode | ChatGPT : Wikipédia 13,2 %, Reddit 12,0 %, Walmart 2,9 %, YouTube 2,7 %, LinkedIn 2,4 %. AI Mode : Fandom 7,2 %, Wikipédia 5,2 %, YouTube 4,9 %, Reddit 4,2 %. Les prompts d'**opinion ou de comparaison** favorisent les communautés et les éditeurs de niche ; les prompts de **décision** (réserver un hôtel) favorisent les grands éditeurs, les agrégateurs et les **sites de marque** ([Similarweb](https://aisearch.similarweb.com/blog/most-cited-domains-llms/)) |
| **BrightLocal** (20 recherches dans 10 secteurs locaux) ✅ | AI Mode, Gemini, Perplexity, ChatGPT | Les **sites des entreprises** restent la première source. Tous les LLM utilisent des annuaires, dans tous les secteurs. Yelp apparaît dans 33 % des recherches. Dentisterie : annuaires spécialisés. Juridique : Superlawyers et FindLaw. Hôtellerie et restauration : médias lifestyle (Time Out). AI Mode s'appuie sur Google Business Profile, Instagram et Facebook ; Gemini ne cite pas Yelp ([BrightLocal](https://brightlocal.com/blog/ai-search-using-listings-sources)). Une étude plus large (1,9 M de citations, 116 670 domaines, août 2026) existe mais son texte n'a pas pu être lu ⚠️ ([BrightLocal](https://www.brightlocal.com/resources/ai-directory-sources/)) |
| **Partoo × Meteoria** (10 000 requêtes « supermarché + ville », février 2026, France) ✅ | ChatGPT, Perplexity, AI Overview | En France, les IA s'appuient sur les **store locators** des enseignes, les sites verticaux, les annuaires structurés, les sites locaux à forte autorité et les pages d'établissement bien construites. Les chiffres sont dans un graphique non lisible en texte ⚠️ ([JDN](https://www.journaldunet.com/retail/1547739-etude-partoo-meteoria-le-retail-a-l-epreuve-des-ia-qui-l-ia-choisit-elle-vraiment)) |

### 1.2 Ce qu'on en retient pour la conception

1. **Aucun domaine ne domine en absolu** : le premier pèse moins de 15 % des citations. La longue traîne est la norme. Il faut donc mesurer les sources **pour les requêtes du client**, pas plaquer un top 10 générique. Le marché le sait, et c'est notre argument face aux listes de blogs.
2. **La volatilité est forte** (rupture Semrush de septembre 2025). Il faut **dater** chaque mesure, comparer mois par mois et ne pas promettre qu'une source restera citée.
3. **Les IA diffèrent** : ChatGPT privilégie les encyclopédies, la presse et les comparatifs ; Perplexity et AI Mode privilégient l'UGC (Reddit, YouTube, LinkedIn) et les annuaires. On présente les sources **par IA** en plus de l'agrégat.
4. **En local**, le site de l'entreprise et les annuaires et plateformes d'avis verticaux dominent (PagesJaunes, Tripadvisor, TheFork, Doctolib, Planity, annuaires d'ordres professionnels). C'est la catégorie la plus **actionnable** : la plupart sont gratuites et rapides.
5. **En B2B**, les comparatifs (G2, Capterra, Appvizer), les listicles « meilleurs X » des médias spécialisés et LinkedIn pèsent beaucoup. **En e-commerce**, les marketplaces, les tests (Les Numériques, Que Choisir, Beauté Test), Reddit et YouTube dominent.
6. **L'intention compte** : les requêtes `review` et les comparatifs (« alternative à X ») tirent l'UGC et les comparatifs ; les requêtes `best` et `nearby` tirent les annuaires et les médias locaux. On garde donc l'intention de chaque citation.

---

## 2. Ce que font Peec, Profound et Otterly

| Outil | Présentation des sources | Ce qu'on reprend |
|---|---|---|
| **Peec AI** ✅ | Vue Domaines et vue URL. Métriques par domaine : **Retrieved %** (part des chats où au moins une URL du domaine a été consultée), **Retrieval rate**, **Cited %** (part des chats qui citent le domaine au moins une fois), **Citation share** (citations du domaine ÷ toutes les citations), **Citation rate**, **Total citations** ([docs](https://docs.peec.ai/domains)). Types de domaine : Corporate, Editorial, Institutional, UGC, Reference, Competitor, Other. **Types d'URL** : Homepage, Category, Product, Listicle, Comparison, Profile, Alternative, Discussion, How-to, Article ([docs](https://docs.peec.ai/metrics/source-metrics/source-types)). **Gap Analysis** : sources qui mentionnent des concurrents mais pas la marque, filtrables par modèle ([help](https://help.peec.ai/en/articles/13728212-how-can-i-use-the-gap-analysis)) | Distinction **consultée / citée**, Cited %, Citation share, **type de page**, gap analysis |
| **Otterly.ai** ✅ | Section « Domain Sources » : table des domaines avec catégorie et **coverage**, donut par catégorie, filtre « Moi + concurrents ». Catégories : Brand, News/Media, Government/NGO, Social Media, Community/Forum, Education, Encyclopedia, Video, Blogs, Competitor, Others. Catégories non modifiables par l'utilisateur ([help](https://help.otterly.ai/what-insights-can-i-gain-from-domain-citations-analysis)) | Donut par catégorie, filtre client et concurrents |
| **Profound** ✅ | Deux mesures : part de toutes les citations, et part au sein du top 10 de la plateforme ; analyses par plateforme ([blog](https://www.tryprofound.com/blog/ai-platform-citation-patterns)) | Ne jamais mélanger les deux dénominateurs ; afficher le dénominateur |

**Ce qui distingue Repéré** : ces outils s'arrêtent au constat (« ces domaines citent vos concurrents »). Aucun ne calcule une **faisabilité** ni ne fournit l'**action type en français pour une TPE ou une PME**, avec exécution. Nos catégories sont **orientées action** (annuaire, avis, comparatif…) plutôt qu'orientées nature éditoriale (corporate, editorial…).

---

## 3. Collecte

### 3.1 Champs collectés par citation

| Champ | Source | Remarque |
|---|---|---|
| `url` brute, `urlNorm` | API | voir §4.1 |
| `domain` (enregistrable), `host` | dérivé | `tldts.getDomain()` |
| `title` | API | absent ou réduit au domaine chez Gemini |
| `snippet` | API | Perplexity `snippet`, Claude `cited_text` (≤ 150 caractères), OpenAI : texte de la réponse entre `start_index` et `end_index` |
| `kind` | dérivé | `cited` (citée dans le texte), `retrieved` (consultée sans être citée), `inline` (URL ou domaine écrit dans le texte), `named` (plateforme nommée sans lien : « sur TheFork ») |
| `position` | dérivé | rang 1-based de **première apparition** dans la réponse (voir §3.3) |
| `provider`, `model`, `queryId`, `intent`, `run`, `at` | moteur | déjà dans `ProviderAnswer` |
| `answerSegment` | dérivé | indices du segment de réponse (élément de liste ou phrase) qui porte la citation, pour savoir **quelle entreprise** la source soutient |

### 3.2 Par API

| IA | Citées (`cited`) | Consultées (`retrieved`) | Titre / extrait / position | Modifs du provider |
|---|---|---|---|---|
| **OpenAI** (Responses + `web_search`) ✅ | `output[].content[].annotations[]` de type `url_citation` : `url`, `title`, `start_index`, `end_index` ([doc](https://developers.openai.com/fr-FR/api/docs/guides/tools-web-search)) | `include: ["web_search_call.action.sources"]` renvoie **toutes** les URL consultées, plus nombreuses que les citations ✅ | Position = ordre des `start_index`. Extrait = `text.slice(start, end)` élargi à la phrase | Ajouter `include`, renvoyer `sources[]` structuré. OpenAI ajoute souvent `?utm_source=openai` aux URL ⚠️ (observé, non documenté) : déjà retiré par `uniqueUrls` |
| **Perplexity** (Agent API) ✅ | `annotations[]` de type `citation` (`url`) ; marqueurs `[n]` ou `[web:n]` dans le texte | `output[type=search_results].results[]` : `id`, `title`, `url`, `snippet`, `date` ✅ (format exact ⚠️, `docs/04` §2) | Position = ordre de première apparition du marqueur `[n]` (à lire **avant** de retirer les marqueurs du texte, ce que fait le code actuel). `n` correspond à `results[].id` | Parser les marqueurs avant nettoyage, garder title et snippet |
| **Claude** (`web_search_20250305`) ✅ | blocs `text` → `citations[]` de type `web_search_result_location` : `url`, `title`, `cited_text` | `web_search_tool_result.content[]` : `url`, `title`, `page_age` (le contenu est chiffré) | Position = ordre des blocs texte portant la citation. Extrait = `cited_text` | Renvoyer title et cited_text |
| **Gemini sans ancrage** (défaut, `GEMINI_GROUNDING=off`) | **Rien** : pas d'annotations sans outil de recherche | — | Il reste ce que le modèle **écrit** : plateformes nommées (« selon PagesJaunes », « réservez sur TheFork ») et URL écrites en clair, souvent **inventées** ou périmées ([forum Google](https://discuss.ai.google.dev/t/gemini-fabricating-urls-even-with-search-grounding/66849)) | On ne garde que le **domaine**, en `kind: 'named'` ou `'inline'`, poids 0,5, jamais d'URL ni de vérification HTTP. Cela mesure la « mémoire » du modèle : utile comme signal faible (« Gemini associe votre métier à Doctolib ») |
| **Gemini avec ancrage** (`GEMINI_GROUNDING=on`) | `url_citation` (Interactions API) ou `groundingChunks[].web` (ancien format) | — | Les URL sont des **redirections** `https://vertexaisearch.cloud.google.com/grounding-api-redirect/…` et `title` contient **seulement le domaine** (« aljazeera ») ([forum Google](https://discuss.ai.google.dev/t/feature-request-provide-actual-source-urls-in-grounding-metadata/107352)). Aucune doc officielle sur la durée de vie ⚠️ | **Ne pas résoudre** les redirections (CGU : pas de suivi de clic, pas de collecte de liens pour constituer un index, pas d'analyse ni de stockage des Grounded Results). Exclure Gemini ancré du pilier Sources ; au mieux, afficher les sources à l'utilisateur dans la session, sans stockage ni score |

Sources supplémentaires extraites **de toutes les réponses** (toutes IA) :
- liens markdown `[x](https://…)` et URL nues (`kind: 'inline'`) ;
- **plateformes nommées** : l'extracteur LLM (`docs/03-methode-score.md` §4.6) renvoie déjà `platforms[]`. On les mappe vers un domaine via les libellés de `03-domains.json` (« PagesJaunes » → `pagesjaunes.fr`), en `kind: 'named'`.

### 3.3 Position
1. Si l'API donne des indices (`start_index`), position = rang de la première occurrence parmi les sources distinctes de la réponse.
2. Sinon, ordre des marqueurs `[n]` ou des blocs de citation.
3. Sinon (`retrieved` seul), `position = null` ; ces sources ne comptent que dans le **taux de consultation**.
On stocke aussi `supportsEntity` : le nom de l'entreprise (client ou concurrent) présente dans le même segment que la citation. C'est ce qui permet de dire « Perplexity recommande Plomberie Martin **en s'appuyant sur** sa fiche PagesJaunes ».

### 3.4 Conformité
- **Gemini ancré** : exclu (voir ci-dessus). Pour Gemini sans ancrage, aucune clause Grounded Results ne s'applique.
- **RGPD** : URL et titres peuvent contenir des noms d'artisans (entrepreneurs individuels). On conserve les `SourceCitation` brutes **90 jours**, puis seulement les agrégats `DomainStat` (domaine, comptes). Les extraits ne servent qu'au rendu.
- **Pas de scraping massif** : aucune exploration de site ; au plus une requête HTTP par URL prioritaire (§5.3).

---

## 4. Normalisation et classification

### 4.1 Normalisation d'URL (`normalizeUrl`)
1. `new URL()` ; refuser ce qui n'est pas `http(s)`.
2. Hôte en minuscules ; retirer `www.`, `m.`, `amp.`, `mobile.` ; décoder le punycode pour l'affichage seulement.
3. Retirer les paramètres de suivi : `utm_*`, `gclid`, `fbclid`, `msclkid`, `srsltid`, `ref`, `ref_src`, `mc_cid`, `mc_eid`, `_ga`, `igshid`, `si`. Garder les paramètres porteurs de sens (`?id=`, `?q=` sur un moteur interne).
4. Retirer le fragment `#…` **sauf** `#:~:text=` (on le retire aussi, mais on le garde dans `snippet` s'il y en a un).
5. Retirer `/amp` final et le `/` final (sauf racine).
6. Clé de dédoublonnage par réponse : `urlNorm`. Une même URL citée 3 fois dans une réponse compte **une fois** pour Cited % et **3 fois** pour Total citations (règle Peec).

### 4.2 Domaine enregistrable
`tldts` (embarque la Public Suffix List, ≈ 40 Ko, sans dépendance) : `getDomain('fr.trustpilot.com') = 'trustpilot.com'`, `getDomain('actu.fr')`, `.co.uk`, `.gouv.fr` gérés.

**Règles d'hôte** (prioritaires sur le domaine, `HOST_OVERRIDES`) :

| Hôte ou motif | Catégorie | Raison |
|---|---|---|
| `maps.google.*`, `google.*/maps`, `g.co/kgs`, `goo.gl/maps`, `maps.app.goo.gl` | `directory` (Google Maps) | fiche Google Business Profile |
| `play.google.com`, `apps.apple.com` | `marketplace` | stores |
| `maps.apple.com` | `directory` | Apple Business Connect |
| `forum.doctissimo.fr`, `forum.*`, `forums.*`, `communaute.*`, `community.*` | `forum` | sous-domaine communautaire d'un média |
| `france3-regions.francetvinfo.fr`, `*.actu.fr`, `actu.fr/<région>/<ville>` | `media_local` | éditions locales |
| `guide.michelin.com` | `comparison` | guide |
| `*.blogspot.com`, `*.wordpress.com`, `*.wixsite.com`, `*.myshopify.com`, `*.webflow.io` | à reclasser (§4.4) | sites d'entreprises hébergés |

### 4.3 Catégories

| Code | Libellé affiché | Exemples | Poids de base (W) local / B2B / e-com |
|---|---|---|---|
| `directory` | Annuaire / plateforme de fiches | PagesJaunes, Google Maps, Doctolib, Planity, annuaire RGE | 1,0 / 0,6 / 0,3 |
| `reviews` | Plateforme d'avis | Tripadvisor, TheFork, Trustpilot, G2, Avis Vérifiés | 1,0 / 0,9 / 0,9 |
| `media_national` | Média national ou spécialisé | Le Parisien, JDN, Les Échos, Marie Claire | 0,5 / 0,8 / 0,8 |
| `media_local` | Média local | Actu.fr, Le Bonbon, Ouest-France, Sortir à Paris | 0,9 / 0,4 / 0,3 |
| `comparison` | Comparatif, classement, guide, affiliation | Les Numériques, Capterra, Appvizer, Petit Futé, AlternativeTo | 0,7 / 1,0 / 1,0 |
| `forum` | Forum, Reddit, Q&R | Reddit, Quora, CommentÇaMarche, Forum Construire | 0,5 / 0,8 / 0,9 |
| `marketplace` | Marketplace | Amazon, Cdiscount, Uber Eats, Malt, Booking | 0,3 / 0,4 / 1,0 |
| `social` | Réseau social / plateforme vidéo | Facebook, Instagram, LinkedIn, YouTube, TikTok | 0,6 / 0,7 / 0,8 |
| `competitor` | Site d'un concurrent | domaine d'un concurrent extrait | 0 (alimente le pilier « Pourquoi ») |
| `client` | Votre site | domaine saisi | 0 (statistique « votre site est cité ») |
| `wikipedia` | Wikipédia et encyclopédies | Wikipédia, Wikidata, Larousse | 0,2 / 0,5 / 0,4 |
| `institutional` | Institutionnel | service-public.fr, CCI, CMA, office de tourisme, ordres | 0,4 / 0,4 / 0,2 |
| `other` | Autre | blogs, sites d'outils | 0,3 / 0,3 / 0,3 |

Le segment (local, B2B, e-commerce) est celui du parcours choisi à l'inscription (brief V2).

### 4.4 Pipeline de classification (`classifyDomain`)
Par ordre de priorité, le premier qui répond gagne :
1. **Client** : `domain === registrableDomain(input.website)` ou domaine déclaré dans les variantes.
2. **Concurrent** : domaine associé à une entité concurrente (`ExtractedEntity.url`), ou label du domaine qui contient le `core` normalisé d'un concurrent (« plomberie-martin.fr » ↔ « Plomberie Martin », Jaro-Winkler ≥ 0,9 sur le label sans tirets).
3. **Règles d'hôte** (§4.2).
4. **Table** `03-domains.json` : correspondance exacte sur l'hôte, puis sur le domaine enregistrable.
5. **Cache global** Supabase `domain_catalog` (classements déjà faits pour d'autres clients, §4.6).
6. **Heuristique de repli** (§4.5).
7. **LLM en lot** pour les domaines non classés vus au moins 2 fois dans l'audit (§4.6).
8. Sinon `other`, `confidence: 'low'`.

### 4.5 Heuristique de repli
Appliquée sur `host`, `path`, `title` et `snippet` normalisés (`norm()` du §4.1 de la méthode). Score par catégorie, la plus forte l'emporte (≥ 2 points requis, sinon `other`).

| Signal | Points |
|---|---|
| TLD ou suffixe `.gouv.fr`, `.gouv`, `.gov`, `.gov.*`, `.edu`, `.ac.*`, `.int`, `europa.eu`, `.mil` ; label `mairie-`, `ville-`, `cci`, `cma-`, `prefecture`, `tourisme`, `office-de-tourisme`, `region-`, `departement` | institutional +3 |
| label contient `annuaire`, `directory`, `pages`, `listing`, `118`, `trouver`, `pro-`, `artisans-`, `-pros` ; chemin `/annuaire/`, `/pro/`, `/fiche/`, `/etablissement/`, `/biz/`, `/place/` | directory +2 |
| label ou chemin `avis`, `review`, `reviews`, `note`, `temoignage`, `opinion` ; titre « avis clients », « X avis » | reviews +2 |
| label ou chemin `compar`, `meilleur`, `top`, `classement`, `versus`, `-vs-`, `test`, `guide`, `alternative` ; titre « Les 10 meilleurs… », « Comparatif… » | comparison +2 (et `pageType = listicle/comparison/alternative`) |
| label ou chemin `forum`, `communaute`, `community`, `discussion`, `topic`, `thread`, `/t/`, `/r/`, `question` | forum +3 |
| label `journal`, `actu`, `info`, `presse`, `news`, `mag`, `magazine`, `tribune`, `matin`, `republicain`, `depeche`, `courrier`, `gazette`, `echo`, `hebdo` ; chemin daté `/2026/11/` | média +2, puis **local** si le label, le titre ou le chemin contient une ville, un département ou une région (liste INSEE), sinon **national** |
| label `shop`, `boutique`, `store`, `market`, `achat`, `vente` ; chemin `/produit/`, `/p/`, `/dp/`, `/product/`, `/vendeur/` | marketplace +1 (≥ 2 seulement si plusieurs vendeurs détectés dans le titre ou l'extrait, sinon c'est probablement un **site marchand concurrent**) |
| titre ou extrait contient le **métier** (`TRADES`) + une adresse ou un téléphone, page d'accueil (`path` vide) | `competitor` probable (+2), « acteur du secteur non cité nommément » |
| hôte sur une plateforme de site (`*.wixsite.com`…) | `competitor` ou `client` selon le nom, sinon `other` |

### 4.6 Classification LLM en lot et cache global
- Un seul appel par audit, avec le modèle d'extraction le moins cher, `temperature: 0`, JSON strict. Entrée : jusqu'à 30 domaines inconnus, chacun avec 1 ou 2 couples (titre, extrait, chemin). Sortie : `{domain, category, label, pageType, confidence}`.
- Le résultat va dans `domain_catalog` (Supabase) avec `source: 'llm'`, `confidence`, `seenCount`. Un domaine classé en LLM vu par 3 audits distincts avec la même catégorie passe en `confirmed`. Revue manuelle mensuelle des 50 domaines les plus vus : c'est ainsi que la table grossit (objectif : 2 000 domaines français en 6 mois).
- Coût : environ 1 500 jetons en entrée, 600 en sortie, soit ≈ 0,0005 €.

### 4.7 Type de page (à la Peec)
`pageType ∈ homepage | profile | listicle | comparison | alternative | discussion | article | product | category | other`. Règles : `path` vide → homepage ; `directory`/`reviews` + chemin d'établissement → profile ; titre « meilleurs », « top N », « les N » → listicle ; « vs », « comparatif » → comparison ; « alternative(s) à » → alternative ; forum → discussion ; `/produit/`, `/dp/` → product. Le type de page détermine l'**unité d'action** (§6.3).

---

## 5. Présence du client (et des concurrents) sur une source

Trois niveaux, du gratuit au plus coûteux. On s'arrête au premier niveau concluant.

### 5.1 Niveau 0 : ce que l'IA renvoie déjà (gratuit, systématique)
- On applique `detectMention` (méthode §4.3, mêmes variantes et seuils) au **titre**, à l'**extrait** et à l'**URL** (slug : « /plomberie-dupont-paris-11 »).
- Domaine de la source = domaine du client → `presence: 'own'`.
- Le segment de réponse qui porte la citation mentionne le client (`supportsEntity`) → `presence: 'present'`, preuve « l'IA vous cite en s'appuyant sur cette source ».
- Même traitement pour chaque **concurrent** du top 10 (`CompetitorStat`), avec ses variantes.

### 5.2 Niveau 1 : auto-déclaration du client (gratuit, dans le rapport)
Sur chaque carte, deux boutons : « J'y suis déjà » et « Je n'y suis pas ». La réponse est stockée par `(businessId, domain)` et prime sur l'inférence pour les **sources à fiche** (annuaire, avis, marketplace, réseau social). C'est la seule voie pour les plateformes qu'on ne requête pas (§5.3).

### 5.3 Niveau 2 : vérification HTTP légère (optionnelle)
Réservée aux **URL des 10 sources prioritaires** dont la présence est `unknown` après les niveaux 0 et 1. Au plus 10 requêtes par audit gratuit, 20 en suivi.
1. **robots.txt** : `GET https://host/robots.txt` (cache 24 h par hôte, dans Supabase). Analyse avec `robots-parser` pour `User-agent: RepereBot` puis `*`. Si l'URL est interdite → `unknown`, raison « robots.txt ».
2. **Requête unique** : `GET` de l'URL normalisée, en-têtes `User-Agent: RepereBot/1.0 (+https://repere.fr/bot)`, `Accept: text/html`, `Accept-Language: fr-FR`. Délai 5 s, 3 redirections au plus, corps lu jusqu'à 1,5 Mo puis coupé, uniquement `text/html`. Une requête par hôte et par audit, avec un intervalle d'au moins 1 s entre hôtes du même domaine. Ni rendu JavaScript, ni cookies, ni connexion, ni contournement de paywall ou d'anti-bot.
3. **Analyse** : retirer `<script>`, `<style>`, `<nav>`, `<footer>` ; extraire le texte visible et les `href` ; chercher les variantes du client et de chaque concurrent, le domaine du client dans les liens, et le téléphone si connu. Résultat : `present` (correspondance exacte ou floue ≥ seuil), `absent` (page lisible d'au moins 2 000 caractères, sans correspondance), `unknown` (403, 429, captcha, page vide, rendu JS, corps < 2 000 caractères).
4. **Liste « ne jamais requêter »** (`NO_FETCH`) : `google.*`, `facebook.com`, `instagram.com`, `linkedin.com`, `x.com`, `tiktok.com`, `reddit.com` (accès automatisé réservé à leur API sous conditions), `amazon.*`, `tripadvisor.*`, `yelp.*`, `thefork.*`, `doctolib.fr`, `leboncoin.fr`, et tout domaine `wikipedia` (on préfère l'API MediaWiki si besoin). Pour ces domaines, présence = niveau 0 ou niveau 1, sinon `unknown`, affiché « À vérifier : cherchez votre nom sur … ».
5. Résultats mis en cache 30 jours par `(urlNorm, entité)` ; on ne stocke que le verdict, jamais le HTML.

### 5.4 Présence au niveau domaine ou au niveau URL
- **Sources à fiche** (`directory`, `reviews`, `marketplace`, `social`) : la question est « avez-vous une fiche sur ce domaine ? ». L'URL citée est souvent une page de liste (« plombiers Paris 11 ») : y figurer ou non dépend de la fiche, du classement et des avis.
- **Sources éditoriales** (`media_*`, `comparison`, `forum`, `wikipedia`) : la question est « êtes-vous **sur cette page** ? ». L'action vise la page (ou une page équivalente).
Chaque `SourceOpportunity` porte donc `presenceScope: 'domain' | 'url'`.

### 5.5 Gap concurrentiel
`competitorsPresent` = concurrents trouvés présents (niveaux 0 ou 2) sur l'URL ou le domaine. **Gap** = au moins un concurrent présent et client absent ou inconnu. C'est le message le plus fort du rapport (« 3 concurrents y sont, pas vous »).

---

## 6. Scores

### 6.1 Statistiques par domaine (`DomainStat`)
Notations : *A* = réponses valides (`!error && !demo`) **ayant au moins une source citée** ; *A_p* = idem pour l'IA *p*.

| Métrique | Définition |
|---|---|
| `citedAnswers` | nombre de réponses de *A* qui citent le domaine au moins une fois (`kind ∈ cited, inline`) |
| `citedRate` (Cited %) | `citedAnswers / |A|` |
| `totalCitations` | nombre de citations du domaine (dédoublonnées par URL et par réponse) |
| `citationShare` | `totalCitations / Σ totalCitations` de tous les domaines (dénominateur affiché) |
| `retrievedRate` | part des réponses où une URL du domaine est consultée (`retrieved`), quand l'API la fournit (OpenAI, Perplexity, Claude) |
| `providerCoverage` | `|{p : domaine cité par p}| / |{p : A_p non vide}|` |
| `avgPosition` | moyenne des positions quand cité |
| `intents` | intentions des requêtes qui le citent |
| `namedOnly` | domaine seulement nommé (Gemini sans ancrage) : compté à part, poids 0,5, jamais seul dans le top 10 |

Agrégation en pool (règle Otterly) : on additionne numérateurs et dénominateurs, jamais de moyenne de pourcentages.

### 6.2 Score d'opportunité
Pour chaque **unité d'action** (§6.3) :

```
O = 100 × F × W × A × X
```

| Facteur | Formule | Commentaire |
|---|---|---|
| **F** fréquence | `F = 0,7 · √min(1, citedRate / 0,30) + 0,3 · providerCoverage` ; `× 0,5` si `citedAnswers < 2` ; `+0,1` (plafond 1) si la source est citée en position 1 ou 2 dans au moins 2 réponses | racine carrée : on récompense la présence sans écraser la longue traîne. 30 % de réponses = fréquence maximale |
| **W** poids catégorie | tableau §4.3 selon le segment ; `× 1,15` si la source est citée pour l'intention prioritaire du segment (local : `best`/`nearby` ; B2B et e-com : comparaison, alternative) | |
| **A** absence | `1,0` gap (concurrent présent, client absent) ; `0,85` absent sans concurrent ; `0,6` inconnu ; `0,25` présent sur le domaine mais pas sur l'URL citée (listicle) ; `0` déjà présent sur l'URL (devient une tâche « consolider », hors top 10) | |
| **X** faisabilité | base par catégorie (§6.4) × `1,1` si `howToGetListed` connu × `0,7` si l'accès est payant ou à commission × `0,5` si l'éligibilité est incertaine (Wikipédia, ordre professionnel, RGE sans qualification) | |

Classement : `O` décroissant, puis `citedRate`, puis `avgPosition`.

**Effort** (affiché) : `S` (moins d'1 h, X ≥ 0,8), `M` (1 h à 1 jour, 0,4 ≤ X < 0,8), `L` (plusieurs semaines ou dépend d'un tiers, X < 0,4).
**Impact** (1 à 3 étoiles) : tertiles de `F × W` sur les opportunités de l'audit (minimum 1 étoile si gap).

### 6.3 Unité d'action
- `directory`, `reviews`, `marketplace`, `social`, `institutional` : **domaine** (une fiche).
- `comparison`, `media_*`, `forum`, `wikipedia` : **URL** (un article, un fil). Si plusieurs URL d'un même domaine, on garde la plus citée et on mentionne les autres (« et 2 autres pages de ce site »).
- `competitor` : pas une opportunité. Alimente le pilier « Pourquoi » (« le site de Martin est cité 7 fois : sa page "Recherche de fuite Paris 11" est la source ») et suggère une page équivalente sur le site du client.
- `client` : statistique « Votre site est cité dans X % des réponses » et les pages concernées.

### 6.4 Action type par catégorie

| Catégorie | X de base | Verbe (titre de la carte) | Comment y entrer (étapes types) | Garde-fous |
|---|---|---|---|---|
| `directory` | 1,0 | **S'inscrire sur** {label} | 1. Créer ou revendiquer la fiche (`howToGetListed`). 2. Nom, adresse et téléphone **identiques** au site et à Google. 3. Catégories, services, horaires, photos, lien vers le site. | Cohérence NAP ; refuser les offres « premium » sans preuve de retour |
| `reviews` | 0,8 | **Obtenir des avis sur** {label} | 1. Revendiquer la page. 2. Demander un avis à **chaque** client réel, sans filtrage ni contrepartie (QR code, e-mail post-prestation). 3. Répondre à tous les avis. | Faux avis interdits (pratique commerciale trompeuse, art. L121-4 du Code de la consommation) ; Yelp interdit la sollicitation |
| `comparison` | 0,4 | **Être ajouté au comparatif** {label} | 1. Contacter l'auteur avec un argumentaire factuel (prix, différenciation, preuves). 2. Pour les plateformes à profil (Capterra, Appvizer, AlternativeTo), créer le profil et collecter des avis. 3. Fournir un produit ou un accès de test si pertinent. | Toute place payante doit être signalée « sponsorisé » ; on l'indique au client |
| `media_local` | 0,4 | **Proposer un sujet à** {label} | 1. Trouver un angle d'actualité locale (ouverture, anniversaire, recrutement, événement, chiffre). 2. Communiqué court + photos. 3. Envoyer au journaliste local (rubrique ville). | Pas de promesse de publication |
| `media_national` | 0,15 | **Proposer un article ou une expertise à** {label} | 1. Repérer l'auteur de la page citée. 2. Proposer une donnée exclusive ou un avis d'expert. 3. Diffuser via plateformes de communiqués si actualité réelle. | Idem |
| `forum` | 0,5 | **Répondre sur** {label} (Reddit, forum) | 1. Compte identifié (« je suis plombier à Paris 11e »). 2. Réponses utiles **sans lien** dans un premier temps. 3. Respecter les règles du forum ou du subreddit ; jamais de faux comptes ni de votes achetés. | Repéré **ne poste jamais** à la place du client : on rédige un brouillon, le client publie |
| `marketplace` | 0,6 | **Vendre ou se référencer sur** {label} | 1. Ouvrir un compte vendeur. 2. Fiches produits complètes (titres explicites, attributs, photos, GTIN). 3. Avis acheteurs. | Calcul de marge (commissions) avant de recommander |
| `social` | 0,9 | **Compléter votre présence sur** {label} | 1. Profil pro avec nom, adresse, catégorie, lien. 2. 4 publications utiles par mois. 3. Pour YouTube et LinkedIn : contenus d'expertise. | — |
| `wikipedia` | 0,05 | **Vérifier votre admissibilité à** Wikipédia | 1. Vérifier les critères (sources secondaires indépendantes). 2. Si admissible, demander via la page de discussion, conflit d'intérêts déclaré. 3. Sinon, viser Wikidata ou les médias. | Ne jamais rédiger sa propre page ; quasi jamais pertinent pour une TPE |
| `institutional` | 0,3 | **Vous faire référencer par** {label} | 1. Vérifier l'éligibilité (RGE, Qualiopi, office de tourisme, CCI, CMA). 2. Constituer le dossier. 3. Mettre à jour la fiche officielle. | Éligibilité réelle uniquement |
| `other` | 0,3 | **Analyser** {label} | Lecture de la page, action au cas par cas | — |

« On le fait pour vous » est proposé pour : `directory` (création ou mise à jour de fiches, avec mandat du client), `reviews` (campagne de demande d'avis par e-mail ou SMS, réponses rédigées), `social` (complétion des profils), `media_local` (communiqué rédigé), `comparison` (e-mail d'approche rédigé), `forum` (brouillon de réponse que le client publie lui-même).

---

## 7. Rendu « Vos 10 sources prioritaires »

### 7.1 Sélection
1. Opportunités avec `O > 0`, hors `competitor` et `client`, hors `namedOnly` seul.
2. Diversité : au plus 3 cartes par catégorie, une par domaine.
3. Au moins une action d'effort `S` parmi les 3 premières (« victoire rapide »).
4. Moins de 10 opportunités : on complète avec les **sources de référence du métier** (`03-domains.json` filtré par segment et métier, marquées « recommandée pour votre secteur, non citée dans cet audit »), visuellement distinctes.
5. Audit gratuit : 3 cartes complètes + 7 domaines visibles avec catégorie et score, détails floutés. Suivi : les 10 + toutes les sources, avec évolution mois par mois de la citation share.

### 7.2 Contenu d'une carte

```
#1  PagesJaunes · Annuaire                          Impact ★★★  Effort S (≈ 30 min)
Pourquoi : cité dans 11 réponses sur 46 (24 %), par ChatGPT et Perplexity, souvent en
  2e position, pour « meilleur plombier Paris 11e » et « plombier près de Bastille ».
  Plomberie Martin et Dupont & Fils y ont une fiche ; vous n'apparaissez pas.
Comment y entrer :
  1. Créez ou revendiquez votre fiche gratuite (espace pro Solocal).
  2. Même nom, adresse et téléphone que sur votre site et Google.
  3. Ajoutez vos services « recherche de fuite », « débouchage », des photos et vos horaires.
Présence : Absent (vérifié le 09/11) · [J'y suis déjà]
[On le fait pour vous]   [Voir les 11 réponses]
```

Textes générés **par gabarit** (pas de LLM) à partir des champs : `why` = phrase de fréquence + IA + intention + gap ; `how` = `howToGetListed` de la table, sinon étapes types de la catégorie (§6.4) ; mention explicite du dénominateur.

### 7.3 Autres vues du pilier
- **Donut par catégorie** (part des citations) et sa version par IA.
- **Table des domaines** (vue Peec) : domaine, catégorie, Cited %, citation share, IA, position moyenne, présence client, concurrents présents.
- **« Vos concurrents s'appuient sur… »** : pour chaque concurrent du top 5, les 3 sources qui soutiennent ses mentions (`supportsEntity`).
- **Votre site** : part des réponses qui citent votre domaine et pages citées.
- Mention de méthode : « Sources relevées via les API officielles de ChatGPT, Perplexity et Claude, le JJ/MM. Gemini : plateformes nommées seulement. Les sources citées varient fortement d'un mois à l'autre. »

---

## 8. Types et pseudo-code TypeScript

Ajouts **additifs** à `src/lib/engine/types.ts` et `providers/http.ts` (champs optionnels, contrat V1 intact). Nouveau module `src/lib/engine/sources/` : `normalize.ts`, `classify.ts`, `presence.ts`, `score.ts`, `index.ts`, et `data/domains.json` (copie de `docs/v2/03-domains.json`). Dépendances : `tldts`, `robots-parser`.

```ts
// ---------- types.ts (ajouts) ----------
export type SourceCategory =
  | 'directory' | 'reviews' | 'media_national' | 'media_local' | 'comparison' | 'forum'
  | 'marketplace' | 'social' | 'competitor' | 'client' | 'wikipedia' | 'institutional' | 'other';

export type SourceKind = 'cited' | 'retrieved' | 'inline' | 'named';
export type PageType = 'homepage' | 'profile' | 'listicle' | 'comparison' | 'alternative'
  | 'discussion' | 'article' | 'product' | 'category' | 'other';
export type Presence = 'own' | 'present' | 'absent' | 'unknown';
export type Segment = 'local' | 'b2b' | 'ecom';

/** Source brute renvoyée par un provider (providers/http.ts → AskResult.sources). */
export interface RawSource {
  url: string;
  title?: string;
  snippet?: string;
  kind: SourceKind;
  /** index du premier caractère cité dans le texte de la réponse, si connu */
  startIndex?: number;
  endIndex?: number;
  /** ordre d'apparition fourni par l'API ([n] Perplexity, ordre des blocs Claude) */
  order?: number;
}

/** Une citation, après normalisation et classification. Clé : (answerKey, urlNorm). */
export interface SourceCitation {
  provider: ProviderId;
  model?: string;
  queryId: string;
  intent: QueryIntent | string;
  run: number;
  at?: string;
  url: string;
  urlNorm: string;
  host: string;
  domain: string;
  title?: string;
  snippet?: string;
  kind: SourceKind;
  position: number | null;
  occurrences: number;               // nombre de fois citée dans la réponse
  category: SourceCategory;
  categorySource: 'client' | 'competitor' | 'rule' | 'table' | 'catalog' | 'heuristic' | 'llm' | 'default';
  categoryConfidence: 'high' | 'medium' | 'low';
  pageType: PageType;
  label: string;                     // libellé affichable (« PagesJaunes »)
  /** entreprises (client ou concurrents) nommées dans le segment qui porte la citation */
  supportsEntities: string[];
  clientPresence: Presence;          // niveau 0 uniquement à ce stade
  competitorsPresent: string[];      // niveau 0
}

export interface DomainStat {
  domain: string;
  label: string;
  category: SourceCategory;
  citedAnswers: number;
  citedRate: number;
  totalCitations: number;
  citationShare: number;
  retrievedRate: number | null;
  byProvider: Partial<Record<ProviderId, { citedAnswers: number; citedRate: number }>>;
  providerCoverage: number;
  avgPosition: number | null;
  intents: string[];
  topUrls: { urlNorm: string; title?: string; count: number; pageType: PageType }[];
  namedOnly: boolean;
  clientPresence: Presence;
  competitorsPresent: string[];
}

export interface SourceOpportunity {
  id: string;                        // `${domain}` ou `${domain}|${urlNorm}`
  scope: 'domain' | 'url';
  domain: string;
  url?: string;
  label: string;
  category: SourceCategory;
  pageType: PageType;
  stat: DomainStat;
  presence: Presence;
  presenceEvidence: 'api_text' | 'answer_segment' | 'http_check' | 'self_declared' | 'none';
  competitorsPresent: string[];
  factors: { F: number; W: number; A: number; X: number };
  score: number;                     // 0..100
  effort: 'S' | 'M' | 'L';
  impact: 1 | 2 | 3;
  action: { verb: string; title: string; why: string; how: string[]; doneForYou: boolean; paid: boolean };
  /** source recommandée pour le secteur mais non citée dans l'audit */
  fallback?: boolean;
}

export interface SourcesReport {
  method: 'repere-sources-v1.0';
  answersWithSources: number;
  totalCitations: number;
  domains: DomainStat[];
  byCategory: Record<SourceCategory, { citations: number; share: number }>;
  clientSite: { citedAnswers: number; citedRate: number; urls: string[] };
  competitorSources: { competitor: string; domains: string[] }[];
  opportunities: SourceOpportunity[];   // toutes, triées
  top10: SourceOpportunity[];
  excludedProviders: { provider: ProviderId; reason: string }[];  // ex. Gemini ancré
}

// ProviderAnswer += sources?: RawSource[]   (citations: string[] reste rempli pour la V1)
// AuditResult    += sources?: SourcesReport
// AskResult      += sources?: RawSource[]
```

```ts
// ---------- sources/normalize.ts ----------
import { parse } from 'tldts';
const TRACKING = /^(utm_|gclid$|fbclid$|msclkid$|srsltid$|ref$|ref_src$|mc_cid$|mc_eid$|_ga$|igshid$|si$)/;

export function normalizeUrl(raw: string): { urlNorm: string; host: string; domain: string; path: string } | null {
  let u: URL;
  try { u = new URL(raw.trim()); } catch { return null; }
  if (!/^https?:$/.test(u.protocol)) return null;
  const host = u.hostname.toLowerCase().replace(/^(www|m|amp|mobile)\./, '');
  for (const k of [...u.searchParams.keys()]) if (TRACKING.test(k)) u.searchParams.delete(k);
  u.hash = '';
  let path = u.pathname.replace(/\/amp\/?$/, '').replace(/\/+$/, '') || '';
  const domain = parse(host).domain ?? host;     // domaine enregistrable (PSL)
  const qs = u.searchParams.toString();
  return { urlNorm: `https://${host}${path}${qs ? `?${qs}` : ''}`, host, domain, path };
}

export function isGeminiRedirect(url: string): boolean {
  return url.includes('vertexaisearch.cloud.google.com/grounding-api-redirect');
}
```

```ts
// ---------- sources/collect.ts ----------
/** Construit les SourceCitation d'une réponse. N'appelle aucun réseau. */
export function collectSources(
  ans: ProviderAnswer & { sources?: RawSource[] },
  query: QuerySpec,
  ctx: { client: Variants; competitors: Map<string, Variants>; clientDomain?: string;
         platformsNamed: string[]; segment: Segment; groundedGemini: boolean },
): SourceCitation[] {
  if (ans.error || ans.demo) return [];
  if (ans.provider === 'gemini' && ctx.groundedGemini) return [];   // CGU : exclu (§3.4)

  const raw: RawSource[] = [
    ...(ans.sources ?? ans.citations.map((url, i) => ({ url, kind: 'cited' as const, order: i }))),
    ...extractInlineUrls(ans.text).map((url) => ({ url, kind: 'inline' as const })),
    ...ctx.platformsNamed.flatMap((p) => {
      const d = domainFromPlatformLabel(p);           // via labels de domains.json
      return d ? [{ url: `https://${d}`, kind: 'named' as const }] : [];
    }),
  ];

  const byUrl = new Map<string, SourceCitation>();
  const segments = splitSegments(ans.text);             // méthode §4.5
  for (const r of raw) {
    if (isGeminiRedirect(r.url)) continue;
    const n = normalizeUrl(r.url);
    if (!n) continue;
    const prev = byUrl.get(n.urlNorm);
    if (prev) { prev.occurrences++; if (rank(r.kind) < rank(prev.kind)) prev.kind = r.kind; continue; }
    const seg = r.startIndex != null ? segmentAt(segments, r.startIndex) : null;
    const cls = classifyDomain(n, { title: r.title, snippet: r.snippet }, ctx);
    const textForPresence = [r.title, r.snippet, decodeURIComponent(n.path).replace(/[-_/]/g, ' ')].join(' ');
    const supports = seg ? entitiesIn(seg.text, ctx) : [];
    byUrl.set(n.urlNorm, {
      provider: ans.provider, model: ans.model, queryId: ans.queryId, intent: query.intent, run: ans.run, at: ans.at,
      url: r.url, urlNorm: n.urlNorm, host: n.host, domain: n.domain, title: r.title, snippet: r.snippet,
      kind: r.kind, position: null, occurrences: 1, ...cls,
      supportsEntities: supports,
      clientPresence: cls.category === 'client' ? 'own'
        : detectMention(textForPresence, ctx.client).mentioned || supports.includes(CLIENT) ? 'present' : 'unknown',
      competitorsPresent: [...ctx.competitors].filter(([, v]) => detectMention(textForPresence, v).mentioned).map(([k]) => k),
    });
  }
  assignPositions([...byUrl.values()], raw);            // startIndex → order → null (§3.3)
  return [...byUrl.values()];
}
```

```ts
// ---------- sources/classify.ts ----------
import TABLE from '../data/domains.json';
const BY_DOMAIN = new Map(TABLE.map((d) => [d.domain, d]));

export function classifyDomain(n: NormUrl, meta: { title?: string; snippet?: string }, ctx: ClassifyCtx) {
  if (ctx.clientDomain && n.domain === ctx.clientDomain) return cls('client', 'client', 'high', n.domain);
  const comp = matchCompetitorDomain(n.domain, ctx.competitors);          // url extraite ou slug ≈ core
  if (comp) return cls('competitor', 'competitor', 'high', comp);
  const rule = HOST_OVERRIDES.find((r) => r.test(n.host, n.path));          // §4.2
  if (rule) return cls(rule.category, 'rule', 'high', rule.label);
  const hit = BY_DOMAIN.get(n.host) ?? BY_DOMAIN.get(n.domain);
  if (hit) return cls(hit.category as SourceCategory, 'table', 'high', hit.label, hit.howToGetListed);
  const cached = ctx.catalog.get(n.domain);                                 // domain_catalog (préchargé)
  if (cached) return cls(cached.category, 'catalog', cached.confidence, cached.label);
  const h = heuristicCategory(n, meta, ctx);                                // §4.5, score ≥ 2
  if (h) return cls(h.category, 'heuristic', 'medium', prettyDomain(n.domain));
  return cls('other', 'default', 'low', prettyDomain(n.domain));            // candidat au lot LLM
}
// + pageTypeOf(n, meta, category) (§4.7)
// + classifyUnknownWithLlm(domains, extractor) : un appel JSON, résultats upsert dans domain_catalog
```

```ts
// ---------- sources/score.ts ----------
const W: Record<Segment, Record<SourceCategory, number>> = { /* tableau §4.3 */ } as never;
const X0: Record<SourceCategory, number> = {
  directory: 1, reviews: 0.8, social: 0.9, marketplace: 0.6, forum: 0.5, comparison: 0.4,
  media_local: 0.4, institutional: 0.3, other: 0.3, media_national: 0.15, wikipedia: 0.05, competitor: 0, client: 0,
};
const ABSENCE = { gap: 1, absent: 0.85, unknown: 0.6, domainOnly: 0.25, present: 0 };

export function aggregateDomains(cits: SourceCitation[], answersWithSources: number, providers: ProviderId[]): DomainStat[] {
  // groupBy domain ; citedAnswers = nb de clés (provider|queryId|run) distinctes avec kind ∈ {cited, inline}
  // totalCitations = Σ occurrences (kind ∈ {cited, inline}) ; citationShare = total / Σ total
  // retrievedRate = réponses avec kind = retrieved / réponses des providers qui fournissent retrieved
  // namedOnly = toutes les citations du domaine sont kind = named
  // clientPresence : own > present > absent > unknown ; competitorsPresent = union
}

export function scoreOpportunity(s: DomainStat, unit: Unit, seg: Segment, prioIntents: string[]): SourceOpportunity | null {
  if (s.category === 'client' || s.category === 'competitor') return null;
  let F = 0.7 * Math.sqrt(Math.min(1, s.citedRate / 0.3)) + 0.3 * s.providerCoverage;
  if (s.citedAnswers < 2) F *= 0.5;
  if (unit.topPositions >= 2) F = Math.min(1, F + 0.1);
  if (s.namedOnly) F *= 0.5;
  let w = W[seg][s.category];
  if (s.intents.some((i) => prioIntents.includes(i))) w = Math.min(1, w * 1.15);
  const A = unit.presence === 'present' || unit.presence === 'own' ? ABSENCE.present
    : unit.presentOnDomainOnly ? ABSENCE.domainOnly
    : unit.competitorsPresent.length && unit.presence !== 'unknown' ? ABSENCE.gap
    : unit.competitorsPresent.length ? 0.8                      // gap probable, présence client inconnue
    : unit.presence === 'absent' ? ABSENCE.absent : ABSENCE.unknown;
  let X = X0[s.category] * (unit.howToGetListed ? 1.1 : 1) * (unit.paid ? 0.7 : 1) * (unit.eligibilityUncertain ? 0.5 : 1);
  X = Math.min(1, X);
  const score = Math.round(100 * F * w * A * X);
  if (score <= 0) return null;
  return { /* … */ factors: { F, W: w, A, X }, score, effort: X >= 0.8 ? 'S' : X >= 0.4 ? 'M' : 'L', impact: 1, action: buildAction(s, unit) } as SourceOpportunity;
}

export function pickTop10(opps: SourceOpportunity[], fallbacks: SourceOpportunity[]): SourceOpportunity[] {
  const sorted = [...opps].sort((a, b) => b.score - a.score || b.stat.citedRate - a.stat.citedRate
    || (a.stat.avgPosition ?? 99) - (b.stat.avgPosition ?? 99));
  const out: SourceOpportunity[] = []; const perCat = new Map<SourceCategory, number>(); const doms = new Set<string>();
  for (const o of sorted) {
    if (out.length === 10) break;
    if (doms.has(o.domain) || (perCat.get(o.category) ?? 0) >= 3 || o.stat.namedOnly) continue;
    out.push(o); doms.add(o.domain); perCat.set(o.category, (perCat.get(o.category) ?? 0) + 1);
  }
  if (!out.slice(0, 3).some((o) => o.effort === 'S')) promoteFirstQuickWin(out, sorted);   // §7.1
  for (const f of fallbacks) { if (out.length >= 10) break; if (!doms.has(f.domain)) out.push({ ...f, fallback: true }); }
  assignImpactTertiles(out);    // tertiles de F × W ; minimum 2 étoiles si gap
  return out;
}
```

```ts
// ---------- sources/presence.ts (niveau 2, optionnel) ----------
const NO_FETCH = /(^|\.)(google\.[a-z.]+|facebook\.com|instagram\.com|linkedin\.com|x\.com|twitter\.com|tiktok\.com|reddit\.com|amazon\.[a-z.]+|tripadvisor\.[a-z.]+|yelp\.[a-z.]+|thefork\.[a-z.]+|doctolib\.fr|leboncoin\.fr|wikipedia\.org)$/;
const UA = 'RepereBot/1.0 (+https://repere.fr/bot)';

export async function verifyPresence(url: string, entities: Map<string, Variants>, opts = { timeoutMs: 5000, maxBytes: 1_500_000 })
  : Promise<Record<string, Presence> & { _reason?: string }> {
  const n = normalizeUrl(url); if (!n || NO_FETCH.test(n.host)) return unknownAll(entities, 'plateforme non vérifiable');
  const cached = await presenceCache.get(n.urlNorm); if (cached) return cached;
  const robots = await getRobots(n.host);                        // cache 24 h, robots-parser
  if (robots && !robots.isAllowed(n.urlNorm, 'RepereBot')) return unknownAll(entities, 'robots.txt');
  const res = await fetchWithLimits(n.urlNorm, { headers: { 'User-Agent': UA, Accept: 'text/html', 'Accept-Language': 'fr-FR' },
    redirect: 'follow' /* ≤ 3 */, ...opts });
  if (!res.ok || !res.contentType.startsWith('text/html')) return unknownAll(entities, `HTTP ${res.status}`);
  const text = visibleText(res.body);                            // retire script/style/nav/footer
  if (text.length < 2000) return unknownAll(entities, 'page vide ou rendue en JavaScript');
  const out: Record<string, Presence> = {};
  for (const [name, v] of entities) out[name] = detectMention(text, v).mentioned || res.hrefs.some((h) => v.domain && h.includes(v.domain)) ? 'present' : 'absent';
  await presenceCache.set(n.urlNorm, out, 30 * 86400);          // verdict seulement, jamais le HTML
  return out;
}
```

```ts
// ---------- intégration dans audit.ts (après detect + competitors) ----------
const groundedGemini = (env('GEMINI_GROUNDING') || 'off') === 'on';
const citations = answers.flatMap((a, i) => collectSources(a, queryById(a.queryId), {
  client: clientVariants, competitors: competitorVariants, clientDomain, platformsNamed: extractions[i]?.platforms ?? [],
  segment, groundedGemini,
}));
await classifyUnknownWithLlm(citations, getExtractor());          // 1 appel, budget compté (≈ 0,0005 €)
const stats = aggregateDomains(citations, answersWithSources(citations), providersUsed);
let opps = buildUnits(stats, citations).map((u) => scoreOpportunity(u.stat, u, segment, PRIO[segment])).filter(Boolean);
if (opts.verifyPresence !== false) await verifyTopUnknowns(opps, 10);   // niveau 2, puis re-score
const sources: SourcesReport = { method: 'repere-sources-v1.0', /* … */ top10: pickTop10(opps, sectorFallbacks(segment, input.trade)) };
// AuditResult.sources = sources ; topActions V1 enrichies avec les 3 premières opportunités (ActionItem).
```

### 8.1 Stockage Supabase
- `source_citations` (audit_id, provider, query_id, run, url_norm, domain, category, kind, position, client_presence, competitors_present jsonb, created_at) : purge à 90 jours.
- `domain_stats` (audit_id, domain, métriques) : conservé (historique de la citation share).
- `domain_catalog` (domain pk, category, label, page_hint, source, confidence, seen_count, updated_at) : partagé entre clients.
- `presence_checks` (url_norm, entity_hash, verdict, reason, checked_at) et `robots_cache` (host, body, fetched_at).
- `presence_declarations` (business_id, domain, present bool, declared_at).

### 8.2 Tests à écrire
`normalizeUrl` (paramètres de suivi, AMP, sous-domaines), `classifyDomain` (table, règles d'hôte, heuristique sur 30 domaines inconnus étiquetés à la main), positions par provider (fixtures JSON des 3 API), `scoreOpportunity` (gap > absent > inconnu, catégories à 0), `pickTop10` (diversité, victoire rapide, compléments), `verifyPresence` (robots interdit, 403, page JS vide, présence floue).

---

## 9. Limites à afficher
- Les API ne reproduisent pas exactement les applications grand public (`docs/04` §5) ; les sources citées par l'API sont un **indicateur**.
- Forte volatilité des sources d'un mois à l'autre (Semrush 2025) : on montre des tendances, pas des garanties.
- Présence « inconnue » sur les grandes plateformes : on demande au client de confirmer plutôt que de scraper.
- Aucune promesse de résultat : entrer sur une source augmente la probabilité d'être cité, sans la garantir.

## Sources
- [Profound, AI platform citation patterns](https://www.tryprofound.com/blog/ai-platform-citation-patterns)
- [Semrush, most cited domains in AI](https://www.semrush.com/blog/most-cited-domains-ai/)
- [Similarweb, most cited domains by LLMs](https://aisearch.similarweb.com/blog/most-cited-domains-llms/)
- [Ahrefs, top 10 most cited domains by AI assistants](https://ahrefs.com/blog/top-10-most-cited-domains-ai-assistants) (non lu en détail)
- [BrightLocal, AI search using listings sources](https://brightlocal.com/blog/ai-search-using-listings-sources) · [BrightLocal, AI directory sources](https://www.brightlocal.com/resources/ai-directory-sources/)
- [JDN, étude Partoo × Meteoria](https://www.journaldunet.com/retail/1547739-etude-partoo-meteoria-le-retail-a-l-epreuve-des-ia-qui-l-ia-choisit-elle-vraiment)
- [Peec, domaines](https://docs.peec.ai/domains) · [Peec, types de sources](https://docs.peec.ai/metrics/source-metrics/source-types) · [Peec, gap analysis](https://help.peec.ai/en/articles/13728212-how-can-i-use-the-gap-analysis)
- [Otterly, domain citations](https://help.otterly.ai/what-insights-can-i-gain-from-domain-citations-analysis)
- [OpenAI, web search](https://developers.openai.com/fr-FR/api/docs/guides/tools-web-search)
- [Forum Google AI, redirections d'ancrage](https://discuss.ai.google.dev/t/feature-request-provide-actual-source-urls-in-grounding-metadata/107352) · [Forum Google AI, URL inventées](https://discuss.ai.google.dev/t/gemini-fabricating-urls-even-with-search-grounding/66849)
