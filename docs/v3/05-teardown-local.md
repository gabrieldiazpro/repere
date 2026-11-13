# 05 — Teardown : outils de présence locale et de réputation

Date de vérification : 9 novembre 2026. Périmètre : BrightLocal, Local Falcon, Partoo, Yext (Scout), Uberall, Birdeye,
Guest Suite, Custplace, Localo, GMB Everywhere, Whitespark. « Cloner » = reproduire l'idée fonctionnelle avec notre design
et notre code ; aucun texte, visuel ou code concurrent n'est repris. Ce qui n'a pas été lu sur une page est marqué
**[non vérifié]**. Prix en USD sauf mention, tels que lus à la date ci-dessus ; les prix de tiers (agrégateurs) sont signalés.

## 0. Ce qu'il faut retenir

1. **La grille géographique est la fonction signature** (Local Falcon, BrightLocal Local Search Grid, Localo, Whitespark).
   Local Falcon l'a étendue aux IA : même prompt envoyé depuis chaque point GPS, carte de chaleur de présence.
2. **BrightLocal a lancé « Local AI Visibility »** (ChatGPT, AI Overviews, AI Mode) : score 0-100 par établissement, jusqu'à
   20 prompts, rivaux détectés, classement des sources citées, actions classées par impact. C'est le concurrent le plus
   proche de notre parcours Local, à partir de 31 $/mois. Repéré a déjà les sources citées et les gaps concurrents :
   l'écart est la dimension **géographique** et l'audit de fiche chiffré.
3. **Les « suites » multi-établissements (Partoo, Yext, Uberall, Birdeye)** vendent la diffusion des fiches et les avis
   sur devis, pour des réseaux. Ce n'est pas notre cible (commerce local isolé) ; seul le **tableau de bord multi-sites en
   lecture** est clonable à bas coût.
4. **Sans API Google Business Profile**, on peut faire : audit de fiche (données publiques), suivi de positions et grille
   (recherche Places), audit NAP (web public), kit d'avis, brouillons de réponses (texte collé), calendrier de posts à
   publier à la main. On ne peut pas : lire tous les avis, répondre, publier des posts, lire les statistiques de la fiche.
5. **Garde-fou majeur** : les règles Places interdisent de stocker du contenu Google (hors identifiants de lieu) et d'en
   tirer du « contenu dérivé » (§ 3). Une grille de positions stockée est dans une zone grise à faire valider.

## 1. Fiches outils

| Outil | Ce que c'est | Prix lu | Source |
|---|---|---|---|
| BrightLocal | Suite SEO local à paliers Track / Manage / Grow, par nombre d'établissements | Track 31 $/mois (annuel, 1 lieu), 41 $ mensuel ; Manage 40 $ ; Grow 49 $ ; Citation Builder à l'unité « dès 2 $ » (la FAQ dit 3,20 $) ; service géré dès 499 $/mois ; essai 14 jours sans carte | [1][2] |
| Local Falcon | Grille géographique de positions Maps et de visibilité IA, crédits | Starter 24,99 $/mois (7 500 crédits), Basic 49,99 $, Pro 99,99 $, Premium 199,99 $ ; lieux et mots-clés illimités ; crédit supplémentaire 0,05 $ ; 100 crédits offerts | [3][4] |
| Localo | Optimisation de fiche, grille, posts, avis (PME, agences) | 39 $/mois (1 fiche), 69 $ (10 fiches), -20 % annuel ; **source tierce partisane** | [9] |
| Whitespark | Citations, suivi de positions, Reputation Builder, service de listings | Citation Finder 33 à 149 $/mois ; Rank Tracker 14 à 200 $ ; Reputation Builder 79 $/lieu ; **source tierce** | [10] |
| Partoo | Présence en ligne et avis, réseaux français multi-sites | Sur devis (aucun montant publié) | [7] |
| Yext (Scout) | Agent de visibilité IA + listings, avis, pages | **[non vérifié]** (aucun tarif lu) | [5][6] |
| Uberall | Fiches, avis, messagerie, store locator | Sur devis | [11] |
| Birdeye | Avis, listings, messagerie, social, chatbot (3 éditions) | Sur devis, aucun montant lu | [12] |
| GMB Everywhere | Extension Chrome d'audit de fiche | **[non vérifié]** (achats intégrés, aucun tarif lu) | [8] |
| Guest Suite | Collecte et gestion d'avis (France) | **[non vérifié]** : seuls des résultats de recherche ont été vus, aucune page lue | — |
| Custplace | Avis clients vérifiés et multidiffusion (France) | **[non vérifié]** : pages inaccessibles ; QR code « intelligent » vu seulement dans un titre de recherche | — |

