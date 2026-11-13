# RACCORDS-FINAUX — journal (13 nov. 2026)

## Fait
- Serveurs de dev 4101/4102/4103 arrêtés (mémoire). Base : tsc vert, vitest 120 fichiers verts, eslint 12 erreurs.
- (1) Analyse 60 s : événements `crawl` + `urls[]` (run.ts, types.ts, stream.ts) ; e-mail du rapport (email.ts
  `sendAnalysisReportEmail`, route : type service = liste d'opposition, 3/jour/adresse, ANALYSIS_EMAIL_REPORT=0 coupe) ;
  /inscription lit ?analyse=&site=&nom= → SignupForm envoie `analysis` (claims existants) ; /analyse : JSON-LD Service
  (plus WebApplication), titre 48 car., description 153 car., og:image. modules.ts déjà branché (INTEGRATION-V5).
- (2) next.config.ts : `htmlLimitedBots` = liste Next 15.5 + robots IA/recherche (GPTBot, ClaudeBot, PerplexityBot,
  OAI-SearchBot, Googlebot, bingbot, RepereBot, bot|crawl|spider).
- (3) entitlements : `recrawl` (table unique src/lib/recrawl-rights.ts, reprise par seo/model.ts) ; seoData/publish/analysis
  déjà là. JOB_TYPES, sitemap, llms.txt, contact barometre : déjà faits par INTEGRATION-V5.
- (4) src/lib/publish/agent.ts `runPublishAgent` (brouillons seulement, réglages kinds/frequency/notify, PUBLISH_AGENT_AUTO=0
  coupe) branché après « Relancer l'exploration » (app/seo/actions.ts) et analysis.rerun ; notif type `agent_proposals` ;
  Centre d'actions → ChangeSet réel (`linkTasksToChangeSets`). Tests : publish/__tests__/agent.test.ts.
- (8) eslint : Shell.tsx (hooks avant le return), scripts (disable ciblé) → 0 erreur.

- env : ANALYSIS_EMAIL_REPORT, PUBLISH_AGENT_AUTO (env.ts, .env.example) ; MISE-EN-LIGNE §14 e) agent auto, f) analyse 60 s (ANALYSIS_*, GEO_LLM).
- (5) /app/seo « Ce qui a changé » : titre du constat + avant → après ; position moyenne GSC démo propre à chaque compte
  (moyenne pondérée de ses mots-clés) + test demo-position.test.ts.
- (6) Stripe : PRO_DECLARATION dans la case CGV obligatoire + submit (stripe.ts, commitment.ts) ; metadata pro_declaration
  (+ pro_declared_at horodaté serveur si `pro: true` envoyé à /api/checkout) ; webhook → billing.pro_declarations.
- (7) Concurrents démo : « SOS Plombier Paris 11 » (enseigne générique réelle partout) → « Plombier du Colibri » (mock.ts).
- (8) vitest 122 fichiers / 1 671 tests verts, tsc vert, eslint 0 erreur (45 avertissements).

- (9) Build de production vert du premier coup (copie scratchpad/prod-build, node_modules en lien, mode démo :
  scratchpad/prod-env.sh). `next start -p 4200` lancé ; relance : scratchpad/start-4200.sh (journal rf/start-4200.log).
  Fumée : 118/118 URL du sitemap en 200 ; /analyse 200 ; /app, /app/seo, /app/agent ×3 comptes démo : 307 → 200 ;
  GPTBot, ClaudeBot, PerplexityBot, OAI-SearchBot, bingbot, Googlebot : title + description + canonical dans <head>
  (118/118 pour GPTBot) ; un navigateur garde le flux (métadonnées dans le body sur les pages dynamiques, normal).
- Demandes qa/v4 restantes : déjà traitées (mouvement réduit, PostCSS en test).

## Reste / à décider (fondateur)
- Noms des comptes démo « Plomberie Martin » (plomberie-martin.fr), « Paysia » (paysia.fr), « Maison Sora » (maison-sora.fr) :
  noms plausibles, des homonymes réels peuvent exister ; domaines non vérifiables d'ici (réseau filtré). Proposition :
  domaines en .example dans SEO-DATA/demo-crawl, ou noms plus clairement fictifs (impact : vidéos, demo/index.html, tests).
- Signup : la case « professionnel » de /inscription n'est pas encore envoyée/horodatée côté serveur (Découverte gratuite,
  pas d'abonnement) ; le paiement, lui, porte la preuve.
- Envoyer `pro: true` à /api/checkout seulement depuis un écran qui affiche la case (aujourd'hui : case Stripe obligatoire).

## Décisions (à valider par le fondateur)
- Agent auto : actif par défaut (brouillons seulement, hebdomadaire, notification e-mail) ; PUBLISH_AGENT_AUTO=0 coupe.
- Quotas publication 20/100/200 séries/mois et recrawl 1/sem·60 p, 1/j·300 p, 3/j·1 000 p, 10/j·2 000 p : propositions.
