# 04 — Module Exécution : « on le fait pour vous »

Date de vérification : 9 novembre 2026. Chaque affirmation renvoie à une source (§ 9). Ce qui n'a pas pu être vérifié est
marqué **[non vérifié]**.

## 0. En une page

- **Rien ne part sans validation du client.** Repéré génère, le client valide en 1 clic, Repéré publie (ou le client publie
  lui-même si l'accès n'existe pas encore). Tout est journalisé et réversible.
- **Ce qui marche dès le jour 1, sans approbation Google** : JSON-LD hébergé, page FAQ / pages citables hébergées, kit de
  demande d'avis, brouillons de réponses aux avis, fiches Bing / Apple / PagesJaunes guidées, llms.txt (présenté honnêtement),
  IndexNow sur les pages hébergées.
- **Le goulot est l'API Google Business Profile** : formulaire, examen « sous 14 jours », et surtout une condition : gérer
  une fiche **vérifiée et active depuis 60 jours ou plus** avec un site web. Action immédiate : créer et vérifier la fiche
  Google de Repéré aujourd'hui (accès possible au plus tôt vers mi-janvier 2027).
- **Piège technique majeur** : les robots des IA (GPTBot, ClaudeBot, PerplexityBot…) n'exécutent pas le JavaScript. Un
  JSON-LD injecté par snippet JS est lu par Google, pas par eux. Il faut privilégier l'insertion côté serveur (plugin
  WordPress, app embed Shopify, code personnalisé Webflow, page hébergée).
- **Deux corrections à la bibliothèque V1** (`05-plan-action.md`) : A04 (« avis détaillés service + quartier ») contredit la
  règle Google qui interdit de demander un contenu précis dans les avis ; A15 / A30 doivent préciser la limite du JS et la
  non-lecture de llms.txt.

## 1. Tableau des actions et niveau d'automatisation

Légende : **AUTO** = Repéré publie par API après validation 1 clic ; **SEMI** = Repéré génère, le client valide en 1 clic
puis copie-colle ou active un bouton ; **GUIDÉ** = pas à pas avec captures, vérification ensuite par Repéré.

| # | Action | Jour 1 (sans approbation) | Cible (après accès) | Canal technique | Réf. V1 |
|---|---|---|---|---|---|
| E01 | Description, catégories, horaires, services de la fiche Google | SEMI (texte généré, client colle) | AUTO | Business Information API `locations.patch` (10 modifications/min/fiche) | A02, A29 |
| E02 | Attributs Google (accessibilité, paiements, etc.) | GUIDÉ | AUTO | Business Information API (attributs) | A02 |
| E03 | Posts Google (actualités, offres) | SEMI | AUTO | Local Posts API | A06 |
| E04 | Photos Google | GUIDÉ | AUTO | Media API | A06 |
| E05 | Réponses aux avis Google | SEMI (brouillon, client colle) | AUTO après validation | Reviews API (lecture + réponse) ; notifications Pub/Sub | A05 |
| E06 | Questions-réponses Google | **Supprimé** | — | API Q&A arrêtée le 3 nov. 2025 ; Q&R publiques remplacées par le bouton « Ask » IA (déc. 2025). Reporter le contenu dans la description et la FAQ du site | — |
| E07 | Kit de demande d'avis (lien court, QR, modèles SMS/e-mail, affiche) | AUTO (génération) | AUTO | Lien `g.page/r/…/review` fourni par le client ou lu par API | A03 |
| E08 | Envoi de la demande d'avis après prestation (e-mail, SMS) | SEMI (client importe ou déclenche) | AUTO sur déclencheur (webhook Shopify/Woo, import CSV) | Resend (e-mail) ; SMS via prestataire **[à choisir]** | A03 |
| E09 | Balisage JSON-LD (LocalBusiness / Organization / Product / FAQPage) | AUTO (hébergé) + SEMI (installation) | AUTO | Endpoint Repéré + plugin WP / app Shopify / API Webflow / snippet | A15 |
| E10 | Page FAQ et pages « citables » hébergées | SEMI (client valide le contenu) | SEMI | Sous-domaine du client en CNAME vers Repéré, ou bloc intégré via CMS | A16, A17, A18 |
| E11 | Pages du site du client (services, à propos) | SEMI (texte fourni) | AUTO via CMS (WP REST, Shopify Pages, Webflow CMS) | Connecteurs CMS | A17, A19 |
| E12 | Fiche Bing Places | GUIDÉ (import depuis Google, 10 min) | GUIDÉ | Pas d'API publique pour un outil tiers trouvée | A07 |
| E13 | Apple Business (ex-Business Connect) | GUIDÉ | GUIDÉ (API réservée aux partenaires approuvés) | — | A08 |
| E14 | PagesJaunes / Solocal | GUIDÉ | GUIDÉ ou via agrégateur | Pas d'API publique trouvée | A09 |
| E15 | Annuaires métier (Doctolib, TheFork, plateformes BTP…) | GUIDÉ | GUIDÉ | — | A10, A13, A27, A33 |
| E16 | Cohérence NAP (nom, adresse, téléphone) | AUTO (contrôle) + GUIDÉ (corrections) | idem | Scan des fiches citées par les IA | A14 |
| E17 | robots.txt : autoriser les robots IA | SEMI (fichier généré) | AUTO via plugin WP / Webflow | — | A20 |
| E18 | llms.txt | SEMI (fichier généré) — étiqueté « effet non démontré » | idem | — | A30 |
| E19 | IndexNow | AUTO sur les pages hébergées | AUTO via plugin WP | Clé IndexNow + ping | A22 |
| E20 | Re-mesure après exécution | AUTO | AUTO | Moteur existant | A34 |

