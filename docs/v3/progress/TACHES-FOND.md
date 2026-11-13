# Journal TACHES-FOND — TERMINÉ
## Fait
- env.ts (zod, refus prod), log.ts (JSON masqué + Sentry HTTP), @/lib/jobs (mémoire immédiate / Supabase skip locked, timeout, backoff, dead, dédoublonnage), handlers (audit.run, audit.scheduled via getEntitlements, tasks.generate, digest.send, délégations reports/integrations/measure/siteaudit), migration 0004_jobs.sql
- Crons monthly/weekly enfilent ; /api/cron/worker ; /api/jobs/[id] ; /api/health (+csp-report) ; RGPD GET/DELETE /api/account/data
- next.config.ts (CSP appliquée + rapports, HSTS sans preload), vercel.json, CI + backup, scripts/ops, README, .env.example, scripts npm
- Tests : 41 verts (jobs, env/log, RGPD) + tests cron existants verts ; tsc et eslint propres sur le périmètre
## Variables nouvelles
- JOBS_* (7), CSP_REPORT_ONLY, CSP_DISABLE, CSP_REPORT_SAMPLE, LOG_LEVEL, SENTRY_DSN, DEMO_MODE, APP_ENV ; CSP_ENFORCE supprimée (CSP appliquée par défaut)
## À faire par d'autres
- Orchestrateur : créer src/instrumentation.ts (annexe A de scripts/ops/mise-en-production.md) ; si la racine git est /home/claude/auditia, déplacer app/.github à la racine
- COMPTES : webhook + inscription → enqueue('audit.run', {businessId, trigger:'onboarding'}, {businessId, dedupeKey:`audit.run:first:${id}`}) ; db.ts : exposer auditInput dans rowToBusiness, exporter deleteBusiness(id), inclure Découverte dans listBusinessesDueForAudit ; nonce CSP (annexe B) facultatif
- DONNEES : src/lib/notify/platform.ts → réexporter enqueue/registerHandler/JobType depuis @/lib/jobs
- App (vague 2b) : sondage GET /api/jobs/[id] ; Réglages « Mes données » (export, suppression)
