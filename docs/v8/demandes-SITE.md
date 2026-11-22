
## De PUBLICITE (22 nov. 2026)
- Page d'arrivée agences : /agences renvoie 404. Les annonces agences (pub/videos/r6-agences.mp4, pub/visuels/s7-agences.png)
  visent /tarifs en attendant. Souhait : une page /agences (offre Agence 149 €/mois, partenaire 0 €, exécution en marque blanche dès 59 €).
- Pixel Meta / API Conversions : rien n'existe ; à n'ajouter qu'après consentement (bandeau CNIL). Événements souhaités :
  analyse terminée (verdict affiché) = Lead, espace créé = CompleteRegistration. Voir docs/pub/plan-test.md.

## De ECOM (22 nov. 2026)
1. **Plateformes prises en charge, en texte** (pas de logos officiels sans autorisation) sur /e-commerce (et /integrations si
   pertinent) : « Shopify · WooCommerce · PrestaShop · Magento / Adobe Commerce · Wix » en noms texte (pastilles neutres,
   même style que les `reassure` existants). Mettre à jour src/app/e-commerce/page.tsx ligne ~31 (« Pour qui ») et ~68
   (`reassure`) qui ne citent que Shopify, WooCommerce, PrestaShop. Précision honnête à garder près de Magento : « Adobe
   Commerce en mode SaaS : pas encore ; redirections, robots.txt et llms.txt préparés avec un pas à pas ».
2. **Mise en avant du simulateur** /outils/simulateur-boutique sur /e-commerce : un bloc après le héros, titre
   « Que représente la visibilité IA pour votre boutique ? », texte « Entrez vos chiffres : une fourchette basse, médiane
   et haute, chaque hypothèse sourcée et modifiable. Une estimation, pas une promesse. », bouton « Faire la simulation »
   → /outils/simulateur-boutique. Aussi : FAQ « C'est rentable ? » (ligne ~120) → ajouter « Le simulateur gratuit en donne
   une première fourchette à partir de vos chiffres. » avec le lien.
3. Sitemap / llms.txt : la page est dans `TOOLS` (registre des outils) ; si le sitemap ou llms.txt listent les outils à la
   main, ajouter /outils/simulateur-boutique.
4. Menu « Solutions > E-commerce » éventuel : lien « Simulateur pour ma boutique ».
Captures de référence : /home/claude/auditia/qa/v8/ECOM/simulateur-resultat-1440.png et -390.png.

## De TEST-MARQUE (22 nov. 2026)
Contexte : /analyse ouvre désormais sur le test de marque (« Votre marque est-elle citée par les IA ? ») : 3 à 5 vraies
questions de clients posées en direct à chaque IA configurée, tableau cité / place / qui à votre place / phrase / sources,
marge d'erreur, « mesure unique, à confirmer dans le temps », puis « Pourquoi eux » et 3 actions. L'inscription Découverte
est ouverte en libre-service, sans carte bancaire (et fonctionne aussi sur le serveur de démonstration DEMO_MODE=1).
1. **Nouvelle accroche marque** (accueil, héros) : titre « Votre marque est-elle citée par les IA ? » ; sous-titre
   « Nous posons en direct de vraies questions de clients aux IA : vous voyez qui elles citent, à quelle place, qui passe
   devant vous et pourquoi. Puis votre site est analysé page par page. » ; bouton « Tester ma marque » → /analyse
   (garder le champ site existant, il préremplit déjà /analyse?site=). Aucune promesse de résultat.
2. **« Sans carte bancaire »** : sous le bouton du héros, sur /tarifs (colonne Découverte) et dans le menu (lien
   « Créer un compte gratuit » → /inscription) : « Gratuit, sans carte bancaire ». L'inscription est en libre-service :
   remplacer les éventuels « bientôt » / « programme pilote » visant l'inscription par /inscription.
