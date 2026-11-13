/**
 * DELETE /api/account { confirm: "<adresse e-mail du compte>" } — suppression du COMPTE (droit à l'effacement,
 * M7 de qa/v3/securite-v3.md). Les espaces se suppriment d'abord avec DELETE /api/account/data (propriétaire).
 * Refus (409) tant que la personne est la dernière propriétaire d'un espace : elle doit le supprimer ou le transmettre.
 * Effet : adhésions retirées, invitations révoquées par effet de bord des espaces, compte supprimé, adresse ajoutée à
 * la liste d'opposition, cookies de session effacés.
 */
import { requireSession, toResponse } from '@/lib/auth';
import { assertSameOrigin, json, limit, readJson } from '@/lib/auth/http';
import { HttpError } from '@/lib/auth/roles';
import { clearSessionCookies } from '@/lib/auth/session';
import { deleteUserAccount, normEmail } from '@/lib/auth/users';
import { addSuppression, listMembers, listMembershipsForUser, removeMembership } from '@/lib/db';
import { log } from '@/lib/log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(req: Request) {
  try {
    assertSameOrigin(req);
    await limit(req, 'account-delete', 5);
    const session = await requireSession(req);
    const body = await readJson(req);
    if (typeof body.confirm !== 'string' || normEmail(body.confirm) !== normEmail(session.email)) {
      throw new HttpError(400, 'Pour confirmer, saisissez exactement l’adresse e-mail de votre compte. Cette suppression est définitive.');
    }
    const memberships = await listMembershipsForUser(session.userId);
    for (const m of memberships) {
      if (m.role !== 'owner') continue;
      const owners = (await listMembers(m.businessId)).filter((x) => x.role === 'owner' && x.userId !== session.userId);
      if (!owners.length) {
        throw new HttpError(
          409,
          'Vous êtes le dernier propriétaire d’un espace : supprimez ses données (Réglages › Mes données) ou nommez un autre propriétaire, puis revenez.',
          'last_owner',
        );
      }
    }
    for (const m of memberships) await removeMembership(m.businessId, session.userId);
    await deleteUserAccount(session.userId, session.email);
    await addSuppression(session.email, 'account_deleted').catch(() => undefined);
    log.info('rgpd.account_deleted', { memberships: memberships.length });
    return json({ ok: true, message: 'Votre compte a été supprimé. Cette action est définitive.' }, { cookies: clearSessionCookies() });
  } catch (e) {
    return toResponse(e, 'api/account');
  }
}