## 2. Prérequis et temps d'accès

| Accès | Prérequis | Délai | Statut au 9/11/2026 |
|---|---|---|---|
| **API Google Business Profile** | Projet Google Cloud ; compte Organisation GBP (type agence) ; formulaire « Application for Basic API Access » avec le numéro de projet, envoyé depuis une adresse propriétaire ou gestionnaire de la fiche ; **fiche vérifiée et active depuis 60 jours ou plus** ; site web représentant l'entreprise | Examen « sous 14 jours » ; quota 0 QPM tant que non approuvé, 300 QPM une fois approuvé | **À lancer** : créer la fiche Google de Repéré maintenant. Une fiche d'un client géré compte aussi (la doc le permet). |
| **OAuth Google (vérification de l'application)** | Écran de consentement, politique de confidentialité, domaine vérifié, scope `business.manage` **[niveau de sensibilité du scope non vérifié]** | Plusieurs jours à semaines **[non vérifié]** ; en mode test, 100 utilisateurs maximum | À lancer en parallèle |
| **Accès gestionnaire aux fiches clients** | Le client ajoute Repéré comme **gestionnaire** (Google recommande que les tiers ne soient pas propriétaires) ou passe par OAuth | Immédiat | Jour 1 |
| Bing Places | Compte Microsoft du client ; import depuis Google | 10 à 30 min guidées | Jour 1 |
| Apple Business | Apple ID du client ; vérification | Variable | Jour 1 (guidé) |
| Shopify | App Partner ; distribution « custom » (un seul marchand, sans revue) puis publique (revue App Store) | Custom : immédiat ; App Store : revue **[délai non vérifié]** | Semaine 2 |
| WordPress | Plugin distribué en .zip ; dépôt wordpress.org ensuite (revue manuelle) | Zip : immédiat | Semaine 2 |
| Webflow | App Webflow avec scope « custom code » **[non vérifié en 2026]** | — | Mois 2 |
| Wix | App avec « embedded script » **[non vérifié en 2026]** | — | Plus tard |
| SMS | Prestataire (Brevo, Twilio…) **[non vérifié]**, expéditeur alphanumérique | — | Mois 2 |

## 3. Règles et risques

### 3.1 Google (fiches et avis)
- **Interdit** (politique « Contenus interdits et restreints » de Google Maps, consultée le 9/11/2026) :
  - offrir une contrepartie (paiement, remise, cadeau) en échange d'un avis, ou pour modifier ou retirer un avis négatif ;
  - « décourager ou interdire les avis négatifs, ou solliciter sélectivement les avis positifs » : **pas de filtre** du type
    « Satisfait ? → Google ; pas satisfait → formulaire privé » ;
  - demander au personnel de solliciter un nombre d'avis (quotas) ou **des avis contenant un contenu précis** ;
  - contenus en conflit d'intérêts ; avis publiés depuis plusieurs comptes à la demande d'une seule personne.
  - Historique : la phrase sur la sollicitation sélective avait disparu en août 2022 ; elle figure de nouveau dans la page
    actuelle, sous « Manipulation des notes ».
- **Conséquence pour Repéré** : le kit envoie la **même demande à tous les clients** d'une période (ou d'un fichier),
  sans pré-filtrage par satisfaction. Le texte invite à « raconter votre expérience », sans imposer de mots-clés.
  **Corriger A04** dans la bibliothèque V1.
