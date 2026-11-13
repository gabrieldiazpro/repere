# Mission TACHES-FOND (journal : docs/v3/progress/TACHES-FOND.md)

## À lire
- docs/v3/10-audit-technique.md : chantiers 4 à 8 (file de tâches, observabilité, RGPD, CI, CSP).
- Code : src/app/api/cron/**, src/app/api/audit/route.ts, src/lib/store.ts, src/lib/email.ts, next.config.ts,
  vercel.json, .env.example, README.md, supabase/schema.sql.

## Périmètre exclusif
src/lib/jobs/**, src/lib/env.ts, src/lib/log.ts, src/app/api/{health,jobs}/**, src/app/api/cron/**,
src/app/api/account/data/**, next.config.ts, vercel.json, .github/**, supabase/migrations/0004_jobs.sql,
scripts/ops/**, README.md, .env.example, package.json (scripts npm uniquement).

## À livrer
1. **@/lib/jobs** : enqueue, registerHandler (contrat). Table `jobs` (migration 0004 : statut, tentatives, run_at,
   dedupe_key, verrou, erreur). Worker appelé par cron (/api/cron/worker ; documente la fréquence selon le plan
   Vercel) : prend N tâches avec verrou (`for update skip locked` via RPC), exécute dans la limite du timeout, relance
   avec backoff, idempotent. Sans base : exécution immédiate en mémoire. GET /api/jobs/[id] (état d'un audit en cours).
2. **Handlers** : `audit.run` (runAudit + sauvegarde), `audit.scheduled` (ré-audits selon la fréquence de l'offre via
   getEntitlements), `tasks.generate`, `digest.send`, `report.scheduled` et `webhook.deliver` (imports dynamiques
   tolérants vers les modules des autres agents). Refonds les crons monthly et weekly : ils ENFILENT des tâches au lieu
   de tout exécuter en ligne.
3. **@/lib/env** : validation zod de toutes les variables au démarrage, message clair, mode démo explicite, refus de
   démarrer en production si un secret obligatoire manque. **@/lib/log** : journal JSON structuré + remontée d'erreurs
   compatible Sentry par HTTP, sans dépendance, si SENTRY_DSN. **/api/health** : base, clés, file.
4. **RGPD** : /api/account/data — GET export JSON complet d'un commerce, DELETE suppression en cascade avec
   confirmation ; protégé par requireBusiness (owner).
5. **next.config.ts** : CSP réellement appliquée (nonce ou hash compatibles Next 15 ; sources : polices locales,
   images data:, Stripe, t.js same-origin), en-têtes de sécurité, X-Robots-Tag conservé.
6. **Exploitation** : .github/workflows/ci.yml (lint, tsc, vitest, build), scripts npm (test, typecheck, check),
   scripts/ops/ (backup.md, seed de démo, checklist de mise en production, check-env.mjs qui compare les variables lues
   dans src à .env.example), README et .env.example complets.
7. **Tests** : file (ordre, reprise, dédoublonnage, idempotence), env, export RGPD.
