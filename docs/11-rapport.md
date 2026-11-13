# 11 — Spécification du rapport AuditIA Local (page web + PDF)

> Agent RAPPORT. Le rapport est l'outil de vente principal. Objectif : en 10 secondes, un commerçant non technophile comprend (1) son score, (2) qu'un concurrent est recommandé à sa place, (3) qu'il existe un moyen simple d'y remédier.
> Contrat de données : `AuditResult` de `docs/00-ARCHITECTURE.md` (aucun champ nouveau obligatoire ; les champs dérivés sont calculés côté rapport, voir §12).

## 0. Ce que disent les références (recherche)

- **Local Falcon** ([lecture d'un rapport AI Visibility](https://www.localfalcon.com/knowledge-base/kb96-how-to-read-an-ai-visibility-scan-report)) : métriques simples (Share of AI Voice = % de réponses qui citent le commerce ; rang moyen), grille colorée vert/jaune/rouge, clic = la réponse brute de l'IA, tableau « marques citées » avec leurs scores côte à côte, sources. Leçons : la preuve brute (réponse réelle) et la comparaison aux concurrents sont les deux éléments qui frappent ; la couleur code l'état sans lecture.
- **HubSpot Website Grader** ([relance](https://blog.hubspot.com/marketing/website-grader-relaunch?afsrc=1)) : score unique /100 en quelques secondes, 4 catégories, recommandations en bas, entrée à faible friction (gratuit, résultat immédiat), lien avec les enjeux business (trafic, leads, CA), partage facile, discours « sous 90 = marge de progression ». Leçons : un chiffre unique + des catégories lisibles + la promesse « puis comment l'améliorer gratuitement ».
- **BrightLocal** (Local Search Audit, [guide rapports clients](https://www.brightlocal.com/learn/effective-client-reports-with-brightlocal/)) : la page n'a pas pu être lue en détail (seule la méta-description est accessible : donner l'information nécessaire et montrer l'impact). Principe retenu, à confirmer : rapport marqué à l'image du vendeur, centré sur l'impact plutôt que sur l'activité.
- Limite de la recherche : 3 des 4 recherches web n'ont renvoyé que des listes de liens ; seules 2 pages ont été lues intégralement. Les principes ci-dessous mêlent ces sources et des pratiques générales de persuasion (aversion à la perte, preuve concrète, comparaison sociale, engagement progressif). Ils sont à valider par test A/B sur de vrais envois.

### Principes de persuasion retenus
1. **Un chiffre, une couleur, une phrase** au-dessus de la ligne de flottaison.
2. **Preuve brute** : la vraie phrase de l'IA, pas une statistique abstraite.
3. **Aversion à la perte** : on montre qui est recommandé à sa place (nom propre), pas « vous manquez de visibilité ».
4. **Comparaison sociale** : barres vs concurrents, tranche « top 25 % / moyenne ».
5. **Valeur gratuite d'abord** : 3 actions concrètes qui marchent sans payer (réciprocité) ; le payant promet la suite (personnalisation, suivi).
6. **Honnêteté** : méthode et limites visibles ; mode démo clairement étiqueté. La confiance fait vendre aux TPE.
7. **Zéro jargon** : « GEO », « share of voice » jamais en titre ; on dit « part des recommandations ».

## 1. Architecture générale de la page `/rapport/[id]`

Ordre (une colonne, max-width 880 px, cartes arrondies, fond clair, accent unique rouge-orangé pour le négatif, vert pour le positif, bleu nuit pour la marque) :

| # | Section | Rôle |
|---|---|---|
| 1 | Couverture | Choc + clarté en 10 s |
| 2 | Ce que les IA répondent à vos clients | Preuve émotionnelle |
| 3 | Tableau par IA | Où exactement on manque |
| 4 | Classement des concurrents | Comparaison sociale |
| 5 | Carte des requêtes | Détail rassurant, scannable |
| 6 | 3 actions prioritaires gratuites | Valeur donnée |
| 7 | Teaser plan complet (flouté) | Désir + ancrage |
| 8 | Méthode et limites | Confiance |
| 9 | CTA | Conversion |

Barre sticky (mobile et desktop, apparaît après la couverture) : « Votre score : 23/100 · Voir le plan d'action ». Bouton secondaire « Télécharger le PDF » et « Partager » (lien + WhatsApp, fort usage chez les artisans).

Règle de bascule démo : si `demo === true`, bandeau fixe en haut « Rapport de démonstration : données simulées » et filigrane discret ; le PDF reprend le bandeau.

## 2. Couverture (hero)

**Données** : `score`, `input.businessName`, `input.trade`, `input.city`, `input.district`, `createdAt`, `confidence`, `demo`, `mentionRate`.
Dérivé : `tranche` (voir §12.1).

**Rendu**
- Jauge semi-circulaire (arc 180°) ou anneau complet, diamètre 240 px desktop / 200 px mobile, chiffre géant au centre (96 px, graisse 800) suivi de « /100 ».
- Couleur de l'arc selon tranche : 0–19 rouge, 20–39 orange, 40–59 jaune ambre, 60–79 vert clair, 80–100 vert.
- Animation : l'aiguille/arc monte de 0 au score en 1,2 s (ease-out), le chiffre compte en synchro. `prefers-reduced-motion` : affichage direct.
- Sous la jauge : pastille de tranche (« Peu visible », « Visibilité faible », « Correct », « Bien placé », « Référence locale »).
- En-tête : nom du commerce en grand, « Plombier · Paris 11e » en sous-titre, « Audit du 9 novembre 2026 ».
- Une phrase-verdict générée (voir texte type).
- Mini-ligne de 3 chiffres : « Cité dans X % des réponses », « Rang moyen : n° Y », « Concurrent le plus cité : Z ».

**Texte type**
- Titre : « Visibilité de [Dupont Plomberie] auprès des assistants IA »
- Verdict score < 40 : « Quand vos clients demandent conseil à ChatGPT, Perplexity ou Gemini, **vous n'êtes cité que dans 1 réponse sur 8**. Vos concurrents, eux, le sont tous les jours. »
- Verdict 40–69 : « Vous êtes cité dans X % des réponses : c'est un début, mais [Concurrent] passe devant vous. »
- Verdict ≥ 70 : « Bonne nouvelle : les IA vous recommandent. Voici comment garder l'avance. »
- Sous-texte confiance : « Basé sur N questions posées à 3 assistants IA. Fiabilité : moyenne. »

**Mobile** : jauge pleine largeur centrée (200 px), titre sur 2 lignes max, 3 chiffres empilés en carrousel horizontal ou colonne ; verdict en 18 px. Tout le hero tient dans un écran 390×700 px.

**Accessibilité** : jauge avec `role="img"` et `aria-label="Score 23 sur 100, visibilité faible"` ; la couleur n'est jamais seule (libellé de tranche).

## 3. « Ce que les IA répondent à vos clients »

**Objectif** : le moment où le commerçant « voit » le problème avec ses mots.

**Données**
- `answers[]` (`provider`, `queryId`, `text`, `citations`, `demo`)
- `mentions[]` (`mentioned`, `rank`, `competitors`, `snippet`)
- `queries[]` (`text`, `intent`)
- `input.businessName` pour la mise en évidence.

**Sélection des 2 ou 3 extraits** (algorithme déterministe, à implémenter dans un helper `pickShowcase(result)`) :
1. Extrait A, « le choc » : réponse où `mentioned === false` et `competitors.length >= 2`, requête d'intention `best` en priorité, fournisseur au choix le plus connu (chatgpt > gemini > perplexity).
2. Extrait B, « la comparaison » : réponse où un concurrent est cité n° 1, de préférence sur un autre fournisseur qu'A.
3. Extrait C (optionnel) : une réponse où le commerce EST cité (si `mentioned`) pour montrer le point positif ; sinon second choc `nearby` ou `urgent`.
- Troncature : 280 caractères max centrés sur la première mention d'un concurrent ; « … » au début/fin ; jamais de coupe en milieu de mot. Réponse complète dans un « Voir la réponse complète » (accordéon).
- Si `demo`, étiqueter chaque carte « exemple simulé ».

**Rendu**
- Format « bulle de chat » : en haut, la question du client (bulle grise à droite, avatar générique) ; dessous la réponse de l'IA (bulle blanche à gauche, logo/pastille du fournisseur : ChatGPT, Perplexity, Gemini).
- Noms de concurrents : surlignage jaune vif (`<mark>`) + pastille numéro de rang (1, 2, 3).
- Nom du commerce : s'il est absent, une ligne de rappel sous la bulle en rouge : « Votre commerce n'apparaît nulle part dans cette réponse. » S'il est présent : surlignage vert.
- Effet « machine à écrire » à l'apparition dans le viewport (30 ms/caractère, 1,5 s max) ; bouton « passer ».
- Légende : « Réponse réelle de ChatGPT, obtenue le 9/11/2026 à la question : … ».

**Texte type (titre de section)** : « Voilà ce que les IA répondent à vos clients »
Sous-titre : « Nous leur avons posé les questions que vos clients posent. Voici leurs réponses, telles quelles. »

**Mobile** : cartes empilées pleine largeur, police 15–16 px, interligne 1,5 ; une seule carte visible d'office + « Voir l'exemple suivant » (carrousel à points) pour ne pas allonger la page. Surlignage conservé, contraste ≥ 4,5:1.

**Cas limites**
- Aucune réponse avec concurrent identifié : afficher la meilleure réponse et le texte « Les IA ne citent personne de précis : c'est une place à prendre. »
- Commerce cité partout : remplacer le choc par la phrase « Voici comment les IA parlent de vous » et surligner le commerce.

## 4. Tableau par IA

**Données** : `subScores` (`chatgpt`, `perplexity`, `gemini`, `claude`, `null` si non utilisé), `mentions[]` regroupées par `provider` pour calculer taux de mention et rang moyen par IA, `answers[].demo`.

**Rendu**
- 3 à 4 lignes (une par IA utilisée ; une IA `null` n'est pas affichée, ou grisée « bientôt »).
- Colonnes : IA (logo + nom) | Score /100 (mini jauge horizontale colorée) | Cité dans X/Y réponses | Rang moyen | Verdict (emoji-pastille : ✓ vert « Vous recommande », ~ orange « Vous cite parfois », ✗ rouge « Ne vous cite pas »).
- Ligne la plus faible mise en avant : « Votre point faible : Gemini ».
- Info-bulle d'une phrase par IA : « ChatGPT : l'assistant le plus utilisé par le grand public. »

**Texte type** : « Les IA ne répondent pas toutes pareil »

**Mobile** : le tableau devient une pile de cartes (une par IA) : logo + score + 2 lignes « Cité dans 2/8 réponses · Rang moyen n° 3 » ; pas de scroll horizontal.

## 5. Classement des concurrents

**Données** : `competitors[]` (`name`, `mentions`, `share`), `shareOfVoice`, `input.businessName`, `mentionRate`.

**Rendu**
- Barres horizontales triées par `share` décroissant, top 5 concurrents + la ligne « Vous » insérée à sa vraie position (même si 0 %).
- Barre du commerce en bleu nuit avec libellé gras « Vous » ; concurrents en gris-orangé ; leader avec couronne ou pastille « n° 1 ».
- Étiquette en bout de barre : « 62 % des réponses ».
- Si le commerce est absent du classement : ligne « Vous : 0 % » en rouge au bas, avec flèche « Vous êtes ici ».
- Barres animées de la gauche vers la droite à l'apparition.

**Texte type**
- Titre : « Qui les IA recommandent à votre place »
- Phrase d'accroche calculée : « **[Concurrent A]** est cité dans **62 %** des réponses. Vous : **12 %**. »
- Note : « Les noms sont ceux cités par les IA ; il peut s'agir d'annuaires ou de plateformes. »

**Règle** : filtrer des « concurrents » les annuaires/plateformes génériques (PagesJaunes, Google Maps, Yelp, TripAdvisor, Doctolib) vers une liste secondaire « Sites cités » pour ne pas fausser le message ; à coordonner avec `detect.ts`.

**Mobile** : même barre pleine largeur, nom au-dessus de la barre (pas à gauche) ; top 4 + « Voir tout » ; pourcentage à droite du nom.

## 6. Carte des requêtes

**Données** : `queries[]` (`id`, `text`, `intent`), `mentions[]` (`queryId`, `provider`, `mentioned`, `rank`, `run`).
Agrégation par cellule (requête × fournisseur) sur les `run` : `mentioned` si ≥ 1 run mentionne ; rang = meilleur rang ; fraction `k/n` si plusieurs runs.

**Rendu**
- Matrice : lignes = requêtes (texte lisible, ex. « Meilleur plombier Paris 11e »), colonnes = IA utilisées.
- Cellule : ✓ vert + « n° 2 » si cité ; ✗ rouge si non cité ; « – » gris si erreur/non testé ; si plusieurs runs : ✓ « 2/3 » (cité 2 fois sur 3).
- Marque d'intention à gauche (petite étiquette : « Meilleur », « Près de moi », « Urgence », « Précis », « Avis »).
- Tri par défaut : requêtes les plus « perdues » en premier (0 ✓).
- Ligne de synthèse en bas : « Cité sur 3 requêtes sur 10 ».
- Clic/tap sur une cellule : ouvre la réponse (accordéon ou bottom sheet) avec concurrents surlignés.

**Texte type** : « Question par question : où vous apparaissez, où vous êtes invisible »

**Mobile** : la matrice passe en liste de cartes par requête, chaque carte avec 3 pastilles (C, P, G) ✓/✗ + rang ; légende fixe en haut ; sinon table compacte à défilement horizontal avec première colonne figée (fallback).

## 7. Les 3 actions prioritaires gratuites

**Objectif** : donner une vraie valeur pour déclencher la réciprocité, sans livrer le plan complet.

**Données** : sortie « courte » de `actions.ts` (ex. `generateActions(result).slice(0, 3)`), à défaut règles ci-dessous selon `input.website`, `mentions` (écarts par intention), `subScores` (IA la plus faible), `competitors[0]`. Aucun champ nouveau requis ; recommander à l'agent ENGINE d'exposer `actions: { title, why, how, effort, impact }[]` si possible (sinon dériver côté rapport).

**Actions par défaut (bibliothèque de repli, choisies selon le diagnostic)**
1. **Compléter et dynamiser la fiche Google Business Profile** (horaires, services, photos, description avec métier + quartier). Pourquoi : les IA s'appuient beaucoup sur les données locales publiques.
2. **Obtenir 5 avis récents** citant le métier et le quartier (message-type à envoyer par SMS/WhatsApp fourni).
3. **Ajouter sur le site une page « [Métier] à [Quartier] »** avec 5 questions-réponses (FAQ) et l'adresse ; ou, sans site, créer la présence sur 1 annuaire de référence.
Variantes : urgence (afficher « dépannage 24/7 »), cohérence NAP (nom-adresse-téléphone identiques partout), présence sur les sites cités par les IA (`answers[].citations` : domaines les plus fréquents → « Soyez présent sur [domaine] »).

**Rendu**
- 3 cartes numérotées, chacune : titre verbe d'action, « Pourquoi » en 1 ligne (avec lien au constat : « ChatGPT cite [X] car… »), « Comment faire » en 3 puces courtes, badges « 15 min » / « Gratuit » / « Impact : fort ».
- Case à cocher locale (localStorage) : « Je l'ai fait » (engagement, gamification légère).
- Bouton « Copier le message d'avis » dans l'action 2.

**Texte type** : « 3 actions gratuites à faire cette semaine »
Sous-titre : « Pas besoin de nous payer pour commencer. Ces 3 gestes font déjà bouger les choses. »

**Mobile** : cartes empilées, puces, boutons pleine largeur (taille tactile ≥ 44 px).

## 8. Teaser du plan complet (flouté)

**Objectif** : désir et sentiment de « il y a plus, et c'est précis pour moi », sans tromper.

**Données** : `competitors[0].name`, `queries.length`, nombre d'actions du plan (valeur indicative issue de `actions.ts` si disponible, sinon 12 à 15 fixes mentionnés « environ »), `input.trade`, `input.district`.

**Rendu**
- Carte « document » avec 8 lignes d'actions réellement générées mais **les lignes 4 à 12 floutées** (CSS `filter: blur(6px)`, `user-select: none`, contenu aria-hidden ; texte réel non servi dans le DOM pour éviter l'inspection : envoyer des chaînes factices de même longueur, ne jamais le vrai plan).
- 3 lignes lisibles en tête (accroches), puis les suivantes floutées avec cadenas.
- Bandeau diagonal : « Plan d'action personnalisé : 149 € une fois ».
- Liste des bénéfices en 4 puces : « Vos 12 actions classées par impact », « Textes prêts à copier (fiche Google, site, avis) », « Les sites où [Concurrent A] est cité et pas vous », « Un re-contrôle pour mesurer le résultat ».
- Preuve/garantie : « Satisfait ou remboursé 14 jours » (à valider avec l'agent juridique/pricing).

**Texte type** : « Le plan complet pour passer devant [Concurrent A] »

**Mobile** : carte pleine largeur, 5 lignes visibles max, bouton collant « Débloquer mon plan : 149 € ».

## 9. Méthode et limites

**Données** : `queries.length`, nombre de `run` (max de `mentions[].run`), fournisseurs réellement utilisés (`subScores` non null), `createdAt`, `confidence`, `demo`, `answers[].error`.

**Rendu** : section repliable (ouverte par défaut dans le PDF), icône « i », ton sobre.

**Texte type**
- « Comment on a mesuré : nous avons posé **N questions** que vos clients posent réellement, **à 3 assistants IA** (ChatGPT, Perplexity, Gemini), **R fois chacune**, le [date]. Nous notons si vous êtes cité, à quelle place, et qui l'est à votre place. »
- « Le score /100 combine : le taux de citation, la place dans la réponse, la régularité sur plusieurs IA. »
- « Fiabilité : [moyenne] : les IA ne répondent pas toujours à l'identique. Un score peut varier de quelques points d'un jour à l'autre. »
- « Limites : on ne voit pas tout ce que voient vos clients (personnalisation, historique, géolocalisation exacte). Ce rapport est un instantané, pas une garantie de clientèle. »
- Mode démo : « Ce rapport utilise des réponses simulées pour illustrer le format. »
- Mention éditeur : « AuditIA Local n'est affilié ni à OpenAI, ni à Google, ni à Perplexity. »

**Mobile** : accordéon fermé avec résumé de 2 lignes visibles.

## 10. CTA

**Rendu**
- CTA principal en bas (et répété en barre sticky mobile) : bouton plein large « Recevoir mon plan d'action : 149 € » (Stripe Payment Link).
- CTA secondaire : « Suivre mon score chaque mois : 29 €/mois ».
- CTA tertiaire (friction minimale) : « Recevoir ce rapport par e-mail » / « Réserver 15 min avec nous » (pour les non-convaincus).
- Réassurance sous le bouton : paiement sécurisé, sans engagement, résiliable en 1 clic, facture.
- Partage : « Envoyer ce rapport à mon associé / comptable ».

**Texte type**
- Titre : « [Concurrent A] est recommandé à votre place. Reprenez la main. »
- Corps : « En 14 jours, la plupart des commerces appliquent les premières actions. On re-mesure ensuite votre score. »
- Éviter les promesses chiffrées de résultats (« +50 % de clients ») : non prouvables.

**Mobile** : barre fixe en bas (hauteur 64 px) avec le bouton primaire ; ne couvre pas le contenu (padding-bottom).

## 11. Rendu transversal

- **Typographie** : titres 28/22 px, texte 16 px, chiffres tabulaires pour les scores ; police système ou Inter.
- **Couleurs** : palette sémantique constante (rouge/orange/ambre/vert) + 1 couleur de marque. Contraste AA minimum. Mode sombre supporté.
- **Performance** : rapport rendu côté serveur (RSC) ; animations légères ; < 150 ko JS ; chargement < 2 s sur 4G.
- **Partage** : balises Open Graph avec image dynamique (score + nom) : « Dupont Plomberie : 23/100 de visibilité IA ».
- **Mode démo/mock** : badge « Démo » sur couverture, extraits et PDF.

## 12. Champs dérivés à calculer (aucun changement de contrat)

### 12.1 Tranches
| Score | Tranche | Libellé | Couleur |
|---|---|---|---|
| 0–19 | 1 | Quasi invisible | rouge |
| 20–39 | 2 | Visibilité faible | orange |
| 40–59 | 3 | Correcte | ambre |
| 60–79 | 4 | Bonne | vert clair |
| 80–100 | 5 | Référence locale | vert |

(À aligner avec les seuils définis par l'agent ENGINE dans `scoring.ts` ; ceux-ci sont une proposition.)

### 12.2 Autres
- `leader = competitors[0]` ; `gapToLeader = leader.share - shareOfVoice`.
- `weakestProvider = argmin(subScores non null)`.
- `byProvider[p] = { cited: n, total: m, avgRank }` à partir de `mentions`.
- `queryMatrix[queryId][provider] = { mentioned, bestRank, k, n }`.
- `topCitedDomains` à partir de `answers[].citations` (domaine, comptage).

## 13. PDF A4, 3 pages

Rendu via `@react-pdf/renderer` (`src/lib/pdf/Report.tsx`). Marges 14 mm, polices embarquées (Inter ou Helvetica), pas d'animation : jauge en SVG statique, barres en `View` colorées. Pied de page : « AuditIA Local · date · page n/3 · lien court vers le rapport en ligne » (QR code vers `/rapport/[id]`).

### Page 1 : Le constat (couverture + preuve)
```
+--------------------------------------------------------------+
| AuditIA Local                              Audit du 09/11/2026|
|                                                              |
|   DUPONT PLOMBERIE                                           |
|   Plombier · Paris 11e                                       |
|                                                              |
|            .-------------.                                   |
|          /    23 /100      \      Visibilité faible          |
|         |   [ jauge arc ]   |     Cité dans 1 réponse sur 8  |
|          \                 /      Rang moyen : n° 3          |
|            '-------------'        Fiabilité : moyenne        |
|                                                              |
|  "Quand vos clients demandent conseil aux IA, vous n'êtes    |
|   presque jamais cité. Vos concurrents, si."                 |
|--------------------------------------------------------------|
|  CE QUE LES IA RÉPONDENT À VOS CLIENTS                       |
|  +--------------------------------------------------------+  |
|  | Question : « Meilleur plombier Paris 11e ? »           |  |
|  | ChatGPT : « Parmi les plombiers du 11e, [Martin        |  |
|  |  Plomberie] et [Paris Dépannage 24] reviennent... »    |  |
|  | (noms surlignés en jaune)                              |  |
|  | >> Votre commerce n'apparaît pas dans cette réponse.   |  |
|  +--------------------------------------------------------+  |
|  +--------------------------------------------------------+  |
|  | Question : « Plombier urgence Bastille » (Perplexity)  |  |
|  +--------------------------------------------------------+  |
| Pied : QR code + « Rapport complet en ligne »      p. 1/3    |
+--------------------------------------------------------------+
```

### Page 2 : La comparaison
```
+--------------------------------------------------------------+
| LES IA, UNE PAR UNE                                          |
|  ChatGPT     [#####-----] 41   cité 3/8   rang moyen 2       |
|  Perplexity  [##--------] 18   cité 1/8   rang moyen 4       |
|  Gemini      [----------]  0   cité 0/8   -                  |
|--------------------------------------------------------------|
| QUI LES IA RECOMMANDENT À VOTRE PLACE                        |
|  Martin Plomberie   [##########################] 62 %       |
|  Paris Dépannage 24 [##################--------] 45 %       |
|  Plomb'Express      [#########---------------]  22 %        |
|  VOUS               [####--------------------]  12 %  <--   |
|--------------------------------------------------------------|
| QUESTION PAR QUESTION                                        |
|  Requête                         ChatGPT  Perplexity Gemini  |
|  Meilleur plombier Paris 11e       ✗        ✗         ✗      |
|  Plombier urgence Bastille         ✓ n°3    ✓ n°4     ✗      |
|  Fuite d'eau 11e                   ✗        ✗         ✗      |
|  ... (8 à 10 lignes)                                         |
|  Synthèse : cité sur 2 requêtes sur 10               p. 2/3  |
+--------------------------------------------------------------+
```

### Page 3 : Passer à l'action
```
+--------------------------------------------------------------+
| 3 ACTIONS GRATUITES À FAIRE CETTE SEMAINE                    |
|  [1] Compléter votre fiche Google    15 min · gratuit · fort |
|      Pourquoi / Comment (3 puces)                            |
|  [2] Obtenir 5 avis récents          20 min · gratuit · fort |
|  [3] Page « Plombier Paris 11e »     45 min · gratuit · moyen|
|--------------------------------------------------------------|
| LE PLAN COMPLET (aperçu)                                     |
|  1. Corriger la fiche Google ............ (lisible)          |
|  2. Obtenir des avis ................... (lisible)           |
|  3. Page quartier ...................... (lisible)           |
|  4. ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒ (flou)                       |
|  5. ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒                                |
|  ... jusqu'à 12                                              |
|  Plan personnalisé 149 € · Suivi mensuel 29 €/mois           |
|--------------------------------------------------------------|
| COMMENT ON A MESURÉ (4 lignes) + limites (3 lignes)          |
|--------------------------------------------------------------|
|  [ Recevoir mon plan d'action ]   <QR code>   p. 3/3         |
|  auditia.fr/rapport/abc123 · contact@auditia.fr              |
+--------------------------------------------------------------+
```

Notes PDF
- Flou : en PDF, remplacer le flou CSS par de vraies barres grises ; ne jamais embarquer le texte réel des actions payantes.
- Si `demo`, bandeau diagonal « DÉMO » discret en filigrane sur les 3 pages.
- Tout reste lisible en niveaux de gris (rang écrit en toutes lettres, ✓/✗ + mots), car beaucoup d'artisans impriment.
- Poids cible < 400 ko (pas d'images bitmap).

## 14. Trois « moments wow » à mettre en scène

### Wow 1 : « Quand on demande à ChatGPT… il recommande votre concurrent »
- **Où** : section 3, juste sous la couverture (au deuxième écran).
- **Mise en scène** : la question du client s'écrit dans une barre de chat, un petit indicateur « ChatGPT réfléchit… » (0,8 s), puis la réponse réelle se tape ; les noms de concurrents se surlignent un à un en jaune, avec pastille de rang. Le commerce n'apparaît pas : la ligne rouge « Vous n'êtes pas dans la réponse » surgit en dernier, après une pause d'une seconde.
- **Pourquoi** : preuve brute, nom propre, aversion à la perte. C'est l'émotion qui déclenche la lecture du reste.
- **Garde-fous** : la réponse est réellement celle obtenue (pas réécrite) ; le bouton « voir la réponse complète » prouve l'authenticité.

### Wow 2 : « Le même client, 3 IA, 3 recommandations : toujours le même concurrent »
- **Où** : entre les sections 3 et 4, ou à l'intérieur du tableau par IA.
- **Mise en scène** : 3 cartes (ChatGPT, Perplexity, Gemini) côte à côte (carrousel sur mobile). Chaque carte affiche en gros le nom du n° 1 cité ; quand le même nom se répète, les 3 cartes se « connectent » par un trait et une étiquette apparaît : « [Martin Plomberie] est recommandé par 3 IA sur 3 ». À côté, une 4e carte grisée : « Vous : 0 sur 3 ».
- **Pourquoi** : comparaison sociale + sentiment d'être le seul absent ; renforce la crédibilité du phénomène (pas un hasard d'une IA).
- **Variante positive** : si le commerce est n° 1 sur une IA, la carte brille en vert « Ici, c'est vous ».

### Wow 3 : « Le score qui bouge » (simulation avant/après avec les 3 actions)
- **Où** : fin de section 6 ou début du teaser (section 8).
- **Mise en scène** : un curseur ou 3 cases à cocher (« J'ai complété ma fiche », « J'ai 5 nouveaux avis », « J'ai la page quartier ») ; à chaque case, la jauge de score gagne un nombre de points ESTIMÉ et un texte « Les commerces qui font ça remontent en moyenne de X rangs » ; une barre « Vous devancez [Concurrent B] » apparaît.
- **Pourquoi** : rend l'effet tangible, montre que c'est atteignable, enclenche l'engagement avant le CTA ; la jauge qui monte est très partageable.
- **Garde-fous** : étiqueter « estimation indicative » ; ne pas citer de chiffres de gain tant qu'ils ne sont pas mesurés sur de vrais clients (utiliser « jusqu'à » ou une fourchette honnête, ou n'afficher que le gain de points théorique du modèle de scoring). Alternative sûre si pas de données : n'afficher que la progression de la jauge, sans promesse de résultat.

### Bonus (optionnel, partage)
« Carte à partager » : image 1080×1080 « Dupont Plomberie : 23/100 sur la visibilité IA, Martin Plomberie : 71/100 » pour un envoi entre artisans (viralité), à n'activer que sur demande de l'utilisateur.

## 15. Check-list d'implémentation

- Composant `ReportPage` (RSC) + sous-composants : `ScoreGauge`, `AiAnswerCard`, `ProviderTable`, `CompetitorBars`, `QueryMatrix`, `FreeActions`, `PlanTeaser`, `MethodNote`, `StickyCta`.
- Helpers purs testables (`src/lib/report/derive.ts`) : tranche, `pickShowcase`, `byProvider`, `queryMatrix`, `topCitedDomains`, verdict.
- Tests : rapport avec 0 mention, mentions partout, un provider `null`, `demo=true`, une `error` dans `answers`, noms de concurrents avec caractères spéciaux (échappement avant surlignage : pas de `dangerouslySetInnerHTML` sur le texte brut de l'IA).
- Sécurité : le texte des IA est une donnée non fiable ; l'échapper systématiquement avant d'appliquer le surlignage (découpage en segments React, pas d'injection HTML).
- Juridique : citer des noms de concurrents réels : mentionner « cités par les IA, pas une appréciation de notre part » ; prévoir un contact de retrait (voir agent juridique).
- À tester ensuite (A/B) : verdict chiffré vs verdict en mots ; ordre des sections 3 et 4 ; prix affiché dans le CTA.

## Sources
- [Local Falcon : lire un rapport AI Visibility](https://www.localfalcon.com/knowledge-base/kb96-how-to-read-an-ai-visibility-scan-report)
- [HubSpot : relance du Website Grader](https://blog.hubspot.com/marketing/website-grader-relaunch?afsrc=1)
- [BrightLocal : rapports clients efficaces](https://www.brightlocal.com/learn/effective-client-reports-with-brightlocal/) (contenu non accessible, méta uniquement)
