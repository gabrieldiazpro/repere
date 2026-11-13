/** POST /api/team/accept { token } — accepte une invitation (utilisateur déjà connecté avec l'adresse invitée). */
import { requireSession, toResponse } from '@/lib/auth';
import { acceptInvitation } from '@/lib/auth/claims';
import { COOKIES, cookieOptions } from '@/lib/auth/cookies';
import { assertSameOrigin, json, limit, readJson, str } from '@/lib/auth/http';
import { HttpError } from '@/lib/auth/roles';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MESSAGES = {
  invalid: 'Cette invitation n’est plus valable.',
  expired: 'Cette invitation a expiré. Demandez-en une nouvelle.',
  wrong_email: 'Cette invitation a été envoyée à une autre adresse. Connectez-vous avec l’adresse invitée.',
} as const;

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    await limit(req, 'team-accept', 20);
    const session = await requireSession(req);
    const body = await readJson(req);
    const r = await acceptInvitation(session, str(body.token, 100));
    if (r.outcome !== 'accepted' && r.outcome !== 'already_member') {
      throw new HttpError(r.outcome === 'wrong_email' ? 403 : 410, MESSAGES[r.outcome], r.outcome);
    }
    return json(
      { ok: true, businessId: r.businessId },
      {
        cookies: [
          { name: COOKIES.business, value: r.businessId!, options: cookieOptions(365 * 86_400, { httpOnly: false }) },
          { name: COOKIES.workspace, value: session.userId, options: cookieOptions(12 * 3600) },
        ],
      },
    );
  } catch (e) {
    return toResponse(e, 'api/team/accept');
  }
}
