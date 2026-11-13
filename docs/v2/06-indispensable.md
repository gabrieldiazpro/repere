# 06 — Repéré V2 « indispensable » : produit et rétention

Agent INDISPENSABLE. Question : **qu'est-ce qui fait qu'un client ne résilie jamais un outil marketing ?**
Entrées : `00-BRIEF-V2.md` (source de vérité), `13-app-spec.md` (V1 : score /100, PWA, plan cochable, alertes, rapport mensuel).
Sources numérotées [n] en fin de document. Les chiffres tirés d'articles d'éditeurs concurrents sont signalés comme tels.

---

## 0. Réponse courte

On ne résilie pas un outil qui, à la fois :

1. **contient quelque chose qu'on perdrait** (historique, faits de référence, rang, rapports déjà présentés au patron) ;
2. **s'invite dans la semaine sans qu'on l'ouvre** (le digest du lundi, une alerte qui fait peur au bon moment) ;
3. **fait une partie du travail** (le texte est écrit, la tâche est prête, il reste à cliquer) ;
4. **prouve sa valeur avant la date de renouvellement** (« voici ce que vous avez gagné ce trimestre ») ;
5. **est utilisé par plus d'une personne ou présenté à quelqu'un d'autre** (associé, agence, comité de direction).

La V1 n'a que le point 2 en partie (alerte mensuelle). Un score seul ne coche aucune case : c'est une photo, pas une habitude.

---

## 1. Ce que la recherche montre

### 1.1 Les mécanismes de rétention des outils de référence

