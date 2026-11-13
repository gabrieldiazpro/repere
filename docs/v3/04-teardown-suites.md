# Teardown des suites SEO/contenu : modules IA (9 novembre 2026)

Périmètre : Semrush, Ahrefs, SE Ranking, Surfer, Moz, Similarweb, Writesonic, Frase, Clearscope, HubSpot AEO/AI Search Grader.
Méthode : 11 recherches web et 11 lectures de pages (plusieurs pages éditeur refusées par la liste d'accès de la session). Données structurées : `features-suites.json` (16 fonctionnalités).

Légende : **[lu]** page ouverte et lue ; **[tiers]** lu sur un blog ou comparatif tiers, souvent écrit par un concurrent ; **[non vérifié]** vu seulement dans un titre de résultat, ou non lu.

## 1. Niveau de preuve par éditeur

| Éditeur | Ce qui a été lu | Ce qui reste non vérifié |
|---|---|---|
| Semrush | Doc officielle AI Visibility Toolkit [lu] ; blog Semrush sur le suivi pour agences [lu] | Enterprise AIO (seulement « 500 à 15 000 prompts », « sur devis » via le blog) ; Semrush One |
| Ahrefs | Aide officielle AI Content Helper [lu] ; prix et plateformes Brand Radar via un blog tiers daté du 29 août 2026 [tiers] | Pages produit et tarifs Ahrefs ; fonctions réelles de Brand Radar (le blog ne cite ni part de voix ni pages citées) |
| SE Ranking | Revue Rankability [tiers, concurrent] | Page produit, tarifs, limites de plans |
| Surfer | Revue Rankability [tiers, concurrent] | Page produit, prix, lien avec l'optimiseur de contenu |
| Moz | rien (page d'aide trouvée mais non chargée) | Tout |
| Similarweb | Annonce AI Brand Visibility du 16 juin 2025 [lu] | Fonction « AI traffic » ; communiqué de juillet 2025 (titre seul) ; état actuel du produit |
| Writesonic | rien (résultats de recherche seuls) | Tout, y compris le prix « GEO à partir de 199 $ » vu dans un titre d'article |
| Frase | Page d'accueil [lu] | Pages de prix détaillées, outils gratuits eux-mêmes |
| Clearscope | Article « AI Cited Pages Content View » [lu] | Page d'accueil, tarifs, méthode de notation |
| HubSpot | Page AEO Grader [lu] ; guide Stackmatix [tiers] | Formulaire d'accès au rapport (non affiché), contenu du rapport complet |

Incohérence à signaler : Semrush indique « pas d'essai gratuit » dans sa doc [lu] et « essai de 7 jours » dans son blog [lu]. À revérifier avant toute citation.

## 2. Tarifs relevés (à citer avec la date de lecture)

| Offre | Prix | Source | Statut |
|---|---|---|---|
| Semrush AI Visibility Toolkit | 99 $/mois, 1 projet, 25 prompts suivis, 300 requêtes d'analyse/jour, 100 pages d'audit IA, 10 exports CSV/jour ; domaine supplémentaire 99 $/mois ; 50 prompts supplémentaires 60 $/mois | https://www.semrush.com/kb/1493-ai-visibility-toolkit | [lu], 9 nov. 2026 |
| Semrush PDF marque blanche | 20 $/mois (My Reports Pro) | https://www.semrush.com/blog/ai-visibility-tracking-tools-for-agencies/ | [lu] |
| Ahrefs Brand Radar | 398 $/mois (plateformes choisies), 699 $/mois (toutes) ; page tarifs : « à partir de 199 $/mois » ; prompts inclus dans les plans Lite 129 $ (5), Standard 249 $ (10), Advanced 449 $ (20) | https://www.get-ryze.ai/blog/ahrefs-brand-radar-pricing-2026 | [tiers], non vérifié chez Ahrefs, incohérent en interne |
| HubSpot AEO (suivi continu) | 50 $/mois sans abonnement HubSpot ; inclus dans Marketing Hub Pro et Enterprise | https://www.hubspot.com/aeo-grader | [lu] |
| Frase | 39 $/mois (annuel) ou 49 $ (mensuel), un site ; Professional 103 $ (annuel) ou 129 $ ; essai 7 jours sans carte | https://www.frase.io/ | [lu] |
| Similarweb AI Brand Visibility | accès via account manager, pas de prix public | https://www.similarweb.com/blog/updates/announcements/introducing-ai-brand-visibility | [lu] |
| SE Ranking, Surfer, Moz, Writesonic, Clearscope | non relevés | non vérifié |

Lecture pour le positionnement : les suites commencent à 39-99 $/mois par domaine et 25 prompts, avec des suppléments à la hausse. Une offre française pour commerces locaux à prix inférieur reste crédible, mais les prix concurrents ci-dessus ne doivent pas être affichés sur /comparatif sans relecture directe des pages tarifs éditeur.

## 3. Inventaire des fonctionnalités reproductibles par un petit acteur

Pour chacune : ce que voit l'utilisateur, la valeur, l'implémentation probable, effort (S/M/L), priorité (1-5) pour Repéré.

### 3.1 Grader gratuit, score de marque dans les IA (priorité 5, effort S)
- **Vu** : HubSpot demande 4 champs (société, lieu, produit/service, secteur) puis donne un score sur 100 en 5 dimensions : sentiment 40, qualité de présence 20, notoriété 20, part de voix 10, concurrence 10 (rôle Leader/Challenger/Niche, perception Innovateur/Perturbateur/Traditionnel). Score sans compte, détail derrière un formulaire. Moteurs cités : OpenAI, Perplexity, Gemini [lu].
- **Limites connues** [tiers] : un mot-clé par rapport, 3 moteurs, instantané sans suivi, pas de test sur domaine concurrent. La description exacte du score est contradictoire selon les sources (mesure de présence réelle ou de « préparation »).
- **Valeur** : résultat immédiat, chiffre partageable, entrée du tunnel.
- **Implémentation** : requêtes standardisées aux LLM, score composite, capture d'email avant le détail. Repéré a déjà le moteur ; version publique limitée à quelques prompts. Frase propose aussi un GEO Score Checker et un AI Visibility Checker (existence lue, contenu non lu).
- **Différenciation possible** : fiche de vérité (faits erronés des IA), France, vocabulaire clair, sans jargon AEO.

### 3.2 Audit « AI readiness » du site (priorité 5, effort M)
- **Vu** : Semrush : widget AI Search Health dans Site Audit, contrôle de l'accès des robots IA, 100 pages [lu]. Frase : score de préparation /100, 212 pages vérifiées et 44 problèmes dans l'exemple, liste « Fix Pack » priorisée, plus un Agent Readiness Checker [lu, existence].
- **Valeur** : un score unique et une liste courte de correctifs.
- **Implémentation** : robots.txt par robot IA, llms.txt, JSON-LD valide, HTML brut vs rendu (contenu dépendant du JS), structure des titres/FAQ, poids et temps de réponse. Règles déterministes, sans coût LLM. Liste exacte des contrôles des concurrents : non vérifié.
- **Synergie** : chaque correctif se relie à une tâche livrable existante (JSON-LD servi, plugin WordPress).

### 3.3 Optimiseur de contenu pour la citabilité (priorité 4, effort M)
- **Vu** : Ahrefs AI Content Helper : mot-clé ou URL, score 0-100 de couverture des sujets, chaque sujet noté pour le brouillon et les concurrents, titres/méta, chat IA, historique. Un document par mois sur toutes les offres, y compris gratuite [lu]. Frase : score par page « pour les classements et les réponses IA » [lu]. Clearscope, Surfer, Writesonic : non vérifié.
- **Valeur** : savoir quoi changer sur une page donnée.
- **Implémentation** : analyse de l'URL (réponse directe en tête de section, questions couvertes ou non, faits chiffrés, FAQ balisée, signaux de confiance) + suggestions LLM. Ne pas promettre un classement ni une citation.

### 3.4 Recherche de prompts et de questions (priorité 4, effort M)
- **Vu** : Semrush Prompt Research : volume par thème, difficulté, intention, 1 000 requêtes/jour sur l'offre de base [lu]. Similarweb : analyse des prompts derrière les réponses [lu]. Moz Prompt Suggestions : page trouvée, non lue.
- **Implémentation** : pas d'accès à de vrais volumes. Suggestions par secteur/ville/produit (LLM + gabarits + People Also Ask), étiquetées « suggestion ». Aucun volume inventé.

### 3.5 Suivi des AI Overviews (priorité 2, effort L)
- **Vu** : SE Ranking : présence et position par mot-clé, domaines cités, copies de SERP en cache, par pays ; AI Mode Tracker avec mentions non liées [tiers]. Surfer et Ahrefs : couverture annoncée par des tiers.
- **Implémentation** : nécessite la SERP réelle (fournisseur payant ou scraping, risque CGU). Gemini sans ancrage ne remplace pas. À différer ou à proposer en vérification ponctuelle étiquetée « échantillon ».

### 3.6 Mentions de marque sur le web : Reddit, forums, vidéos (priorité 3, effort M)
- **Vu** : Ahrefs : YouTube, TikTok, Reddit comme sources, gratuites en bêta [tiers]. SE Ranking : mentions non liées [tiers]. Similarweb : sources qui alimentent les mentions [lu].
- **Implémentation** : étendre les 436 domaines classés de Repéré : repérer les fils Reddit/forums/avis dans les sources citées, résumer, proposer une action. Pas de collecte massive de Reddit.

### 3.7 Rapports automatiques (priorité 3, effort S)
- **Vu** : Semrush : My Reports, exports CSV, PDF marque blanche en option [lu]. Surfer : rapports de tendance hebdomadaires [tiers].
- **Implémentation** : PDF mensuel HTML vers PDF, export CSV, lien lecture seule, marque blanche pour agences. S'appuie sur digest et Rapports V2.

### 3.8 Part de voix par thématique (priorité 5, effort M)
- **Vu** : Semrush Brand Performance (part de voix, sentiment, récits, recommandations par urgence) [lu] ; SE Ranking par thème avec historique [tiers] ; Similarweb par thème [lu] ; Frase par étape du parcours d'achat [lu].
- **Implémentation** : étiqueter chaque prompt d'un thème, agréger la part de réponses citant la marque et chaque concurrent. Agrégation simple sur les audits existants.

### 3.9 Autres fonctions (voir JSON)
Gap « cités chez eux, pas chez vous » (priorité 4, S) ; pages citées par les IA (Clearscope, priorité 4, M) ; suivi quotidien avec alerte de baisse (3, M) ; suivi local par ville/code postal (4, M, segment local) ; sentiment (3, S) ; trafic référent IA (2, S, déjà présent) ; détection de déclin (2, M) ; agent MCP (1, L, à ne pas cloner).

## 4. Comment les suites présentent leurs produits

Constat : peu de matière lue, donc à compléter si une analyse plus poussée est demandée.

- **HubSpot** [lu] : le grader est la porte d'entrée. Structure de page en 10 blocs : sélecteur de langue ; héro avec formulaire et infobulles par champ, logos « powered by », avertissement « généré par IA, non relu » ; pourquoi la visibilité IA compte ; détail des 5 dimensions ; guide en 4 étapes ; certification gratuite ; bandeau vers le produit payant (démo, essai) ; FAQ ; formulaire « débloquer votre rapport » ; autres outils gratuits. Le score est libre, le détail est gated, le suivi continu est vendu (50 $/mois).
- **Frase** [lu] : animations d'illustrations, maquettes de tableaux de bord, témoignages, notes G2/Capterra, essai 7 jours sans carte, un hub d'outils gratuits (GEO Score Checker, AI Visibility Checker, Agent Readiness Checker). Pas de vidéo ni de démo intégrée dans le texte capturé, lien vers une demande de démo.
- **Similarweb** [lu] : produit réservé aux clients, accès via account manager ; captures d'écran. Pas de parcours libre.
- **Semrush** [lu] : doc détaillée, prix publics (99 $), essai à vérifier ; vidéos et démos interactives : non vérifié.
- **Ahrefs** : un tutoriel interactif Guideflow sur l'AI Content Helper apparaît dans les résultats (titre seul, non lu, non vérifié si c'est Ahrefs qui l'a produit).
- **Surfer, SE Ranking, Moz, Writesonic, Clearscope** : non vérifié.

Enseignements pour Repéré (hypothèses à partir de HubSpot et Frase, pas de généralité) :
1. Un grader gratuit doit donner un score sans compte, puis monnayer le détail par email.
2. Un hub d'outils gratuits relie grader, audit de site et vérificateur de robots.
3. Prix publics et essai sans carte rassurent ; Repéré peut le faire en mode démo avec données étiquetées « démo ».
4. Mentionner l'avertissement « généré par IA » comme HubSpot : cohérent avec l'exigence d'honnêteté.

## 5. Les six fonctionnalités à cloner en priorité

1. Grader gratuit avec score /100 et détail derrière email (3.1).
2. Audit « AI readiness » du site avec liste de correctifs priorisée (3.2).
3. Part de voix par thématique (3.8).
4. Recherche de prompts : suggestions par secteur et ville (3.4).
5. Optimiseur de citabilité par page, avec score et suggestions (3.3).
6. Gap « cités chez eux, pas chez vous » relié à des tâches livrables (3.9).

À éviter en V3 : suivi des AI Overviews (coût, CGU), agent MCP, volumes de prompts inventés.

## 6. Limites de ce teardown

- Plusieurs pages éditeur (SE Ranking, Writesonic, Clearscope, Moz, Ahrefs produit, Surfer) n'ont pas pu être chargées ; les informations les concernant viennent de tiers, parfois concurrents.
- Les prix ne sont pas relus sur les pages tarifs officielles sauf Semrush, HubSpot et Frase.
- Aucune démo ni vidéo n'a été visionnée.

## Sources
- https://www.semrush.com/kb/1493-ai-visibility-toolkit
- https://www.semrush.com/blog/ai-visibility-tracking-tools-for-agencies/
- https://www.hubspot.com/aeo-grader
- https://www.stackmatix.com/blog/hubspot-ai-search-grader
- https://www.frase.io/
- https://help.ahrefs.com/en/articles/9879434-about-the-new-ai-content-helper
- https://www.get-ryze.ai/blog/ahrefs-brand-radar-pricing-2026
- https://www.clearscope.io/blog/is-ai-citing-your-pages
- https://rankability.com/blog/se-rankings-ai-visibility-tracker-review
- https://www.rankability.com/blog/surfer-ai-tracker-review/
- https://www.similarweb.com/blog/updates/announcements/introducing-ai-brand-visibility
