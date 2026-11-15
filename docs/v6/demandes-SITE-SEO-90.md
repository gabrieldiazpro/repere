
## De WIX (15 nov. 2026)
- src/components/pages/features-data.ts (l. ~258) : « Wix et Bing Places ne sont pas encore connectés : vous recevez un
  fichier et les instructions. » n'est plus exact pour Wix. Proposition : « Wix : titres, descriptions, données
  structurées, redirections, robots.txt et llms.txt appliqués directement (clé API du site) ; textes d'images et FAQ
  guidés pas à pas. Bing Places n'a pas d'API publique : l'agent vous guide (import de la fiche Google). »
- /integrations : même mise à jour si Wix y figure (source : docs/v5/publication.md § Wix).

## De OPS (15 nov. 2026)
1. **/statut** (page publique livrée : src/app/statut/page.tsx) : l'ajouter au sitemap (priorité basse, `changefreq` daily)
   et un lien « État des services » dans le pied de page (colonne Aide / Ressources), à côté de /securite.
2. **Erreurs du navigateur** : dans src/app/layout.tsx, ajouter une fois dans `<body>` :
   `import { ClientErrorReporter } from '@/lib/ops/ClientErrorReporter';` puis `<ClientErrorReporter />`
   (n'affiche rien ; envoie window.onerror / unhandledrejection à POST /api/ops/errors, 5 par page au plus, même origine).
3. **src/app/global-error.tsx** (absent aujourd'hui) : page de secours sobre (« Une erreur est survenue », bouton
   Réessayer → `reset()`), avec `useEffect(() => reportClientError(error, { boundary: 'global' }), [error])`
   (`import { reportClientError } from '@/lib/ops/client'`). Idem dans src/app/not-found.tsx : rien à faire.

## De LANCEMENT (15 nov. 2026)
Pages livrées : `/pilotes` (programme entreprises pilotes + formulaire, `dynamic = 'force-dynamic'` car le compteur de
places lit le store) et `/presse` (kit presse, statique). Logos : `/presse/logo-repere.svg`, `/presse/logo-repere-blanc.svg`,
`/presse/pictogramme-repere.svg`. Rien d'autre à créer : seulement les liens et déclarations ci-dessous.
1. **Menu (src/components/site/nav.ts)** : dans `RESOURCES`, juste avant « À propos » :
   `{ href: "/pilotes", label: "Entreprises pilotes", text: "Repéré se lance : 10 places, 3 mois offerts" },`
   (option, si la place le permet : un lien discret « Devenir pilote » dans l'en-tête à côté de « Voir la démo » pendant le lancement).
2. **Pied de page (src/components/site/Footer.tsx)**, colonne « Repéré », après « À propos » :
   `{ href: "/pilotes", label: "Entreprises pilotes" }`, `{ href: "/presse", label: "Presse" }`.
3. **Sitemap (src/app/sitemap.ts + PAGE_UPDATED dans src/lib/seo/site.ts)** : ajouter `'/pilotes': '2026-11-15'` et
   `'/presse': '2026-11-15'` à PAGE_UPDATED et les deux URL au sitemap (priorité 0.6 pour /pilotes, 0.4 pour /presse).
   Optionnel : `OWN_OG` (src/lib/seo/meta.ts) si vous leur faites une image OG dédiée ; sinon l'image par défaut convient.
4. **llms.txt (src/app/llms.txt/route.ts)**, section « À propos » ou équivalente :
   `link('Programme entreprises pilotes', '/pilotes', '10 places, offre Accompagné offerte 3 mois, mesures J0/J30/J90')`
   et `link('Espace presse', '/presse', 'présentation, chiffres vérifiables de la méthode, logos SVG, captures de la démo')`.
5. **/contact** : le sujet « Presse » existe ; option : sous le formulaire, une ligne « Journalistes : voir l'espace presse » → /presse.
6. Note : l'offre pilote (3 mois d'Accompagné) est une PROPOSITION à valider par le fondateur ; si elle change, seule
   `PILOT_MONTHS` (src/lib/pilots/validate.ts) est à modifier, le texte suit.

## De GEO-MARQUE (15 nov. 2026)
Contexte : nouvelles pages dans mon périmètre (/questions/[slug] ×5, /etudes/pourquoi-les-ia-recommandent-une-marque),
/questions passe à 35 réponses, /glossaire à 53 termes. Kit hors site : docs/visibilite-repere/.
1. **Sitemap** (src/app/sitemap.ts) : ajouter
   `import { TARGET_QUESTIONS, targetQuestionPath } from '@/app/questions/_lib/target-questions';`
   puis `for (const x of TARGET_QUESTIONS) entries.push({ url: abs(targetQuestionPath(x)), lastModified: x.updated });`
   (la nouvelle étude est déjà couverte par la boucle STUDIES).
2. **PAGE_UPDATED** (src/lib/seo/site.ts) : '/questions', '/glossaire', '/etudes' → '2026-11-15'.
3. **llms.txt** : section « Questions clés » avec les 5 pages (libellé = la question ; note = la description de
   TARGET_QUESTIONS) + l'étude « Pourquoi une IA recommande-t-elle une marque ? » ; glossaire « 53 termes », questions « 35 ».
4. **REFERENCE_LINKS** (src/lib/seo/editorial.tsx) : « Glossaire du référencement IA et du SEO (53 termes) » et
   « Les 35 questions que les dirigeants posent sur le référencement SEO et IA » (ou retirer les nombres).
5. **Identité unique** (src/lib/seo/site.ts) — le positionnement V5 est SEO + GEO, mais ONE_LINER/DESCRIPTOR disent
   « référencement IA (GEO) » seul. Proposition, reprise mot pour mot dans tous les profils externes
   (docs/visibilite-repere/01-textes-identite.md) :
   - ONE_LINER : « Repéré est un service français de référencement SEO et IA (GEO) : il analyse un site pour de vrai,
     mesure si Google, ChatGPT, Gemini, Perplexity et Claude recommandent l'entreprise, explique pourquoi ses concurrents
     sont cités et réalise les corrections, validées par le client avant publication. »
   - DESCRIPTOR : « le référencement SEO et IA (GEO) des entreprises françaises »
   - nouvelle constante SHORT_DESCRIPTION (≤ 160) : « Repéré analyse votre site, mesure si Google, ChatGPT, Gemini et
     Perplexity recommandent votre entreprise, et réalise les corrections avec vous. »
   Si accepté, aligner aussi src/lib/house.ts (HOUSE_FACTS.services / prix, encore en V2) — à transmettre à qui le possède.
6. **sameAs** : variables nommées en plus de NEXT_PUBLIC_SAME_AS, fusionnées dans RAW_SAME_AS :
   NEXT_PUBLIC_SAME_AS_LINKEDIN, _CRUNCHBASE, _G2, _CAPTERRA, _PRODUCTHUNT, _ALTERNATIVETO, _YOUTUBE, _WIKIDATA
   (https uniquement, vides ignorées). Suggestion : publier les profils de MARQUE dans sameAs même si ENTITY_READY est
   faux (ce sont des profils publics réels) ; garder SIREN/adresse/fondateur sous ENTITY_READY. À votre arbitrage.
   Pied de page : bloc « Nous suivre » rendu seulement pour les variables remplies.
7. **Pas d'aggregateRating** dans SoftwareApplication tant qu'aucun avis réel vérifiable n'existe (rappel).
8. **Maillage** : /comparatif → /questions/outils-geo-francais et /questions/meilleur-outil-visibilite-ia ;
   /comparatif/semrush et /comparatif/ahrefs → /questions/alternative-semrush-pme ; /analyse et /audit →
   /questions/audit-seo-gratuit et /questions/savoir-si-les-ia-recommandent-mon-entreprise ; /geo et /methode →
   /etudes/pourquoi-les-ia-recommandent-une-marque.
9. **FAQ d'accueil** : ajouter « Repéré est-il un outil GEO français ? » → « Oui. Repéré est un service français de
   référencement SEO et IA (GEO) ; il propose une offre gratuite permanente et des offres dès 29 € par mois. Il ne
   suit pas Google AI Overviews ni AI Mode. » (lien /questions/outils-geo-francais).
10. **Test** src/lib/seo/__tests__/content.test.ts : j'ai mis à jour les seuls compteurs qui portent sur mes pages
    (l. 76-81 : glossaire 36→53, questions 30→35). À valider. Autre échec, hors de mon périmètre : « outils … sont
    listés » attend 9 pages /outils/* et en trouve 20 (nouveaux outils de l'agent OUTILS).
11. **robots.txt** : confirmer que OAI-SearchBot, PerplexityBot, Claude-SearchBot, Claude-User, MistralAI-User,
    Googlebot et Bingbot sont autorisés sur /questions, /etudes, /glossaire (aucun noindex).

## De OUTILS (15 nov. 2026) — 11 outils gratuits ajoutés (registre `TOOLS` : 9 → 20)
Nouvelles pages (déjà dans `TOOLS`, donc lues par menu / pied de page / `v3Routes()` / sitemap / llms.txt sans action) :
/outils/apercu-google, /outils/balises-title-meta, /outils/indexabilite, /outils/redirections, /outils/en-tetes-http,
/outils/validateur-sitemap, /outils/hreflang, /outils/open-graph, /outils/analyse-liens, /outils/lisibilite,
/outils/generateur-robots-txt.
1. **src/lib/seo/routes.ts l. 91** : la note de /outils est périmée. Proposition : « 20 outils SEO et IA gratuits : aperçu
   Google, title et meta, indexabilité, redirections, sitemap, en-têtes HTTP, hreflang, Open Graph, liens, lisibilité,
   robots.txt des IA, JSON-LD, llms.txt, fiche produit, lien d’avis ».
2. **src/lib/seo/__tests__/content.test.ts** (« outils … sont listés ») : attendre `TOOLS.length` (20) au lieu de 9.
3. **Menu** : si le menu « Outils » affiche une sélection fixe, y ajouter en tête « Aperçu dans Google »
   (/outils/apercu-google) et « Google peut-il indexer cette page ? » (/outils/indexabilite) : ce sont les requêtes
   gratuites les plus cherchées chez les leaders (SERP preview, indexability / noindex checker).
4. **llms.txt** : dans « ## Outils gratuits », la description de chaque outil vient de `t.description` (rien à faire) ;
   ajouter en tête de section la phrase : « Outils sans inscription, sans fournisseur de données payant : ils lisent le
   HTML, les en-têtes, le robots.txt et le sitemap d’une page publique avec le robot déclaré RepereBot. »
5. **Endpoints** : POST /outils/api/<outil> (meta, indexabilite, redirections, en-tetes, hreflang, open-graph, liens,
   sitemap). Ne pas les mettre au sitemap ; facultatif : `Disallow: /outils/api/` dans robots.ts (POST seulement, aucun
   contenu à indexer).
6. Déjà traités de votre liste : H1 de /outils/robots-ia raccourci (76 car.) ; saut d’intertitres de /outils/llms-txt
   corrigé (encadré en h2 avant résultat, h3 dans le résultat).
12. Pour info (vitest complet, 15 nov. 01 h 20) : src/components/site/__tests__/v4-site.test.tsx « le hero (V5)… un seul
    appel principal » échoue (2 boutons submit dans le hero au lieu d'un) : accueil, votre périmètre.

## Suivi SITE-SEO-90 (15 nov. 2026)
- WIX : features-data (limite Wix/Bing Places + « Wix » dans les plateformes) fait ; /integrations ne cite pas Wix.
- OPS : /statut au sitemap (PAGE_UPDATED) + pied de page (colonne Produit, après Sécurité) + llms.txt ; ClientErrorReporter
  dans le layout racine ; src/app/global-error.tsx créé (Réessayer → reset(), lien accueil, reportClientError).
- LANCEMENT : 1 (menu Ressources, texte lu dans PILOT_SLOTS / PILOT_MONTHS), 2, 3 (sans `priority`), 4, 5 faits.
- GEO-MARQUE : 1 à 9 et 11 faits (sameAs nommés publiés dès qu'ils sont renseignés ; SIREN/adresse/fondateur restent sous
  ENTITY_READY) ; 10 : voir journal SITE-SEO-90.

## De GUIDES (15 nov. 2026) — 20 guides ajoutés (src/lib/seo/guides-v6.ts, catalogue 13 → 33)
Enregistrés dans `GUIDES` (src/lib/seo/guides.ts : import de `GUIDES_V6` + ajout en fin de tableau) ; /guides et
/guides/[slug] les lisent sans action. Le gabarit actuel suffit pour le texte ; trois évolutions demandées :
1. **Schémas SVG** : `GUIDE_V6_FIGURES` (exporté par guides-v6.ts) = slug → { section, src, alt, caption } pour 5 fichiers
   statiques sous public/guides/v6/*.svg (fond blanc intégré, lisibles en thème sombre). Dans src/app/guides/[slug]/page.tsx,
   sous le h2 de la section `section`, afficher par exemple :
   `<figure className="my-4"><img src={f.src} alt={f.alt} width={720} loading="lazy" className="w-full h-auto rounded-xl" /><figcaption className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>{f.caption}</figcaption></figure>`
   (import `{ GUIDE_V6_FIGURES } from '@/lib/seo/guides-v6'`). Alternative : ajouter `image?: { src; alt; caption }` à
   `GuideSection` — je remplirai alors le champ au lieu de la table.
2. **Liens dans le corps du texte** (souhaitable, pas bloquant) : les guides citent des guides et outils (« notre guide sur
   les robots d’IA », « l’outil de rendu sans JavaScript ») sans pouvoir faire de lien, car `withRefs` ne gère que [n].
   Proposition : reconnaître `[texte](/chemin)` dans `withRefs` (chemins internes uniquement, commençant par « / »),
   rendu en `<Link>`. Mon test valide déjà les routes ; j’ajouterai les liens dès que le rendu existe.
3. **/guides** : 33 guides en une grille unique devient long. Suggestion : regrouper par grappe (SEO local, IA et GEO,
   e-commerce, outils de site/CMS, SEO de fond), ou un filtre. Grappes proposées (slugs V6) :
   - Local : fiche-google-business-profile, pages-ville-sans-doublon, annuaires-locaux-bing-apple
   - IA / GEO : llms-txt-faut-il-en-creer-un, perplexity-sources, bing-copilot-indexnow, apercus-ia-google, contenu-ecrit-avec-ia
   - CMS : seo-wordpress, seo-shopify, seo-wix, seo-prestashop
   - E-commerce : google-merchant-center, seo-images
   - SEO de fond : maillage-interne, seo-b2b-acheteurs, audit-seo-30-minutes, refonte-site-sans-perdre-seo,
     titres-meta-descriptions, liens-entrants-sans-risque
   Penser aussi à la DESCRIPTION de /guides (liste de sujets) et à PAGE_UPDATED['/guides'] → '2026-11-15'.
4. Rendu à vérifier lors de votre passe build (aucun serveur côté GUIDES) : 20 nouvelles pages /guides/<slug>, FAQPage
   présente sur chacune (3 à 5 questions), sitemap et llms.txt si la liste des guides y est générée depuis `GUIDES`.

## De AGENCES (15 nov. 2026) — l'offre Agence est construite côté app
Livré dans l'app (démo : /app?compte=demo-agence) : tableau de bord multi-clients (/app/agence), marque de l'agence
appliquée à tous les clients (rapport mensuel imprimable /app/rapports/mensuel, liens partagés, e-mails programmés),
domaine d'envoi propre après vérification DNS, accès client qui valide les propositions de l'agent (/app/validation),
CSV par client (constats, positions Google, réponses des IA). Droits : `getEntitlements(b).agency` (src/lib/entitlements.ts),
« 20 clients ». **La vente reste en liste d'attente** (api/checkout inchangé : décision du fondateur).
1. **/tarifs** (onglet Agences, src/components/site/PricingExplorer.tsx l. ~373 et PriceTable.tsx l. ~56) : remplacer
   « La marque blanche est en cours de construction » par « Marque blanche, tableau de bord multi-clients, accès client
   et exports CSV sont prêts : voyez-les dans la démo agence. L'offre ouvre prochainement : laissez votre e-mail. » avec
   un lien secondaire « Voir la démo agence » → `/app?compte=demo-agence`. Liste des fonctions de l'offre :
   « Tous vos clients sur une page (scores Google et IA, alertes, validations) », « Rapports à votre nom, logo et couleur,
   envoyés depuis votre domaine », « Votre client valide les corrections, vous les appliquez », « Exports CSV par client ».
2. **FAQ /tarifs** (src/app/tarifs/page.tsx l. ~146) : même mise à jour de la réponse « Je gère des clients… ».
3. **features-data.ts** (l. ~648) « La marque blanche… est réservée aux agences, en liste d'attente » → « réservée à
   l'offre Agence (ouverture prochaine ; démo disponible) ».
4. **/comparatif** (src/app/comparatif/page.tsx l. ~67) : « Notre offre Agence (marque blanche, rapports partagés) est en
   liste d'attente à l'achat » → ajouter « fonctions visibles dans la démo agence ». Faits concurrents vérifiés le 15 nov.
   2026 (pages officielles) dans docs/v6/progress/AGENCES.md § 2 si vous voulez une ligne « agences » au comparatif.
5. **CGV / confidentialité** : à revoir par le juridique avant ouverture (domaine d'envoi de l'agence, client invité
   « valideur ») — hors périmètre, à signaler au fondateur.

## De ROBUSTESSE (15 nov. 2026) — afficher l'état d'accès de l'analyse (`FullAnalysis.access`)
Nouveau champ (src/lib/analysis/access.ts, type `AccessReport`) : `state`, `readable`, `tone` ('ok'|'info'|'warn'|'block'),
`title`, `message`, `howTo: string[]`, `notes: string[]`, `platform?` ({ id, name, confidence, evidence, publishable,
ecommerce?, plugins? }), `pagesRead`, `homeStatus`. Quand `readable` est faux, `scores` vaut null partout, `seo`/`geo` sont
null (modules « non lancé ») et `verdict` donne déjà la vraie raison ; `priorities[0]` est un constat `access.<state>`.
Le rapport s'affiche donc correctement sans rien changer, mais il gagnerait à :
1. src/components/analysis/AnalysisReport.tsx (sous le verdict) : si `a.access && a.access.tone !== 'ok'`, un encadré
   (StatusBadge tone warn/danger selon `tone`) avec `title`, `message`, la liste `howTo` (étapes numérotées) et `notes`
   (liste discrète). Si `!a.access.readable`, masquer les cadrans de score (ils afficheraient « non mesuré ») au profit de
   cet encadré et du bouton « Relancer l'analyse ».
2. Même encadré dans le flux en direct (src/components/analysis/LiveAnalysis.tsx) à la réception de `result`.
3. Plateforme : « Site réalisé avec {platform.name} » dans le bloc « Comment cette analyse a été faite » (avec
   `evidence` au survol), et si `platform.publishable`, « Repéré peut appliquer les corrections sur {name} » vers l'agent.
4. format.ts `partialNotes` : ajouter `...(a.access?.notes ?? [])` (limitation 429, pare-feu partiel, pièges à URL…).
