/**
 * Balayage quotidien SEO-DATA (Authorization: Bearer <CRON_SECRET>) : synchro Search Console, relevés hebdomadaires,
 * collectes en attente. À ajouter à vercel.json / pg_cron (orchestrateur).
 */
import { cronAuthorized } from '@/app/api/cron/auth';
import { captureError } from '@/lib/log';
import { scheduleSeoData } from '@/lib/seodata/jobs';
import { json } from '../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

async function handle(req: Request) {
  if (!cronAuthorized(req)) return json({ error: 'Non autorisé.' }, 401);
  try {
    return json(await scheduleSeoData());
  } catch (e) {
    captureError(e, { event: 'seodata.cron_failed' });
    return json({ error: 'Balayage en échec.' }, 500);
  }
}

export const GET = handle;
export const POST = handle;