- **Tiers gérant des fiches** : se mettre gestionnaire, pas propriétaire ; contrôler l'accès au projet Cloud ; ne jamais
  créer de fiche fictive de test (suspension) ; on ne lit que les fiches auxquelles on a accès.
- **Quotas** : 10 modifications par minute et par fiche, non relevable ; Update Location 10 000/jour ; Create Location
  300/jour.
- **Réponses générées par IA** : aucune règle Google spécifique trouvée. Règle Repéré : brouillon IA, validation humaine
  obligatoire, aucune promesse ou donnée personnelle du client final dans la réponse.

### 3.2 Droit français
- **Art. L121-4 du Code de la consommation, 27° et 28°** (en vigueur depuis le 28 mai 2022, ordonnance 2021-1734,
  « Omnibus ») : sont trompeurs en toutes circonstances le fait d'affirmer que des avis viennent de consommateurs sans
  prendre les mesures pour le vérifier, et le fait de **diffuser ou faire diffuser de faux avis** ou de modifier des avis.
- **Sanctions** (selon un avocat, mai 2026, citant L132-2) : 2 ans et 300 000 € ; 5 ans et 750 000 € en ligne ; jusqu'à
  10 % du chiffre d'affaires. La DGCCRF utilise l'outil « Polygraphe » et a contrôlé plus de 1 200 établissements depuis
  juillet 2023 ; amende de 38 000 € en décembre 2023 pour information incomplète sur le traitement des avis.
- **Art. L111-7-2** (et décret 2017-1436) : toute personne qui collecte, modère ou diffuse des avis, même à titre
  accessoire, doit informer de façon loyale, claire et transparente sur leurs modalités (vérification ou non, date, critères
  de classement, motifs de refus). **Si Repéré affiche des avis** sur une page hébergée ou un widget, il faut ces mentions.
  Le plus simple au MVP : ne pas afficher d'avis, seulement un lien vers la fiche Google.
- **Proposition de loi Courtial** (vérification d'achat obligatoire, suppression d'avis négatifs sanctionnée) : non adoptée
  en mai 2026. À surveiller.
- **E-mail et SMS de demande d'avis** : Repéré agit comme **sous-traitant** du client (contrat art. 28 RGPD). Chaque message
  contient l'identité du commerce et un lien de désinscription ; base légale à valider avec un juriste (relation
  contractuelle existante) **[non vérifié ici, voir 06-juridique.md]**.

### 3.3 Contenus et balisage
- **Scaled content abuse** : Google vise les pages générées en masse « sans valeur ajoutée pour les utilisateurs »,
  avec ou sans IA. Google demande de **vérifier manuellement** tout contenu généré, y compris les titres et métadonnées.
- **Garde-fous Repéré** :
  - plafond de pages par client (par exemple 5 pages « service × ville » au MVP) ;
  - chaque page exige au moins un fait propre au client (prix, délai, zone, photo, cas réel) saisi ou validé par lui ;
  - pas de page ville si le client n'y intervient pas réellement ;
  - les comparatifs citent des faits vérifiables et datés, sans dénigrement ;
  - les « études de données » ne publient que des données détenues par le client ou publiques, avec la méthode.
- **Données structurées** : elles doivent décrire le contenu visible de la page (règles générales de Google).
  Depuis août 2023, Google n'affiche plus les résultats enrichis FAQ que pour des sites gouvernementaux ou de santé
  faisant autorité. Le balisage FAQPage reste valide, mais il ne faut pas le vendre comme un levier de visibilité Google.
  Pour les IA, aucune preuve causale ; Microsoft dit utiliser schema.org pour ses LLM (cf. 05-plan-action.md).
- **Domaine du client** : une page hébergée par Repéré sur un sous-domaine du client avec du contenu du client est
  acceptable. Il ne faut jamais y mettre de contenu tiers : ce serait un risque d'abus de réputation du site.

### 3.4 Honnêteté produit
- **llms.txt** (Ahrefs, juin 2026, 137 210 domaines) :
  - 28 % des domaines en publient un ;
  - **97 % de ces fichiers n'ont reçu aucune requête** en mai 2026 ;
  - les robots IA font environ 19,5 % des requêtes, dont GPTBot 4,5 %.
  - Repéré le livre comme option gratuite, étiquetée « effet non démontré ».
