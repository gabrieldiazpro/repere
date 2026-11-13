# 12 — Verticales : les 3 premiers métiers à attaquer à Paris

Agent VERTICALES — 9 nov. 2026. Brief commun : `docs/00-ARCHITECTURE.md`.

**Règle de lecture.** Chaque chiffre est marqué `[S]` (sourcé, lien en fin de document) ou `[E]` (estimation de l'agent, non sourcée, à valider). Les notes 1 à 5 de la matrice sont un jugement de l'agent, pas une donnée.

**Limites de la recherche.**
- L'API SIRENE (recherche-entreprises.api.gouv.fr) est bloquée par le proxy de l'environnement (HTTP 403). Je n'ai pas pu compter les établissements par code NAF à Paris. La densité repose sur des recensements Apur/CCI et sur des ordres de grandeur.
- Aucune donnée publique trouvée sur « quels métiers se font recommander par une IA ». La demande IA est déduite du comportement d'achat (urgence, ticket élevé, comparaison). C'est une hypothèse.
- Pour reproduire la densité : télécharger la base SIRENE stock établissements (data.gouv.fr), filtrer sur `codeCommuneEtablissement` commençant par 751 et sur l'`activitePrincipaleEtablissement` (NAF), état « actif ». Les codes NAF à compter figurent plus bas.

## 1. Ce qu'on sait, sourcé

- 78 % des Français interrogés ont déjà utilisé ChatGPT pour trouver des produits ou services à proximité, mais seulement 22 % disent lui faire confiance pour cela, et 50 % préfèrent encore les moteurs classiques [S1]. Attention : l'échantillon (2 237 répondants, 4 pays) ne comprend que des gens ayant acheté en ligne et utilisé la recherche vocale ou conversationnelle. Ce n'est pas représentatif de tous les Français. À citer avec cette réserve.
- PagesJaunes a lancé le 22 juin 2026 une app gratuite dans ChatGPT. Exemples cités : restaurants, garages, plombiers (dont urgence). Environ 19 millions d'utilisateurs d'IA conversationnelle en France en 2026, d'après OpenAI [S2]. Deux lectures : la recherche locale par IA est confirmée, et l'annuaire historique devient une source que les IA vont citer. Un annuaire bien renseigné devient un levier du plan d'action.
- Serrurerie : porte claquée 130 à 180 € TTC, porte blindée fermée à clé 180 à 250 €, serrure 3 points 400 à 800 € ; majoration d'urgence +20 à +100 % ; ouverture en urgence à Paris 180 à 300 € [S3].
- Déménagement : appartement 2 à 4 pièces, courte distance 350 à 700 €. À 100 m², formule standard 1 000 à 1 500 € et formule confort plus de 1 500 € TTC [S4].
- Immobilier : sur un bien à 450 000 €, honoraires moyens de vente 24 390 € TTC, soit 5,42 % (fourchette 3 % à 8 %). Gestion locative Paris : environ 7,4 % du loyer TTC [S5]. Le blog précise que ce ne sont pas les tarifs moyens du marché parisien 2026.
- Coiffure : 109 310 établissements en France en 2023 ; Île-de-France = 16 % des établissements (chiffre 2022) ; fiche moyenne 55,4 € (femme) et 26,4 € (homme) [S6]. Le CA moyen par entreprise est de 73,2 k€ (2022).
- Commerce parisien : 60 517 commerces et services commerciaux en 2026, dont 9 209 restaurants traditionnels et 4 053 restauration rapide [S7] ; 60 846 en 2023 [S8]. Pour l'historique, le recensement de 2014 en comptait 13 822 cafés-restaurants et 12 343 services aux particuliers [S9].

## 2. Méthode de notation

Cinq critères, notés de 1 à 5 (5 = favorable à AuditIA).

| Critère | Poids | Ce que 5 veut dire |
|---|---|---|
| C1 Demande IA | 30 % | Le client demande volontiers « le meilleur X » ou « X pas cher, tout de suite » à une IA : urgence, ticket élevé, comparaison |
| C2 Valeur d'un client gagné | 25 % | Un seul client rembourse des années d'abonnement |
| C3 Densité à Paris | 15 % | Beaucoup de cibles à contacter, et beaucoup de concurrents qui se disputent les mêmes réponses IA |
| C4 Habitude de payer du marketing | 20 % | Déjà clients de PagesJaunes, Google Ads, plateformes de devis. Sinon la vente est un travail d'évangélisation |
| C5 Conformité | 10 % | Publicité et démarchage libres, pas de déontologie bloquante |

Note pondérée = 0,30·C1 + 0,25·C2 + 0,15·C3 + 0,20·C4 + 0,10·C5.

## 3. Matrice des 15 métiers

| Rang | Métier | C1 | C2 | C3 | C4 | C5 | Note |
|---|---|---|---|---|---|---|---|
| 1 | Déménageur | 5 | 5 | 3 | 4 | 5 | **4,50** |
| 2 | Agence immobilière | 4 | 5 | 4 | 5 | 4 | **4,45** |
| 3 | Plombier-chauffagiste | 5 | 4 | 4 | 4 | 5 | **4,40** |
| 4 | Rénovation / peintre | 4 | 5 | 4 | 3 | 5 | 4,15 |
| 5 | Serrurier | 5 | 4 | 3 | 4 | 3 | 4,05 |
| 6 | Électricien | 4 | 4 | 4 | 3 | 5 | 3,90 |
| 7 | Wedding planner | 4 | 5 | 2 | 3 | 5 | 3,85 |
| 8 | Restaurant | 4 | 2 | 5 | 3 | 5 | 3,55 |
| 9 | Garage auto | 4 | 3 | 3 | 3 | 5 | 3,50 |
| 10 | École de langues | 3 | 4 | 2 | 4 | 4 | 3,40 |
| 11 | Coiffeur | 3 | 2 | 5 | 3 | 5 | 3,25 |
| 11 | Institut de beauté | 3 | 3 | 4 | 3 | 4 | 3,25 |
| 13 | Coach sportif / bien-être | 3 | 3 | 3 | 3 | 4 | 3,10 |
| 13 | Nettoyage / ménage | 3 | 2 | 4 | 3 | 5 | 3,10 |
| 15 | Photographe | 3 | 3 | 3 | 2 | 5 | 3,00 |

Justification des notes qui comptent :
- **C5 serrurier = 3.** Le secteur a une réputation dégradée (arnaques au dépannage, devis gonflés). Auditer la visibilité d'un serrurier sérieux est légitime, mais le risque de réputation pour AuditIA est réel. À écarter du top 3 tant qu'on n'a pas une charte (vérifier l'inscription au registre, afficher les prix).
- **C5 agence immo = 4.** L'affichage des honoraires est encadré et les agents sont soumis à la loi Hoguet. AuditIA ne publie rien à leur place, donc pas de blocage, mais le plan d'action ne doit pas suggérer de promesses de prix. `[E]`
- **C2 restaurant et coiffeur = 2.** Un client gagné vaut un repas ou une coupe (fiche moyenne femme 55,4 € [S6]). Même si la demande IA existe, le retour sur 29 €/mois est moins évident que pour les métiers à ticket élevé.
- **C4 = estimations.** Aucune enquête sourcée sur les dépenses marketing par métier n'est ressortie de mes recherches. Les notes sont une hypothèse : les métiers d'urgence et de devis (dépannage, déménagement, immobilier) paient déjà des annuaires, des plateformes de mise en relation ou Google Ads. À valider par les 20 premiers appels.

