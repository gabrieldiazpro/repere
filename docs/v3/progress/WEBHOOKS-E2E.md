# WEBHOOKS-E2E — journal (terminé)

**Fait**
- Tests E2E webhooks sortants : src/lib/integrations/__tests__/webhooks-e2e.test.ts (vrai serveur node:http port 0, vraie file mémoire + gestionnaire `webhook.deliver`) : corps exact, en-têtes, HMAC vérifié côté récepteur, anti-rejeu (±5 min), 500→reprises avec backoff 60/120/240/480 s, 5 essais max, abandon journalisé + notifié une fois, 4xx non retenté (sauf 408/425/429), délai dépassé, pas de doublon après réussite, Slack Block Kit, URL interdites en production, chiffrement au repos.
- Correctifs src/lib/integrations/index.ts : abandon immédiat (PermanentJobError) sur 4xx/3xx/adresse refusée/secret illisible ; échec de déchiffrement désormais journalisé et notifié ; `createdAt` figé à la diffusion ; `localhost.` refusé ; URL revalidée à chaque envoi ; en-tête Slack vide/trop long, troncature sans entité coupée ; verrou par commerce sur la config ; option `__allowLocalTargetsForTests` (appel de code uniquement, refusée en production) ; `__skipDnsCheck` inopérant en production.
- Stripe entrant : src/app/api/stripe/__tests__/webhook-e2e.test.ts (événements signés, faux serveur d'API Stripe local). Correctifs route.ts : `invoice.paid` prolonge `currentPeriodEnd` (jamais en arrière) ; une même session traitée deux fois ne crée plus un second commerce (abonnement rebasculé).
- scripts/ops/test-webhook.mjs `<url> [--secret|WEBHOOK_SECRET] [--slack] [--dry-run]` + test scripts/__tests__/test-webhook.test.ts.
- Vérifié : vitest complet 76 fichiers / 1120 tests verts ; tsc sans erreur dans mon périmètre.

**À faire par d'autres** : tsc signale 4 erreurs dans scripts/ops/__tests__/migrations.test.ts (agent migrations en cours : options `all` absentes de la signature de migrate.mjs).
