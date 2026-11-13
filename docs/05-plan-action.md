# 05 — Plan d'action (offre à 149 €)

Ce document définit **ce que le client achète** : un plan personnalisé, issu d'une bibliothèque de 35 actions déclenchées par les résultats de son audit. Les actions sont aussi dans `05-actions.json` (même contenu, lisible par le code).

## 1. Ce qui est prouvé, ce qui est corrélé, ce qui est spéculatif

Règle d'honnêteté du produit : on ne promet jamais un gain de score. On vend un travail ordonné, chiffré en effort, et un re-test à 30 jours.

**Constaté ou déclaré par la source concernée**
- John Mueller (Google) : aucun service IA n'a dit utiliser llms.txt, et les journaux serveur montrent qu'ils ne le consultent pas. Sur 10 sites suivis 90 jours, 8 n'ont eu aucun changement mesurable.
- Fabrice Canel (Bing) a confirmé que Microsoft utilise schema.org pour aider ses LLM à comprendre les contenus (déclaration à SMX Munich, rapportée par Search Engine Land).
- Reddit est un des domaines les plus cités par ChatGPT et Perplexity (Semrush, 230 000 requêtes, juillet à octobre 2025) mais très instable : jusqu'à 60 % des réponses ChatGPT début août, environ 10 % mi-septembre.