## 4. Top 3 et justification

1. **Déménageur** (4,50). Demande IA : forte, car on compare avant de réserver. Un client = 600 à 1 500 € (les ordres de grandeur sont sourcés [S4]). Réserve : densité plus faible que les autres, et saisonnalité (juin à septembre).
2. **Agence immobilière** (4,45). Un client = commission de vente de plusieurs milliers à 20 000 € et plus [S5]. Ils paient déjà les portails. Réserve : les gros réseaux (Orpi, Century 21…) ont des services marketing, la vraie cible est l'agence indépendante de quartier. Les agences physiques reculent à Paris [S7].
3. **Plombier-chauffagiste** (4,40). Urgence, forte densité, et PagesJaunes cite déjà les plombiers d'urgence dans son app ChatGPT [S2]. Réserve : le ticket est mal documenté dans mes sources (voir section 5).

Pourquoi pas le serrurier malgré un ticket sourcé et une urgence maximale : C5 et risque de réputation (voir plus haut). Il reste le premier métier de la vague 2, avec la rénovation (4,15).

Ordre de lancement conseillé : plombier d'abord pour le volume et la simplicité du message, puis déménageur, puis agence immo, plus lente à signer mais au plus gros ticket. `[E]` Ce choix de calendrier est une recommandation, pas un résultat de la matrice (qui place le déménageur premier).

## 5. Fiches des 3 verticales

