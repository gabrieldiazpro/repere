import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getActionProgress, setActionProgress } from '@/lib/db';
import { DEMO_READ_ONLY } from '@/lib/demo-v2';
import { canEditBusiness } from '@/lib/auth/compat';
import { HOUR_MS, getClientIp, rateLimit } from '@/lib/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  businessId: z.string().min(1).max(100),
  actionId: z.string().regex(/^[a-z0-9_-]{1,64}$/i),
  done: z.boolean(),
});

/**
 * Accès : `requireBusiness` (@/lib/auth, via le compat V2) — session cookie httpOnly ou Bearer, rôles ;
 * comptes démo lisibles, jamais modifiables côté serveur (l'UI simule l'écriture sur l'appareil).
 */
export async function GET(req: Request) {
  const businessId = new URL(req.url).searchParams.get('businessId');
  if (!businessId) return NextResponse.json({ error: 'businessId manquant.' }, { status: 400 });
  const auth = await canEditBusiness(req, businessId);
  if (!auth.ok) return NextResponse.json({ error: 'Accès refusé.' }, { status: auth.status });
  return NextResponse.json({ progress: await getActionProgress(businessId) });
}

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  const { businessId, actionId, done } = parsed.data;

  const rl = await rateLimit('actions', getClientIp(req), 300, HOUR_MS);
  if (!rl.ok) return NextResponse.json({ error: 'Trop de requêtes.' }, { status: 429 });

  const auth = await canEditBusiness(req, businessId, { write: true });
  if (!auth.ok) return NextResponse.json({ error: auth.demo ? DEMO_READ_ONLY : 'Accès refusé.', demo: auth.demo ?? false }, { status: auth.status });

  try {
    await setActionProgress(businessId, actionId, done);
    return NextResponse.json({ ok: true, progress: await getActionProgress(businessId) });
  } catch (e) {
    console.error('[api/actions]', e);
    return NextResponse.json({ error: 'Enregistrement impossible.' }, { status: 500 });
  }
}
