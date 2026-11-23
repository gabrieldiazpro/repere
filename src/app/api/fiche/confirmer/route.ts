/** POST /api/fiche/confirmer { businessId } — « Je confirme que c'est à jour » (prochain rappel dans 90 jours). */
import { NextResponse } from 'next/server';
import { confirmOfficialFiche } from '@/lib/execution/fiche';
import { err, fail, screenDataFor, writer } from '../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { businessId?: unknown } | null;
  const businessId = typeof body?.businessId === 'string' ? body.businessId : '';
  if (!businessId) return err(400, 'businessId manquant.');
  const w = await writer(req, businessId);
  if (!w.ok) return w.res;
  try {
    const fiche = await confirmOfficialFiche(businessId, w.actor);
    return NextResponse.json({ ok: true, ...(await screenDataFor(businessId, fiche)) });
  } catch (e) {
    return fail(e, 'confirmer');
  }
}