- **ChatGPT et Bing** : selon l'étude Peec de septembre 2026, ChatGPT s'appuie sur son propre index et sur plusieurs
  fournisseurs. Pour Google, ce sont des extractions de résultats via des prestataires. Pour le local, Yelp et
  TripAdvisor (sous licence) et des données Google Maps. Bing n'apparaît surtout qu'en Deep Research. Conséquences :
  - la fiche Bing Places reste utile pour **Copilot et Bing**, mais son effet sur ChatGPT n'est pas démontré ;
  - **IndexNow** (Bing, Yandex, Seznam, Naver, Yep ; pas Google) accélère l'indexation Bing et Copilot. Pour ChatGPT,
    l'effet est au mieux indirect. Le coût est quasi nul, donc on l'active, sans promesse.
- **Bing Places** : nouvelle version lancée en octobre 2025, avec un import depuis Google amélioré et des outils
  multi-établissements. Elle annonce un « support agences et partenaires » à venir, sans API publique documentée trouvée.

## 4. Déployer le balisage et les pages sans développeur

| Méthode | Lu par Google | Lu par les robots IA (sans JS) | Effort client | Recommandation |
|---|---|---|---|---|
| Snippet `<script src="https://cdn.repere.fr/ld/{id}.js">` qui injecte le JSON-LD | Oui (Google exécute le JS) | **Non** | Coller 1 ligne | Uniquement en secours |
| Bloc `<script type="application/ld+json">` statique à coller (généré par Repéré) | Oui | Oui | Coller 1 bloc ; à re-coller si les données changent | Jour 1, tous CMS |
| **Plugin WordPress** (hook `wp_head`, rendu serveur, synchronisé avec l'API Repéré) | Oui | Oui | Installer le .zip + clé | Semaine 2 |
| **App Shopify, app embed** (`target: head`, Liquid rendu serveur) + metafields pour les données | Oui | Oui | Activer l'app embed (désactivée par défaut ; lien profond `activateAppId`) | Semaine 2-3 |
| Webflow : code personnalisé via API (scripts enregistrés) **[non vérifié]** | Oui | Oui | Autoriser l'app | Mois 2 |
| Wix : script intégré via app **[non vérifié]** | Oui | À tester | Installer l'app | Plus tard |
| **Page hébergée** sur `faq.client.fr` (CNAME vers Repéré, HTML rendu serveur, JSON-LD inclus, sitemap, IndexNow) | Oui | Oui | 1 enregistrement DNS (guidé) | Jour 1 |
| Fichiers à déposer (robots.txt, llms.txt) | — | — | Envoi FTP ou CMS | Jour 1, guidé |

Types schema.org par parcours :
- **Local** : `LocalBusiness` (ou un sous-type précis) avec NAP, `openingHoursSpecification`, `areaServed`, `sameAs` vers
  les fiches Google, Bing et PagesJaunes.
- **PME / B2B** : `Organization` et `Service`.
- **E-commerce** : `Product` / `Offer` (Shopify en génère souvent déjà : il faut détecter et éviter les doublons).
- **Tous** : `FAQPage` sur les pages FAQ.
- Le JSON-LD ne reprend que ce qui est visible sur la page.

## 5. Annuaires et agrégateurs

| Acteur | API pour Repéré | Coût | Usage |
|---|---|---|---|
| PagesJaunes / Solocal | Pas d'API publique trouvée. Les données PagesJaunes alimentent automatiquement Mappy, Bing, Apple et Yahoo (synchronisation environ 2 semaines, publication sous 2 jours, d'après l'aide Solocal Bridge) | Fiche de base gratuite **[non vérifié]** | GUIDÉ, à prioriser car il diffuse vers d'autres annuaires |
| Partoo, Uberall, Yext (agrégateurs) | API côté plateforme ; Yext et Uberall ont une intégration Apple ; Partoo accepte l'envoi de données d'établissements | Sur devis, par établissement ; **tarifs non vérifiés** (page Partoo inaccessible) | Option phase 4 : revente ou partenariat si la demande multi-établissements existe |
| Annuaires métier | Aucune | — | GUIDÉ : liste par famille de métier (12-verticales.md), fiche pré-remplie à copier, contrôle de la mise en ligne par scan |

**Mode guidé standard** : fiche de données unique (« source de vérité NAP »), textes prêts à coller (courte, moyenne,
longue), liste de contrôle, capture attendue, puis vérification automatique par Repéré à J+7 et J+30.

## 6. Architecture du module

```
Client (app Next.js)                 Supabase                              Workers (cron / file)
 ├─ Connexions ───────────────► connections (provider, scopes, tokens chiffrés, statut, expire_at)
 ├─ Boîte « À valider » ◄─────── tasks (type, cible, payload, diff, statut) ◄── Générateurs (LLM + gabarits)
 │    └─ clic « Valider » ─────► approvals (qui, quand, canal, hash du diff)
 │                                   │
 │                                   ▼
 │                              queue (pgmq ou table + verrou) ──► Exécuteurs par connecteur :
 │                                                                  gbp, bing(guidé), wp, shopify,
 │                                                                  webflow, hosted, indexnow, mail/sms
 └─ Journal ◄───────────────────── task_log (append-only : avant / après, réponse API, opérateur)
                                    hosted_assets (jsonld, pages, versions)  ──► CDN / sous-domaines
```

- **Connecteurs OAuth** :
  - un module par fournisseur, avec `connect()`, `refresh()`, `read()`, `apply(task)`, `rollback(task)` et `verify()` ;
  - tokens chiffrés (pgsodium ou chiffrement applicatif), scopes minimaux, révocation visible par le client.
- **Cycle d'une tâche** : `draft → awaiting_approval → approved → queued → running → done | failed | rolled_back`.
  - Pas de passage à `queued` sans ligne `approvals` dont le hash correspond au diff validé.
  - Toute modification après validation impose une nouvelle validation.
- **Validation 1 clic** :
  - e-mail ou notification avec un lien signé (HMAC, expiration 7 jours, usage unique) ;
  - la page affiche le diff avant/après et trois boutons : « Valider », « Modifier », « Refuser » ;
  - option « valider automatiquement les réponses aux avis 5 étoiles » laissée au client, désactivée par défaut.
- **File** :
  - limitation par fiche (10 modifications/min Google) et par fournisseur ;
  - nouvelle tentative avec attente exponentielle ;
  - file des échecs et alerte.
- **Journal** : append-only, avec instantané avant modification (pour l'annulation) et identifiant de requête API.
  Il est exportable : c'est la preuve du travail fait, réutilisable dans le rapport mensuel.
- **Vérification** : après chaque exécution, relecture par API ou scan. Les modifications Google peuvent rester
  « en attente » de modération : on affiche alors le statut réel, pas « fait ».
- **Événements entrants** : notifications GBP (Pub/Sub) pour les nouveaux avis, qui créent un brouillon de réponse ;
  webhooks Shopify et WooCommerce de commande livrée, qui déclenchent une demande d'avis (si le client l'a activée).
- **Sécurité** :
  - coupe-circuit global et par client ;
  - aucune action sur une fiche sans connexion active ;
  - aucune création de fiche par Repéré (seul le client la crée ou la revendique).

## 7. Ordre d'implémentation (MVP réaliste, fondateur solo)

**Jour 1 (administratif, en parallèle)**
- Créer et vérifier la fiche Google de Repéré, avec site web. Le compteur de 60 jours démarre : candidature API vers le
  9 janvier 2027.
- Créer le projet Google Cloud et le compte Organisation GBP ; préparer la vérification OAuth.
- Alternative plus rapide : faire la candidature avec la fiche vérifiée depuis plus de 60 jours d'un premier client qui a
  nommé Repéré gestionnaire.

**Sprint 1 (semaines 1-2) — tout ce qui ne dépend de personne**
1. `hosted_assets` + endpoint JSON-LD (bloc statique à coller + snippet JS de secours) + validateur interne.
2. Page FAQ hébergée sur sous-domaine (CNAME guidé), rendue côté serveur, sitemap, IndexNow.
3. Kit d'avis : lien court, QR code, affiche PDF, modèles e-mail/SMS neutres (sans filtre), envoi d'e-mails via Resend
   depuis un CSV importé.
4. Brouillons de réponses aux avis : le client colle ses avis, ou Repéré les lit sur la fiche publique.
   Validation, puis copier-coller guidé.
5. Guides : Bing Places (import Google), Apple Business, PagesJaunes, annuaires métier, robots.txt, llms.txt.
6. `tasks` / `approvals` / `task_log` + boîte « À valider » + liens signés.

**Sprint 2 (semaines 3-5) — insertion côté serveur**
7. Plugin WordPress (.zip) : JSON-LD, robots.txt, llms.txt, IndexNow, création de pages en brouillon WP.
8. App Shopify en distribution custom : app embed `head` + metafields, puis webhook commande, qui déclenche une demande
   d'avis.
9. Re-scan automatique J+7 / J+30 des actions guidées (NAP, présence annuaire).

**Sprint 3 (après approbation Google, environ mi-janvier à février 2027)**
10. Connecteur GBP : lecture de la fiche et des avis, puis publication des réponses validées, puis posts, puis description,
    horaires et attributs, puis photos.
11. Notifications Pub/Sub pour les nouveaux avis.

**Plus tard** : Webflow, Wix, SMS, partenariat avec un agrégateur, app Shopify publique, plugin sur wordpress.org.

## 8. Ce qu'on dit au client (cadre commercial)

- « Nous préparons, vous validez, nous publions. » Aucune promesse de citation par les IA ni de position.
- Les avis : « Nous vous aidons à demander un avis à tous vos clients. Nous n'écrivons jamais d'avis et ne filtrons pas
  les mécontents. »
- Les actions guidées sont comptées comme faites seulement après vérification par Repéré.

## 9. Sources (consultées le 9 novembre 2026)

**Google Business Profile**
- Prérequis d'accès à l'API : https://developers.google.com/my-business/content/prereqs
- FAQ de l'API (examen sous 14 jours, APIs disponibles, règles pour les tiers) : https://developers.google.com/my-business/content/faq
- Limites d'utilisation : https://developers.google.com/my-business/content/limits
- Arrêt de l'API Q&A (3 nov. 2025) et bouton « Ask » : https://ppc.land/google-quietly-kills-q-a-for-an-ai-button-most-wont-use/
- Politique Google Maps, contenus interdits (faux engagement, manipulation des notes) : https://support.google.com/contributionpolicy/answer/7400114?hl=en
- Retrait temporaire de la règle sur la sollicitation sélective (2022) : https://www.seroundtable.com/google-removes-maps-review-gating-policy-34002.html

**Droit français**
- Art. L121-4 Code de la consommation : https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000044563107
- Décret 2017-1436 (L111-7-2) : https://www.legifrance.gouv.fr/jorf/id/JORFARTI000035720943
- Faux avis, état du droit 2026 (avocat) : https://consultation.avocat.fr/blog/etienne-bucher/article-2981104-faux-avis-en-ligne-etat-du-droit-et-des-risques-en-2026.html

**Bing, Apple, ChatGPT**
- Nouveau Bing Places (oct. 2025) : https://www.searchenginejournal.com/microsoft-launches-new-bing-places-for-business/557520/
- Fournisseurs de ChatGPT search (Peec, sept. 2026) : https://docs.peec.ai/research/chatgpt-search-result-providers
- Apple Business Connect devenu Apple Business : https://support.apple.com/guide/apple-business-connect/abcb36ef9f27/web
- Partenaires API Apple Business Connect : https://localise.co.uk/apple-business-connect/

**Contenus, llms.txt, robots IA**
- Contenu généré par IA et scaled content abuse : https://developers.google.com/search/docs/fundamentals/using-gen-ai-content
- Politiques anti-spam (mars 2024) : https://developers.google.com/search/blog/2024/03/core-update-spam-policies
- llms.txt, 97 % jamais lus (Ahrefs, juin 2026) : https://ahrefs.com/blog/llmstxt-study/
- Les robots IA n'exécutent pas le JS (Vercel) : https://vercel.com/blog/the-rise-of-the-ai-crawler

**CMS et annuaires**
- Shopify, theme app extensions et app embeds : https://shopify.dev/docs/apps/build/online-store/theme-app-extensions/configuration
- Solocal Bridge / PagesJaunes, diffusion vers d'autres annuaires : https://help-bridge.solocal.com/hc/en-us/articles/11272402355228-Pages-Jaunes
- Partoo, envoi de données d'établissements : https://intercom.help/partoo/en/articles/1126880-how-do-i-send-my-establishments-data-to-partoo

**Non vérifié** :
- tarifs Partoo, Uberall et Yext ;
- délai de vérification OAuth et sensibilité du scope `business.manage` ;
- API custom code de Webflow et de Wix en 2026 ;
- délai de revue de l'App Store Shopify ;
- base légale des SMS et e-mails de demande d'avis (à faire valider).
