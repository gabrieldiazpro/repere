/**
 * GET /api/fiche/rappels — tâche planifiée (Bearer CRON_SECRET) : rappel « vérifiez votre fiche officielle » dans le
 * centre de notifications, tous les 90 jours (une notification par période, dédoublonnée).
 */
import { NextResponse } from 'next/server';
import { runFicheReminders } from '@/lib/execution/fiche';
import { cronAuthorized } from '../../cron/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  try {
    return NextResponse.json(await runFicheReminders());
  } catch (e) {
    console.error('[api/fiche/rappels]', e);
    return NextResponse.json({ error: 'Rappels en échec.' }, { status: 500 });
  }
}
