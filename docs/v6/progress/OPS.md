# OPS — journal (V6)

## Inventaire de l'existant (15 nov.)
- Santé : `GET /api/health` (base, env, file ; détail avec Bearer CRON_SECRET), `POST /api/health/csp-report`.
- Journaux : `src/lib/log.ts` (JSON une ligne, masquage, `captureError`, Sentry par HTTP « envelope » sans SDK si SENTRY_DSN).
- Erreurs : aucun stockage interne ; error boundaries seulement sous src/app/app/*/error.tsx (MesureError, AGENCES) ; pas de global-error.
- Démarrage : `src/instrumentation.ts` → `instrumentation-node.ts` (assertEnv + traitants) ; pas d'`onRequestError`.
- Cron : vercel.json (6 crons quotidiens, Hobby) ; worker `/api/cron/worker` (pg_cron chaque minute recommandé, migration 0004).
- File : `src/lib/jobs` (mémoire ou table `jobs`, priorités 1..8, `jobStats`, dead après JOBS_MAX_ATTEMPTS).
- Coûts : seodata.costs (mensuel/compte, USD), barometre.budget (mensuel), copilot.usage (journalier), audits.result.details.estimatedCostEur.
- Store : `src/lib/store.ts` (table `documents` ou `.data/`). Admin : /admin (cookie admin_token = ADMIN_TOKEN), /admin/roi.
- Sauvegarde : scripts/ops/backup.md + .github/workflows/backup.yml (pg_dump chiffré age, option B).
- Stripe webhook : échec = console.error + 500 (pas de captureError).

## Fait
- src/lib/ops : erreurs regroupées par signature (compte, 1re/dernière), capture console.error + `onRequestError`, alertes e-mail 1/h/type (santé, cron, pic d'erreurs, tâches abandonnées, webhook Stripe via API Events, coûts), coûts du jour (compteurs existants), garde-fou (pause des tâches priorité > 3), incidents, contrôle toutes les 5 min.
- Routes : /api/health (public enrichi + HEAD, forme Bearer compatible verifier-prod), /api/health/deep, /api/ops/{errors,tick,incidents,guard} ; pages /admin/ops et /statut ; rapporteur navigateur src/lib/ops/client.ts + ClientErrorReporter.
- Sauvegarde : scripts/ops/sauvegarde.mjs (+ lib, AES-256-GCM/scrypt, vérifier, déchiffrer, restaurer simulé/confirmé). Doc : MISE-EN-LIGNE.md étape 15 (alertes, moniteur gratuit, Sentry UE, sauvegardes, PITR).
- Tests : src/lib/ops (21), src/app/api/ops (13), scripts/ops sauvegarde (5). tsc et eslint verts ; vitest : 5 échecs restants hors périmètre (outils/sitemap en cours chez OUTILS/SITE-SEO-90).
- Modifs minimales hors dossier : instrumentation.ts (+onRequestError), instrumentation-node.ts (installServerCapture), cron/worker (pausableBackend, heartbeat, contrôle après réponse), env.ts (6 variables OPS + avertissement ALERT_EMAIL mal formée), .env.example (section Supervision), check-env (BACKUP_PASSPHRASE script seul).
## En cours
- (rien)
## Reste
- Purge des compteurs `ops.errcount` / `ops.alertlog` anciens (petits documents, non urgent). Captures d'écran non faites.
## À faire par d'autres
- SITE-SEO-90 : /statut au sitemap et au pied de page, `<ClientErrorReporter />` dans layout, global-error.tsx (demandes-SITE-SEO-90.md).
- AGENCES : `reportClientError` dans MesureError (demandes-AGENCES.md).
- Orchestrateur : lien « Opérations » vers /admin/ops dans src/app/admin/page.tsx (non attribué) ; facultatif : `captureError` dans src/app/api/stripe/webhook/route.ts (déjà capté via console.error) ; `kickWorker` de src/lib/jobs ne passe pas par le garde-fou (maxJobs 3, surtout urgentes).
