/**
 * Worker de la file de tâches (src/lib/jobs). Prend les tâches dues avec verrou, les exécute dans la limite du
 * budget (JOBS_WORKER_BUDGET_MS, 240 s par défaut), relance avec backoff, abandonne après JOBS_MAX_ATTEMPTS.
 *
 * Fréquence d'appel :
 * - Vercel Hobby : les crons sont limités à UNE exécution par jour (vercel.json : 13 h 47 UTC). Ajoutez pg_cron +
 *   pg_net (gratuit, chaque minute) : voir supabase/migrations/0004_jobs.sql et scripts/ops/mise-en-production.md.
 * - Vercel Pro : passez le cron de vercel.json à `* * * * *` (ou `*\/5 * * * *`).
 * - Dans tous les cas, les tâches urgentes (premier audit après achat) sont lancées aussitôt via `after()`.
 * GET (Vercel Cron) ou POST (pg_net), `Authorization: Bearer <CRON_SECRET>`.
 * Supervision (OPS V6) : garde-fou de coûts (tâches non urgentes en pause si le plafond du jour est dépassé),
 * dernier passage enregistré (`ops.heartbeat/worker`, lu par /api/health), contrôle des alertes après la réponse.
 */
import { NextResponse } from 'next/server';
import { jobBackend, runWorker } from '@/lib/jobs';
import { afterResponse, pausableBackend, recordHeartbeat, runOpsTick } from '@/lib/ops';
import { captureError, withRequest } from '@/lib/log';
import { cronAuthorized } from '../auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

async function handle(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  const l = withRequest(req);
  try {
    const report = await runWorker({ backend: pausableBackend(jobBackend()) });
    await recordHeartbeat('worker', true, { durationMs: report.durationMs, detail: { processed: report.processed, dead: report.dead } });
    afterResponse(() => runOpsTick());
    l.info('jobs.worker', { processed: report.processed, done: report.done, retried: report.retried, dead: report.dead, durationMs: report.durationMs, stoppedBy: report.stoppedBy });
    return NextResponse.json(report);
  } catch (e) {
    captureError(e, { event: 'jobs.worker_failed' });
    await recordHeartbeat('worker', false);
    return NextResponse.json({ error: 'Worker en échec.' }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
