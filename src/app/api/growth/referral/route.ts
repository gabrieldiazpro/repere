import { NextResponse } from 'next/server';
import { z } from 'zod';
import { HOUR_MS, getClientIp, rateLimit } from '@/lib/ratelimit';
import { errorResponse, requireBusiness } from '@/lib/growth/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { SITE_URL } from '@/lib/seo/site';
import { getOrCreateCode, referralSummary } from '@/lib/growth/referral';

const Body = z.object({ businessId: z.string().min(1).max(100) });

async function payload(businessId: string) {
  const c = await getOrCreateCode(businessId);
  return { code: c.code, link: `${SITE_URL}/audit?ref=${c.code}`, ...(await referralSummary(businessId)) };
}

/** GET /api/growth/referral?businessId= — code, lien et compteurs du parrain (code créé au premier appel). */
export async function GET(req: Request) {
  const businessId = new URL(req.url).searchParams.get('businessId') ?? '';
  try {
    await requireBusiness(req, businessId, { write: true });
    return NextResponse.json({ ok: true, referral: await payload(businessId) });
  } catch (e) {
    return errorResponse(e, 'referral');
  }
}

/** POST /api/growth/referral { businessId } — crée (ou renvoie) le code de parrainage du compte. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  try {
    await requireBusiness(req, parsed.data.businessId, { write: true });
    return NextResponse.json({ ok: true, referral: await payload(parsed.data.businessId) });
  } catch (e) {
    return errorResponse(e, 'referral');
  }
}