| Outil | Mécanisme principal | Ce qu'on perdrait en partant | Leçon pour Repéré |
|---|---|---|---|
| **Semrush / Ahrefs** | Suivi de positions dans le temps, projets, rapports programmés | L'historique : les concurrents proposent explicitement d'« importer l'historique de positions » pour lever ce frein, et pointent les limites de rétention de Semrush [12] | L'historique de visibilité IA est **non rattrapable** : un concurrent ne peut pas reconstituer ce que ChatGPT disait de vous il y a 6 mois. Peec le reconnaît : son historique ne commence qu'au début du suivi [6]. |
| **HubSpot** | Multi-hubs, sièges, données enrichies, agents IA | Données CRM, workflows, utilisateurs | NRR 2025 : 103,5 % (105 % au T4) ; 40 % de la base Pro+ (en ARR) possède 4 hubs ou plus ; « customer dollar retention » dans le haut des 80 % [9]. L'**expansion** (sièges, modules) compense le churn. |
| **Pennylane** | Espace partagé dirigeant + expert-comptable, synchro bancaire, connecteurs (paie, Stripe, e-commerce) | Migration de 4 à 8 semaines, relation avec le cabinet [13] | Le verrou le plus fort est **le tiers dans la boucle** (comptable) et les connecteurs. Pour Repéré : l'agence, l'associé, le comité de direction. |
| **Malt** | Marché biface, contrats cadres, paiement en 48 h, avis obligatoires | Le réseau, les contrats, l'historique de missions [14] | Effet de réseau → pour Repéré, le **benchmark sectoriel** : plus il y a de clients, plus le rang est juste. |
| **Partoo** | Gestion multi-établissements (fiches, avis, messages) pour réseaux | Le flux quotidien d'avis à répondre, la synchro des fiches | Un **flux de travail récurrent** (répondre aux avis) fait revenir plus qu'un tableau de bord. *(Page source inaccessible lors de la recherche ; déduit du positionnement public de Partoo.)* |
| **Agorapulse** | Boîte de réception unifiée, rapports ROI pour agences | Le travail quotidien + les rapports clients | Les **rapports présentés à un tiers** (client d'agence) sont un verrou : on ne change pas d'outil au milieu d'une série de rapports. |
| **Clay** | E-mail « Week in Review » personnalisé | — | Plus de 100 000 envois, des milliers de clics de retour dans le produit, des clients qui partagent l'e-mail sur LinkedIn ; « une part essentielle de notre boucle de croissance » [10]. Pas de chiffre de churn publié. |

### 1.2 Churn des SaaS PME

- Churn annuel des SaaS PME (ACV < 5 k$) : **14 à 22 %**, contre 3 % en grands comptes [8] *(chiffres agrégés de ChartMogul, Recurly, ProfitWell, non vérifiables depuis la page)*.
- **54 %** des résiliations volontaires viennent d'une faible adoption ; **46 %** des acheteurs B2B qui partent invoquent budget et consolidation d'outils ; les échecs de paiement font **28 à 40 %** du churn total [8].
- **38 %** des résiliations de la première année ont lieu dans les **90 premiers jours** [8].
- Pour un produit à 29 €/mois vendu à des TPE, le churn mensuel réaliste sans travail de rétention est de 5 à 8 % (cible V1 : < 6 %). Conséquence : **l'activation des 30 premiers jours est le premier chantier de rétention**, avant toute intégration.

### 1.3 Ce que les clients apprécient (et reprochent) aux outils GEO

| Outil | Apprécié | Reproché |
|---|---|---|
| **Profound** (1 100+ avis G2) | Résumés hebdo présentables à la direction ; suivre et **rapporter** la visibilité « avec confiance » ; FactCheck qui signale les affirmations fausses et remonte aux URL sources ; Agent Analytics (robots IA, trafic IA) [5] | Prix (99 $ ChatGPT seul, 399 $ pour 3 IA) ; trop de données, **« pas évident de savoir par où commencer »** ; intégration technique des logs [5] |
| **Peec AI** | Vue sources (pages et domaines cités, à qui ils appartiennent, sentiment) ; classement sectoriel ; prompts suggérés ; sièges illimités [6] | Méthode de calcul opaque ; coût dès qu'on ajoute des IA ; historique limité au début du suivi [6] |
| **Otterly** | Gain de temps (« jusqu'à 80 % » sur la veille) ; tableaux clairs ; prix d'entrée bas (29 $ / ~10 prompts) [7] | Peu de fonctionnalités agence documentées ; avis rares hors early adopters [7] |

*(Les synthèses [5], [6], [7] sont publiées par des éditeurs concurrents ; à recouper avec les avis G2 eux-mêmes.)*

**Lecture** : le marché paie pour **(a)** un rapport présentable, **(b)** les sources à travailler, **(c)** l'exactitude. Il reproche la complexité et le prix. L'espace libre pour Repéré : **simple, en français, orienté tâches, prix PME**.

### 1.4 L'exactitude : le déclencheur de peur

- Étude Insites sur 10 000 commerces américains : ChatGPT trouve 94 % des commerces mais seuls **56 %** ont toutes leurs informations exactes (48 % sur Perplexity) ; **30 %** ont un mauvais numéro de téléphone sur ChatGPT (39 % sur Perplexity), 16 % un mauvais site [3].
- Étude Searchable (juillet 2026, 72 000 questions, commerces britanniques) : **64 %** des commerces ont au moins une information fausse ; 1 réponse sur 16 est fausse ; 1 réponse sur 10 donne une mauvaise adresse ; **58 %** des acheteurs perdent confiance dans une marque quand l'IA donne une mauvaise information produit ; les **petits commerces sont plus touchés** que les grandes marques [4].

« ChatGPT donne un mauvais numéro pour votre entreprise » est un message que tout dirigeant comprend en 2 secondes, sans le mot GEO. C'est le meilleur déclencheur d'achat **et** de rétention (on ne coupe pas une alarme).

### 1.5 Le « job to be done » du dirigeant de PME face à l'IA

Bpifrance Le Lab (1 209 dirigeants de PME/ETI) : **32 %** utilisent l'IA ; **58 %** pensent qu'elle peut toucher la survie de leur entreprise d'ici 3 à 5 ans ; freins : coût (30 %), peur du mauvais usage / des données (30 %), **pas d'usage pertinent identifié (23 %)** [11].

Les jobs, formulés par le client :

| Job | Déclencheur | Ce que Repéré doit livrer |
|---|---|---|
| « Je veux savoir si je suis en train de rater quelque chose » | Un client dit « je vous ai trouvé sur ChatGPT » ou, pire, un concurrent le dit | Le rang et le verbatim des IA, chaque semaine |
| « Je ne veux pas qu'on dise des bêtises sur moi » | Horaires, prix ou adresse faux | Fiche de vérité + alerte hallucination |
| « Dites-moi quoi faire, en 30 min max cette semaine » | Manque de temps, pas d'expertise | 3 tâches, texte prêt à coller |
| « Je dois rendre des comptes » (associé, DG, client d'agence) | Comité, bilan, renouvellement | Rapport présentable, preuve avant/après |
| « Je ne veux pas être le dernier de mon secteur » | Peur du décrochage (58 % [11]) | Benchmark : « 4ᵉ sur 12 » |

---

## 2. La boucle hebdomadaire : « le lundi de Repéré »

Principe : **le produit vient au client**. 80 % des clients ne doivent jamais avoir besoin d'ouvrir l'app pour en tirer la valeur ; l'app sert à agir.

### 2.1 Le digest du lundi (e-mail, 7 h 30)

Objet (variable selon l'événement le plus fort de la semaine, par ordre de priorité) :
1. « Alerte : ChatGPT donne de mauvais horaires pour {Commerce} » *(hallucination détectée)*
2. « {Concurrent} vient de passer devant vous sur Perplexity »
3. « Vous gagnez 2 places : 4ᵉ sur 12 plombiers du 11ᵉ »
4. « Vos 3 tâches de la semaine (25 min) »

Corps (lisible en 30 secondes, mobile d'abord) :

| Bloc | Contenu | Donnée |
|---|---|---|
| 1. La phrase de la semaine | « Cette semaine, ChatGPT vous cite dans 4 questions sur 10 (+1). » | `audits`, delta vs S-1 |
| 2. Votre rang | « 4ᵉ sur 12 plombiers du 11ᵉ » + flèche | benchmark §6 |
| 3. Ce que les IA disent de vous | 1 citation verbatim (la meilleure) + 1 citation à corriger, avec l'IA et la question posée ; pastille sentiment | `audit_runs.snippet` + analyse §5 |
| 4. Exactitude | « Toutes vos informations sont justes » (vert) ou « 1 erreur détectée » (rouge, bouton « Corriger ») | `fact_checks` §5 |
| 5. Nouveau concurrent | « Nouveau : {X} est cité 3 fois sur Gemini » | `alerts.new_competitor` |
| 6. Vos 3 tâches | 3 lignes : verbe, durée, gain estimé (fourchette, étiquette estimation), bouton « C'est fait » cliquable **depuis l'e-mail** | plan dynamique §2.2 |
| 7. Pied | lien app, lien « transférer à mon associé / mon agence », réglage de fréquence | — |

Règles :
- **Jamais vide** : si rien n'a bougé, le digest le dit (« semaine calme : votre position tient ») et pousse une tâche. Un digest sans nouvelle reste un rappel de valeur.
- Audits légers hebdomadaires (échantillon réduit : 10 questions × 2 IA principales), audit complet mensuel : maîtrise du coût d'API.
- Bouton « C'est fait » depuis l'e-mail : lien signé à usage unique qui coche l'action (`actions_progress`) → mesure d'engagement sans ouverture de l'app.
- Envoi via Resend ; désinscription en 1 clic (obligation légale) mais **réglage de fréquence proposé avant** (hebdo / mensuel).
- Canaux secondaires (paliers PME et plus) : même contenu en message Slack ou Teams le lundi ; push PWA pour les alertes urgentes seulement.

### 2.2 Les 3 tâches de la semaine (plan dynamique)

- Le plan V1 est statique (liste triée). En V2, le moteur choisit **3 tâches par semaine** : la plus rentable, la plus rapide, et une tâche liée à l'événement de la semaine (erreur détectée, concurrent qui monte, source nouvellement citée).
- Chaque tâche arrive **avec son livrable prêt** (texte de FAQ, balisage schema.org, réponse à un avis, description de fiche annuaire) → l'effort client tombe à « copier, coller, cocher ».
- Une tâche non faite glisse à la semaine suivante une fois, puis est remplacée (pas de culpabilisation, pas de pile infinie).
- Durée totale affichée : objectif ≤ 30 min/semaine pour le palier Local.

### 2.3 Le rythme complet

| Fréquence | Ce que reçoit le client | Rôle dans la rétention |
|---|---|---|
| Temps réel | Alerte hallucination, concurrent qui passe devant | Peur → retour immédiat |
| Lundi | Digest + 3 tâches | Habitude |
| Mensuel | Rapport complet (PDF / lien) | Preuve, partage |
| Trimestriel | **Bilan « valeur obtenue »** : places gagnées, erreurs corrigées, tâches faites, trafic IA mesuré, sources obtenues ; envoyé **30 jours avant** tout renouvellement annuel | Défense du renouvellement |
| À la tentative de résiliation | Écran « ce que vous perdez » (historique, rang, alertes actives) + pause 1 à 3 mois au lieu de résilier + export complet offert | Sauvetage, honnêteté |

---

## 3. Le copilote GEO

### 3.1 Ce qu'il est

Un assistant dans l'app (et répondable depuis le digest) qui répond **uniquement à partir des données du client** : audits, verbatims, sources citées, concurrents, fiche de vérité, historique, tâches. Ce n'est pas un ChatGPT générique : chaque réponse cite les données utilisées (« d'après l'audit du 3 novembre, 7 réponses sur 10… »).

### 3.2 Questions types et réponses attendues

| Question | Ce que le copilote fait |
|---|---|
| « Pourquoi Dupont Plomberie passe devant moi ? » | Compare : sources où Dupont est présent et pas vous (PagesJaunes, Reddit, article du Parisien), nombre et fraîcheur des avis, présence d'une FAQ, schema.org. Termine par 1 à 3 tâches ajoutables au plan. |
| « Écris-moi la FAQ » | Génère 8 à 12 questions/réponses à partir des **questions réellement posées aux IA** dans l'audit + fiche de vérité ; fournit le HTML et le JSON-LD `FAQPage`. |
| « Que dit ChatGPT de mes prix ? » | Extrait les verbatims sur les prix, les compare à la fiche de vérité, signale les écarts. |
| « Réponds à cet avis » | Brouillon de réponse ; jamais de faux avis ni de sollicitation d'avis contraire aux règles Google. |
| « Prépare mon point pour le comité de lundi » | 5 puces + 1 graphique (part de voix), exportables. |
| « Quelle source dois-je viser en premier ? » | Classe les sources manquantes par fréquence de citation × facilité d'accès. |

### 3.3 Conception

- **V0 (dans le top 10)** : 6 questions guidées (boutons) + génération de livrables. Prompts structurés, contexte injecté depuis Supabase (pas de base vectorielle au départ : les données d'un client tiennent dans le contexte). Coût maîtrisé.
- **V1 du copilote** : question libre, mémoire de conversation par commerce, action « ajouter au plan ».
- Garde-fous : refuse de promettre un résultat ; n'invente pas de chiffres (réponse « je n'ai pas cette donnée ») ; mentionne la date des données ; quotas par palier (Local 20 questions/mois, PME 100, E-commerce 150, Agence 500 mutualisées).
- Pourquoi c'est un verrou : le copilote vaut par **les données accumulées** (historique, verbatims). Ailleurs, il faudrait tout ressaisir. Et il répond au premier reproche fait à Profound : « pas évident de savoir par où commencer » [5].

---

## 4. Les fonctionnalités à effet de verrouillage

| Verrou | Mécanisme | Pour qui | Pourquoi on ne part pas |
|---|---|---|---|
| **Historique illimité** | Tous les audits, verbatims, rangs, depuis le jour 1 ; courbes de part de voix par IA | Tous | Non reconstituable ailleurs ; c'est la mémoire de « comment les IA vous voyaient ». Export offert (honnêteté), mais l'historique exporté perd sa valeur hors de l'outil. |
| **Fiche de vérité** | Faits de référence saisis et validés par le client (adresse, horaires, prix, zones, services, dirigeant, date de création) | Tous | Sert à l'alerte hallucination, au copilote, aux générateurs. Le client l'a construite ; elle s'enrichit. |
| **Benchmark sectoriel anonymisé** | Rang parmi les pairs (métier × zone, ou catégorie B2B / e-commerce) | Tous | Effet de réseau : plus de clients → benchmark plus fiable ; un concurrent nouveau venu n'a pas l'échantillon. |
| **Intégrations** | GA4 (trafic venu des IA), Search Console, Google Business Profile, Shopify, Slack/Teams | PME, E-com, Agence | Chaque connexion = un coût de sortie + des données que Repéré est seul à croiser (visibilité IA × trafic réel). |
| **Multi-utilisateurs** | Rôles : propriétaire, contributeur (exécute les tâches), lecteur (reçoit le rapport) | PME, E-com, Agence | Le cas Pennylane : le tiers dans la boucle rend la résiliation collective [13]. |
| **Rapports marque blanche** | Logo, couleurs, domaine de l'agence ; envoi programmé à ses clients | Agence | L'agence revend le rapport ; changer d'outil = changer ses livrables clients en cours d'année. |
| **Rapport comité de direction** | 1 page / 5 slides : part de voix vs concurrents, erreurs corrigées, trafic IA, prochaines actions ; export PDF et PPTX | PME, E-com | Une fois le chiffre présenté au comité, il doit être suivi au même endroit le trimestre suivant. |
| **Bilan « valeur obtenue »** | Récap trimestriel chiffré | Tous | Rend visible la valeur juste avant la décision de renouvellement. |

Ordre de construction : les verrous **gratuits à construire** d'abord (historique, fiche de vérité, benchmark), les intégrations ensuite, l'agence en dernier (petit volume, gros panier).

---

## 5. Ce que les IA disent de la marque : sentiment et exactitude

### 5.1 Trois mesures distinctes

| Mesure | Question | Méthode |
|---|---|---|
| **Présence** | Est-ce que l'IA me cite ? | V1 (mention, rang) |
| **Sentiment** | Est-ce qu'elle en dit du bien ? | Classification des passages qui citent le client : positif / neutre / négatif / réservé (« bon mais cher »), avec les **attributs** associés (prix, délai, qualité, accueil). Afficher le verbatim, pas seulement l'étiquette. |
| **Exactitude** | Est-ce que c'est vrai ? | Comparaison des faits extraits des réponses avec la **fiche de vérité** du client. |

### 5.2 L'alerte « hallucination »

- **Requêtes dédiées** chaque semaine, posées aux IA : « Quels sont les horaires de {Commerce} ? », « Quelle est l'adresse… », « Combien coûte {service} chez… », « Quel est le numéro… », « {Marque} livre-t-elle en Belgique ? », « {Logiciel} a-t-il une API ? ».
- Extraction des faits (LLM en sortie JSON contraint), comparaison à la fiche de vérité avec tolérances (formats de téléphone, horaires équivalents).
- Niveaux : **Critique** (téléphone, adresse, fermé alors qu'ouvert, prix faux de plus de 20 %) → alerte immédiate (e-mail + push) ; **À surveiller** (site, services) → digest.
- Chaque alerte contient : l'IA, la question, la phrase fausse (verbatim), la valeur juste, **la source probable** (URL citée par l'IA quand elle existe : vieil annuaire, ancienne fiche, article daté), et la **tâche de correction** pré-écrite (mettre à jour la fiche Google, demander la correction à l'annuaire, ajouter le fait sur le site en balisage schema.org).
- Suivi : « Erreur détectée le 3/11 → corrigée sur ChatGPT le 24/11 ». Compteur « erreurs corrigées » dans le bilan trimestriel.
- Honnêteté : on ne promet pas que l'IA corrigera (délai et résultat non garantis) ; on affiche « détection sur échantillon » et la date.

### 5.3 Pourquoi c'est un déclencheur d'achat

- Statistiques directement utilisables dans l'acquisition : environ la moitié des commerces ont au moins une information inexacte selon les IA [3][4], et les petits sont plus touchés [4].
- Le **rapport gratuit** V2 doit inclure un contrôle d'exactitude sur 3 faits publics (adresse, téléphone, site, récupérables sans saisie). Une erreur trouvée dans le rapport gratuit est un argument de conversion bien plus fort que « score 34/100 ».

---

## 6. Le benchmark

### 6.1 Benchmark privé (dans l'app et le digest)

- **Cohorte** : même métier × même zone (arrondissement, ville, ou rayon) pour le Local ; même catégorie de requêtes pour PME et e-commerce (« logiciel de paie PME », « crème solaire bio »).
- Le benchmark ne dépend **pas** du nombre de clients : les concurrents sont ceux que les IA citent pour les mêmes questions (on les mesure déjà dans `audit_runs.competitors`). Donc « 4ᵉ sur 12 plombiers du 11ᵉ » est calculable dès le premier client de la zone.
- Affichage : « Vous êtes **4ᵉ sur 12** plombiers cités par les IA dans le 11ᵉ. Le 3ᵉ a 2 mentions de plus que vous. » + l'écart concret à combler (sources, avis).
- **Benchmark anonymisé entre clients** (valeur ajoutée du réseau) : moyennes de cohorte des clients Repéré (score médian, temps moyen pour gagner une place, tâches les plus efficaces du secteur). Anonymisé, agrégé, minimum 5 clients par cohorte pour publier une moyenne.

### 6.2 Classement public opt-in

- Pages publiques « Les plombiers du 11ᵉ les plus recommandés par les IA — novembre 2026 », mises à jour chaque mois.
- **Opt-in obligatoire** pour apparaître avec son nom et un badge ; les non-inscrits ne sont pas nommés (on affiche « 8 autres professionnels »). Évite tout risque de dénigrement et respecte la ligne juridique (pas de classement de tiers non consentants présenté comme un jugement de qualité).
- Bénéfices : pages SEO locales (acquisition), badge « Recommandé par les IA — Repéré » à afficher sur son site (backlink, preuve sociale), raison de rester abonné (le badge disparaît à la résiliation).
- Méthode affichée sur chaque page : échantillon de questions, IA testées, date, absence de garantie.
- Faible priorité RICE (§9) : à lancer quand une zone a au moins 3 clients consentants.

---

## 7. Les paliers de prix V2

### 7.1 Principe : ancrer sur la valeur

On ne vend pas « N requêtes × M IA » (ancrage coût, celui des concurrents). On vend **ce que vaut un client recommandé par l'IA** et **le temps économisé**. La métrique de facturation reste simple (établissements, marques, clients d'agence).

### 7.2 Les paliers

| | **Local** | **PME** | **E-commerce** | **Agence** |
|---|---|---|---|---|
| Pour | Artisan, restaurant, cabinet, agence immobilière | SaaS, conseil, formation, industrie, services B2B | Marques DTC, boutiques Shopify / Woo | Agences web, SEO, communication |
| Prix mensuel | **49 €** | **179 €** | **249 €** | **499 €** (10 clients) puis 29 €/client |
| Annuel | 490 € (2 mois offerts) | 1 790 € | 2 490 € | 4 990 € |
| Questions suivies | 25 | 100 | 150 (dont requêtes produit) | 100 par client |
| IA | ChatGPT, Gemini, Perplexity | + Claude, Copilot, Google AI Overviews | idem PME + shopping ChatGPT / Perplexity | idem PME |
| Digest + 3 tâches | ✓ | ✓ + Slack/Teams | ✓ + Slack/Teams | ✓ par client |
| Fiche de vérité + alerte hallucination | ✓ (1 établissement) | ✓ | ✓ + prix et disponibilités produits | ✓ |
| Benchmark | Rang local | Rang sectoriel + sources des concurrents | Rang par catégorie produit | ✓ par client |
| Copilote | 20 questions/mois | 100 | 150 | 500 mutualisées |
| Générateurs (FAQ, schema, llms.txt, avis) | ✓ | ✓ + pages comparatives / « alternatives » | ✓ + fiches produit citables | ✓ |
| Intégrations | GBP | GA4, GSC, GBP | GA4, GSC, Shopify | toutes |
| Utilisateurs | 1 (+1 lecteur) | 5 | 5 | illimités + accès client en lecture |
| Rapports | Mensuel | + rapport comité (PDF/PPTX) | + rapport comité | **Marque blanche**, envoi programmé |
| Établissement / marque supplémentaire | +29 € | +79 € | +99 € | inclus dans le compte client |

Le prix V1 de 29 € reste possible comme offre de lancement « Veille » (score + digest, sans tâches ni alerte) pour ne pas casser les abonnés existants (grandfathering).

### 7.3 Ce qui justifie chaque prix

- **Local, 49 €** : un plombier facture 150 à 300 € une intervention ; un restaurant 30 à 40 € de ticket moyen par couvert. **Un seul client par mois** venu d'une recommandation IA, ou **une seule erreur de téléphone** corrigée, paie l'abonnement. Référence marché : Otterly Lite à 29 $ pour ~10 prompts, sans tâches ni français [7] ; un abonnement Partoo / gestion d'avis multi-sites coûte davantage par établissement.
- **PME, 179 €** : en B2B, un lead entrant vaut souvent plusieurs milliers d'euros de contrat ; être absent de « meilleur logiciel de paie pour PME » coûte des deals invisibles. Remplace 2 à 4 h/mois de veille manuelle (Otterly : jusqu'à −80 % de temps de veille [7]) et fournit le rapport comité. Références : Peec Starter ≈ 97 $ pour 25 prompts, Pro ≈ 217 $ pour 100 prompts [6] ; Profound 99 $ (ChatGPT seul) à 399 $ (3 IA) [5]. Repéré est **en dessous de Profound, au niveau de Peec Pro, avec l'exécution en plus**.
- **E-commerce, 249 €** : panier moyen 50 à 80 € → 4 à 5 commandes par mois remboursent l'outil. L'erreur de prix ou de disponibilité dans une réponse IA fait perdre confiance à 58 % des acheteurs [4] : l'alerte d'exactitude produit est le cœur du palier.
- **Agence, 499 €** : une agence refacture typiquement un suivi « visibilité IA » 150 à 400 €/mois par client ; avec 10 clients, la marge brute dépasse 1 000 €/mois. Le prix est ancré sur **la marge de l'agence**, pas sur notre coût. Le marque blanche transforme Repéré en produit de l'agence.

### 7.4 Leviers d'expansion (NRR)

Établissements / marques supplémentaires ; montée Local → PME quand le client ouvre un 2ᵉ site ou recrute un marketeur ; agences qui ajoutent des clients ; module « Exécution assistée » (service humain : fiches annuaires, contenus) en complément ponctuel (offre plan d'action 149 € de la V1 réutilisée).

---

## 8. Métriques de succès

### 8.1 Activation (7 premiers jours)

Définition « client activé » — les 3 conditions :
1. Fiche de vérité complétée (≥ 5 faits validés) ;
2. ≥ 1 tâche cochée (dans l'app ou depuis l'e-mail) ;
3. 1er digest ouvert **ou** 1 question posée au copilote.

Cible : **≥ 60 % des nouveaux abonnés activés à J7**. Métriques intermédiaires : délai paiement → fiche de vérité (< 24 h), % d'audits avec au moins une erreur d'exactitude trouvée (alimente le moment « aha »).

### 8.2 Rétention à 90 jours

- Rétention logo à J90 : **≥ 85 %** (soit un churn mensuel < 5 %). 38 % des résiliations de la première année ont lieu dans ces 90 jours [8] : c'est la fenêtre décisive.
- Indicateurs avancés (hebdomadaires) : taux d'ouverture du digest (cible ≥ 50 %), **semaines actives** (≥ 1 tâche cochée ou ouverture d'app) ≥ 6 sur les 12 premières, % de clients avec une erreur d'exactitude corrigée à J90.
- Score de santé (risque de churn) : digest non ouvert 3 semaines + aucune tâche en 30 jours + rang en baisse → e-mail personnel du fondateur (ou du copilote) + proposition de pause.
- Churn involontaire (28 à 40 % du churn SaaS [8]) : relances Stripe Smart Retries, e-mail avant expiration de carte, encourager le prélèvement SEPA et l'annuel.

### 8.3 NRR (revenu net retenu)

- Cible à 12 mois : **≥ 100 %** (le revenu d'une cohorte ne baisse pas grâce aux montées de palier et aux établissements ajoutés). Référence : HubSpot 103,5 % en 2025 [9] ; premier quartile SaaS ≥ 120 % [8].
- Leviers mesurés : % de comptes avec ≥ 2 établissements / marques ; % Local → PME ; nombre moyen de clients par agence ; part du chiffre d'affaires en annuel.

### 8.4 Tableau de bord interne

| Étape | Métrique | Cible |
|---|---|---|
| Acquisition | Rapport gratuit → abonnement | ≥ 5 % (≥ 10 % si erreur d'exactitude trouvée) |
| Activation | Activés à J7 | ≥ 60 % |
| Habitude | Ouverture digest | ≥ 50 % |
| Habitude | Tâches cochées / client / mois | ≥ 4 |
| Rétention | Logo J90 | ≥ 85 % |
| Rétention | Churn mensuel | < 5 % (Local), < 3 % (PME, Agence) |
| Expansion | NRR 12 mois | ≥ 100 % |
| Valeur | Clients avec rang en hausse à J90 | ≥ 50 % |

---

## 9. Priorisation RICE (25 fonctionnalités)

**Barème** — *Reach* : part de la base d'abonnés touchée chaque trimestre (0 à 10, 10 = 100 %). *Impact* : effet sur la rétention par client (3 massif, 2 fort, 1 moyen, 0,5 faible). *Confidence* : certitude sur reach et impact. *Effort* : semaines de travail du fondateur solo (aidé de l'IA). **Score = R × I × C / E.**
Base supposée : 80 % Local, 15 % PME/E-commerce, 5 % Agences la première année.

| # | Fonctionnalité | R | I | C | E (sem.) | Score |
|---|---|---|---|---|---|---|
| 1 | Digest du lundi (e-mail) | 10 | 3 | 90 % | 1,5 | **18,0** |
| 2 | Fiche de vérité (faits de référence du client) | 9 | 2 | 80 % | 1 | **14,4** |
| 3 | Alerte nouveau concurrent / dépassement | 8 | 1 | 80 % | 0,5 | **12,8** |
| 4 | 3 tâches de la semaine (plan dynamique) | 10 | 2 | 80 % | 1,5 | **10,7** |
| 5 | Historique illimité + part de voix | 10 | 1 | 90 % | 1 | **9,0** |
| 6 | Ce que les IA disent de vous (verbatim + sentiment) | 10 | 2 | 80 % | 2 | **8,0** |
| 7 | Alerte hallucination (exactitude des faits) | 9 | 3 | 70 % | 2,5 | **7,6** |
| 8 | Bilan trimestriel « valeur obtenue » | 10 | 1 | 70 % | 1 | **7,0** |
| 9 | Benchmark sectoriel anonymisé (rang) | 9 | 2 | 70 % | 2 | **6,3** |
| 10 | Preuve avant/après par action | 8 | 2 | 60 % | 2 | **4,8** |
| 11 | Générateur « faites-le pour moi » (FAQ, schema, llms.txt, avis) | 8 | 2 | 80 % | 3 | **4,3** |
| 12 | Mesure du trafic IA sans GA4 (balise légère) | 6 | 2 | 60 % | 2,5 | **2,9** |
| 13 | Connexion GA4 (trafic venu des IA) | 5 | 2 | 70 % | 2,5 | **2,8** |
| 14 | Rapport comité de direction (PDF/PPTX) | 4 | 2 | 70 % | 2 | **2,8** |
| 15 | Copilote GEO (chat sur les données) | 7 | 2 | 60 % | 4 | **2,1** |
| 16 | Connexion Google Business Profile | 7 | 2 | 60 % | 4 | **2,1** |
| 17 | Notifications Slack / Teams | 2 | 1 | 80 % | 1 | **1,6** |
| 18 | Connexion Search Console | 4 | 1 | 70 % | 2 | **1,4** |
| 19 | Multi-utilisateurs et rôles | 3 | 1 | 80 % | 2 | **1,2** |
| 20 | Rapports marque blanche (agences) | 1,5 | 3 | 70 % | 3 | **1,1** |
| 21 | Multi-établissements / multi-marques | 2 | 2 | 70 % | 3 | **0,9** |
| 22 | Synchro auto annuaires / Bing Places | 6 | 2 | 40 % | 6 | **0,8** |
| 23 | Espace agence multi-clients | 1,5 | 3 | 60 % | 4 | **0,7** |
| 24 | Classement public opt-in | 4 | 1 | 50 % | 3 | **0,7** |
| 25 | Connexion Shopify (catalogue produits) | 2 | 2 | 50 % | 5 | **0,4** |

Remarques :
- Le RICE favorise mécaniquement ce qui est peu coûteux et touche toute la base (Local). Les fonctionnalités agence et e-commerce sortent bas parce que ces segments sont petits la première année, **pas parce qu'elles sont inutiles** : elles portent les gros paniers et le NRR. Elles forment la V2.1.
- La GBP (16) a une confiance basse car l'accès à l'API Business Profile est soumis à validation par Google : déposer la demande dès maintenant, la construire quand elle est accordée.

---

## 10. Top 10 V2 (ordre de livraison)

Deux arbitrages par rapport au RICE brut :
- **Fiche de vérité (2) et alerte hallucination (7) fusionnées** : la seconde n'existe pas sans la première ; ensemble elles forment le déclencheur d'achat n° 1.
- **Copilote V0** (questions guidées + générateurs, fusion de 11 et 15) remonte dans le top 10 malgré le score de 15 : c'est le pilier « on le fait pour vous » du brief, et il rend chaque tâche exécutable. On le livre en version guidée (effort ~3 semaines), pas en chat libre.

| Rang | Fonctionnalité | Pourquoi | Effort |
|---|---|---|---|
| 1 | **Digest du lundi** | L'habitude ; la valeur arrive sans ouvrir l'app | 1,5 sem. |
| 2 | **Fiche de vérité + alerte hallucination** | Peur concrète, déclencheur d'achat, verrou de données | 3,5 sem. |
| 3 | **3 tâches de la semaine** (livrables prêts) | Transforme le score en travail fait | 1,5 sem. |
| 4 | **Alerte concurrent qui passe devant** | Émotion, très faible coût | 0,5 sem. |
| 5 | **Historique illimité + part de voix** | Mémoire non reconstituable ailleurs | 1 sem. |
| 6 | **Ce que les IA disent de vous** (verbatim + sentiment) | Concret, partageable, alimente le digest | 2 sem. |
| 7 | **Benchmark « 4ᵉ sur 12 »** | Comparaison sociale, effet de réseau | 2 sem. |
| 8 | **Copilote GEO V0** (« pourquoi X passe devant moi ? », « écris-moi la FAQ ») | Exécution + réponse au reproche « par où commencer » | 3 sem. |
| 9 | **Bilan trimestriel « valeur obtenue »** | Défend le renouvellement | 1 sem. |
| 10 | **Preuve avant/après par action** | Relie les tâches faites aux places gagnées | 2 sem. |

Total ≈ **18 semaines** de travail solo : à découper en 3 lots de 6 semaines.
- **Lot 1 (habitude)** : 1, 3, 4, 5 → le digest existe dès la semaine 4.
- **Lot 2 (peur et preuve sociale)** : 2, 6, 7.
- **Lot 3 (exécution et preuve)** : 8, 9, 10.

**V2.1 (après le top 10)** : rapport comité, GA4 + mesure trafic IA, GBP, multi-utilisateurs, Slack/Teams, puis le pack Agence (marque blanche, espace multi-clients) et Shopify quand ces segments dépassent 10 % de la base.

### Impacts sur le schéma Supabase (indicatif)

Nouvelles tables : `truth_facts` (business_id, key, value, validated_at), `fact_checks` (audit_id, provider, key, observed, expected, severity, source_url, status), `mentions_sentiment` (audit_run_id, polarity, attributes jsonb, quote), `weekly_tasks` (business_id, week, action_id, deliverable, status), `benchmarks` (cohort_key, period, business_id, rank, total), `digests` (business_id, week, sent_at, opened_at, clicked_at), `copilot_messages` (business_id, role, content, data_refs jsonb). RLS par `business_id` comme en V1.

---

## 11. Risques et garde-fous

- **Coût d'API** du rythme hebdomadaire : audit léger hebdo (échantillon réduit), complet mensuel ; requêtes d'exactitude limitées aux faits critiques ; suivre `audits.cost_eur` par palier.
- **Faux positifs d'hallucination** : seuil de confiance, double vérification (2 tirages) avant alerte critique, bouton « ce n'est pas une erreur ».
- **Fatigue d'alertes** : maximum 1 alerte urgente par semaine hors critique ; le reste va au digest.
- **Conformité** : pas de promesse de résultat ; méthode affichée ; classement public uniquement opt-in ; pas de faux avis ni de sollicitation contraire aux règles Google ; e-mails transactionnels/relationnels avec désinscription en 1 clic ; données de benchmark agrégées et anonymisées (seuil de 5).
- **Honnêteté à la résiliation** : export complet, pause proposée, pas de parcours de désabonnement piège (la « résiliation en 3 clics » est obligatoire en France pour les consommateurs ; l'appliquer aussi aux professionnels).

---

## 12. Sources

1. Brief V2 — `/home/claude/auditia/docs/v2/00-BRIEF-V2.md`
2. Spec app V1 — `/home/claude/auditia/docs/13-app-spec.md`
3. Insites, « Does ChatGPT hallucinate local businesses? The data on AI accuracy » — https://insites.com/blog/does-chatgpt-hallucinate-local-businesses-the-data-on-ai-accuracy/
4. Retail Technology Innovation Hub, étude Searchable sur les erreurs des chatbots (juillet 2026) — https://retailtechinnovationhub.com/home/2026/7/15/many-uk-high-street-retailers-are-suffering-from-ai-chatbot-inaccuracies-searchable-research-finds ; voir aussi https://retail-focus.co.uk/nearly-two-thirds-of-uk-high-street-retailers-suffer-from-ai-chatbot-inaccuracies/
5. SE Visible (SE Ranking, éditeur concurrent), « Profound AI review » — https://visible.seranking.com/blog/profound-review/ ; avis G2 Profound — https://www.g2.com/products/profound/reviews
6. Stateshift, « Peec AI Review: What We Learned After 3 Months of Testing » — https://blog.stateshift.com/?p=3334 ; G2 Peec AI — https://www.g2.com/products/peec-ai
7. Rankability (éditeur concurrent), « Otterly AI review » — https://rankability.com/blog/otterly-ai-review/ ; avis G2 OtterlyAI — https://www.g2.com/products/otterlyai/reviews_and_filters
8. Voxbooster, « Statistiques de churn SaaS 2026 » (agrège ChartMogul, Recurly, ProfitWell, Gainsight, KeyBanc, Bessemer) — https://www.voxbooster.com/fr/blog/saas-churn-statistics-2026
9. HubSpot, transcript de la conférence résultats T4 2025 (The Motley Fool) — https://www.fool.com/earnings/call-transcripts/2026/02/11/hubspot-hubs-q4-2025-earnings-call-transcript ; 10-K 2025 — https://www.sec.gov/Archives/edgar/data/1404655/000119312526046646/hubs-20251231.htm
10. Inflection.io, « The secret behind Clay's Week in Review email » — https://inflection.io/post/the-secret-behind-clays-week-in-review-email
11. Siècle Digital, « Seulement 32 % des PME françaises utilisent l'IA » (étude Bpifrance Le Lab) — https://siecledigital.fr/2025/06/05/seulement-32-des-pme-francaises-utilisent-lia-une-revolution-encore-timide/
12. Advanced Web Ranking, « Goodbye Semrush » (migration d'historique) — https://www.advancedwebranking.com/goodbye-semrush
13. Hayot Expertise (cabinet partenaire Pennylane), « Pennylane review 2026 » — https://hayot-expertise.fr/en/blog/pennylane-review-2026-an-independent-assessment-from-a-french-chartered-accountant
14. Erevena, « Interview with Alexandre Fretti, Managing Director at Malt » — https://www.erevena.com/articles/interview-with-alexandre-fretti-managing-director-at-malt
15. Pistes non exploitées (page inaccessible ou sans contenu utile) : Partoo — https://www.leptidigital.fr/logiciels/partoo/ ; Agorapulse agences — https://www.agorapulse.com/blog/agencies/ ; Localogy, hallucinations et commerces locaux — https://www.localogy.com/2026/09/ai-hallucinations-pose-risks-for-local-businesses/
