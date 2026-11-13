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
 */
import { NextResponse } from 'next/server';
import { runWorker } from '@/lib/jobs';
import { captureError, withRequest } from '@/lib/log';
import { cronAuthorized } from '../auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

async function handle(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  const l = withRequest(req);
  try {
    const report = await runWorker();
    l.info('jobs.worker', { processed: report.processed, done: report.done, retried: report.retried, dead: report.dead, durationMs: report.durationMs, stoppedBy: report.stoppedBy });
    return NextResponse.json(report);
  } catch (e) {
    captureError(e, { event: 'jobs.worker_failed' });
    return NextResponse.json({ error: 'Worker en échec.' }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
