/**
 * GET /api/pilote/cron — tâche planifiée quotidienne (Bearer CRON_SECRET) du pilote automatique : met en ligne les
 * contenus dont le délai de relecture de 72 h est passé (sans blocage, mandat toujours actif) et envoie le
 * récapitulatif du lundi (rapport du mois le premier lundi). Idempotent.
 */
import { NextResponse } from 'next/server';
import { sweepAutopilot } from '@/lib/autopilot/runner';
import { cronAuthorized } from '../../cron/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  try {
    return NextResponse.json(await sweepAutopilot());
  } catch (e) {
    console.error('[api/pilote/cron]', e);
    return NextResponse.json({ error: 'Balayage en échec.' }, { status: 500 });
  }
}
