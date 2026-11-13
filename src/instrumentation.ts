/**
 * Démarrage du serveur (Next 15, `register()` appelé une fois par instance) — scripts/ops/mise-en-production.md, annexe A.
 *
 * 1. Validation des variables d'environnement : lève en production si un secret obligatoire manque (sauf DEMO_MODE=1),
 *    rapport des briques désactivées sinon (src/lib/env.ts).
 * 2. Enregistrement des traitants de tâches des modules qui s'enregistrent eux-mêmes à l'import
 *    (`registerHandler` : webhook.deliver, report.scheduled, measure.action). Le registre est global au processus
 *    (globalThis), donc partagé avec le worker /api/cron/worker et les routes. Les traitants par défaut
 *    (src/lib/jobs/handlers.ts) restent installés au premier passage du worker, sans écraser ceux-ci.
 */
export async function register(): Promise<void> {
  // Forme imposée par Next : l'import doit être DANS la condition pour que la compilation « edge » (middleware)
  // n'embarque pas les modules Node (node:crypto, resend…).
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { registerNode } = await import('./instrumentation-node');
    await registerNode();
  }
}