## 2. Inventaire par fonctionnalité

Pour chaque fonction : ce que voit l'utilisateur / la valeur / implémentation probable (marquée « hypothèse » : aucune
documentation technique lue) / faisable sans API Business Profile.

### 2.1 Grille géographique appliquée aux IA (Local Falcon)
- **Ce que voit l'utilisateur** : un rapport par couple mot-clé × lieu avec une carte de chaleur des points de la grille où
  l'entreprise est citée ou non, un « Share of AI Voice » (repères affichés : 75+ = cité la plupart du temps, 50-74 =
  souvent, moins de 50 = absent de la plupart des réponses), un « Buyer Persuasion Score » de -10 à +10, un rang moyen
  « pseudo-rang » fondé sur l'ordre de mention, les citations, le sentiment, les concurrents présents là où vous êtes absent,
  et une analyse « Falcon AI » avec recommandations [3][13].
- **Comment c'est appliqué** : le même prompt est envoyé depuis chaque point GPS d'une grille (exemple lu : rayon de 2 miles,
  7×7 = 49 points, points désactivables, par exemple sur l'eau). Chaque exécution renvoie la réponse IA, les marques
  mentionnées, le rang et les citations. Sources de données au choix : Google AI Overviews, AI Mode, Gemini, ChatGPT,
  Grok ; la page produit liste aussi Perplexity et Copilot (« 8 plateformes » annoncées mais sept nommées) [13][14][15].
- **Coût** : même système de crédits que le suivi de positions, par couple lieu × mot-clé ; plusieurs mots-clés lancés
  ensemble au même coût de crédits par scan [3][4][13].
- **Non documenté sur les pages lues** : la façon dont la localisation est transmise à ChatGPT ou Gemini (simulation de
  position, paramètre d'API, injection dans le prompt), la stabilité des résultats d'une exécution à l'autre, la formule
  de SoLV / ARP / ATRP (le nom SoLV est seulement indiqué comme marque déposée) **[non vérifié]** [13][14][16].
- **Valeur** : montrer qu'une entreprise est visible dans son quartier mais invisible à 3 km ; argument de vente fort pour
  agences. Limite assumée par l'éditeur : un rang moyen n'est pas un rang formel.
- **Implémentation probable (hypothèse)** : requêtes parallèles sur les API des moteurs ou rendu de pages, avec
  une position par point ; stockage d'une matrice points × résultats ; rendu cartographique.
- **Sans API Business Profile** : oui, la grille ne dépend pas du Business Profile. Notre version honnête : les API LLM
  ne prennent pas de coordonnées GPS ; on injecte le quartier ou la commune dans le prompt (« près de [quartier], [ville] »)
  sur une grille de 9 à 25 points, et on étiquette « simulation par zone ». Pour Gemini, ancrage Maps possible avec lat/long
  mais la contrainte CGU du brief (« Gemini sans ancrage ») s'applique **[à arbitrer]**.

### 2.2 Grille de positions Google Maps (Local Falcon, BrightLocal Local Search Grid, Localo, Whitespark)
- **Ce que voit l'utilisateur** : carte de points colorés (rang 1 à 20+) autour de l'établissement, rapport par
  concurrents qui nous dépassent à tel point, tendances, rapports programmés avec URL partageable [4][16]. BrightLocal :
  cartes de grille pour jusqu'à 5 mots-clés dans le palier Track [2]. Localo : grille par mot-clé et zone ; des avis
  d'utilisateurs jugent la précision inégale (source tierce partisane) [9]. Whitespark : suivi Google et Bing en pack local,
  Maps et organique, par coordonnées, code postal ou centre-ville, jusqu'à 100 positions (source tierce) [10].
- **Implémentation probable (hypothèse)** : une recherche locale par point avec position simulée, rang = index de
  l'établissement dans la liste retournée.
- **Sans API Business Profile** : oui, via l'API Places (recherche textuelle avec biais de localisation par point) : le
  rang est l'index dans les résultats retournés. Contraintes : pas de stockage de contenu Google hors place_id (§ 3) ;
  coût par requête (49 points × mots-clés) **[tarif Places non vérifié ici]** ; le classement « Places » n'est pas
  strictement celui de Google Maps grand public **[non vérifié]**.

### 2.3 Audit de fiche Google avec score (BrightLocal, Localo, GMB Everywhere)
- **Ce que voit l'utilisateur** : BrightLocal inclut des audits de fiche dès Track [2]. Localo compare la fiche aux facteurs
  de classement et aux concurrents proches, génère une liste de tâches, se rafraîchit tous les 7 jours ; la source ne décrit
  pas de score numérique [9]. GMB Everywhere (extension) affiche catégories (principale étoilée), statut revendiqué, Place
  ID, CID, liens avis et posts, autres entreprises à la même adresse ou au même site, graphiques d'activité des avis et
  des posts, Category Finder, simulation de recherche depuis une autre position (« Teleport »), comparaison côte à côte (« Local
  Scan ») [8].
- **Implémentation probable (hypothèse)** : lecture de la fiche (API ou page publique) + règles de complétude + comparaison
  avec les 3 concurrents les mieux classés.
- **Sans API Business Profile** : oui pour l'essentiel, via Places : nom, catégorie principale et types, adresse, téléphone,
  site, horaires, note et nombre d'avis, présence de photos et de description (champs exacts et plafonds de photos ou
  d'avis **[non vérifiés ici : la page des champs Places n'a pas pu être lue]**). Non lisible : posts, questions-réponses,
  attributs complets, statistiques de la fiche.
