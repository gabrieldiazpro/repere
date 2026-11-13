# Orchestration V4 fin + V5 (tenu par l'orchestrateur) — 13 nov. 2026, 02 h 15

## En cours (mise à jour 13 nov.)
- Vague A V5 : TERMINÉE (7 moteurs livrés). V4 : SITE-PAGES-2 terminé ; APP-FIN en cours (4102).
- Vague B V5 en cours : INTEGRATION-V5 (lib + config), ANALYSE-UI (4101), SITE-POSITIONNEMENT (4101), APP-SEO (4103, copie qa-fn), APP-AGENT (4103).

## Historique
- V4 (design) : SITE-PAGES-2 (dev 4101, qa-site), APP-FIN (dev 4102, qa-app) — relancés après redémarrage.
- V5 vague A (moteurs, brief docs/v5/00-BRIEF-V5.md) : CRAWL, SEO-AUDIT, GEO-OPT, SEO-DATA, PUBLICATION, BAROMETRE, ANALYSE-60S.
Après un redémarrage : sync.sh + dev.sh pour 4101/4102, puis relancer chaque agent avec « reprends depuis ton journal »
(docs/v4/progress/<NOM>.md ou docs/v5/progress/<NOM>.md) et le même périmètre.

## Ensuite
- Vague B V5 (interfaces) : ANALYSE-UI (page publique d'analyse 60 s + rapport, remplace l'entrée de l'audit gratuit),
  APP-SEO (sections SEO de l'app : vue d'ensemble, technique, mots-clés et positions, Search Console, liens, performance),
  APP-AGENT (agent de publication : connexions, propositions, validation, journal, effet), SITE-POSITIONNEMENT (SEO + GEO
  pour tous les sites pros : accueil, fonctionnalités, tarifs à revoir avec le fondateur, comparatifs vs Semrush/Ahrefs/
  Screaming Frog/Peec), + entitlements (limites SEO-DATA par offre), JOB_TYPES, check-env et guide (nouvelles variables).
- Puis : QA fonctionnelle + regard client, vidéos réenregistrées, build, push GitHub gabrieldiazpro/repere (privé, clone
  vide dans /home/claude/repere), démo publiée, archive.

## Décisions fondateur
Mycelo éditeur ; clients pros uniquement ; audit seul = 1 mois Essentiel ; V5 : analyse réelle 60 s + SEO classique complet
+ agent qui publie + baromètres exclusifs + GEO poussé, pour tous les sites pros.
Attente fondateur : SIREN / adresse / forme de Mycelo, TVA ; connexions Supabase/Stripe/Vercel quand il sera sur ordinateur.

## À brancher (notes de fin d'agents)
- ANALYSE-60S : remplacer l'adaptateur provisoire de src/lib/analysis/modules.ts par auditSeo / auditGeo dès qu'ils sont livrés ;
  rattacher les analyses à l'inscription (claims.ts) ; page /analyse/[id] (vague B). Nouvelles variables ANALYSIS_* → check-env + guide.
- CRAWL : livré (fakesites.ts réutilisable pour les tests).
- BAROMETRE : livré, rien publié (aucune mesure réelle). Raccords dans docs/v5/demandes-BAROMETRE.md (sitemap, llms.txt,
  tâche barometre.run, sujet contact). Coût ≈ 96,50 €/mois pour 50 baromètres. Décision fondateur : lancer ou non, budget.
- SITE-PAGES-2 : V4 terminée.
- GEO-OPT : livré (runGeo / auditGeo, rewritePassage, POST /api/v5/geo, docs/v5/geo-methode.md). ANALYSE-60S doit appeler runGeo
  avec le HTML du crawl. Variable GEO_LLM=off.
- SEO-DATA : livré. Raccords : 3 types dans JOB_TYPES, `seoData` dans entitlements (limites par offre proposées dans son
  journal), cron quotidien, page /app/seo (cible du retour OAuth). Variables PAGESPEED_API_KEY, CRUX_API_KEY,
  DATAFORSEO_LOGIN/PASSWORD, SEODATA_EUR_PER_USD → check-env + guide. Coût ≈ 0 à 5 €/client/mois ; liens entrants = 100 $/mois
  de plateforme DataForSEO (décision fondateur).
- PUBLICATION : livré. Raccords : scopes d'écriture Shopify dans l'OAuth existant (src/lib/ecommerce/shopify.ts), page
  /app/agent (vague B), petit plugin WordPress pour exposer les champs Yoast/Rank Math (integrations/wordpress), variables
  PUBLISH_GBP_ENABLED, SHOPIFY_THEME_WRITE → check-env + guide. Wix et Bing Places non faits.
- ANALYSE-UI : livré (/analyse, écran en direct, /analyse/[id]). Raccords (demandes-ANALYSE-60S.md) : envoi de l'e-mail du
  rapport, /inscription?analyse=<id> pour rattacher, plus d'URL de pages dans les événements pour la carte en direct.
- INTEGRATION-V5 : livré. Quotas de publication 20/100/200 par mois = proposition (fondateur). 3 tests + tsc v4-site.test.tsx +
  eslint Shell.tsx à reprendre à la vérification finale.
- SITE-POSITIONNEMENT : livré (accueil, fonctionnalités + 7 pages, local/pme/e-commerce, tarifs, comparatifs Semrush/Ahrefs/
  Screaming Frog, méthode, 5 guides, llms.txt, JSON-LD ; docs/v5/positionnement.md). Auto-score SEO 55→60, GEO 98.
  Raccords (demandes-SITE-POSITIONNEMENT.md) : next.config — Next met meta description + canonical dans le body pour les
  robots non reconnus (robots IA inclus) → à corriger (≈65) ; /analyse : erreur sévère de données structurées (ANALYSE-UI).
- APP-SEO : livré (/app/seo, 7 écrans, démo src/lib/seoaudit/demo-crawl.ts, 5 entrées nav). Raccords : limites de recrawl dans
  entitlements.ts ; position moyenne Search Console démo identique pour les 3 comptes (fournisseur démo SEO-DATA) ; capture
  performance e-commerce manquante.
  Relecture capture : « Ce qui a changé » affiche des lignes vagues (« Balises et contenu : 5 → 6 pages concernées ») → nommer
  le constat précis ; menu latéral qui s'arrête à mi-hauteur sur la capture pleine page (vérifier en vrai).
- APP-FIN (V4) : terminé (bienvenue, admin, en-têtes V4, toast « C'est fait » + Annuler, corrections 390). À reprendre :
  test SITE-PAGES qui attend 10 fonctionnalités (17 maintenant) ; Réglages compte Local en 390 non capturé (OOM serveur).
- APP-AGENT : livré (/app/agent : connexions + assistant, propositions, AVANT/APRÈS, journal, réglages, démo). Raccords
  (progress/APP-AGENT.md « Attendu des autres ») : créer de vrais ChangeSets après chaque analyse en lisant
  publish.agent_settings + notification ; mesure IA liée au ChangeSet ; lien Centre d'actions → ChangeSet réel.
## Vague C : RACCORDS-FINAUX (lancé 13 nov.)
- RACCORDS-FINAUX : terminé (journal docs/v5/progress/RACCORDS-FINAUX.md). tsc / vitest (122 fichiers, 1 671 tests) / eslint (0 erreur)
  verts ; build de production vert ; serveur de production démo sur 4200 (relance : scratchpad/start-4200.sh).
