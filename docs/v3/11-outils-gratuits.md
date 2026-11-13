# 11 — Outils gratuits et boucles de croissance (agent OUTILS GRATUITS ET CROISSANCE)

Date : 9 novembre 2026. Langue : français, vouvoiement. Source amont : `00-BRIEF-V3.md`, `../v2/07-positionnement.md` (Repéré = référencement IA clé en main pour TPE, PME, e-commerces ; l'audit flash gratuit est déjà la porte d'entrée).

Limite des recherches : aucun outil de mesure de trafic (Similarweb, Semrush) n'était accessible. **Je n'ai pas de chiffre de trafic vérifié pour les outils des concurrents** ; les ordres de grandeur ci-dessous sont des hypothèses de classement, étiquetées comme telles. Rien ici ne doit être repris sur le site comme un chiffre.

---

## 0. Ce que font les concurrents (relevé du 9 nov. 2026)

| Acteur | Outil gratuit | Ce que l'on sait (sourcé) |
|---|---|---|
| HubSpot | AI Search Grader | Entrées : nom de l'entreprise, lieu, produit/service, secteur. Sortie : note /100 en 5 volets (sentiment 40, qualité de présence 20, notoriété 20, part de voix 10, concurrence 10) ; interroge ChatGPT, Perplexity, Gemini. Pas de compte, mais un formulaire « Débloquer votre rapport » avant le résultat complet. [Page HubSpot](https://www.hubspot.com/ai-search-grader) ; [annonce HubSpot](https://www.hubspot.com/company-news/from-seo-to-lmo-hubspot-launches-the-first-free-tool-for-ai-discovery) |
| HubSpot | Website Grader | Une URL, une note et des améliorations. Décrit comme utilisé par des millions de personnes ; **aucun nombre de leads publié** dans la source. [MicroConf, Engineering as marketing](https://microconf.com/latest/engineering-as-marketing) |
| Ahrefs | 11 outils gratuits | Vérificateurs de trafic, de backlinks, de difficulté de mots-clés, de SERP, de liens cassés ; Webmaster Tools (audit, analytics dont **trafic venant des IA par chatbot**). Le pied de page cite aussi AI Visibility Checker, AI Overviews Tracker, AI Mode Tracker (détails non lus). [Ahrefs](https://ahrefs.com/blog/ahrefs-free-tools/) |
| Semrush | Plan gratuit | AI Visibility Tool : **3 vérifications/jour** ; Site Audit 100 pages/mois ; Position Tracking 10 mots-clés ; 10 requêtes d'analyse/jour partagées. Compte requis. [Semrush](https://www.semrush.com/blog/free-seo-tools/) |
| Profound | Prompt Volumes | Fonction payante (volumes de requêtes posées aux moteurs de réponse, étendue à Gemini, Claude, Perplexity en août 2025). Pas un outil gratuit : **je n'ai pas pu ouvrir la doc détaillée**. [Changelog](https://product.tryprofound.com/changelog/prompt-volumes-expansion-now-with-gemini-claude-and-perplexity) ; [blog](https://www.tryprofound.com/blog/prompt-volumes-the-new-way-to-see-what-customers-ask-answer-engines) |
| Peec, Otterly | — | Pas d'outil gratuit autonome trouvé dans les résultats ; essais payants. Otterly compare lui-même son offre au grader de HubSpot. À vérifier avant d'écrire « ils n'en ont pas ». |
| Birdeye, Whitespark | Générateur de lien d'avis Google + QR | Entrée : nom de l'établissement. Sortie : lien court + QR. Les boutons mènent à une page de démo, donc le gratuit est une porte vers le produit. [Birdeye](https://birdeye.com/review-link-generator/) ; [Whitespark](https://support.whitespark.ca/en/articles/8950267-what-is-whitespark-s-google-review-link-generator) |
| Nombreux petits éditeurs | llms.txt generator, générateur de schema, vérificateur robots.txt IA | Marché encombré, outils jetables. [Exemple robots.txt IA](https://resolve247.ai/tools/robots-txt-checker) ; [exemple schema](https://seomator.com/schema-markup-generator) |

**Pourquoi ça marche** (convergence des sources) : l'audience de l'outil recoupe celle du produit payant ; le résultat est utile seul ; chaque outil est une page indexable qui attire des liens ; une petite équipe en livre un en quelques jours. Contre-exemple utile : des calculatrices généralistes attiraient du trafic qui ne convertissait pas (Preceden, même source MicroConf). **Règle pour Repéré : n'ouvrir que des outils dont l'utilisateur est un dirigeant de commerce, de PME ou d'e-commerce français.**

Faits techniques qui fondent les outils serveur :
- Aucun grand robot IA n'exécute JavaScript (GPTBot, ClaudeBot, PerplexityBot récupèrent les fichiers JS sans les exécuter) ; données Vercel sur un mois : GPTBot 569 M de requêtes, Claude 370 M, PerplexityBot 24,4 M. [Vercel](https://vercel.com/blog/the-rise-of-the-ai-crawler). Étude de 2024-2025 : à recouper avant de citer le chiffre exact.
- Robots à distinguer (entraînement vs recherche vs requête utilisateur) : GPTBot et ClaudeBot (entraînement), OAI-SearchBot et Claude-SearchBot et PerplexityBot (index de recherche), Perplexity-User et Claude-User (récupération à la demande), Google-Extended (jeton de contrôle Gemini, pas un user-agent HTTP), Applebot-Extended, CCBot, Bytespider. `anthropic-ai` et `Claude-Web` sont obsolètes. [Digital Applied, 4 juin 2026](https://www.digitalapplied.com/blog/ai-crawler-access-control-2026-robots-llms-txt-decision-matrix) (source unique d'éditeur ; liste à revérifier dans les docs de chaque opérateur avant publication).
- llms.txt : Google dit ne pas l'utiliser (Gary Illyes, juillet 2025 ; guidance Google du 15 juin 2026 selon une source secondaire) ; Perplexity et Claude le liraient, OpenAI n'a rien confirmé ; adoption de 10 % sur 300 000 domaines selon une étude citée. [Ecorp IT](https://ecorpit.com/does-llms-txt-help-seo-google-2026/) (**source unique, à vérifier aux sources primaires**). D'où l'exigence d'honnêteté du générateur.
- Avis et recommandations IA : corrélation entre nombre d'avis et présence dans ChatGPT/Perplexity (133 avis en moyenne pour les entreprises citées par les deux, contre 10,7 pour celles citées par aucune ; 10 000 commerces américains ; corrélationnel ; éditeur concurrent). [Insites](https://insites.com/blog/do-google-reviews-affect-ai-recommendations-yes-heres-by-how-much/)

---

## 1. Les 8 outils gratuits

Classement par (trafic potentiel × conversion vers l'audit) ÷ effort. Les estimations de trafic sont des hypothèses : **fort** = volume de recherche français plausiblement en milliers par mois, **moyen** = centaines, **faible** = dizaines. À mesurer avec la Search Console après 90 jours, pas avant.

Principes communs :
- **Aucune clé d'IA** : tout est du fetch HTTP, de l'analyse HTML/JSON et des règles. Chaque résultat est déterministe et reproductible.
- **Sécurité** : fetch côté serveur uniquement avec liste de blocage SSRF (IP privées, localhost, métadonnées cloud, redirections revérifiées), délai de 8 s, taille max 2 Mo, 5 redirections, user-agent déclaré `ReperéBot (+/robots-repere)`, respect du robots.txt de la cible pour l'analyse de page, limite 10 analyses/h/IP.
- **Conversion** : le résultat s'affiche **sans inscription**. L'e-mail n'est demandé que pour **recevoir le rapport PDF/lien** et lancer l'audit flash. Pas de formulaire avant le résultat (là où HubSpot demande un formulaire, nous différencions).
- **Honnêteté** : chaque outil dit ce qu'il ne mesure pas. Aucun « score IA » inventé : les scores sont des listes de contrôles, nommées comme telles.
- **Mode démo** : un bouton « Essayer avec un exemple » (Plomberie Martin, Paysia, Maison Sora) pré-remplit, étiqueté « démo ».

### 1. Lien d'avis Google et QR code — `/outils/lien-avis-google`
- **Promesse** : « Créez le lien et l'affiche QR pour que vos clients vous laissent un avis Google en deux gestes. »
- **Entrées** : identifiant de lieu Google (Place ID) ou lien Google Maps de la fiche ; nom de l'établissement ; couleur et texte de l'affiche (option).
- **Sorties** : lien court `https://search.google.com/local/writereview?placeid=…`, QR code (SVG et PNG), affiche A5/A6 imprimable (PDF), modèle de SMS et d'e-mail de demande d'avis (3 variantes).
- **Implémentation** : l'URL d'avis se construit sans API à partir du Place ID. Extraction du Place ID depuis un lien Maps long si présent ; sinon lien vers le « Place ID Finder » officiel de Google avec mode d'emploi en 3 étapes (sans clé Places, nous ne pouvons pas le résoudre nous-mêmes : **dire la limite**). QR généré côté serveur (bibliothèque `qrcode`), affiche en HTML imprimable.
- **Faisable sans clé d'IA** : oui, 100 %.
- **Appel à l'action** : « Vos avis pèsent dans ce que les IA disent de vous (corrélation observée, pas garantie). Voyez ce que ChatGPT dit de vous : audit gratuit ». Deuxième CTA : kit avis inclus dans l'offre.
- **Trafic** : fort (requête de masse chez les commerçants) ; **conversion** : forte (cible exacte = TPE locale) ; **effort** : S.
- **SEO** : « lien avis google », « qr code avis google », « générer lien avis google », « affiche avis google à imprimer », « comment demander un avis google ».
- **Garde-fous** : ne pas encourager l'achat ni le filtrage d'avis (règles Google) ; mention visible.

### 2. Vérificateur de robots.txt pour les robots IA — `/outils/robots-ia`
- **Promesse** : « Les robots d'OpenAI, Anthropic, Perplexity et Google peuvent-ils lire votre site ? Réponse en 5 secondes. »
- **Entrée** : URL ou domaine.
- **Sorties** : tableau robot par robot (GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-SearchBot, Claude-User, PerplexityBot, Perplexity-User, Google-Extended, Applebot-Extended, CCBot, Bytespider) avec rôle (entraînement, recherche, requête utilisateur), statut Autorisé/Bloqué/Non précisé, règle responsable (ligne et groupe). Détection d'un blocage au niveau pare-feu : requête de test avec chaque user-agent, comparaison des codes HTTP (403, 429, page de défi Cloudflare). Fichier robots.txt recommandé en bloc copiable (deux profils : « être cité par les IA » / « être cité, sans servir à l'entraînement »).
- **Implémentation** : récupérer `/robots.txt`, analyser selon la RFC 9309 (plus long préfixe gagne, Allow l'emporte à longueur égale, `*` en repli), tester les chemins `/` et `/tarifs`. Tableau des robots maintenu dans un fichier de données versionné et daté, **revu chaque trimestre** (les noms changent).
- **Sans clé d'IA** : oui. **Limite à afficher** : un robots.txt est une demande, pas une barrière ; Google-Extended n'agit que sur Gemini, pas sur AI Overviews.
- **CTA** : « Vous êtes ouvert aux IA ? Voilà ce qu'elles disent de vous » vers l'audit flash ; pour les non techniques, tâche « corriger robots.txt » de l'offre.
- **Trafic** : moyen à fort (sujet en vogue, concurrence d'outils jetables) ; conversion : moyenne ; effort : S.
- **SEO** : « robots.txt gptbot », « bloquer gptbot », « autoriser chatgpt à lire mon site », « robots.txt ia », « vérifier robots.txt ».

### 3. Validateur et générateur JSON-LD — `/outils/generateur-json-ld`
- **Promesse** : « Les données structurées que lisent les moteurs et les IA, prêtes à coller. »
- **Entrées** : mode Générer (type LocalBusiness / Organization / Product / FAQPage ; formulaire adapté, adresse, horaires, téléphone, avis agrégés optionnels, questions-réponses) ou mode Valider (URL ou bloc collé).
- **Sorties** : bloc `<script type="application/ld+json">` copiable ; liste d'erreurs et d'avertissements en français (propriété requise absente, `telephone` mal formé, `openingHours` invalide, `sameAs` non absolu, `aggregateRating` sans source, FAQ non visible sur la page) ; lien vers le validateur officiel schema.org pour recoupement.
- **Implémentation** : gabarits TypeScript + règles de validation maison (propriétés recommandées par type, formats) ; extraction des `<script type="application/ld+json">` et des microdonnées de l'URL ; contrôle de cohérence : les données déclarées sont-elles visibles dans le HTML ? Réutilise le moteur JSON-LD déjà servi par Repéré (tâche d'exécution existante).
- **Sans clé d'IA** : oui. **Honnêteté** : le balisage ne garantit ni affichage enrichi ni citation ; il réduit l'ambiguïté. Pas de balisage d'avis inventés.
- **CTA** : « Nous le servons pour vous, sans toucher au code » (JSON-LD servi, plugin WordPress).
- **Trafic** : fort (requête installée) mais concurrence lourde ; conversion : moyenne ; effort : M.
- **SEO** : « générateur json-ld », « schema local business », « données structurées entreprise locale », « schema faq générateur », « balisage schema.org commerce ».

### 4. Test de rendu sans JavaScript — `/outils/rendu-sans-javascript`
- **Promesse** : « Voyez votre page comme un robot IA : sans JavaScript. »
- **Entrée** : URL.
- **Sorties** : texte brut visible dans le HTML initial (aperçu), mots et titres trouvés, comparaison « ce que voit un robot » vs. « ce que voit un humain » **sans navigateur** : indicateurs (taille du HTML initial, nombre de mots, présence de `<h1>`, `<main>`, balise title, meta description, JSON-LD, texte dans `<noscript>`, racine vide type `<div id="root">`, dépendance à des frameworks détectés). Verdict : lisible / partiellement lisible / quasi vide.
- **Implémentation** : fetch avec user-agent de robot, parsing HTML (cheerio), calcul du ratio texte/HTML, détection de coquilles SPA. **Pas de rendu navigateur** (coût, sécurité) : on le dit, et on ne prétend pas comparer au rendu réel. Option phase 2 : rendu Playwright pour les comptes payants.
- **Sans clé d'IA** : oui.
- **CTA** : « Contenu invisible ? Nous publions une page FAQ lisible par les IA, hébergée chez nous » (page /p/[slug]).
- **Trafic** : moyen ; conversion : forte pour e-commerce et sites en SPA ; effort : M.
- **SEO** : « voir mon site comme google sans javascript », « mon site est-il lisible par chatgpt », « site javascript seo », « simulateur robot d'indexation ».

### 5. Analyseur de citabilité d'une page — `/outils/citabilite`
- **Promesse** : « Cette page a-t-elle les éléments qu'une IA peut citer ? Liste de contrôle en 20 points. »
- **Entrée** : URL (une page) ; question visée (option, ex. « plombier chauffagiste Lyon 3 »).
- **Sorties** : 20 contrôles regroupés (réponse directe dans les 100 premiers mots, titres en forme de question, listes et tableaux, chiffres et dates sourcés, auteur et date de mise à jour, coordonnées visibles, FAQ, JSON-LD cohérent, liens sortants vers des sources, longueur des paragraphes, page lisible sans JS, canonique, présence dans le sitemap). Chaque contrôle : réussi/à corriger, pourquoi, comment. **Pas de note unique présentée comme un score d'IA** : un décompte « 14 sur 20 », explicitement « liste de bonnes pratiques, pas une mesure de ce que fait ChatGPT ».
- **Implémentation** : parsing HTML, heuristiques (regex dates, nombres, longueurs), mots de la question comparés au titre et au premier paragraphe. Règles publiées sur `/methode` pour la transparence.
- **Sans clé d'IA** : oui. Option avec clé (compte connecté) : réécriture proposée, jamais en gratuit anonyme.
- **CTA** : « Voyez si les IA citent réellement cette page : audit flash » (mesure réelle).
- **Trafic** : moyen ; conversion : forte pour PME de services et e-commerce ; effort : M.
- **SEO** : « rendre une page citable par chatgpt », « optimiser page pour ia », « analyse geo d'une page », « checklist référencement ia ».

### 6. Comparateur « mon site vs un concurrent » — `/outils/comparateur-concurrent`
- **Promesse** : « Votre site face à un concurrent sur les signaux que lisent les IA. »
- **Entrées** : deux URL.
- **Sorties** : tableau côte à côte (outils 2, 3, 4, 5 réunis : accès des robots, rendu sans JS, JSON-LD, citabilité, présence de llms.txt, sitemap, HTTPS, vitesse du HTML initial) ; « 3 écarts à combler » ; image de partage (OG dynamique).
- **Implémentation** : orchestration des analyseurs existants en parallèle (budget 15 s, quota 5/h/IP). Aucun nouveau code d'analyse.
- **Sans clé d'IA** : oui. **Honnêteté** : on compare des signaux techniques, pas des recommandations réelles des IA ; l'audit flash mesure l'écart réel.
- **Éthique** : analyse d'une page publique, user-agent déclaré, pas de stockage nominatif du concurrent au-delà du cache 24 h.
- **CTA** : « Voici ce que les IA disent de vous et de ce concurrent : audit gratuit avec comparaison ».
- **Trafic** : faible à moyen ; conversion : la plus forte (intention concurrentielle) ; effort : M (après 2-5).
- **SEO** : « comparer mon site à un concurrent », « analyse concurrent seo geo », « audit concurrent visibilité ia ».

### 7. Générateur de llms.txt, honnête — `/outils/llms-txt`
- **Promesse** : « Générez votre llms.txt en une minute, et sachez ce qu'il fait réellement. »
- **Entrée** : URL ; Repéré lit le sitemap et sélectionne les pages principales (modifiable).
- **Sorties** : fichier `llms.txt` (titre, résumé en une phrase, sections de liens avec descriptions), version `llms-full.txt` optionnelle ; instructions de pose (racine, WordPress, Shopify) ; **encadré « Ce que ça change vraiment »**.
- **Texte de l'encadré (à valider avant mise en ligne)** : Google a déclaré ne pas l'utiliser pour la recherche ; certains assistants et agents de développement le liraient ; aucun effet démontré sur les citations ; le fichier ne contrôle pas l'entraînement (c'est le rôle du robots.txt). Source : [Ecorp IT](https://ecorpit.com/does-llms-txt-help-seo-google-2026/) (secondaire), à remplacer par les sources primaires.
- **Implémentation** : parsing du sitemap, titres et meta des pages, regroupement par premier segment d'URL. Repéré sert déjà un `/llms.txt` : le valider dans le même outil.
- **Sans clé d'IA** : oui (résumés = meta description).
- **CTA** : « Mieux qu'un fichier : mesurer si les IA vous citent » vers l'audit.
- **Trafic** : fort à très concurrentiel (outil jetable, saturé) ; conversion : faible ; effort : S. Valeur surtout **confiance et liens** : notre positionnement « honnête » ressort face aux générateurs qui promettent des miracles.
- **SEO** : « générateur llms.txt », « llms.txt c'est quoi », « llms.txt utile ou pas », « créer fichier llms.txt wordpress ».

### 8. Simulateur de trafic IA — `/outils/simulateur-trafic-ia`
- **Promesse** : « Que pourrait représenter la recherche par IA pour votre activité ? Posez vos hypothèses, voyez l'ordre de grandeur. »
- **Entrées** : visites mensuelles, part actuelle du trafic venant des IA (si connue, sinon 0), taux de conversion, panier moyen ou valeur d'un client, part d'IA dans les recherches (curseur d'hypothèse), part de recommandation visée.
- **Sorties** : trois scénarios (prudent, central, ambitieux) en visites, contacts et chiffre d'affaires ; graphique ; export du lien avec les hypothèses.
- **Implémentation** : calcul côté navigateur. **Aucun chiffre de marché présenté comme un fait** : les valeurs par défaut sont vides ou marquées « hypothèse à remplacer », avec les sources à consulter. Bandeau : « Simulation, pas une prévision ni une promesse ».
- **Sans clé d'IA** : oui.
- **CTA** : « Remplacez vos hypothèses par vos vraies mesures : script de suivi sans cookie gratuit + audit ».
- **Trafic** : faible à moyen ; conversion : moyenne (dirigeants chiffrés) ; effort : S. Risque : perçu comme gadget ; à garder s'il reste honnête.
- **SEO** : « calculateur trafic chatgpt », « simulateur référencement ia », « combien rapporte le référencement ia ».

### Ordre de réalisation
Vague 1 (S, 1-3 jours chacun) : 1, 2, 7. Vague 2 (M) : 3, 4, 5. Vague 3 : 6, 8. Page hub `/outils` dès la vague 1 (liste, filtres par parcours, lien dans le menu et le pied de page, ajout au sitemap).

### Page type d'un outil (cohérence SEO)
H1 = promesse ; l'outil au-dessus de la ligne de flottaison ; sous l'outil : « Comment lire le résultat », 5 questions fréquentes balisées FAQPage, méthode et limites, lien vers le guide ou l'entrée du glossaire correspondant, CTA unique vers l'audit. Un maillage interne depuis /glossaire, /guides, /questions. Ne pas dupliquer les textes entre outils.

---

## 2. Les 5 boucles de croissance

Ce qui est sourcé : les badges « Powered by » fonctionnent comme boucle d'acquisition (LiveAgent attribue la moitié de ses nouveaux leads à sa mention ; test Senja : clic de 0,217 % à 0,305 % après refonte du badge, soit environ 12 000 visites par an), avec un opt-out payant comme levier de montée en gamme. [Fazier, badges](https://faziergrowthhacks.beehiiv.com/p/badges) (chiffres déclaratifs d'entreprises, non vérifiés). Les marges de ces boucles pour un fondateur solo se mesurent après lancement ; **aucun taux de conversion n'est promis**.

### Boucle 1 — Carte de score partageable
- **Déclencheur** : à la fin d'un audit flash, ou d'un outil (2, 5, 6).
- **Objet** : carte « Visibilité IA de [Nom] » : note de l'audit, nombre d'IA qui citent la marque sur N questions, date, mention « mesuré par Repéré, [date], N questions, mode réel ». **Pas de carte en mode démo hors étiquette « démo »**.
- **Mécanique** : page publique `/carte/[id-opaque]` + image Open Graph dynamique 1200×630 (`opengraph-image.tsx`, déjà présent dans l'app) ; boutons LinkedIn, copier le lien, télécharger l'image ; texte LinkedIn pré-rédigé, modifiable, sans superlatif ni promesse.
- **Opt-in** : la carte est **privée par défaut** ; l'utilisateur la publie explicitement. `noindex` par défaut ; l'indexation est une case à cocher. Identifiant non devinable ; suppression en un clic.
- **Contenu limité** : jamais les noms des concurrents cités sans leur accord (agrégat seulement) ; jamais de phrases d'IA décrivant des tiers.
- **Boucle** : lecteur LinkedIn voit la carte, clique « Mesurez la vôtre », arrive sur l'audit flash pré-rempli sur un parcours.
- **Mesures** : cartes publiées / audits terminés ; clics entrants par carte ; audits lancés depuis une carte (paramètre `?from=carte`, sans cookie).
- **Effort** : S à M. **Risque** : note faible = peu de partage ; ne montrer le bouton « partager » que si la note le justifie, ou proposer la carte « progression » (avant/après) plutôt que le niveau absolu.

### Boucle 2 — Badge « Cité par les IA » à afficher sur son site
- **Condition** : le badge n'est **délivré que sur un fait mesuré** : la marque est citée dans au moins X % des réponses sur N questions lors de la dernière mesure (seuil fixé à la conception, publié sur /methode). Pas de badge sans mesure ni sans date. Le badge **expire** (35 jours) s'il n'est pas remesuré.
- **Forme** : widget `<script>` ou image SVG servie par `/badge/[id].svg`, avec date de mesure et lien vers `/carte/[id]` (preuve vérifiable). Texte : « Cité par ChatGPT et Perplexity, mesuré le 9/11/2026 par Repéré » (moteurs réellement concernés seulement).
- **Boucle** : visiteur du site client voit le badge, clique vers la carte, puis vers l'audit.
- **Backlink** : lien `rel="noopener"` ; nous ne forçons pas `nofollow` mais ne le vendons pas comme un levier SEO. Option « sans lien » pour les comptes payants (opt-out, comme le modèle du « Powered by »).
- **Intégrité** : vérification publique (la page carte affiche les questions et la date) ; retrait automatique si la mesure tombe sous le seuil ; interdiction d'héberger le badge sur un site différent du domaine audité (contrôle du referer côté image, indicatif).
- **Mesures** : sites ayant posé le badge ; clics par badge ; audits issus d'un badge.
- **Effort** : M. **Risque** : un badge perçu comme « label » trompeur ; mention « mesure, pas certification » obligatoire.

### Boucle 3 — Classement public par ville et par secteur (opt-in)
- **Principe** : pages `/classement/[secteur]/[ville]` (ex. plombiers à Lyon) **uniquement avec les entreprises qui ont choisi de figurer**. Pas de classement de tiers non consentants (CNIL, risque de dénigrement, exactitude).
- **Données** : mesure réelle, mêmes questions pour tous, date et nombre de questions affichés ; classement par taux de citation ; entreprises à égalité regroupées ; seuil minimal d'entreprises (≥ 10) avant publication d'une page, sinon page « classement en préparation » en `noindex`.
- **Entrée** : case à cocher à la fin de l'audit, avec aperçu de ce qui sera publié ; retrait à tout moment.
- **Boucle** : une entreprise classée partage son rang ; ses concurrents du même secteur voient la page et lancent un audit.
- **SEO** : pages « meilleurs [métier] [ville] » à fort volume local ; **attention** : ne pas se présenter comme un annuaire d'avis ; mention « classement de citations par les IA, pas de qualité ».
- **Effort** : L (volume de données, modération, règles de comparabilité). **À ne lancer qu'une fois la base d'audits suffisante** ; avant cela, publier des études agrégées (/etudes).
- **Risques** : biais (entreprises déjà visibles s'inscrivent), contestations ; règlement public et contact de rectification.

### Boucle 4 — Parrainage
- **Mécanique** : lien unique par client (`?ref=code`), page `/parrainage` dans /app. Le filleul reçoit **un audit approfondi à tarif réduit** ou un mois offert ; le parrain reçoit un crédit sur sa facture (mois offert), jamais d'argent comptant au départ. Le crédit n'est acquis qu'à partir du **premier paiement du filleul** (anti-abus), plafonné (ex. 6 mois/an).
- **Montants** : à fixer avec les marges de `../v2/07-positionnement.md` (Local 29 €/mois ; PME 99 €/mois ; e-commerce 79 €/mois) : un mois offert = au plus 1 mois de marge ; à valider avec le fondateur.
- **Mise en œuvre** : table `referrals` (code, filleul, statut, crédit), coupon Stripe appliqué, e-mail Resend de remerciement ; mentions CGV : pas d'auto-parrainage, même entité, même moyen de paiement.
- **Déclencheurs de la demande** : après une victoire visible (une IA cite enfin la marque, score en hausse), dans le digest du lundi ; une seule relance.
- **Repère sourcé** : exemple Typeform avec un outil de parrainage, +10 % de croissance annuelle d'utilisateurs payants selon l'étude de cas de l'éditeur de l'outil ([Case Study SaaSquatch](https://www.casestudies.com/company/saasquatch/case-study/user-growth-with-the-power-of-referral-marketing), source intéressée, à ne pas reprendre comme référence).
- **Effort** : M. **Légalité** : mention de l'avantage dans la communication, conformité parrainage (Code de la consommation, loyauté de l'information).

### Boucle 5 — Programme agences et freelances
- **Cible** : agences web, SEO, community managers, experts-comptables, CCI qui conseillent des TPE.
- **Offre** : espace multi-clients (un tableau de bord de leurs clients), **rapports en marque blanche** (logo et couleurs de l'agence, mention « mesuré avec Repéré » désactivable), remise de volume ou commission récurrente (par ex. 20 % à 30 %, **à décider** ; non issue d'une source), accès à des outils gratuits sans limite d'usage (usage « pro »), formation courte.
- **Mécanique** : page `/agences` avec candidature ; statut Partenaire après 1 client actif ; lien de suivi ; page « Trouver un partenaire » **opt-in** et seulement pour des partenaires ayant au moins 1 client réel (aucun faux logo, aucune promesse de volume).
- **Pourquoi** : un fondateur solo ne peut pas vendre à 500 TPE une à une ; les agences ont déjà la relation et le besoin de rapports.
- **Produit requis** : rôle « agence » avec comptes clients rattachés, export PDF, facturation consolidée (Stripe) ; **ne pas** créer un second produit.
- **Effort** : L pour le multi-clients complet ; **S pour une version 0** (page candidature + commission manuelle + rapport PDF existant). Lancer la version 0.
- **Mesures** : agences actives, clients par agence, part des ventes via partenaires, délai jusqu'au premier client.

---

## 3. Modèle freemium

**Principe** : le gratuit doit être **assez utile pour être partagé** et **assez limité pour que la suite se justifie**. Repères (benchmarks d'un seul article, non vérifiés) : freemium 2 à 5 % de conversion sur l'ensemble des inscrits (3-4 % typique en B2B) ; essai sans carte 15 à 25 % des essayeurs, avec 2 à 5 fois plus d'inscriptions qu'avec carte ; essai avec carte 30 à 50 %. [Dodo Payments, avr. 2026](https://dodopayments.com/blogs/saas-free-trial-vs-freemium) (auteur, pas d'étude citée). Les concurrents posent des limites strictes au gratuit (Semrush : 3 vérifications d'IA par jour).

### Gratuit pour toujours (sans carte bancaire)
| Élément | Limite | Raison |
|---|---|---|
| Les 8 outils | Quota anti-abus (10 analyses/h/IP) ; pas de limite mensuelle pour un compte | Aimants SEO ; pas de coût d'IA. |
| Audit flash | **1 marque**, **5 prompts** (questions) pour l'espace gratuit, **1 mesure par mois**, 2 IA (ex. ChatGPT, Perplexity), historique 3 mois | Valeur réelle (on voit si on est cité) ; coût d'IA borné (5 prompts × 2 moteurs × 1/mois) ; chiffre à valider avec les coûts d'API. |
| Carte de score | 1 carte active, mention Repéré | Boucle 1. |
| Script de suivi sans cookie t.js | 1 site, jusqu'à un seuil de visites à fixer | Prépare le trafic IA (donnée propre à l'utilisateur). |
| Digest du lundi | Version courte (1 constat, 1 action) | Rétention ; ne coûte presque rien. |
| Badge | Si le seuil mesuré est atteint, avec lien Repéré | Boucle 2. |
| Exécution d'une tâche | **1 livrable de départ** à choisir (ex. JSON-LD servi ou kit avis) | L'utilisateur voit que Repéré **fait**, pas seulement mesure. |

### Payant
- **Mesure** étendue : prompts, moteurs (4 IA), fréquence hebdomadaire, concurrents, sources citées, vérité, historique complet.
- **Exécution** : toutes les tâches et livrables ; page FAQ hébergée ; plugin ; réponses aux avis ; comparatifs.
- **Audit approfondi** (390 € PME/e-commerce, 149 € local) et **Accompagné** : voir `../v2/07-positionnement.md`.
- **Retrait de la mention « mesuré avec Repéré »** sur carte et badge.

### Essai
- **Essai du palier payant sans carte, 14 jours** (pas de piège de renouvellement automatique). À la fin, retour au gratuit **sans perte des données** (lecture seule du reste). Conformité : pas de prélèvement implicite ; information claire.
- **Déclencheurs de montée en gamme** (jamais de pression artificielle) : atteinte d'une limite (6e prompt, 2e marque), question concurrentielle, tâche d'exécution suivante, victoire mesurée (« vous êtes cité ; suivez-le chaque semaine »).

### Indicateurs à suivre dès le lancement
Visiteurs par outil, résultat vu, inscription, audit flash lancé, audit terminé, tâche exécutée, passage au payant, partage de carte, badge posé. Objectif : savoir quel outil conduit à des clients, pas seulement à des visites. Supprimer sans regret l'outil qui apporte du trafic sans audit (cf. Preceden).

### Coûts à surveiller
Gratuit = coût d'API par compte. Plafonner : 1 mesure par mois et par marque, 5 prompts, cache des réponses 30 jours, détection des multi-comptes (même domaine, même appareil), pas d'API publique anonyme.

---

## 4. Points à valider avant mise en œuvre
1. Seuils exacts du badge et du classement (X %, N questions, nombre minimal d'entreprises).
2. Montants de parrainage et de commission agence (marges).
3. Réponses CNIL : publication opt-in des cartes et classements (base légale = consentement), durée de conservation, droit de retrait.
4. Liste des robots IA : vérifier chaque user-agent dans la documentation officielle de son opérateur ; la source utilisée est un éditeur.
5. Statut de llms.txt : remplacer la source secondaire par les déclarations primaires de Google, Perplexity et Anthropic.
6. Trafic des outils concurrents : mesurer avec Similarweb ou Semrush avant d'écrire un chiffre ; aucun n'est donné ici.
7. Peec et Otterly : confirmer l'absence (ou la présence) d'outils gratuits.

## Sources
- [HubSpot, AI Search Grader](https://www.hubspot.com/ai-search-grader) ; [annonce](https://www.hubspot.com/company-news/from-seo-to-lmo-hubspot-launches-the-first-free-tool-for-ai-discovery)
- [Semrush, outils gratuits](https://www.semrush.com/blog/free-seo-tools/) ; [Ahrefs, outils gratuits](https://ahrefs.com/blog/ahrefs-free-tools/)
- [Profound, changelog Prompt Volumes](https://product.tryprofound.com/changelog/prompt-volumes-expansion-now-with-gemini-claude-and-perplexity)
- [MicroConf, Engineering as marketing](https://microconf.com/latest/engineering-as-marketing)
- [Vercel, The rise of the AI crawler](https://vercel.com/blog/the-rise-of-the-ai-crawler)
- [Digital Applied, accès des robots IA, 4 juin 2026](https://www.digitalapplied.com/blog/ai-crawler-access-control-2026-robots-llms-txt-decision-matrix)
- [Ecorp IT, llms.txt et Google](https://ecorpit.com/does-llms-txt-help-seo-google-2026/)
- [Insites, avis et recommandations IA](https://insites.com/blog/do-google-reviews-affect-ai-recommendations-yes-heres-by-how-much/)
- [Birdeye, générateur de lien d'avis](https://birdeye.com/review-link-generator/) ; [Whitespark](https://support.whitespark.ca/en/articles/8950267-what-is-whitespark-s-google-review-link-generator)
- [Fazier, badges](https://faziergrowthhacks.beehiiv.com/p/badges)
- [Dodo Payments, freemium vs essai](https://dodopayments.com/blogs/saas-free-trial-vs-freemium)
- [Case Study SaaSquatch / Typeform](https://www.casestudies.com/company/saasquatch/case-study/user-growth-with-the-power-of-referral-marketing)
