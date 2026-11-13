import { NextResponse } from 'next/server';
import { z } from 'zod';
import { HOUR_MS, getClientIp, rateLimit } from '@/lib/ratelimit';
import { errorResponse, requireBusiness } from '@/lib/growth/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { CardError, activeCardForBusiness, cardOgUrl, cardUrl, disableCard, enableCard } from '@/lib/growth/cards';

const Body = z.object({ businessId: z.string().min(1).max(100), auditId: z.string().min(1).max(80), enabled: z.boolean() });

/** GET /api/growth/card?businessId= — carte active du commerce (lien, image), ou null. */
export async function GET(req: Request) {
  const businessId = new URL(req.url).searchParams.get('businessId') ?? '';
  try {
    await requireBusiness(req, businessId);
    const c = await activeCardForBusiness(businessId);
    return NextResponse.json({ ok: true, card: c ? { auditId: c.auditId, url: cardUrl(c.auditId, c.token), imageUrl: cardOgUrl(c.auditId, c.token), createdAt: c.createdAt } : null });
  } catch (e) {
    return errorResponse(e, 'card');
  }
}

/** POST /api/growth/card { businessId, auditId, enabled } — active ou retire le partage de la carte d'un audit. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  const { businessId, auditId, enabled } = parsed.data;
  const rl = await rateLimit('growth-card', getClientIp(req), 60, HOUR_MS);
  if (!rl.ok) return NextResponse.json({ error: 'Trop de requêtes.' }, { status: 429 });
  try {
    await requireBusiness(req, businessId, { write: true });
    if (!enabled) return NextResponse.json({ ok: true, removed: await disableCard(businessId, auditId), card: null });
    const c = await enableCard(businessId, auditId);
    return NextResponse.json({ ok: true, card: { auditId: c.auditId, url: cardUrl(c.auditId, c.token), imageUrl: cardOgUrl(c.auditId, c.token), createdAt: c.createdAt } });
  } catch (e) {
    if (e instanceof CardError) return NextResponse.json({ error: e.message }, { status: e.status });
    return errorResponse(e, 'card');
  }
}
