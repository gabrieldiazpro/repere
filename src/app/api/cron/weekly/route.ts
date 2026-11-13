/**
 * Cron du lundi 7 h 30 (Europe/Paris) : enfile un `digest.send` par commerce (dédoublonné par semaine), puis fait
 * tourner le worker avec le budget restant. Le corps de l'envoi (alertes une fois par audit, digest, e-mail,
 * marquage) est dans src/lib/jobs/handlers.ts (`digest.send`), avec reprises et idempotence.
 * vercel.json déclare 2 horaires UTC (5 h 30 et 6 h 30 le lundi) pour couvrir l'heure d'été et d'hiver : la route
 * n'agit que le lundi à partir de 7 h, heure de Paris. `?force=1` (avec le secret) court-circuite la porte horaire.
 */
import { NextResponse } from 'next/server';
import { listBusinessesForDigest } from '@/lib/db';
import { weekOf } from '@/lib/digest';
import { enqueue, runWorker } from '@/lib/jobs';
import { captureError, withRequest } from '@/lib/log';
import { cronAuthorized } from '../auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Lundi, 7 h ou plus, heure de Paris. */
function isMondayMorningParis(d: Date): boolean {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', weekday: 'short', hour: '2-digit', hour12: false }).formatToParts(d);
  const wd = parts.find((p) => p.type === 'weekday')?.value;
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  return wd === 'Mon' && hour >= 7;
}

export async function GET(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  const url = new URL(req.url);
  const now = new Date();
  if (url.searchParams.get('force') !== '1' && !isMondayMorningParis(now)) {
    return NextResponse.json({ skipped: 'hors créneau (lundi 7 h 30, heure de Paris)', queued: 0 });
  }
  const l = withRequest(req);
  try {
    const week = weekOf(now);
    const businesses = await listBusinessesForDigest();
    let queued = 0;
    for (const b of businesses) {
      await enqueue('digest.send', { businessId: b.id, week }, { businessId: b.id, dedupeKey: `digest.send:${b.id}:${week}` });
      queued++;
    }
    const worker = await runWorker();
    l.info('cron.weekly', { week, queued, processed: worker.processed, dead: worker.dead });
    return NextResponse.json({ week, candidates: businesses.length, queued, worker });
  } catch (e) {
    captureError(e, { event: 'cron.weekly_failed' });
    return NextResponse.json({ error: 'Planification en échec.' }, { status: 500 });
  }
}
