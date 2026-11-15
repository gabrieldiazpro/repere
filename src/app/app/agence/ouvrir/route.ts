/**
 * GET /app/agence/ouvrir?client=<id>&vers=/app/… — ouvre l'espace d'un client en un clic depuis le portefeuille.
 * Compte réel : contrôle d'accès (adhésion à l'espace) puis cookie de l'espace courant. Démo : bascule de compte démo.
 */
import { NextResponse } from 'next/server';
import { requireBusiness, toResponse } from '@/lib/auth';
import { COOKIES, cookieOptions } from '@/lib/auth/cookies';
import { isDemoBusinessId, segmentForDemoId } from '@/lib/demo-v2';
import { safeTarget } from '@/lib/agency/links';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const u = new URL(req.url);
  const id = u.searchParams.get('client') ?? '';
  const to = new URL(safeTarget(u.searchParams.get('vers')), req.url);
  try {
    if (isDemoBusinessId(id)) {
      const res = NextResponse.redirect(to);
      res.cookies.set(COOKIES.demo, segmentForDemoId(id), cookieOptions(30 * 86_400, { httpOnly: false }));
      return res;
    }
    const { business } = await requireBusiness(req, id);
    const res = NextResponse.redirect(to);
    res.cookies.set(COOKIES.business, business.id, cookieOptions(365 * 86_400, { httpOnly: false }));
    return res;
  } catch (e) {
    return toResponse(e, 'app/agence/ouvrir');
  }
}
