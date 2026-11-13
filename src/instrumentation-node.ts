/**
 * Démarrage du serveur — partie Node.js (chargée uniquement par le runtime nodejs) (Next 15, `register()` appelé une fois par instance) — scripts/ops/mise-en-production.md, annexe A.
 *
 * 1. Validation des variables d'environnement : lève en production si un secret obligatoire manque (sauf DEMO_MODE=1),
 *    rapport des briques désactivées sinon (src/lib/env.ts).
 * 2. Enregistrement des traitants de tâches des modules qui s'enregistrent eux-mêmes à l'import
 *    (`registerHandler` : webhook.deliver, report.scheduled, measure.action). Le registre est global au processus
 *    (globalThis), donc partagé avec le worker /api/cron/worker et les routes. Les traitants par défaut
 *    (src/lib/jobs/handlers.ts) restent installés au premier passage du worker, sans écraser ceux-ci.
 */
export async function registerNode(): Promise<void> {
  const { assertEnv } = await import('@/lib/env');
  assertEnv();

  const { log } = await import('@/lib/log');
  const modules: [string, () => Promise<unknown>][] = [
    ['integrations', () => import('@/lib/integrations')],
    ['notify/reports', () => import('@/lib/notify/reports')],
    ['measure', () => import('@/lib/measure')],
  ];
  for (const [name, load] of modules) {
    try {
      await load();
    } catch (e) {
      // Une brique en panne ne doit pas empêcher le site de démarrer : la file reprendra ses tâches plus tard.
      log.error('startup.handlers_failed', e, { module: name });
    }
  }
}
