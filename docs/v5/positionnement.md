# Positionnement V5 de Repéré — SEO + GEO pour tous les sites professionnels

Agent SITE-POSITIONNEMENT, 13 nov. 2026. Sert de référence pour l'accueil, /fonctionnalites, les parcours, /tarifs,
/comparatif, /methode, llms.txt et le JSON-LD. Prix des concurrents relevés le 13 nov. 2026 (sauf mention), en dollars
US hors taxes quand l'éditeur facture en dollars. À revérifier avant toute republication.

## 1. La promesse

**« Google et les IA décident qui vos clients trouvent. Repéré analyse votre site pour de vrai, vous dit quoi corriger,
et le fait avec vous. »**

- Sous-titre (accueil) : « Entrez votre site : en 60 secondes, Repéré l'explore page par page, contrôle 185 points SEO et
  ce que les IA peuvent en lire, puis vous donne les 5 corrections qui comptent. »
- Une phrase par public :
  - **Commerce local** : « Sur Google Maps comme dans ChatGPT, on recommande le commerce dont la fiche, le site et les avis
    disent la même chose. »
  - **PME / B2B** : « Vos acheteurs comparent sur Google et dans les assistants : soyez dans la liste, avec les bons faits. »
  - **E-commerce** : « Fiches produit, facettes, Shopping, réponses des IA : vos produits doivent être lisibles partout où
    l'on compare. »
- Ce que nous ne disons jamais : « numéro 1 sur Google », « garanti », « cité par ChatGPT en X jours ».

## 2. Les preuves honnêtes (ce que le produit fait réellement, V5)

| Promesse | Preuve vérifiable | Où c'est dans le code |
|---|---|---|
| « pour de vrai » | Exploration réelle du site (robots.txt, sitemaps, jusqu'à 60 pages en 45 s pour l'analyse publique, 500 ou 2 000 pages en offre payante), robot identifié RepereBot, politesse (≤ 4 requêtes simultanées) | src/lib/crawl, src/lib/entitlements.ts |
| « 185 contrôles SEO » | Catalogue généré depuis le code, 12 sections, sources Google pour chacun | docs/v5/seo-controles.md, src/lib/seoaudit |
| « ce que les IA peuvent lire » | Accès des robots d'IA (OAI-SearchBot, PerplexityBot, Claude-SearchBot…), rendu sans JavaScript, entité, passages notés, fraîcheur ; chaque règle porte son niveau de preuve (démontré / probable / hypothèse) | docs/v5/geo-methode.md, src/lib/geo |
| « ce que répondent les IA » | Questions clients posées plusieurs fois à ChatGPT, Perplexity, Gemini, Claude (Mistral en option), marge d'erreur affichée | src/lib/engine |
| « positions et Search Console » | Connexion Search Console (16 mois), PageSpeed/CrUX, positions Google suivies (fournisseur DataForSEO, plafond de coût par compte) | src/lib/seodata, docs/v5/donnees-seo.md |
| « le fait avec vous » | Agent de publication : WordPress, Shopify, Webflow, PrestaShop, export pour les autres ; aperçu avant/après, validation obligatoire, journal, retour arrière | src/lib/publish, docs/v5/publication.md |
| « données exclusives » | Baromètres mensuels métier × ville / catégorie, publiés seulement après mesure réelle | src/lib/barometre, docs/v5/barometres.md |

Limites dites en clair : pas d'analyse de journaux serveur ; liens entrants seulement si la source payante est activée ;
Wix et Bing Places en export ; la note SEO mesure l'état du site, pas une position.

## 3. Différences avec les outils de référence (faits vérifiables, datés)

