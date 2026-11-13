/**
 * POST|GET /api/local/reminders (cron, `Authorization: Bearer <CRON_SECRET>`) → { ok, data: ReminderRunReport }
 * Envoie les rappels de posts Google dus (notification dans l'app + e-mail au contact du commerce si configuré).
 */
import { cronAuthorized } from '@/app/api/cron/auth';
import { errorResponse } from '@/lib/local/auth';
import { ok } from '@/lib/local/http';
import { processDueReminders } from '@/lib/local/repo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

async function run(req: Request) {
  if (!cronAuthorized(req)) return Response.json({ ok: false, error: 'Non autorisé.' }, { status: 401 });
  try {
    return ok(await processDueReminders());
  } catch (e) {
    return errorResponse(e, 'reminders');
  }
}

export const GET = run;
export const POST = run;
