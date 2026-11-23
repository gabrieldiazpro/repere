/**
 * Fiche officielle — GET /api/fiche?businessId=… (lecture : faits, alertes, encart) ;
 * POST /api/fiche { businessId, text?, services?, certifications?, exceptions?, sameAs?, accept? } (enregistrement :
 * faits marqués « saisis et vérifiés par vous », recopiés dans la fiche Vérité et les faits clés de l'agent de contenu).
 */
import { NextResponse } from 'next/server';
import { saveFiche } from '@/lib/execution/fiche';
import { HOUR_MS, getClientIp, rateLimit } from '@/lib/ratelimit';
import { err, fail, ficheScreenData, reader, screenDataFor, writer } from './_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const businessId = new URL(req.url).searchParams.get('businessId') ?? '';
  const a = await reader(req, businessId);
  if (!a.ok) return a.res;
  try {
    const data = await ficheScreenData(businessId);
    if (!data) return err(404, 'Commerce introuvable.');
    return NextResponse.json(data);
  } catch (e) {
    return fail(e, 'GET');
  }
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== 'object' || Array.isArray(body)) return err(400, 'Requête invalide.');
  const businessId = typeof body.businessId === 'string' ? body.businessId : '';
  const rl = await rateLimit('fiche', getClientIp(req), 120, HOUR_MS);
  if (!rl.ok) return err(429, 'Trop de requêtes.');
  const w = await writer(req, businessId);
  if (!w.ok) return w.res;
  try {
    const { businessId: _omit, ...patch } = body;
    void _omit;
    const { fiche, warnings } = await saveFiche(businessId, patch, w.actor);
    return NextResponse.json({ ok: true, warnings, ...(await screenDataFor(businessId, fiche)) });
  } catch (e) {
    return fail(e, 'POST');
  }
}
