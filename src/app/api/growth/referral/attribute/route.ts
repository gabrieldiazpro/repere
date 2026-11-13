import { NextResponse } from 'next/server';
import { z } from 'zod';
import { HOUR_MS, getClientIp, rateLimit } from '@/lib/ratelimit';
import { errorResponse, requireBusiness } from '@/lib/growth/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { attributeReferral } from '@/lib/growth/referral';

const Body = z.object({ businessId: z.string().min(1).max(100), code: z.string().min(1).max(20) });

/** POST /api/growth/referral/attribute { businessId, code } — rattache le compte filleul (appelé après l'inscription avec ?ref=). */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  const rl = await rateLimit('growth-ref-attr', getClientIp(req), 20, HOUR_MS);
  if (!rl.ok) return NextResponse.json({ error: 'Trop de requêtes.' }, { status: 429 });
  try {
    await requireBusiness(req, parsed.data.businessId, { write: true, minRole: 'owner' });
    const r = await attributeReferral({ code: parsed.data.code, refereeBusinessId: parsed.data.businessId });
    if (!r.ok) return NextResponse.json({ ok: false, reason: r.reason }, { status: r.reason === 'already_referred' ? 409 : 422 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e, 'referral-attribute');
  }
}