- **Notre score** : 100 points pondérés (complétude 30, catégories 15, avis 20, photos 10, activité 10, cohérence avec
  le site 15), explicables ligne à ligne, jamais présentés comme un score Google.

### 2.4 Audit de citations NAP (BrightLocal, Whitespark, Yext, Uberall, Partoo)
- **Ce que voit l'utilisateur** : BrightLocal : suivi de l'exactitude des citations dès Track, Citation Builder payant à
  l'unité, lacunes de citations renvoyées depuis Local AI Visibility vers Citation Builder [2][17]. Whitespark : Local
  Citation Finder qui analyse les listings concurrents et classe par facilité de soumission, 43 pays ; service de nettoyage
  de listings (corrige les NAP, supprime les doublons) en paiement unique, avec des retards signalés par des utilisateurs
  (source tierce) [10]. Partoo, Yext, Uberall : diffusion vers Google, Apple, Facebook, annuaires, GPS depuis une
  plateforme unique ; Uberall met en avant plus de 100 annuaires (page SAP) [7][11][18].
- **Implémentation probable (hypothèse)** : pour l'audit, interrogation de sources de listings ; pour la correction,
  partenariats éditeurs (le vrai moat des suites).
- **Sans API Business Profile** : oui pour l'audit. Liste France pour le contrôle : PagesJaunes, Apple Plans, Bing Places,
  Facebook, Mappy, Yelp, Tripadvisor, annuaires métier (liste proposée par nous, **à valider**). Méthode : recherche web
  « nom + ville » restreinte au domaine, lecture du NAP, comparaison normalisée (casse, accents, « rue » / « r. », format
  téléphone). Sortie : tableau annuaire × statut (présent, incohérent, absent) + liste des annuaires manquants avec lien
  pas-à-pas (déjà prévu : E12 à E16 de `docs/v2/04-execution.md`). Pas de correction automatique.

