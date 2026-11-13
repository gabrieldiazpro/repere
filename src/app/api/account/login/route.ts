/**
 * POST /api/account/login { email, next?, invitation? } — envoie un lien magique.
 * Réponse identique que le compte existe ou non (pas d'énumération des comptes). Une invitation valide pour cette
 * adresse crée le compte s'il est absent.
 */
import { toResponse } from '@/lib/auth';
import { findInvitationByTokenHash } from '@/lib/db';
import { sha256, type CookieWrite } from '@/lib/auth/cookies';
import { assertSameOrigin, json, limit, readJson, str } from '@/lib/auth/http';
import { startBrowserLogin } from '@/lib/auth/magic';
import { HttpError } from '@/lib/auth/roles';
import { ensureUser, findUser, isEmail, normEmail } from '@/lib/auth/users';
import { authMode } from '@/lib/auth/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    await limit(req, 'auth-login', 10);
    const body = await readJson(req);
    if (!isEmail(body.email)) throw new HttpError(400, 'Cette adresse e-mail semble incomplète. Vérifiez-la, par exemple vous@exemple.fr.');
    if (authMode() === 'off') throw new HttpError(503, 'La connexion est momentanément indisponible.', 'auth_unavailable');
    const email = normEmail(body.email);
    const invitation = str(body.invitation, 100) || null;

    let invite: string | null = null;
    if (invitation) {
      const inv = await findInvitationByTokenHash(sha256(invitation));
      if (inv && !inv.revokedAt && !inv.acceptedAt && new Date(inv.expiresAt).getTime() > Date.now() && inv.email === email) {
        await ensureUser(email);
        invite = invitation;
      }
    }
    const exists = invite ? true : Boolean(await findUser(email));
    let devLink: string | undefined;
    const cookies: CookieWrite[] = [];
    if (exists) {
      const r = await startBrowserLogin(email, { next: str(body.next, 500) || '/app', invite });
      if (!r.ok) {
        console.warn('[auth] envoi du lien impossible', r.error);
        throw new HttpError(502, 'L’envoi n’a pas fonctionné. Réessayez dans un instant.');
      }
      cookies.push(...r.cookies);
      devLink = r.devLink;
    } else if (authMode() === 'local') {
      console.info(`[auth:local] aucun compte pour ${email} : créez-le sur /inscription.`);
    }
    return json({ ok: true, ...(devLink ? { devLink } : {}) }, { cookies });
  } catch (e) {
    return toResponse(e, 'api/account/login');
  }
}
