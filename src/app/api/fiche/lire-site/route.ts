/** POST /api/fiche/lire-site { businessId } — relit l'accueil et la page contact du site (RepereBot, robots.txt). */
import { NextResponse } from 'next/server';
import { refreshSiteObservation } from '@/lib/execution/fiche';
import { HOUR_MS, getClientIp, rateLimit } from '@/lib/ratelimit';
import { err, fail, screenDataFor, writer } from '../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { businessId?: unknown } | null;
  const businessId = typeof body?.businessId === 'string' ? body.businessId : '';
  if (!businessId) return err(400, 'businessId manquant.');
  const rl = await rateLimit('fiche-site', getClientIp(req), 12, HOUR_MS);
  if (!rl.ok) return err(429, 'Trop de relectures : réessayez dans une heure.');
  const w = await writer(req, businessId);
  if (!w.ok) return w.res;
  try {
    const fiche = await refreshSiteObservation(businessId);
    return NextResponse.json({ ok: true, ...(await screenDataFor(businessId, fiche)) });
  } catch (e) {
    return fail(e, 'lire-site');
  }
}
