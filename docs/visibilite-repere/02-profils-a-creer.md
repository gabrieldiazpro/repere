# Profils à créer — liste priorisée (à faire par le fondateur)

Agent GEO-MARQUE, 15 nov. 2026. Textes : 01-textes-identite.md (copier sans modifier). Chaque profil créé → ajouter son
URL dans la variable **NEXT_PUBLIC_SAME_AS** (séparées par des virgules) et redéployer ; elle alimente `sameAs` du
JSON-LD Organization (src/lib/seo/site.ts, publié quand ENTITY_READY est vrai). Rien n'est payant ici sauf mention ;
ne souscrire à aucune option payante sans décision.

Légende priorité : **P0** jour de la mise en ligne · **P1** première semaine · **P2** premier mois · **P3** quand les
conditions sont remplies.

| # | Profil | Prio | Éligible ? | Catégorie à choisir | Texte | Notes |
|---|---|---|---|---|---|---|
| 1 | Google Search Console | P0 | Oui | — | — | Vérifier le domaine (DNS), soumettre /sitemap.xml ; activer les rapports. Indispensable : Google dit que l'éligibilité aux fonctions IA passe par l'indexation. |
| 2 | Bing Webmaster Tools | P0 | Oui | — | — | Import depuis Search Console possible ; soumettre le sitemap ; suivre le rapport **AI Performance** (citations dans Copilot). Copilot et une partie de la recherche ChatGPT passent par Bing. |
| 3 | Variables d'entité du site | P0 | — | — | — | NEXT_PUBLIC_FOUNDER_NAME / _BIO / _LINKEDIN, NEXT_PUBLIC_LEGAL_* (voir docs/MISE-EN-LIGNE.md) : sans elles, /a-propos reste en noindex et le JSON-LD n'a ni fondateur ni sameAs. |
| 4 | Page LinkedIn entreprise | P0 | Oui (profil personnel requis) | Logiciels / Services informatiques | courte (slogan), longue (présentation) | Nom exact « Repéré », site repere-ia.fr, logo 512, bannière. Le fondateur met « Fondateur chez Repéré » avec le même texte court dans son titre. |
| 5 | Profil LinkedIn du fondateur | P0 | Oui | — | — | Lien vers la page entreprise ; la même URL dans NEXT_PUBLIC_FOUNDER_LINKEDIN. |
| 6 | annuaire-entreprises.data.gouv.fr, Pappers, Societe.com | P0 (automatique) | Dès l'immatriculation | — | — | Rien à créer ; vérifier que le nom commercial « Repéré » figure (enseigne / nom commercial) pour relier l'entité légale à la marque. La fiche data.gouv est ajoutée d'office au sameAs. |
| 7 | Crunchbase (profil gratuit) | P1 | Oui | Software, SEO, Artificial Intelligence | moyenne + fiche faits | Fondateur relié, date de création, ville. |
| 8 | G2 (profil éditeur gratuit) | P1 | Oui, produit commercialisé | La plus proche disponible au moment de l'inscription (« SEO Software » ; une catégorie GEO / AI visibility si elle existe — à vérifier) | longue + captures | Les avis viendront des clients pilotes (voir 04-communautes.md, § avis). Lire les règles d'avis de G2 avant toute sollicitation. |
| 9 | Capterra / GetApp / Software Advice (Gartner Digital Markets, fiche gratuite via le portail éditeur) | P1 | Oui (conditions à vérifier à l'inscription) | « SEO Software » | longue + captures + fiche faits | Le référencement payant au clic est une option : ne pas l'activer sans décision. Growfusely (juil. 2026) trouve peu de citations IA de Capterra/GetApp : priorité moyenne. |
| 10 | AlternativeTo | P1 | Oui (ajout libre) | SEO / Website Analytics | très courte + longue | Se déclarer « alternative à » Semrush, Peec AI, Otterly.AI **seulement** pour les usages réellement couverts. |
| 11 | Product Hunt | P2 (lancement préparé) | Oui | Marketing, SEO, Artificial Intelligence | très courte (tagline) + longue + vidéo | Préparer 1 jour de lancement ; ne jamais demander de votes (règle Product Hunt) ; répondre à chaque commentaire. |
| 12 | Appvizer | P2 | À vérifier (procédure : help.appvizer.com « How do I reference software on Appvizer? ») | SEO | longue | Appvizer publie aussi « alternative à Semrush » : demander une évaluation factuelle. |
| 13 | La Fabrique du Net (« Inscrire mon logiciel ») | P1 | À vérifier ; la page indique que des positions peuvent être rémunérées | Logiciels GEO **et** Alternatives à Semrush | longue + prix | C'est la source francophone la mieux classée sur « outils GEO ». Fiche gratuite si possible ; **refuser** toute position payée non signalée comme telle. |
| 14 | Tool Advisor | P3 | Non au lancement : annuaire gratuit si 4 critères sur 5 (250 clients, 10 avis vérifiés, 6 mois d'existence, mentions légales, fondateur identifié avec e-mail pro) | Outils de suivi LLM | longue | Revenir quand 4 critères sont vrais. |
| 15 | Codeur.com (comparatif outils GEO) | P2 | À vérifier (formulaire de contact) ; P1 pouvant être sponsorisée | — | fiche faits | Proposer un test, pas un achat de position. |
| 16 | Digitiz, comparateur-ia.com, LeptiDigital (fiches logiciels), logiciels.pro, dixmilleheures.fr | P2 | Procédures non vérifiées | GEO / SEO | fiche faits + captures | Pages classées sur nos requêtes ; contact éditorial, offre d'accès gratuit pour test. |
| 17 | Blog du Modérateur (rubrique Tools) | P2 | Procédure non vérifiée | GEO | fiche faits | Fiche Meteoria existante : demander une fiche équivalente. |
| 18 | YouTube (chaîne de marque) | P2 | Oui | — | moyenne (description) | 3 à 5 vidéos courtes : « vérifier si ChatGPT recommande votre entreprise », démo de l'analyse 60 s, lecture d'une marge d'erreur. Perplexity cite YouTube sur les requêtes logiciels (Growfusely). |
| 19 | Google Business Profile | **Non, sauf local réel** | Google exige un lieu qui reçoit des clients ou une zone de service où l'on se déplace ; bureaux virtuels, boîtes postales et coworking sans accueil sont exclus | — | — | Un SaaS 100 % en ligne n'est pas éligible : ne pas créer de fiche fictive (risque de suspension et incohérence d'entité). Si un bureau accueille réellement des clients avec signalétique et horaires : P2. |
| 20 | Bing Places | Mêmes conditions que la fiche Google (à vérifier) | — | — | — | Ne pas créer sans lieu réel. |
| 21 | Wikidata | **P3** | Règle : élément sur une entité clairement identifiable décrite par des **sources sérieuses et publiques** ; les éléments promotionnels sont supprimés | — | — | Attendre au moins 2 articles indépendants (presse, étude citée). Alors : créer l'élément (instance de : entreprise ; pays ; site officiel ; date de création ; fondateur ; identifiant SIREN) avec les références, sans texte publicitaire, et l'ajouter au sameAs. |
| 22 | Wikipédia | Non | Notoriété encyclopédique + conflit d'intérêts | — | — | Ne jamais rédiger soi-même l'article de sa société. |

## Contrôle de cohérence (à refaire après chaque création)
- Même nom, même domaine, même description courte, même logo, mêmes prix que src/lib/plans.ts.
- Même catégorie principale (« GEO / référencement IA ») puis « SEO ».
- Chaque profil renvoie vers https://repere-ia.fr/ (racine, avec la barre finale) ; le site renvoie vers chaque profil
  (sameAs + pied de page « Nous suivre » quand SITE-SEO-90 l'aura ajouté).