| Outil | Ce qu'il fait très bien | Prix public relevé | Ce que Repéré fait autrement | Sources |
|---|---|---|---|---|
| **Semrush** | Suite SEO complète (mots-clés, concurrents, publicité, contenu) ; Site Audit jusqu'à 100 000 pages par audit en Pro ; boîte à outils « AI Visibility » (25 prompts suivis, ChatGPT et AI Mode pour le suivi, audit d'accès des robots d'IA) | Pro 139,95 $/mois, Guru 249,95 $, Business 499,95 $ (relevé tiers d'avril 2026) ; AI Visibility Toolkit 99 $/mois par domaine en annuel ; Semrush One (SEO + IA) 199 $, 299 $, 549 $/mois (relevé tiers) | Interface et constats en français pour non-spécialistes ; règles propres au site type (local / PME / boutique) et aux obligations françaises ; mesure sur 4 à 5 IA dont Claude et Mistral ; publication des correctifs sur le site du client après validation | https://www.semrush.com/pricing/ai/ ; https://www.semrush.com/kb/1493-ai-visibility-toolkit ; https://docket.io/resources/research/semrush-pricing ; https://www.stylefactoryproductions.com/blog/semrush-one-review |
| **Ahrefs** | Index de liens et de mots-clés de référence ; Site Audit (crédits d'exploration : 100 000/mois en Lite) ; Brand Radar pour la visibilité dans les IA ; compte gratuit avec Site Audit (5 000 crédits/mois/projet) pour un site vérifié | Lite 129 $/mois, Standard 249 $, Advanced 449 $ ; Brand Radar AI dès 199 $/mois ; packs de prompts 50 à 250 $/mois | Repéré ne prétend pas rivaliser sur l'index de liens ; il traduit l'audit en 5 priorités, mesure les réponses des IA avec marge d'erreur et applique les corrections | https://ahrefs.com/pricing ; https://pricingsaas.com/companies/ahrefs ; https://help.ahrefs.com/en/articles/13002606-what-can-i-use-for-free-in-ahrefs |
| **Screaming Frog SEO Spider** | Robot d'exploration de bureau de référence pour les techniciens ; version gratuite limitée à 500 URL ; intégrations IA (OpenAI, Gemini, Anthropic, Ollama) et serveur MCP | 245 €/an par licence (1 à 4 licences), 209 € dès 20 | Repéré est un service en ligne, sans installation, pour un dirigeant : il explore moins de pages mais explique, priorise, suit dans le temps et corrige | https://www.screamingfrog.co.uk/seo-spider/pricing/ |
| **Peec AI** | Suivi de la visibilité dans les IA (prompts, sources, concurrents), agent et crédits d'actions | Starter 95 $/mois (50 prompts, 3 modèles), Pro 245 $, Advanced 495 $ ; Perplexity en option | Repéré couvre aussi le SEO classique (audit, positions, Search Console) et publie les corrections ; offre gratuite permanente | https://www.layer3labs.io/guides/peec-ai-pricing (25 oct. 2026) ; https://peec.ai/pricing (lu le 9 nov. 2026) |
| **Otterly.AI** | Suivi quotidien des réponses IA ; audit GEO d'URL inclus | Lite 29 $/mois (15 prompts), Standard 189 $ (100), Premium 489 $ (400) | Audit SEO complet en plus du GEO ; corrections appliquées ; interface française | https://www.capterra.com/p/10023384/Otterly-AI/pricing/ ; https://help.otterly.ai/pricing-of-otterlyai |
| **Meteoria** | Éditeur français de suivi GEO (7 IA possibles, sentiment, sources, Google Analytics / Matomo) | Starter 75 €/mois, puis 175 €, 420 €, Enterprise ~700 € (relevé tiers du 6 oct. 2026) | Repéré ajoute l'audit SEO technique, les positions Google et l'agent de publication | https://www.lafabriquedunet.fr/logiciels/marketing-digital/outils-geo ; https://www.blogdumoderateur.com/tools/meteoria/ |

Lecture d'ensemble : les suites SEO (Semrush, Ahrefs) ajoutent l'IA à un outil d'expert ; les outils GEO (Peec, Otterly,
Meteoria) mesurent les IA sans auditer le SEO ; Screaming Frog explore mais ne suit ni n'agit. **Repéré est le seul de
cette liste à réunir, en français et pour un non-spécialiste : exploration réelle, audit SEO + GEO, mesure des IA avec
marge d'erreur, et corrections publiées après validation** — à un prix d'entrée de 0 € (Découverte) puis 29 à 99 €/mois.
Là où ils sont meilleurs (index de liens d'Ahrefs, volume de pages de Screaming Frog, nombre de moteurs de Peec
Enterprise), nous le disons sur les pages comparatives.

## 4. Règles de rédaction (site)
- Titres-résultats, pas de fonctions (« 12 pages n'ont pas de titre », pas « Analyse des titres »).
- Chaque chiffre a sa source (code, doc officielle ou mesure datée). Démo étiquetée.
- Aucun logo d'IA ni d'outil concurrent ; noms en texte seulement.
- Aucun « garanti », « n° 1 », « explosez ». Le résultat dépend aussi de Google et des IA.