Calcul commun pour l'argument massue : le suivi à 29 €/mois vaut 348 €/an ; avec le plan d'action à 149 €, la première année coûte 497 €.

### 5.1 Déménageur

**Argument massue : « Un déménagement gagné = 350 à 1 500 € ; un seul client paie votre première année. »** [S4]
- Un 2 à 4 pièces, courte distance : 350 à 700 €. Un 100 m² en formule standard : 1 000 à 1 500 €.
- Un seul déménagement d'un 100 m² en formule standard couvre la première année complète (497 €) deux fois.

**10 requêtes types**
1. Quel est le meilleur déménageur à Paris ?
2. Déménageur pas cher Paris 11e pour un studio
3. Déménageur fiable avec assurance Paris, avis clients
4. Combien coûte un déménagement d'un 2 pièces dans Paris ?
5. Déménageur Paris pour un week-end ou à la dernière minute
6. Déménagement avec monte-meuble Paris, quelle société ?
7. Déménageur Paris vers Lyon, devis comparés
8. Déménageur qui s'occupe de l'emballage, Paris 15e
9. Meilleure entreprise de déménagement pour un piano à Paris
10. Déménageur sérieux à Paris, comment éviter les arnaques ?

**Annuaires et sources que les IA citent probablement** `[E]` : Google Business Profile, PagesJaunes, Trustpilot, Avis Vérifiés, plateformes de devis déménagement (à lister en validant sur 10 requêtes réelles), site du syndicat professionnel (à confirmer).

### 5.2 Agence immobilière