3. **Liste des IA** : ne pas la figer à la main. Lire `brandTestEngines()` (src/lib/analysis/aicheck.ts, côté serveur) :
   `{ demo, engines: [{ id, label }] }` = les IA réellement configurées (toutes celles de MOTEURS-IA : ChatGPT, Gemini,
   Perplexity, Claude, Mistral, DeepSeek, AI Overviews… selon les clés). Affichage en noms texte (pastilles neutres, jamais
   de logos). En démo : « réponses simulées ». Phrase type : « Interrogées en direct : ChatGPT, Gemini, Perplexity… ».
4. Menu / pied de page : libellé du lien vers /analyse → « Test de marque gratuit » (au lieu de « Analyse gratuite »),
   même URL. llms.txt : décrire /analyse comme « test gratuit : votre marque est-elle citée par les IA (questions posées
   en direct, qui est cité à votre place et pourquoi), puis analyse SEO et GEO du site ».
5. Comparatif face à Semji (si une page le fait) : « Audit GEO gratuit » de Semji = cité ou non ; Repéré ajoute la phrase
   exacte, la place, les sources lues, « pourquoi lui » et les actions, avec la marge d'erreur. Sans dénigrement.
Captures : /home/claude/auditia/qa/v8/TEST-MARQUE/.

## De API-PUBLIQUE (22 nov. 2026)
1. **Pied de page** (colonne Ressources ou Produit) : lien « Développeurs (API, MCP) » → /developpeurs.
2. **Menu** : pas d'entrée principale ; si un sous-menu « Ressources » existe, y ajouter « Développeurs » → /developpeurs.
3. **Sitemap** (src/app/sitemap.ts) : ajouter /developpeurs (priorité ~0.5, changefreq monthly).
4. **llms.txt** : ligne « Développeurs : API REST (OpenAPI 3.1 sur /api/public/v1/openapi.json), serveur MCP en lecture
   (/api/mcp), webhooks signés — /developpeurs ».
5. **/tarifs** (offres Accompagné et Agence) : ajouter la ligne « API publique, serveur MCP et webhooks » (incluse en
   Accompagné et Agence, absente en Découverte et Essentiel). FAQ éventuelle : « Puis-je brancher Repéré dans Claude ou
   ChatGPT ? » → « Oui, avec l'offre Accompagné ou Agence : serveur MCP en lecture, clé créée dans Réglages › API. »
6. **/integrations** : bloc « API et MCP » renvoyant vers /developpeurs.
7. **robots.ts** : /api/ est sans doute déjà exclu ; laisser /developpeurs indexable.

## De MOTEURS-IA (22 nov. 2026)
Contexte : le moteur mesure désormais jusqu'à 10 IA, chacune derrière sa variable (désactivée si non configurée, jamais
simulée pour un vrai client). Source unique des noms et méthodes : `PROVIDER_LABELS`, `PROVIDER_SHORT`, `EXTENDED_PROVIDERS`
(src/lib/engine/types.ts) et `providerMethod(id)` / `methodNote(id)` (src/lib/engine/providers/methods.ts). Noms en texte,
pastilles neutres, **jamais de logos**. Ne pas promettre une IA non configurée en production : afficher « en option » tant
que l'orchestrateur n'a pas confirmé les clés (MISE-EN-LIGNE étape 6 bis).
1. **Liste des IA couvertes** (accueil `AiStrip`, /tarifs `PricingExplorer`, /methode, /comparatif) — libellés et mode :
   - ChatGPT — API officielle, avec recherche web
   - Perplexity — API officielle, avec recherche web
   - Gemini — API officielle, sans recherche web (donc sans sources)
   - Claude — API officielle, avec recherche web
   - Mistral Vibe (ex-Le Chat, renommé le 28 mai 2026) — API officielle, avec recherche web, en option
   - Google AI Overviews — relevé sur la page de résultats Google en France (mobile), en option
   - Google AI Mode — relevé sur la page de résultats Google en France, en option
   - Copilot (Bing) — réponse Copilot dans la recherche Bing en France (pas l'application Copilot), en option
   - DeepSeek — API officielle, avec recherche web, en option
   - Grok — API officielle, avec recherche web, sur demande (peu utilisé en France : à ne pas mettre en avant)
   Accroche comparatif (sans nommer de concurrent dans l'accroche) : « Les 7 IA qu'on attend d'un outil sérieux (ChatGPT,
   Gemini, Perplexity, aperçus IA et AI Mode de Google, Claude, DeepSeek), plus Copilot et Mistral Vibe ; avec la marge
   d'erreur de chaque mesure et la méthode affichée pour chaque IA. » Pour /comparatif : Semji annonce 7 IA (ChatGPT, Gemini,
   Perplexity, AI Overviews, AI Mode, Claude, DeepSeek) ; Repéré couvre les mêmes + Copilot (Bing) + Mistral Vibe (+ Grok).
