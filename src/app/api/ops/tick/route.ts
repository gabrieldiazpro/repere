/**
 * POST|GET /api/ops/tick — contrôle des alertes et du garde-fou de coûts (src/lib/ops/tick.ts).
 * `Authorization: Bearer <CRON_SECRET>` ou admin. `?force=1` ignore l'intervalle minimal de 5 minutes.
 */
import { NextResponse } from 'next/server';
import { captureError } from '@/lib/log';
import { opsAuthorized, runOpsTick } from '@/lib/ops';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function handle(req: Request) {
  if (!opsAuthorized(req)) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  try {
    const force = new URL(req.url).searchParams.get('force') === '1';
    return NextResponse.json(await runOpsTick({ force }), { headers: { 'cache-control': 'no-store' } });
  } catch (e) {
    captureError(e, { event: 'cron.ops_tick_failed' });
    return NextResponse.json({ error: 'Contrôle en échec.' }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