**Argument massue : « Une vente = environ 24 000 € d'honoraires sur un bien à 450 000 € ; un mandat de plus rembourse dix ans de suivi. »** [S5]
- Honoraires moyens de vente : 5,42 % soit 24 390 € TTC sur 450 000 € (fourchette 3 à 8 %). Gestion locative : environ 7,4 % du loyer TTC.
- Réserve à afficher : c'est la valeur du dossier pour l'agence, pas le gain net de l'agent. Dans la prospection, parler de « chiffre d'affaires d'une vente » et non de bénéfice.
- Même un mandat de gestion à 1 500 € de loyer représente environ 1 332 € TTC/an de frais (7,4 % × 1 500 € × 12) [S5, calcul de l'agent].

**10 requêtes types**
1. Meilleure agence immobilière à Paris 11e pour vendre un appartement
2. Agence immobilière fiable pour estimer mon appartement à Paris 15e
3. Quelle agence a les honoraires les plus bas à Paris ?
4. Agence immobilière spécialisée dans les studios à Paris 5e
5. Meilleure agence de gestion locative à Paris 17e
6. Agence immobilière avec bons avis pour acheter à Paris 20e
7. Avec quelle agence vendre rapidement à Paris, sans mandat exclusif ?
8. Agence immobilière pour vendre un bien de prestige à Paris 7e
9. Agence immobilière indépendante recommandée près de Montmartre
10. Quelle agence choisir pour mettre en location un meublé à Paris ?

**Annuaires et sources** `[E]` : Google Business Profile, PagesJaunes, SeLoger, Bien'ici, Meilleurs Agents, Trustpilot, annuaires de membres FNAIM et UNIS, pages d'agence des réseaux.

### 5.3 Plombier-chauffagiste

**Argument massue : « Une urgence plomberie gagnée = quelques centaines d'euros ; un chantier salle de bain = plusieurs milliers. »** `[E]`
- Aucune source de prix de plomberie n'a été collectée dans cette session. Ordres de grandeur à valider avant toute publication : dépannage 150 à 400 €, remplacement de chauffe-eau 800 à 2 000 €, salle de bain complète plusieurs milliers d'euros.
- Chiffre de substitution sourcé dans un métier voisin d'urgence : le serrurier facture 130 à 250 € pour une ouverture de porte, avec +20 à +100 % de majoration nuit et week-end [S3]. À présenter comme « un métier comparable », jamais comme le prix d'un plombier.
- À faire avant la prospection : relever 10 tarifs affichés par des plombiers parisiens (sites web) et fixer l'argument sur des prix observés.

**10 requêtes types**
1. Plombier d'urgence à Paris 11e maintenant
2. Meilleur plombier Paris 15e, avis clients
3. Plombier pas cher pour une fuite d'eau à Paris
4. Plombier disponible un dimanche à Paris
5. Combien coûte un plombier pour changer un chauffe-eau à Paris ?
6. Plombier fiable à Paris pour une rénovation de salle de bain
7. Plombier-chauffagiste pour une panne de chaudière à Paris 18e
8. Plombier pour un dégât des eaux, qui contacte l'assurance ?
9. Plombier près de Bastille avec devis gratuit
10. Comment éviter les arnaques de plombier à Paris ?

**Annuaires et sources** `[E]` : Google Business Profile, PagesJaunes (qui a une app dans ChatGPT, [S2]), MesDépanneurs.fr (page prix serrurier déjà citée [S3]), Travaux.com, Habitatpresto, Allovoisins, Houzz, annuaires CAPEB et Qualibat, site de l'entreprise.

## 6. Métiers à éviter et pourquoi

Notes juridiques de l'agent (non sourcées, à faire valider par un juriste avant lancement) :

| Métier | Raison | Décision |
|---|---|---|
| Médecins, dentistes, kinés, infirmiers, sages-femmes, pharmaciens | Santé réglementée : la publicité et le démarchage sont encadrés ou interdits par les codes de déontologie et le code de la santé publique. Recommander ou « faire monter » un praticien est sensible | Exclus |
| Avocats | Publicité et démarchage encadrés par le règlement intérieur national. Beaucoup de barreaux surveillent de près | Exclus (au moins en V1) |
| Notaires, huissiers/commissaires de justice | Officiers ministériels, tarifs réglementés, publicité très limitée | Exclus |
| Experts-comptables | Déontologie de l'Ordre, démarchage restreint | Exclus (V1) |
| Architectes | Publicité encadrée par l'Ordre | Exclus (V1) |
| Coach de vie et « thérapeutes » | Frontière floue avec la santé et risque de dérives sectaires. À ne pas viser sans filtre. Seuls les coachs sportifs déclarés restent possibles | Prudence |
| Serruriers | Pas interdit, mais risque de réputation (arnaques). Pas en tête de liste | Vague 2 avec charte |
| Écoles de langues | Si financées via CPF, vérifier la certification Qualiopi et les règles de démarchage CPF (très encadrées) | Prudence |
| Instituts de beauté | Gris si actes médicalisés ou allégations de santé. Cibler les soins esthétiques simples | Prudence |

**Règle produit à inscrire dans l'app** : la liste des métiers acceptés est fermée (liste blanche). Tout métier réglementé est refusé dès le formulaire d'audit, avec un message clair.

## 7. Questions ouvertes pour la suite
- Mesurer sur de vraies requêtes (ChatGPT, Perplexity, Gemini) quels annuaires et quels sites sont cités pour chacun des 3 métiers, pour remplacer les listes `[E]` ci-dessus.
- Compter les établissements parisiens par code NAF via SIRENE (hors environnement bloqué). Codes à tester : 49.42Z (déménagement), 68.31Z (agences immobilières), 43.22A (plomberie, chauffage).
- Faire 20 appels de découverte par métier pour valider C4 (habitude de payer).

## 8. Sources

- [S1] Yext, « The Rise of AI Search Archetypes » (juil. 2025), relayé par La Réclame : https://lareclame.fr/yext-etude-theriseofaisearcharchetypes-320249
- [S2] Solocal, communiqué du 29 juin 2026 sur l'app PagesJaunes dans ChatGPT : https://www.solocal.com/sites/default/storage/files/2026-06/Communique_pagesjaunes_app_ChatGPT_29062026.pdf
- [S3] MesDépanneurs.fr, tarifs serrurier : https://www.mesdepanneurs.fr/blog/prix-serrurier
- [S4] La Poste, prix d'un déménagement : https://www.laposte.fr/demenager/prix-demenagement
- [S5] iad France, honoraires des agences immobilières à Paris : https://blog.iadfrance.fr/?p=5130
- [S6] UNEC, rapport de branche coiffure 2024 (données 2023) : https://unec.fr/wp-content/uploads/2024/12/rapport-de-branche-coiffure-2024-donnees-2023.pdf
- [S7] Ville de Paris, nouveau visage du commerce parisien : https://www.paris.fr/pages/cafes-patisseries-friperies-salles-de-sport-le-nouveau-visage-du-commerce-parisien-36819
- [S8] Apur, premiers résultats du recensement 2023 des commerces parisiens : https://www.apur.org/en/our-works/first-2023-results-survey-parisian-commercial-outlets
- [S9] Toute-la-franchise, recensement 2014 Ville de Paris / CCI / Apur : https://www.toute-la-franchise.com/article-focus-le-commerce-a-paris-intra-m