2. **Offres** : plans.ts / entitlements.ts NON modifiés (test plans-engines : « IA annoncées = IA suivies » et « aucune
   offre n'annonce AI Overviews, AI Mode ni Copilot », décision 3 du contrat V3). Les IA en option sont mesurées pour les
   abonnés via l'interrupteur plateforme `AUDIT_PAID_EXTRA_ENGINES`. Tant que le fondateur n'a pas tranché, le site dit
   « en option » sans les compter dans « N IA ». Quand il tranche : ajouter les IA à la ligne « N IA : … » de plans.ts,
   aux listes d'entitlements.ts, et lever le second test. Proposition : AI Overviews + AI Mode (≈ 0,0037 € par réponse)
   dans toutes les offres payantes, où Google pèse le plus pour les commerces locaux.
3. **Textes devenus faux à corriger** (« les aperçus IA de Google ne sont pas mesurés ») :
   src/components/site/AiStrip.tsx l. 17 (« Mistral Le Chat ») et l. 43 ; src/app/llms.txt/route.ts l. 59 ;
   src/app/cgv/page.tsx l. 46 ; src/lib/seo/competitors.ts l. 130 ; src/app/etudes/[slug]/page.tsx l. 257 (étude datée :
   garder, préciser « à la date de l'étude ») ; src/app/methode/V3Sections.tsx l. 38 et src/app/methode/page.tsx l. 44
   (« Mistral (Le Chat) ») ; src/components/site/offer-facts.ts l. 38 (« plus Mistral Le Chat en option ») ;
   src/components/pages/changelog.ts (entrée V8 : « Nouvelles IA : aperçus IA et AI Mode de Google, Copilot, DeepSeek ;
   méthode et marge affichées pour chaque IA ») ; Footer.tsx l. 116 (marques : ajouter Microsoft, DeepSeek, xAI, Mistral AI).
4. **/methode** : section « Comment chaque IA est mesurée » reprenant le tableau de MISE-EN-LIGNE étape 6 bis (API officielle
   vs page de résultats, pays France, langue français, appareil, 2 passages en gratuit / 3 en suivi, marge à 90 % par IA ;
   « une recherche sans aperçu IA est comptée à part, jamais comme un oubli » ; « Copilot = réponse Copilot dans Bing »).

## De AGENT-CONTENU (22 nov. 2026)
1. /tarifs : ligne « Contenus rédigés et publiés pour vous (après votre validation) » — Essentiel 2/mois, Accompagné 6/mois,
   Agence 6/mois par client (proposition en attente de décision du fondateur) ; Découverte : propositions visibles.
2. Fonctionnalités / comparatifs : « On fait le travail, sans ce que Google pénalise » — pages proposées sur preuves (questions où
   les IA citent un concurrent, requêtes Search Console sans page), rédigées avec vos seuls faits, créées en brouillon chez vous,
   mesurées à J+30/J+90 ; mentions à obtenir au lieu d'échange de liens ; jamais d'envoi automatique.
3. .env.example / docs MISE-EN-LIGNE : `CONTENT_WRITER=off` désactive la rédaction IA des contenus (modèles structurés seuls).
