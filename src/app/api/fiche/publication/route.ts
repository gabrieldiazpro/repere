/**
 * POST /api/fiche/publication { businessId, indexable?, embedJsonLd? } — opt-in explicite à l'indexation de la page
 * publique et injection du JSON-LD par l'encart. Administrateur ou propriétaire ; jamais pour un compte démo.
 */
import { NextResponse } from 'next/server';
import { setPublication } from '@/lib/execution/fiche';
import { err, fail, screenDataFor, writer } from '../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { businessId?: unknown; indexable?: unknown; embedJsonLd?: unknown } | null;
  const businessId = typeof body?.businessId === 'string' ? body.businessId : '';
  if (!businessId) return err(400, 'businessId manquant.');
  if (typeof body?.indexable !== 'boolean' && typeof body?.embedJsonLd !== 'boolean') return err(400, 'Rien à changer.');
  const w = await writer(req, businessId, 'admin');
  if (!w.ok) return w.res;
  try {
    const fiche = await setPublication(businessId, { indexable: body!.indexable, embedJsonLd: body!.embedJsonLd });
    return NextResponse.json({ ok: true, ...(await screenDataFor(businessId, fiche)) });
  } catch (e) {
    return fail(e, 'publication');
  }
}