### 2.5 Gestion des avis
- **Collecte par QR, SMS, e-mail** : BrightLocal Grow : demandes par e-mail, SMS et campagnes en magasin [2]. Whitespark
  Reputation Builder : e-mail ou SMS, 100+ plateformes, **route les notes basses vers un retour privé** (source tierce)
  [10] ; ce schéma est celui que `docs/v2/04-execution.md` § 3.1 classe comme interdit par la politique Google
  (sollicitation sélective). Custplace : QR code « intelligent » vu dans un titre de recherche seulement **[non vérifié]**.
  Birdeye : demandes SMS cités par des avis tiers, rien lu sur la page **[non vérifié]** [12].
- **Réponses par IA** : Partoo a un assistant « Jim » pour rédiger les réponses (via La Fabrique du Net, source tierce)
  [7] ; Uberall : assistant IA de réponse intégré [11] ; Birdeye : « Reviews AI » (nom d'édition seulement) [12] ; Localo :
  modèles par type d'avis, réponse publiée directement sur Google [9] ; Whitespark : réponses manuelles par modèles [10].
- **Widgets d'avis sur le site** : BrightLocal Grow « publier les avis sur votre site » [2] ; Partoo : widgets d'affichage
  [7]. Contraintes : mentions d'information (art. L111-7-2) et, pour des avis Places, affichage de la date de visite pour la
  France, avis crédité à l'auteur, lien vers Google Maps [§ 3].
- **Analyse de sentiment** : Partoo (via source tierce) [7] ; Local Falcon sur les réponses IA, pas sur les avis [13].
- **Sans API Business Profile** : kit de demande (lien d'avis, QR, SMS, e-mail, affiche) : oui, et déjà livré en V2 ;
  réponses IA : oui sur texte d'avis collé par le client (brouillon + validation humaine) ; lecture automatique des avis :
  limitée à ce que Places expose **[plafond non vérifié ici]** ; publication de la réponse : non.

### 2.6 Posts Google programmés
- BrightLocal Manage : « scheduled GBP posts » [2]. Localo : Content Publisher pour posts Google et Facebook, texte rédigé par
  IA, calendrier visuel [9].
- **Implémentation probable** : API Local Posts du Business Profile (déjà notée E03 dans `docs/v2/04-execution.md`).
- **Sans API Business Profile** : non pour publier. Repli honnête : calendrier de 4 posts par mois, texte et visuel à
  copier, rappel par e-mail, marqué « publication manuelle ».

### 2.7 Suivi de positions locales
- BrightLocal : suivi jusqu'à 100 mots-clés et 4 concurrents par établissement dès Track [2] ; Whitespark : Google et Bing
  [10] ; Local Falcon : positions sur grille [4].
- **Sans API Business Profile** : oui via recherche Places en un seul point (centre) ou la grille (2.2), historique en
  base : mêmes contraintes de stockage (§ 3).

### 2.8 Rapports clients en marque blanche
- Local Falcon : rapports Tendance, Campagne, Mot-clé, Lieu, Concurrent ; rapports programmés avec URL partageable, mise en
  page personnalisée ; agences : rapports et tableaux de bord en marque blanche, widget de scan avec capture de leads à
  intégrer sur son site ; intégrations Looker Studio, Zapier, n8n, API, connecteurs Claude et ChatGPT, MCP [13][16]. La
  page de prix liste « White Label Reports » sans préciser les paliers [4]. BrightLocal : marque blanche listée dans le
  tableau des plans sans palier lisible [2].
- **Sans API Business Profile** : oui, entièrement (rapport produit à partir de nos propres mesures).

### 2.9 Presence management multi-établissements
- Partoo : synchronisation des informations d'établissement vers Google, Apple, Facebook, annuaires ; point faible cité :
  reporting limité, résiliation difficile (avis tiers non vérifiés) [7]. Yext : Scout connecté à Listings, Reviews et Pages,
  mesure à l'échelle (plus de 2 milliards de points de données par mois sur 9 millions de couples entreprise-lieu, chiffres
  de l'éditeur) [5][6]. Uberall : plus de 1,5 million d'établissements gérés (chiffre de l'éditeur), avis, messagerie, store
  locator, « Answers » [11]. Birdeye : trois éditions Starter / Growth / Dominate [12].
- **Implémentation probable (hypothèse)** : accords de partenariat avec chaque éditeur d'annuaire + API Business Profile en
  mode agence.
- **Sans API Business Profile** : tableau de bord multi-sites en lecture (scores, dérives NAP, alertes) : oui ; diffusion
  automatique vers les annuaires : non.

### 2.10 Autres fonctions à noter
- **Sources citées par les IA et rivaux locaux détectés** (BrightLocal) [1] : Repéré a déjà cette brique (436 domaines).
- **Explications en langage clair du pourquoi les rivaux passent devant, actions classées par impact** (BrightLocal) [1] : à
  reprendre sur notre moteur de gaps.
- **Scan de prospect intégrable sur un site** (Local Falcon, agences) [13] : équivalent de notre audit gratuit en widget.
- **Agent d'automatisation** (Falcon Agent, scans programmés ou conditionnels) [16] : équivalent de nos alertes.

## 3. Contraintes d'API et de règles à retenir

- **Business Profile** : approbation requise, fiche active depuis 60 jours (voir `docs/v2/04-execution.md` § 2). Hors
  périmètre jusqu'à approbation.
- **Places (règles lues)** [19] : ne pas pré-collecter, indexer ni stocker du contenu Places (noms, adresses, avis) hors
  exceptions ; place_id stockable sans limite ; latitude/longitude en cache 30 jours maximum ; pas de « contenu dérivé »
  (exemple cité : analyse point-dans-polygone) ; interdiction du scraping et de l'export en masse ; attribution Google
  obligatoire ; pour des avis : auteur crédité, lien `googleMapsUri`, avis de lieux français avec `visitDate`, mention de
  l'ordre et du filtrage ; résumés IA avec `disclosureText` inchangé. **Conséquence** : l'historique de positions est un
  résultat calculé, pas un contenu copié, mais la frontière n'est pas tranchée par la page lue ; valider avant de
  stocker une grille ou des avis **[à vérifier auprès de Google]**.
- **Avis** : pas de filtre de satisfaction (cf. `docs/v2/04-execution.md` § 3.1) ; affichage d'avis = obligations de
  l'art. L111-7-2 (§ 3.2 du même document).
- **LLM** : pas de coordonnées GPS dans les API de ChatGPT, Claude, Perplexity **[non vérifié pour chaque API]** ; Gemini
  « sans ancrage » selon le brief.

## 4. Les 6 fonctionnalités à cloner pour le parcours Local

| Rang | Fonction | Effort | Pourquoi |
|---|---|---|---|
| 1 | Audit de fiche Google avec score et actions (2.3) | S à M | Faisable avec les seules données publiques, valeur immédiate, base du plan d'action |
| 2 | Carte de visibilité par zone, IA + Maps (2.1 et 2.2) | M | Seule vraie fonction que nous n'avons pas, argument marketing fort ; version « simulation par zone » honnête |
| 3 | Audit NAP + annuaires manquants (2.4) | M | Fonction d'entrée des concurrents (BrightLocal, Whitespark), alimente les tâches E12 à E16 |
| 4 | Kit d'avis complet QR + SMS + e-mail sans filtre, réponses IA validées, analyse de thèmes (2.5) | S à M | Déjà en V2 en partie ; ajouter SMS et analyse de thèmes ; refuser le tri par satisfaction |
| 5 | Rapport client en marque blanche + rapport programmé (2.8) | M | Ouvre le canal agences, entièrement faisable sans API Google |
| 6 | Calendrier de posts + rappel (2.6) | S | Parité de surface avec BrightLocal Manage et Localo, sans API ; publication auto reportée |

À ne pas cloner maintenant : diffusion multi-annuaires (partenariats), publication de posts et de réponses sans API
approuvée, widget d'avis (obligations légales).

## 5. Ce qui n'a pas été lu (limites de ce teardown)

- Pages produit de Guest Suite et Custplace (inaccessibles ou non lues) ; Yext : aucun tarif ; GMB Everywhere : aucun tarif.
- Grilles de Local Falcon : tailles autres que l'exemple 7×7, définitions de ARP, ATRP, SoLV, méthode de localisation pour
  les LLM.
- BrightLocal : page Local Search Grid non lisible (hors liste autorisée) ; paliers incluant la marque blanche non lisibles.
- Page des champs et des tarifs de l'API Places non lue (accès refusé) : plafonds d'avis et de photos, coût par requête.
- Les prix Localo et Whitespark viennent d'articles tiers ; ceux de Partoo, Uberall et Birdeye sont « sur devis ».
- Aucune recherche n'a porté sur les évolutions de Birdeye ou Uberall après 2025 ; la fiche de presse Yext de juin 2026
  n'a pas été ouverte.

## 6. Sources

1. BrightLocal, Local AI Visibility : https://www.brightlocal.com/local-ai-tools/local-ai-visibility/
2. BrightLocal, plans et prix : https://www.brightlocal.com/pricing/
3. Local Falcon, prix : https://www.localfalcon.com/pricing
4. Local Falcon, suivi de positions : https://www.localfalcon.com/features/local-rank-tracker
5. Yext, Scout (blog) : https://www.yext.com/blog/how-yext-scout-helps-brands-outperform-competitors-across-ai-and-search
6. Yext, communiqué Scout : https://www.businesswire.com/news/home/20250303452300/en
7. La Fabrique du Net, Partoo : https://www.lafabriquedunet.fr/logiciel/partoo
8. GMB Everywhere, Chrome Web Store : https://chromewebstore.google.com/detail/oibcaeeplepnjfjhokfcabnaafodppik
9. Search Atlas, avis Localo (tiers, partisan) : https://searchatlas.com/localo-review
10. Search Atlas, avis Whitespark (tiers) : https://searchatlas.com/whitespark-review
11. Uberall vs Yext : https://get.uberall.com/uberall-vs-yext
12. G2, prix Birdeye : https://www.g2.com/products/birdeye/pricing
13. Local Falcon, fonctionnement du suivi IA : https://www.localfalcon.com/blog/how-local-falcons-local-ai-visibility-tracking-works
14. Local Falcon, AI Mode, Gemini, Grok : https://www.localfalcon.com/blog/now-live-track-your-ai-visibility-in-ai-mode-gemini-and-grok-with-local-falcon
15. Local Falcon, page AI visibility : https://www.localfalcon.com/features/ai-visibility
16. Local Falcon, rapports et marque blanche (même page 15 et 4)
17. BrightLocal, aide, Local AI Visibility : https://help.brightlocal.com/hc/en-us/articles/37989673412114-What-is-Local-AI-Visibility
18. SAP, page partenaire Uberall (vue en résultat de recherche seulement) : https://www.sap.com/germany/products/crm/partners/uberall-gmbh-uberall-location-marketing-platform.html
19. Google Places, politiques : https://developers.google.com/maps/documentation/places/web-service/policies
