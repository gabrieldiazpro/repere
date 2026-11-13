import { NextResponse } from 'next/server';
import { z } from 'zod';
import { HOUR_MS, getClientIp, rateLimit } from '@/lib/ratelimit';
import { errorResponse, requireBusiness } from '@/lib/growth/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { getEnrollment, setRankingOptIn } from '@/lib/growth/ranking';
import { latestRealMeasure } from '@/lib/growth/measure';

const Body = z.object({ businessId: z.string().min(1).max(100), optIn: z.boolean() });

/** GET /api/growth/ranking?businessId= — état de l'inscription et ce qui serait publié (aperçu). */
export async function GET(req: Request) {
  const businessId = new URL(req.url).searchParams.get('businessId') ?? '';
  try {
    const { business } = await requireBusiness(req, businessId);
    const e = await getEnrollment(businessId);
    return NextResponse.json({
      ok: true,
      optIn: e?.optIn ?? false,
      preview: { name: business.name, trade: business.trade, city: business.city, hasRealMeasure: !!(await latestRealMeasure(businessId)) },
    });
  } catch (err) {
    return errorResponse(err, 'ranking');
  }
}

/** POST /api/growth/ranking { businessId, optIn } — inscription (consentement explicite) ou retrait immédiat. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  const { businessId, optIn } = parsed.data;
  const rl = await rateLimit('growth-ranking', getClientIp(req), 60, HOUR_MS);
  if (!rl.ok) return NextResponse.json({ error: 'Trop de requêtes.' }, { status: 429 });
  try {
    const { business } = await requireBusiness(req, businessId, { write: true, minRole: 'owner' });
    const e = await setRankingOptIn({ id: business.id, name: business.name, trade: business.trade, city: business.city }, optIn);
    return NextResponse.json({ ok: true, optIn: e.optIn });
  } catch (err) {
    return errorResponse(err, 'ranking');
  }
}
