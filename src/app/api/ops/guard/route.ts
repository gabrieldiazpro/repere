/**
 * POST /api/ops/guard — garde-fou de coûts (admin) : action=override (lever la pause pour aujourd'hui) ou
 * action=restore (la rétablir). GET → état. Formulaire de /admin/ops ou JSON.
 */
import { NextResponse } from 'next/server';
import { clearOverride, guardState, isPausedState, opsAuthorized, overrideToday, sameOrigin } from '@/lib/ops';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!opsAuthorized(req)) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  const s = await guardState();
  return NextResponse.json({ ...s, pausedNow: isPausedState(s) }, { headers: { 'cache-control': 'no-store' } });
}

export async function POST(req: Request) {
  if (!opsAuthorized(req) || !sameOrigin(req)) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  const ct = req.headers.get('content-type') ?? '';
  const action = ct.includes('application/json')
    ? String(((await req.json().catch(() => ({}))) as { action?: unknown }).action ?? '')
    : String((await req.formData()).get('action') ?? '');
  if (action === 'override') await overrideToday();
  else if (action === 'restore') await clearOverride();
  else return NextResponse.json({ error: 'Action inconnue.' }, { status: 400 });
  if (!ct.includes('application/json')) return NextResponse.redirect(new URL(`/admin/ops?garde=${action}#couts`, req.url), 303);
  const s = await guardState();
  return NextResponse.json({ ...s, pausedNow: isPausedState(s) });
}
