import { NextResponse } from 'next/server';
import { z } from 'zod';
import { HOUR_MS, getClientIp, rateLimit } from '@/lib/ratelimit';
import { errorResponse, requireBusiness } from '@/lib/growth/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { SITE_URL } from '@/lib/seo/site';
import { BADGE_MAX_AGE_DAYS } from '@/lib/growth/constants';
import { badgeState, embedCode, getBadgeSettings, setBadgeSettings } from '@/lib/growth/badge';
import { latestRealMeasure } from '@/lib/growth/measure';
import { publicPageUrl } from '@/lib/growth/pageUrl';

const Body = z.object({ businessId: z.string().min(1).max(100), enabled: z.boolean(), showScore: z.boolean().optional() });

async function status(businessId: string) {
  const [s, m, page] = await Promise.all([getBadgeSettings(businessId), latestRealMeasure(businessId), publicPageUrl(businessId)]);
  return {
    enabled: s?.enabled ?? false,
    showScore: s?.showScore ?? false,
    measuredAt: m?.measuredAt ?? null,
    state: badgeState(m?.measuredAt),
    maxAgeDays: BADGE_MAX_AGE_DAYS,
    imageUrl: `${SITE_URL}/badge/${encodeURIComponent(businessId)}.svg`,
    /** Null tant que la page publique du commerce n'est pas publiée : pas de lien vers rien. */
    embedHtml: page ? embedCode(businessId, page) : null,
    needsPublicPage: !page,
  };
}

/** GET /api/growth/badge?businessId= — réglages du badge et code d'intégration. */
export async function GET(req: Request) {
  const businessId = new URL(req.url).searchParams.get('businessId') ?? '';
  try {
    await requireBusiness(req, businessId);
    return NextResponse.json({ ok: true, badge: await status(businessId) });
  } catch (e) {
    return errorResponse(e, 'badge');
  }
}

/** POST /api/growth/badge { businessId, enabled, showScore? } */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  const { businessId, enabled, showScore } = parsed.data;
  const rl = await rateLimit('growth-badge', getClientIp(req), 60, HOUR_MS);
  if (!rl.ok) return NextResponse.json({ error: 'Trop de requêtes.' }, { status: 429 });
  try {
    await requireBusiness(req, businessId, { write: true });
    await setBadgeSettings(businessId, { enabled, showScore });
    return NextResponse.json({ ok: true, badge: await status(businessId) });
  } catch (e) {
    return errorResponse(e, 'badge');
  }
}
