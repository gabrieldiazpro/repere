/**
 * Démarrage du serveur (Next 15, `register()` appelé une fois par instance) — scripts/ops/mise-en-production.md, annexe A.
 *
 * 1. Validation des variables d'environnement : lève en production si un secret obligatoire manque (sauf DEMO_MODE=1),
 *    rapport des briques désactivées sinon (src/lib/env.ts).
 * 2. Enregistrement des traitants de tâches des modules qui s'enregistrent eux-mêmes à l'import
 *    (`registerHandler` : webhook.deliver, report.scheduled, measure.action). Le registre est global au processus
 *    (globalThis), donc partagé avec le worker /api/cron/worker et les routes. Les traitants par défaut
 *    (src/lib/jobs/handlers.ts) restent installés au premier passage du worker, sans écraser ceux-ci.
 * 3. Supervision (src/lib/ops, agent OPS V6) : observation de console.error vers le stockage interne des erreurs,
 *    et `onRequestError` (erreurs de rendu, d'action serveur et de route) → journal, Sentry si SENTRY_DSN, /admin/ops.
 */
export async function register(): Promise<void> {
  // Forme imposée par Next : l'import doit être DANS la condition pour que la compilation « edge » (middleware)
  // n'embarque pas les modules Node (node:crypto, resend…).
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { registerNode } = await import('./instrumentation-node');
    await registerNode();
  }
}

/** Next 15 : appelé pour chaque erreur levée pendant une requête (runtime nodejs seulement ici). */
export async function onRequestError(
  err: unknown,
  request: { path?: string; method?: string },
  context: { routerKind?: string; routePath?: string; routeType?: string; renderSource?: string },
): Promise<void> {
  // Même forme que register() : import dans la condition, pour que la compilation « edge » n'embarque rien.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { handleRequestError } = await import('@/lib/ops/capture');
      await handleRequestError(err, request, context);
    } catch {
      /* la supervision ne doit jamais aggraver une erreur */
    }
  }
}