**Corrélations (études de fournisseurs d'outils, surtout américaines, causalité non prouvée)**
- Avis Google : 133 en moyenne pour les commerces visibles dans ChatGPT et Perplexity, contre 11 pour les invisibles ; présence dans le Local Pack associée à 3,5 fois plus de recommandations ; site du commerce = source la plus citée (Insites, 10 000 commerces, mai 2026).
- Même étude : Core Web Vitals, données structurées, FAQ schema et llms.txt ne montrent aucune corrélation avec la visibilité IA. Seuls 55 % des commerces connus des IA ont des informations exactes.
- Gemini cite surtout les sites des marques (environ 52 %) ; ChatGPT s'appuie à environ 49 % sur des sites tiers (Yelp, TripAdvisor, MapQuest) ; Perplexity cite davantage d'annuaires régionaux et de niche (Yext, 6,8 millions de citations).
- Facebook, Yelp et TripAdvisor sont les sources d'avis les plus présentes dans les résultats Bing Places (Whitespark, 153 requêtes, 9 villes américaines).
- 28,5 % des commerces du Local Pack sont absents de Google AI Mode pour la même requête ; « près de moi » fait apparaître des fiches (Local SEO Data, communiqué payé d'un vendeur d'API).

**Spéculatif ou non démontré**
- Bing Places comme source de ChatGPT : pas de consensus (Whitespark), ChatGPT dit ne pas l'utiliser (réponse non fiable). Coût faible, donc conservé.
- Effet de la cohérence NAP, du libellé des avis, des pages quartier, des mentions presse locale sur les IA : aucune mesure isolée trouvée (Ahrefs FR le reconnaît pour NAP et avis).
- Listes « meilleurs … de la ville » : titre d'une étude Whitespark vue via Custplace, contenu non vérifié.
- llms.txt : pas utile en l'état. On le propose en dernier, impact 1.
- Transposition à la France : aucune étude française chiffrée trouvée ; les annuaires français (PagesJaunes, Doctolib…) sont recommandés par usage, pas par mesure.

## 2. Format des déclencheurs (champ `trigger`)

Le champ `trigger` est une expression booléenne à évaluer sur un objet de contexte construit à partir de l'audit.

**Grammaire**
```
expr   := or
or     := and ('or' and)*
and    := not ('and' not)*
not    := 'not' not | cmp
cmp    := value (op value)? | value 'in' '[' literal (',' literal)* ']' | '(' expr ')'
op     := '<' | '<=' | '>' | '>=' | '==' | '!='
value  := nombre | 'texte' | true | false | null | chemin.pointé
```
Cas particulier : `always` est toujours vrai.

**Valeurs inconnues** : une variable absente vaut `null`. Les comparaisons d'ordre (`<`, `<=`, `>`, `>=`) avec `null` valent `false` ; `==` et `!=` comparent normalement (donc `null != true` vaut `true`). Une action qui dépend d'une donnée inconnue ne se déclenche que si l'expression l'autorise explicitement.

**Variables issues de l'audit (`AuditResult`)**
| Variable | Source | Type |
|---|---|---|
| `score` | `score` | 0 à 100 |
| `sub.chatgpt`, `sub.perplexity`, `sub.gemini`, `sub.claude` | `subScores` | 0 à 100 ou null |
| `mention_rate` | `mentionRate` | 0 à 1 |
| `share_of_voice` | `shareOfVoice` | 0 à 1 |
| `avg_rank` | `avgRank` | nombre ou null |
| `competitors_top_mentions` | max de `competitors[].mentions` | entier |
| `competitors_count` | `competitors.length` | entier |
| `confidence` | `confidence` | 'faible', 'moyenne', 'bonne' |
| `trade_family` | classification du `trade` | 'btp', 'restauration', 'sante_bienetre', 'immobilier', 'beaute', 'juridique_compta', 'autre' |

**Variables de scan du site (`site.*`, à calculer en récupérant la page d'accueil et robots.txt ; null si pas de site)**
`site.has_website`, `site.has_schema`, `site.has_localbusiness_schema`, `site.has_faq`, `site.has_service_pages`, `site.has_district_pages`, `site.has_about`, `site.blocks_ai_bots`, `site.has_llms_txt` (booléens) ; `site.last_update_days` (entier).

**Variables déclaratives (`declared.*`, petit questionnaire à l'achat, 8 questions)**
`declared.gbp_claimed`, `declared.bing_claimed`, `declared.pagesjaunes`, `declared.facebook_page`, `declared.nap_consistent`, `declared.third_party_reviews` (booléens) ; `declared.google_reviews` (entier) ; `declared.reply_rate` (0 à 1).

**Règle de sélection (recommandé pour `actions.ts`)** : évaluer tous les déclencheurs ; filtrer sur `trades` contenant « tous » ou la famille du client ; trier par `impact` décroissant puis `effort` croissant (S avant M avant L) ; garder 10 à 14 actions réparties en 3 vagues (semaine 1, semaines 2 et 3, mois 2).

## 3. Bibliothèque d'actions (35)

Légende : effort S = moins de 2 h, M = 2 à 8 h réparties, L = plus de 8 h ou plusieurs semaines. Impact : 1 = marginal, 2 = utile, 3 = fondamental.

### A01 — Revendiquer et valider la fiche Google Business Profile
- **Pourquoi** : Sans fiche Google validée, vous n'existez ni dans les cartes Google ni dans Gemini, et les IA qui s'appuient sur Google ont peu de données fiables sur vous.
- **Comment** :
  1. Chercher le nom du commerce sur Google Maps ; s'il existe déjà une fiche, cliquer sur « Revendiquer cette fiche ».
  2. Sinon créer la fiche sur business.google.com avec le nom exact de l'enseigne (sans mots-clés ajoutés).
  3. Choisir la validation proposée (courrier, téléphone, vidéo) et la terminer.
  4. Noter l'URL de la fiche pour les actions suivantes.
- **Effort** : S · **Impact estimé** : 3/3 · **Métiers** : tous
- **Déclencheur** : `declared.gbp_claimed != true`
- **Niveau de preuve** : Corrélation forte : être dans le Local Pack va avec 3,5 fois plus de recommandations IA (Insites, 2026). Gemini utilise les données de profil Google (Yext).

### A02 — Compléter à 100 % la fiche Google (catégories, services, horaires, description)
- **Pourquoi** : Une fiche précise permet aux IA de savoir quoi vous recommander et pour quelle demande.
- **Comment** :
  1. Choisir la catégorie principale la plus précise (ex. « Plombier ») et 2 à 4 catégories secondaires réelles.
  2. Remplir la liste des services/produits avec une courte description chacun.
  3. Indiquer la zone de service (arrondissements/communes) et les horaires, y compris urgences et jours fériés.
  4. Rédiger une description de 600 à 750 caractères : métier, quartier, spécialités, années d'expérience, sans slogans creux.
  5. Ajouter au moins 10 photos réelles (équipe, véhicule, chantiers, façade).
- **Effort** : S · **Impact estimé** : 3/3 · **Métiers** : tous
- **Déclencheur** : `declared.gbp_claimed == true and score < 60`
- **Niveau de preuve** : Bonne pratique de SEO local reconnue ; effet direct sur les IA non mesuré isolément.

### A03 — Lancer une campagne d'avis Google (lien court + QR code)
- **Pourquoi** : Le nombre d'avis Google est le signal le plus corrélé à la présence dans les réponses des IA.
- **Comment** :
  1. Générer le lien direct d'avis depuis la fiche Google (« Demander des avis »).
  2. Préparer un SMS/WhatsApp type et un QR code imprimé (facture, carte de visite, comptoir).
  3. Demander l'avis à chaque client (pas seulement aux satisfaits) dans les 24 h suivant l'intervention.
  4. Viser +10 avis dans les 30 jours puis 4 à 6 par mois ; ne jamais acheter ni inciter par cadeau (interdit par Google).
  5. Suivre le compteur chaque semaine.
- **Effort** : M · **Impact estimé** : 3/3 · **Métiers** : tous
- **Déclencheur** : `declared.google_reviews < 30 or score < 40`
- **Niveau de preuve** : Corrélation : 133 avis en moyenne pour les commerces visibles dans ChatGPT et Perplexity contre 11 pour les invisibles (Insites, 10 000 commerces). Corrélation, pas preuve de causalité.

### A04 — Inviter tous les clients à raconter leur expérience (sans contenu imposé)
- **Pourquoi** : Des avis récents et spontanés décrivent naturellement le service rendu ; les IA s'en servent comme contexte. Google interdit en revanche de demander des avis contenant un contenu précis et de solliciter sélectivement les clients satisfaits (politique « Contenus interdits et restreints », section « Manipulation des notes », consultée le 9/11/2026 ; voir docs/v2/04-execution.md § 3.1).
- **Comment** :
  1. Envoyer la même demande à tous les clients d'une période, satisfaits ou non, sans filtre préalable (« Satisfait ? → Google » est interdit).
  2. Formulation neutre : « Vous pouvez partager votre expérience, qu'elle ait été bonne ou moins bonne. » Aucune question orientée (service, quartier, mots-clés), aucun modèle de texte, aucune note suggérée.
  3. Aucune contrepartie (remise, cadeau, concours) en échange d'un avis.
  4. Relire les avis existants pour repérer les services peu mentionnés : les mettre en avant sur la fiche Google et le site (description, services, posts), pas dans les avis.
- **Effort** : S · **Impact estimé** : 2/3 · **Métiers** : tous
- **Déclencheur** : `declared.google_reviews >= 10 and score < 50`
- **Niveau de preuve** : Plausible : l'étude Insites indique que les avis citant service, lieu et date donnent plus de contexte, mais ce contenu doit rester spontané. Aucune mesure d'effet isolé (Ahrefs le dit aussi). Correction V2 (9/11/2026) : l'ancienne version « guider vers des avis détaillés (service + quartier) » contredisait la règle Google.

### A05 — Répondre à tous les avis, positifs comme négatifs
- **Pourquoi** : Cela montre une entreprise active et ajoute du texte pertinent à la fiche.
- **Comment** :
  1. Répondre sous 48 h, en citant le service et le quartier de façon naturelle.
  2. Répondre aux avis négatifs avec calme, proposer de régler hors ligne.
  3. Bloquer 15 minutes par semaine dans l'agenda.
- **Effort** : S · **Impact estimé** : 1/3 · **Métiers** : tous
- **Déclencheur** : `declared.google_reviews > 0 and declared.reply_rate < 0.7`
- **Niveau de preuve** : Bonne pratique ; effet sur les IA spéculatif.

### A06 — Publier des photos et des actualités sur la fiche Google chaque mois
- **Pourquoi** : Une fiche vivante est mieux classée et rassure les clients comme les algorithmes.
- **Comment** :
  1. Ajouter 3 à 5 photos de chantiers/plats/réalisations par mois.
  2. Publier une actualité mensuelle (offre, saison, nouveau service).
  3. Mettre à jour les horaires exceptionnels dès qu'ils changent.
- **Effort** : S · **Impact estimé** : 1/3 · **Métiers** : tous
- **Déclencheur** : `declared.gbp_claimed == true and score < 70`
- **Niveau de preuve** : Spéculatif pour les IA ; bonne pratique pour le Local Pack.

### A07 — Créer ou revendiquer la fiche Bing Places (import depuis Google)
- **Pourquoi** : ChatGPT s'est appuyé sur Bing pour la recherche web ; une fiche Bing correcte coûte 15 minutes.
- **Comment** :
  1. Aller sur bingplaces.com et choisir « Importer depuis Google Business Profile ».
  2. Vérifier que nom, adresse, téléphone, horaires et catégories sont identiques à Google.
  3. Valider la fiche (code par courrier/téléphone/e-mail) et ajouter le site web.
  4. Soumettre le site à Bing Webmaster Tools et activer IndexNow si le CMS le permet.
- **Effort** : S · **Impact estimé** : 2/3 · **Métiers** : tous
- **Déclencheur** : `declared.bing_claimed != true or sub.chatgpt < 25`
- **Niveau de preuve** : Débattu : Whitespark note qu'il n'y a pas de consensus et ChatGPT affirme ne pas utiliser Bing Places (réponse peu fiable). Faible coût, donc recommandé malgré une preuve incomplète.

### A08 — Créer la fiche Apple Business Connect
- **Pourquoi** : Apple Plans alimente Siri et l'écosystème iPhone, où vos clients cherchent aussi.
- **Comment** :
  1. Aller sur businessconnect.apple.com, revendiquer l'établissement.
  2. Reprendre exactement les mêmes nom, adresse, téléphone et horaires.
  3. Ajouter logo, photos et lien du site.
- **Effort** : S · **Impact estimé** : 1/3 · **Métiers** : tous
- **Déclencheur** : `score < 50`
- **Niveau de preuve** : Spéculatif pour les IA génératives ; utile pour la cohérence des données et les recherches Apple.

### A09 — Compléter la fiche PagesJaunes (et Solocal)
- **Pourquoi** : PagesJaunes reste l'annuaire généraliste le plus consulté en France et alimente d'autres annuaires.
- **Comment** :
  1. Revendiquer la fiche sur pagesjaunes.fr (« Mettre à jour ma fiche »).
  2. Choisir la rubrique la plus précise, ajouter horaires, zone, photos, site, description.
  3. Ignorer les offres payantes dans un premier temps : la fiche gratuite suffit.
- **Effort** : S · **Impact estimé** : 2/3 · **Métiers** : tous
- **Déclencheur** : `declared.pagesjaunes != true`
- **Niveau de preuve** : Fort usage en France (Ahrefs FR, estimation). Rôle exact pour les IA non mesuré ; Yext observe que ChatGPT cite beaucoup d'annuaires tiers (49 % de ses citations).

### A10 — S'inscrire sur les annuaires prioritaires de son métier
- **Pourquoi** : Les IA citent des annuaires métier quand elles recommandent un professionnel précis.
- **Comment** :
  1. Ouvrir la liste de sa famille de métiers (section « Annuaires prioritaires »).
  2. S'inscrire d'abord sur les 3 premiers, puis les suivants selon le temps.
  3. Utiliser une fiche type (nom, adresse, tél, description, catégories, photos) copiée-collée.
  4. Ajouter le lien vers le profil sur le site et les réseaux.
- **Effort** : M · **Impact estimé** : 3/3 · **Métiers** : tous
- **Déclencheur** : `always`
- **Niveau de preuve** : Corrélation : Yext constate que Perplexity cite des annuaires régionaux et de niche, et TripAdvisor/Zocdoc selon le secteur ; Whitespark observe des annuaires spécialisés (santé, travaux) dans les sources d'avis Bing. Données surtout américaines.

### A11 — Créer ou nettoyer la page Facebook de l'entreprise
- **Pourquoi** : Facebook est la source d'avis la plus présente dans les résultats Bing Places selon Whitespark.
- **Comment** :
  1. Créer la page « Entreprise locale » avec le nom exact, l'adresse, le téléphone et le site.
  2. Activer les recommandations/avis et demander à 5 clients de s'exprimer.
  3. Publier une fois par semaine (réalisation, avis, offre).
- **Effort** : S · **Impact estimé** : 2/3 · **Métiers** : tous
- **Déclencheur** : `declared.facebook_page != true`
- **Niveau de preuve** : Corrélation (étude américaine Whitespark, 153 requêtes) ; transposition à la France non vérifiée.

### A12 — Créer ou compléter sa fiche Yelp
- **Pourquoi** : Yelp est cité par les IA et Google AI Mode dans beaucoup de catégories locales.
- **Comment** :
  1. Revendiquer la fiche sur biz.yelp.com.
  2. Compléter catégories, horaires, photos, services.
  3. Inviter les clients à laisser un avis (sans les inciter).
- **Effort** : S · **Impact estimé** : 1/3 · **Métiers** : restauration, beaute, btp, sante_bienetre
- **Déclencheur** : `trade_family in ['restauration','beaute','btp','sante_bienetre'] and score < 60`
- **Niveau de preuve** : Corrélation aux États-Unis (Whitespark, Yext) ; faible poids en France, d'où impact 1.

### A13 — Optimiser TripAdvisor et TheFork
- **Pourquoi** : Pour un restaurant, TripAdvisor est une source majeure citée par les IA.
- **Comment** :
  1. Revendiquer la fiche TripAdvisor (gratuit) et TheFork si réservation en ligne.
  2. Mettre à jour menu, photos, horaires et lien de réservation.
  3. Répondre aux avis et demander des avis après chaque service.
- **Effort** : M · **Impact estimé** : 3/3 · **Métiers** : restauration
- **Déclencheur** : `trade_family == 'restauration'`
- **Niveau de preuve** : Corrélation : TripAdvisor pèse dans l'hôtellerie-restauration chez Yext et Whitespark. À vérifier en France.

### A14 — Auditer et harmoniser nom, adresse, téléphone (NAP) partout
- **Pourquoi** : Des coordonnées différentes d'un site à l'autre font douter les IA de qui vous êtes vraiment.
- **Comment** :
  1. Écrire la version de référence : nom exact, adresse, code postal, téléphone, URL.
  2. Lister toutes les présences (Google, Bing, PagesJaunes, Facebook, annuaires, site, Instagram).
  3. Corriger chaque écart (« 11ème » vs « 11e », « SARL Martin » vs « Martin Plomberie », ancien numéro).
  4. Supprimer ou fusionner les doublons de fiches.
- **Effort** : M · **Impact estimé** : 2/3 · **Métiers** : tous
- **Déclencheur** : `declared.nap_consistent != true or score < 40`
- **Niveau de preuve** : Insites : seuls 55 % des commerces connus des IA ont des informations exactes. Effet causal non établi ; Ahrefs précise qu'une incohérence dilue l'autorité sans bloquer.

### A15 — Ajouter le balisage schema.org LocalBusiness (JSON-LD) au site
- **Pourquoi** : C'est la fiche d'identité lisible par les machines : nom, adresse, horaires, métier, zone.
- **Comment** :
  1. Choisir le type précis (Plumber, Electrician, Restaurant, Dentist, LegalService…) sinon LocalBusiness.
  2. Renseigner name, address, telephone, openingHours, areaServed, url, sameAs (liens vers profils), priceRange.
  3. Insérer le JSON-LD dans l'accueil ; l'adresse doit correspondre à celle de Google.
  4. Tester avec le test des résultats enrichis de Google.
- **Effort** : S · **Impact estimé** : 1/3 · **Métiers** : tous
- **Déclencheur** : `site.has_website == true and site.has_localbusiness_schema != true`
- **Niveau de preuve** : Partagé : un responsable de Bing (Fabrice Canel) dit que le schema aide les LLM de Microsoft ; mais l'étude Insites ne trouve aucune corrélation avec la visibilité IA. Impact 1, coût faible.

### A16 — Créer une page FAQ répondant aux vraies questions clients
- **Pourquoi** : Les IA répondent à des questions ; une page qui y répond directement peut être reprise.
- **Comment** :
  1. Lister 8 à 12 questions entendues au téléphone (prix, délais, urgence, zone, garanties).
  2. Répondre en 2 à 4 phrases claires, avec chiffres honnêtes (fourchettes de prix).
  3. Publier en texte visible sur le site (pas dans un PDF ni une image).
  4. Facultatif : balisage FAQPage ; sans effet prouvé.
- **Effort** : M · **Impact estimé** : 2/3 · **Métiers** : tous
- **Déclencheur** : `site.has_website == true and site.has_faq != true`
- **Niveau de preuve** : Plausible ; l'étude Insites ne voit pas d'effet du balisage FAQ, mais note que les sites riches (2x plus de pages) sont plus visibles. Le contenu compte, pas la balise.

### A17 — Une page dédiée par prestation principale
- **Pourquoi** : Une page par service permet de répondre précisément à « dépannage chauffe-eau » ou « coach sportif senior ».
- **Comment** :
  1. Lister 3 à 6 prestations qui rapportent le plus.
  2. Pour chacune : ce qui est fait, pour qui, prix indicatif, délais, zone, photo, appel à l'action.
  3. Ajouter 2 avis clients liés à cette prestation.
- **Effort** : M · **Impact estimé** : 2/3 · **Métiers** : tous
- **Déclencheur** : `site.has_website == true and site.has_service_pages != true`
- **Niveau de preuve** : Corrélation : Insites observe qu'un site plus profond va avec plus de visibilité IA. Gemini favorise les pages locales (Yext).

### A18 — Pages « quartier / arrondissement » réellement utiles
- **Pourquoi** : Si vous voulez être cité pour « plombier Paris 11e », une page qui parle concrètement du 11e aide.
- **Comment** :
  1. Créer au plus 3 à 5 pages, uniquement pour des zones réellement desservies.
  2. Chaque page contient du contenu unique : exemples de rues, types de bâtiments, interventions récentes, avis locaux.
  3. Ne pas dupliquer le même texte en changeant le nom du quartier (risque de pénalité Google).
- **Effort** : M · **Impact estimé** : 2/3 · **Métiers** : btp, beaute, sante_bienetre, immobilier, juridique_compta
- **Déclencheur** : `site.has_website == true and site.has_district_pages != true and (sub.gemini < 40 or score < 40)`
- **Niveau de preuve** : Spéculatif pour les IA. Yext note que Gemini favorise les pages locales. Pages dupliquées : risque documenté pour Google.

### A19 — Page « À propos » avec preuves de confiance
- **Pourquoi** : Les IA recommandent plus volontiers un professionnel dont l'existence et les qualifications sont vérifiables.
- **Comment** :
  1. Présenter le dirigeant et l'équipe avec photos, parcours, année de création.
  2. Afficher SIRET, assurances (décennale, RC pro), diplômes, labels.
  3. Relier à tous les profils officiels (sameAs, liens).
- **Effort** : S · **Impact estimé** : 2/3 · **Métiers** : tous
- **Déclencheur** : `site.has_website == true and site.has_about != true`
- **Niveau de preuve** : Spéculatif (signaux de confiance) ; cohérent avec l'importance du site propre : ChatGPT le cite dans 72 % des requêtes de réputation (Insites).

### A20 — Vérifier que les robots IA peuvent lire le site
- **Pourquoi** : Si le site bloque les robots ou cache le texte dans du JavaScript, les IA ne le voient pas.
- **Comment** :
  1. Ouvrir monsite.fr/robots.txt et vérifier qu'aucune règle ne bloque OAI-SearchBot, PerplexityBot, Googlebot, bingbot.
  2. Vérifier que le texte principal est présent dans le code source de la page (clic droit, afficher le code source).
  3. Corriger les protections anti-bot de l'hébergeur qui renvoient des erreurs aux robots.
- **Effort** : S · **Impact estimé** : 2/3 · **Métiers** : tous
- **Déclencheur** : `site.has_website == true and site.blocks_ai_bots == true`
- **Niveau de preuve** : Logique technique : une page non lue ne peut pas être citée. Insites note que les IA lisent le code brut.

### A21 — Créer un site vitrine minimal (1 à 5 pages)
- **Pourquoi** : Le site du commerce est la source la plus citée par les IA ; sans site, vous ne contrôlez rien.
- **Comment** :
  1. Choisir un outil simple (Google Sites, Wix, WordPress) ou un site d'une page.
  2. Contenu minimum : accueil (métier, zone, téléphone), services, avis, contact, mentions légales.
  3. Raccorder un nom de domaine propre et le renseigner sur toutes les fiches.
- **Effort** : L · **Impact estimé** : 3/3 · **Métiers** : tous
- **Déclencheur** : `site.has_website == false`
- **Niveau de preuve** : Fort : site propre = 1re source citée (72 % des requêtes de réputation ChatGPT, Insites ; 52 % des citations Gemini, Yext). Corrélations, mais convergentes.

### A22 — Remettre le site à jour et signaler les changements (IndexNow)
- **Pourquoi** : Les IA favorisent le contenu récent ; un site abandonné depuis des années est moins repris.
- **Comment** :
  1. Mettre à jour prix, horaires, photos et textes obsolètes.
  2. Ajouter une réalisation ou une actualité par mois.
  3. Activer IndexNow (plugin) pour prévenir Bing des mises à jour.
- **Effort** : S · **Impact estimé** : 1/3 · **Métiers** : tous
- **Déclencheur** : `site.has_website == true and site.last_update_days > 365`
- **Niveau de preuve** : Insites : les sites périmés sont moins visibles ; Bing recommande IndexNow pour la fraîcheur (déclaration).

### A23 — Obtenir des mentions dans la presse et les blogs locaux
- **Pourquoi** : Quand un concurrent est cité souvent, c'est souvent parce que d'autres sites parlent de lui.
- **Comment** :
  1. Lister 10 médias locaux (mairie du 11e, journaux de quartier, blogs, associations de commerçants).
  2. Proposer un sujet concret : réalisation, conseils de saison, événement, création.
  3. Demander un lien vers votre site et une mention complète nom/adresse.
  4. Parrainer un événement ou une association locale contre une mention.
- **Effort** : L · **Impact estimé** : 2/3 · **Métiers** : tous
- **Déclencheur** : `competitors_top_mentions > 3 or sub.perplexity < 20`
- **Niveau de preuve** : Corrélation générale : les IA citent des sources tierces (Yext : 49 % des citations ChatGPT). Pas de mesure spécifique à la presse locale française.

### A24 — Entrer dans les classements et listes « meilleurs … de [ville] »
- **Pourquoi** : Les IA reprennent souvent les listes de type « les 10 meilleurs plombiers de Paris ».
- **Comment** :
  1. Chercher dans Google les listes « meilleur [métier] [ville] » où figurent vos concurrents.
  2. Contacter les auteurs avec preuves (avis, années, certifications) pour demander l'ajout.
  3. Participer aux labels et palmarès locaux (prix, concours, Meilleurs artisans).
- **Effort** : M · **Impact estimé** : 2/3 · **Métiers** : tous
- **Déclencheur** : `competitors_top_mentions > 3`
- **Niveau de preuve** : Préliminaire : un titre d'étude (Whitespark via Custplace) avance que les listes expertes dépassent les autres citations, mais le contenu n'a pas pu être vérifié. À traiter comme une hypothèse.

### A25 — Être présent et utile sur Reddit et les forums locaux
- **Pourquoi** : Reddit est l'un des sites les plus cités par ChatGPT et Perplexity, notamment pour les avis et recommandations.
- **Comment** :
  1. Créer un compte au nom de l'entreprise, indiquer clairement son affiliation.
  2. Répondre sincèrement aux questions dans les forums concernés (r/Paris, r/vosfinances, forums de copropriété, Facebook locaux).
  3. Ne jamais faire de publicité masquée : les modérateurs bannissent vite et les IA lisent le contexte.
  4. Encourager les clients satisfaits à en parler spontanément.
- **Effort** : M · **Impact estimé** : 1/3 · **Métiers** : tous
- **Déclencheur** : `sub.perplexity < 20 and competitors_top_mentions > 3`
- **Niveau de preuve** : Fait : Reddit est le 1er domaine cité par Perplexity et dans le top 2 pour ChatGPT (Semrush, 230 000 requêtes). Mais très instable (de 60 % à 10 % en six semaines) et rarement local en France. Impact limité.

### A26 — Collecter des avis sur une plateforme tierce de confiance
- **Pourquoi** : Diversifier les sources d'avis rassure les IA qui croisent plusieurs plateformes.
- **Comment** :
  1. Choisir 1 plateforme selon le métier (Trustpilot, Avis Vérifiés, Houzz, Doctolib, TheFork).
  2. Envoyer le lien d'avis par e-mail/SMS après chaque prestation.
  3. Afficher la note moyenne sur le site (sans balisage trompeur).
- **Effort** : M · **Impact estimé** : 2/3 · **Métiers** : tous
- **Déclencheur** : `declared.third_party_reviews != true and declared.google_reviews >= 10`
- **Niveau de preuve** : Corrélation : Whitespark recommande de diversifier les avis au-delà de Google ; Yext voit les annuaires et avis tiers cités par ChatGPT.

### A27 — S'inscrire sur les plateformes de mise en relation du BTP
- **Pourquoi** : Ces plateformes sont des sources que les IA citent pour les travaux et la rénovation.
- **Comment** :
  1. Créer le profil sur Houzz, Travaux.com, Habitissimo, Starofservice (selon spécialité).
  2. Joindre photos de chantiers, certifications et avis.
  3. Rester vigilant aux commissions : un profil gratuit suffit pour la visibilité.
- **Effort** : M · **Impact estimé** : 2/3 · **Métiers** : btp
- **Déclencheur** : `trade_family == 'btp' and score < 50`
- **Niveau de preuve** : Corrélation partielle : Whitespark observe Porch/Angi dans les sources d'avis (États-Unis). Équivalents français non mesurés.

### A28 — Afficher les qualifications et labels du métier
- **Pourquoi** : Une qualification officielle est un signal de fiabilité vérifiable.
- **Comment** :
  1. Lister Qualibat, RGE, Artisan de France, ordres professionnels selon le métier.
  2. Les afficher sur le site, la fiche Google et les annuaires.
  3. Demander l'inscription à l'annuaire officiel du label.
- **Effort** : S · **Impact estimé** : 1/3 · **Métiers** : btp, sante_bienetre, immobilier, juridique_compta
- **Déclencheur** : `trade_family in ['btp','sante_bienetre','immobilier','juridique_compta'] and score < 60`
- **Niveau de preuve** : Spéculatif pour les IA ; bonne pratique de confiance.

### A29 — Fixer une description officielle unique de l'activité
- **Pourquoi** : Si chaque profil décrit l'entreprise différemment, les IA ne savent pas dans quelle case vous ranger.
- **Comment** :
  1. Écrire une phrase de référence : « Martin Plomberie, plombier-chauffagiste à Paris 11e, dépannage et rénovation depuis 2008 ».
  2. La coller dans toutes les fiches (Google, Bing, annuaires, réseaux) et en tête du site.
  3. Utiliser les mêmes mots pour le métier partout.
- **Effort** : S · **Impact estimé** : 2/3 · **Métiers** : tous
- **Déclencheur** : `score < 50`
- **Niveau de preuve** : Spéculatif mais cohérent avec les signaux de cohérence des entités ; coût quasi nul.

### A30 — Ajouter un fichier llms.txt (optionnel)
- **Pourquoi** : Il n'est pas prouvé que les IA le lisent : à faire en dernier, jamais à la place des autres actions.
- **Comment** :
  1. Créer /llms.txt à la racine avec le nom, le métier, la zone et les liens des pages clés.
  2. Ne pas y consacrer plus de 30 minutes.
  3. Ne pas le présenter au client comme un levier de visibilité.
- **Effort** : S · **Impact estimé** : 1/3 · **Métiers** : tous
- **Déclencheur** : `site.has_website == true and site.has_llms_txt != true and score >= 60`
- **Niveau de preuve** : Non démontré et plutôt contredit : John Mueller (Google) dit qu'aucun service IA n'a déclaré l'utiliser et que les logs montrent qu'ils ne le consultent pas ; 8 sites sur 10 sans effet mesurable.

### A31 — Publier des vidéos courtes sur YouTube
- **Pourquoi** : YouTube est une source très citée par les IA de Google et par Perplexity.
- **Comment** :
  1. Filmer 3 à 5 vidéos de 1 à 2 minutes : un geste, un conseil, une présentation de l'équipe.
  2. Titre avec métier et ville, description avec adresse et site.
  3. Intégrer les vidéos sur les pages services et les liens depuis la fiche Google.
- **Effort** : M · **Impact estimé** : 1/3 · **Métiers** : tous
- **Déclencheur** : `score < 50 and site.has_website == true`
- **Niveau de preuve** : Fait : YouTube figure dans les domaines les plus cités par Google AI Mode (Semrush). Effet pour un commerce local non mesuré.

### A32 — Cibler les requêtes avec « près de moi », « urgence » et le quartier
- **Pourquoi** : Les IA répondent différemment selon la formulation ; il faut couvrir les mots que les clients utilisent.
- **Comment** :
  1. Lister 10 phrases clients (« plombier urgence Paris 11e », « fuite week-end »).
  2. Vérifier qu'elles apparaissent dans les titres, descriptions et FAQ.
  3. Mesurer avec l'audit mensuel sur ces mêmes requêtes.
- **Effort** : S · **Impact estimé** : 2/3 · **Métiers** : tous
- **Déclencheur** : `mention_rate < 0.2`
- **Niveau de preuve** : Indice : Local SEO Data (étude de fournisseur) observe que « près de moi » fait apparaître des fiches dans AI Mode là où le mot-clé seul n'en donne pas. Corrélation.

### A33 — Compléter Doctolib, Maiia ou la plateforme de réservation du secteur
- **Pourquoi** : Pour la santé et le bien-être, les IA citent les plateformes de rendez-vous.
- **Comment** :
  1. Créer ou compléter le profil (spécialités, tarifs, adresse, photos).
  2. Activer la prise de rendez-vous et inviter les patients à laisser un avis.
  3. Vérifier l'accord avec les règles de votre ordre professionnel sur les avis et la publicité.
- **Effort** : M · **Impact estimé** : 2/3 · **Métiers** : sante_bienetre
- **Déclencheur** : `trade_family == 'sante_bienetre'`
- **Niveau de preuve** : Yext : Zocdoc domine les citations santé chez Perplexity (États-Unis) ; équivalent français supposé (Doctolib) mais non mesuré.

### A34 — Relancer l'audit et suivre l'évolution tous les 30 jours
- **Pourquoi** : Sans mesure, on ne sait pas quelles actions fonctionnent ; les réponses des IA varient d'un jour à l'autre.
- **Comment** :
  1. Refaire l'audit 30 jours après chaque lot d'actions.
  2. Comparer score, taux de mention, rang moyen et concurrents cités.
  3. Ajuster : renforcer ce qui a bougé, abandonner ce qui ne donne rien.
- **Effort** : S · **Impact estimé** : 2/3 · **Métiers** : tous
- **Déclencheur** : `always`
- **Niveau de preuve** : Les réponses varient d'un jour à l'autre (Local SEO Data, Semrush) : la mesure répétée est nécessaire.

### A35 — Éviter les erreurs qui coûtent cher
- **Pourquoi** : Certaines pratiques courantes provoquent des suspensions de fiche ou des pénalités.
- **Comment** :
  1. Ne pas ajouter de mots-clés au nom de l'entreprise sur Google.
  2. Ne pas acheter d'avis ni utiliser de faux avis.
  3. Ne pas créer de fiches multiples ou d'adresses fictives.
  4. Ne pas masquer du texte pour les robots.
- **Effort** : S · **Impact estimé** : 1/3 · **Métiers** : tous
- **Déclencheur** : `score < 30`
- **Niveau de preuve** : Règles officielles de Google ; risque documenté de suspension.

## 4. Annuaires prioritaires par famille de métiers

Dans tous les cas, commencer par Google Business Profile, Bing Places, Apple Business Connect, PagesJaunes et Facebook (actions A01, A07, A08, A09, A11). Les listes ci-dessous ajoutent les plateformes propres à chaque métier. Ordre = priorité. Ces listes viennent de la pratique du SEO local français (Ahrefs FR, Codeur) et des études américaines ; elles n'ont pas été mesurées sur des requêtes françaises. À valider avec un test d'audit sur 10 commerces avant publication.

| Famille | Priorité 1 | Priorité 2 | Priorité 3 |
|---|---|---|---|
| Artisans du BTP | Google Business Profile, PagesJaunes, Houzz | Travaux.com, Habitissimo, Starofservice, Facebook | Qualibat et RGE (annuaires de labels), Yelp, Mappy |
| Restauration | Google Business Profile, TripAdvisor, TheFork | Yelp, Facebook, Instagram, Uber Eats / Deliveroo si livraison | Guide Michelin et Gault&Millau si éligible, blogs gastronomiques locaux |
| Santé et bien-être non médical | Google Business Profile, Doctolib / Maiia (si éligible), PagesJaunes | Planity, Resalib, Mon Spa, annuaires de fédérations (sophrologie, naturopathie, yoga) | Facebook, Instagram, Yelp |
| Immobilier | Google Business Profile, SeLoger, Leboncoin Immobilier | Logic-Immo, Bien'ici, PagesJaunes, avis Google des clients vendeurs | Trustpilot, annuaires FNAIM / UNIT / Orpi (selon réseau) |
| Beauté | Google Business Profile, Planity, Treatwell | Instagram, Facebook, Yelp, PagesJaunes | Fresha, Booksy, Pinterest |
| Juridique et comptable | Google Business Profile, annuaires d'ordres (barreau, Ordre des experts-comptables), Doctrine / Justifit selon activité | PagesJaunes, LinkedIn, Trustpilot | Avocat.fr, annuaires de CCI et centres de gestion |

Précautions : vérifier la déontologie (avis et publicité pour avocats, santé), ne pas payer d'abonnement avant d'avoir mesuré, ne pas s'inscrire à plus de 8 à 10 annuaires au total (Ahrefs FR recommande de se concentrer sur quelques niveaux de confiance plutôt que sur des centaines).

## 5. Exemple de plan complet : Plomberie Martin

**Fiche client (cas fictif, données illustratives)** : Plomberie Martin, plombier, Paris 11e, score 18/100. Sous-scores : ChatGPT 12, Perplexity 15, Gemini 28. Taux de mention : 0,08. Concurrent le plus cité : 6 mentions. Site existant (WordPress), sans balisage, sans FAQ, sans pages quartier. Questionnaire : fiche Google validée, 14 avis, pas de fiche Bing, PagesJaunes non revendiquée, page Facebook inexistante, adresse écrite de deux façons.

**Actions déclenchées (14 sur 35)** : A02, A03, A04, A07, A09, A10, A11, A14, A15, A16, A17, A18, A23, A24, plus A34 (suivi). Déclenchées mais reportées par la règle de sélection (impact faible ou effort élevé) : A05, A12, A19, A25, A27, A29, A31, A32, A35. Non déclenchées : A01 (fiche déjà validée), A21 (site existant), A13 et A33 (autres métiers), A30 (score inférieur à 60). Les mentions de A27 sont couvertes par A10 pour ce client.

### Vague 1 — Semaine 1 : les fondations (environ 6 h)
1. **A14 — Une seule identité.** Fixer la version de référence : « Plomberie Martin, 12 rue Oberkampf, 75011 Paris, 01 23 45 67 89 » (adresse et téléphone à remplacer). Corriger chaque variante repérée.
2. **A02 — Fiche Google complète.** Catégorie principale « Plombier » ; secondaires « Chauffagiste », « Service de dépannage ». Services : fuite, débouchage, chauffe-eau, remplacement de robinetterie, salle de bains. Zone : 75011, 75010, 75012, 75003. Description : « Plomberie Martin, plombier à Paris 11e depuis 2008. Dépannage d'urgence, chauffe-eau, salle de bains. Devis gratuit. ». Ajouter 10 photos de chantiers.
3. **A07 — Bing Places** par import depuis Google, puis Bing Webmaster Tools.
4. **A09 — PagesJaunes** : revendiquer et compléter la fiche gratuite.
5. **A11 — Page Facebook** avec les mêmes informations.

### Vague 2 — Semaines 2 et 3 : preuves et contenu (environ 10 h)
6. **A03 — Campagne d'avis.** Objectif : passer de 14 à 24 avis en 30 jours. SMS type, envoyé à tous les clients : « Bonjour, merci de nous avoir fait confiance. Votre avis sur Google, quel qu'il soit, nous aide : [lien]. Merci, Plomberie Martin ». QR code sur chaque facture.
7. **A04 — Avis spontanés** : même demande à tous les clients, formulation neutre (« partagez votre expérience, qu'elle soit bonne ou moins bonne »), sans question orientée ni mot-clé.
8. **A16 — FAQ** sur le site : 10 questions (« Combien coûte un dépannage fuite à Paris ? », « Intervenez-vous le dimanche ? », « Quelle est votre zone ? »), réponses de 2 à 4 phrases avec fourchettes de prix réelles.
9. **A17 — Pages services** : dépannage fuite, chauffe-eau, débouchage, salle de bains (4 pages).
10. **A15 — Balisage LocalBusiness** (type `Plumber`) avec adresse, horaires, zone et liens vers les profils.

### Vague 3 — Mois 2 : notoriété externe (environ 8 h étalées)
11. **A18 — Pages quartier** : 3 pages (11e, 10e, 12e) avec rues et exemples d'interventions réelles, sans texte dupliqué.
12. **A10 — Annuaires BTP** : Houzz, Travaux.com, Habitissimo (profils gratuits).
13. **A23 — Mentions locales** : écrire à la mairie d'arrondissement, aux journaux de quartier et à l'association de commerçants du 11e.
14. **A24 — Listes « meilleur plombier Paris 11e »** : repérer les 3 listes où figurent les concurrents et demander l'ajout avec preuves.
15. **A34 — Nouvel audit** à J+30 et J+60 sur les mêmes requêtes.

### Résultat attendu (honnête)
Aucun gain de score n'est garanti : les IA varient d'un jour à l'autre et nos sources sont des corrélations. À J+30, les indicateurs de travail à suivre sont : nombre d'avis Google (cible 24), fiches Bing/PagesJaunes/Facebook en place, cohérence des coordonnées, pages publiées. À J+60, comparer score, taux de mention et nombre de concurrents cités. Hypothèse de travail, pas promesse : passer de 18 à une fourchette de 30 à 45.

## 6. Sources

Consultées lors de cette recherche (novembre 2026). Les chiffres viennent des sites cités ; plusieurs sont des études de fournisseurs d'outils.

- Whitespark, « Want to rank in ChatGPT? Focus on these review sites » — https://whitespark.ca/blog/want-to-rank-in-chatgpt-focus-on-these-review-sites-new-research/
- Insites (A. Waite), « What AI uses to choose local businesses and what it ignores », 5 mai 2026 — https://insites.com/blog/what-ai-uses-to-choose-local-businesses-and-what-it-ignores/
- Yext, « AI Visibility in 2025: How Gemini, ChatGPT and Perplexity cite brands » — https://www.yext.com/blog/ai-visibility-in-2025-how-gemini-chatgpt-perplexity-cite-brands
- Near Media, « Bing Places, AIO Love, No Google Killer » — https://www.nearmedia.co/bing-places-aio-love-no-google-killer-wheres-the-decision/
- Search Engine Land, « Does llms.txt matter? » — https://searchengineland.com/does-llms-txt-matter-467740
- Search Engine Land, « Microsoft Bing/Copilot use schema for its LLMs » — https://searchengineland.com/microsoft-bing-copilot-use-schema-for-its-llms-453455
- Semrush, « Most-cited domains in AI search » — https://www.semrush.com/blog/most-cited-domains-ai/
- Local SEO Data, « AI Mode vs Local Pack » (communiqué payé), juin 2026 — https://smb.elizabethton.com/article/Local-SEO-Data-Study-Finds-285percent-of-Local-Pack-Businesses-Are-Invisible-in-Google-AI-Mode/6a299c6d5f1a39366789142f
- Ahrefs FR, « SEO local 2026 : le plan de bataille » — https://ahrefs.com/blog/fr/astuces-seo-local/
- Custplace FR, « Les listes best of experts surpassent… » (titre seul, page non lue) — https://fr.custplace.com/business/les-listes-best-of-experts-surpassent-les-autres-citations-locales-dans-la-visibilite-ia/
- Résultats de recherche (titres seulement, non lus en détail) : Joe Youngblood, « Local Ranking Factors in ChatGPT » — https://www.joeyoungblood.com/?p=10877 ; Codeur, « 13 annuaires incontournables pour votre référencement local » — https://www.codeur.com/blog/annuaires-referencement-local/
